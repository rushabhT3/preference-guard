import {
  constraintField,
  FIELD_LABELS,
  formatFieldValue,
  readField,
} from "./fields";
import type {
  Client,
  ConstraintField,
  HardConstraint,
  Preferences,
  Profile,
} from "./schemas";

export type Outcome = "pass" | "fail" | "unknown";
export type Status = "clear" | "needs_check" | "blocked";
export type Side = "client" | "candidate";

export interface ConstraintResult {
  constraintId: string;
  label: string;
  field: ConstraintField;
  outcome: Outcome;
  actual: string;
  message: string;
}

export interface CandidateEvaluation {
  status: Status;
  results: ConstraintResult[];
}

export interface MutualEvaluation {
  clientSide: CandidateEvaluation;
  /** null when the candidate has no preferences on file. */
  candidateSide: CandidateEvaluation | null;
  status: Status;
}

const STATUS_SEVERITY: Record<Status, number> = {
  clear: 0,
  needs_check: 1,
  blocked: 2,
};

const SIDE_LABELS: Record<Side, string> = {
  client: "Client",
  candidate: "Candidate",
};

type LocationConstraint = Extract<HardConstraint, { kind: "location" }>;

function locationOutcome(
  constraint: LocationConstraint,
  profile: Profile,
): Outcome {
  if (constraint.allowedCities.includes(profile.city)) return "pass";
  if (!constraint.acceptIfOpenToRelocate) return "fail";
  if (profile.openToRelocate === null) return "unknown";
  return profile.openToRelocate ? "pass" : "fail";
}

function knownOutcome<T>(
  value: T | null,
  isAllowed: (known: T) => boolean,
): Outcome {
  if (value === null) return "unknown";
  return isAllowed(value) ? "pass" : "fail";
}

function outcomeOf(constraint: HardConstraint, profile: Profile): Outcome {
  switch (constraint.kind) {
    case "location":
      return locationOutcome(constraint, profile);
    case "range":
      return knownOutcome(
        profile[constraint.field],
        (value) =>
          (constraint.min === undefined || value >= constraint.min) &&
          (constraint.max === undefined || value <= constraint.max),
      );
    case "oneOf":
      return knownOutcome(profile[constraint.field], (value) =>
        constraint.allowed.includes(value),
      );
    case "noneOf":
      return knownOutcome(
        profile[constraint.field],
        (value) => !constraint.disallowed.includes(value),
      );
    case "equals":
      return knownOutcome(
        profile[constraint.field],
        (value) => value === constraint.value,
      );
  }
}

function describeActual(constraint: HardConstraint, profile: Profile): string {
  if (constraint.kind !== "location") {
    return formatFieldValue(
      constraint.field,
      readField(profile, constraint.field),
    );
  }
  const relocation = formatFieldValue("openToRelocate", profile.openToRelocate);
  return `${profile.city}, open to relocate: ${relocation}`;
}

export function evaluateConstraint(
  constraint: HardConstraint,
  profile: Profile,
  side: Side = "client",
): ConstraintResult {
  const field = constraintField(constraint);
  const actual = describeActual(constraint, profile);
  return {
    constraintId: constraint.id,
    label: constraint.label,
    field,
    outcome: outcomeOf(constraint, profile),
    actual,
    message: `${FIELD_LABELS[field]}: ${actual}. ${SIDE_LABELS[side]} rule: ${constraint.label}`,
  };
}

export function evaluateCandidate(
  preferences: Preferences,
  profile: Profile,
  side: Side = "client",
): CandidateEvaluation {
  const results = preferences.hard.map((constraint) =>
    evaluateConstraint(constraint, profile, side),
  );
  const hasFail = results.some((result) => result.outcome === "fail");
  const hasUnknown = results.some((result) => result.outcome === "unknown");
  return {
    status: hasFail ? "blocked" : hasUnknown ? "needs_check" : "clear",
    results,
  };
}

export function worseStatus(a: Status, b: Status): Status {
  return STATUS_SEVERITY[a] >= STATUS_SEVERITY[b] ? a : b;
}

export function compareStatus(a: Status, b: Status): number {
  return STATUS_SEVERITY[a] - STATUS_SEVERITY[b];
}

export function evaluateMutual(
  client: Client,
  candidate: Profile,
): MutualEvaluation {
  const clientSide = evaluateCandidate(client.preferences, candidate, "client");
  const candidateSide = candidate.preferences
    ? evaluateCandidate(candidate.preferences, client, "candidate")
    : null;
  return {
    clientSide,
    candidateSide,
    status: worseStatus(clientSide.status, candidateSide?.status ?? "clear"),
  };
}

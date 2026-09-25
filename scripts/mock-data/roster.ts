import { constraintField } from "@/domain/fields";
import {
  evaluateCandidate,
  evaluateConstraint,
  evaluateMutual,
  type Outcome,
} from "@/domain/rules";
import type {
  Client,
  ConstraintField,
  HardConstraint,
  Profile,
} from "@/domain/schemas";
import type { Rng } from "./prng";
import { ALL_CITIES, VALUES_BY_ACCEPTANCE } from "./vocabulary";

/** field null: every client rule must pass; otherwise that field's rule must reach `outcome`. */
export interface Requirement {
  field: ConstraintField | null;
  outcome: Outcome;
}

type RangeRule = Extract<HardConstraint, { kind: "range" }>;
type ListRule = Extract<HardConstraint, { kind: "oneOf" | "noneOf" }>;
type LocationRule = Extract<HardConstraint, { kind: "location" }>;

const ALL_PASS: Requirement = { field: null, outcome: "pass" };
const IDENTITY_FIELDS: readonly ConstraintField[] = ["religion", "community"];
const NULLABLE_RULE_FIELDS: readonly ConstraintField[] = [
  "smoking",
  "drinking",
  "wantsChildren",
];
const MAX_SHARES_PER_CANDIDATE = 6;
const MIN_CLEAR_IN_POOL = 5;
const MAX_BALANCING_ROUNDS = 5;
const RANGE_SPAN = 10;

const pairKey = (clientId: string, candidateId: string) =>
  `${clientId}|${candidateId}`;

function targetOutcome(
  rule: HardConstraint,
  requirement: Requirement,
): Outcome {
  return constraintField(rule) === requirement.field
    ? requirement.outcome
    : "pass";
}

function rulesMeet(
  rules: readonly HardConstraint[],
  candidate: Profile,
  requirement: Requirement,
): boolean {
  return rules.every(
    (rule) =>
      evaluateConstraint(rule, candidate).outcome ===
      targetOutcome(rule, requirement),
  );
}

function acceptsEachOther(client: Client, candidate: Profile): boolean {
  const ownRules = candidate.preferences
    ? evaluateCandidate(candidate.preferences, client, "candidate").status
    : "clear";
  return candidate.gender !== client.gender && ownRules === "clear";
}

function fits(
  client: Client,
  candidate: Profile,
  requirement: Requirement,
): boolean {
  return (
    acceptsEachOther(client, candidate) &&
    rulesMeet(client.preferences.hard, candidate, requirement)
  );
}

function rangeBounds({ min, max }: RangeRule): [number, number] {
  if (min !== undefined && max !== undefined) return [min, max];
  if (min !== undefined) return [min, min + RANGE_SPAN];
  if (max !== undefined) return [max - RANGE_SPAN, max];
  throw new Error("A range rule needs at least one bound");
}

function rangeValue(rule: RangeRule, target: Outcome, rng: Rng): number {
  const [low, high] = rangeBounds(rule);
  const third = Math.floor((high - low) / 3);
  if (target === "pass") return rng.int(low + third, high - third);
  return rule.max !== undefined ? high + rng.int(2, 5) : low - rng.int(3, 8);
}

function listValue(rule: ListRule, target: Outcome, rng: Rng): string | null {
  if (target === "unknown") return null;
  const values = VALUES_BY_ACCEPTANCE[rule.field] ?? [];
  const isAllowed = (value: string) =>
    rule.kind === "oneOf"
      ? rule.allowed.includes(value)
      : !rule.disallowed.includes(value);
  const value =
    target === "pass"
      ? values.find(isAllowed)
      : rng.pick(values.filter((option) => !isAllowed(option)));
  if (value === undefined) throw new Error(`No passing value for ${rule.id}`);
  return value;
}

function locationPatch(
  rule: LocationRule,
  target: Outcome,
  rng: Rng,
): Partial<Profile> {
  if (target === "pass") {
    return rule.acceptIfOpenToRelocate
      ? { openToRelocate: true }
      : { city: rng.pick(rule.allowedCities) };
  }
  const city = rng.pick(
    ALL_CITIES.filter((name) => !rule.allowedCities.includes(name)),
  );
  if (target === "unknown") return { city, openToRelocate: null };
  return rule.acceptIfOpenToRelocate
    ? { city, openToRelocate: false }
    : { city };
}

export function outcomePatch(
  rule: HardConstraint,
  target: Outcome,
  rng: Rng,
): Partial<Profile> {
  switch (rule.kind) {
    case "range":
      return { [rule.field]: rangeValue(rule, target, rng) };
    case "oneOf":
    case "noneOf": {
      const value = listValue(rule, target, rng);
      return value === "never_married"
        ? { maritalStatus: value, hasChildren: false }
        : { [rule.field]: value };
    }
    case "equals":
      return {
        [rule.field]:
          target === "unknown"
            ? null
            : target === "pass"
              ? rule.value
              : !rule.value,
      };
    case "location":
      return locationPatch(rule, target, rng);
  }
}

function withoutRulesFailing(candidate: Profile, client: Client): Profile {
  if (!candidate.preferences) return candidate;
  const hard = candidate.preferences.hard.filter(
    (rule) => evaluateConstraint(rule, client).outcome === "pass",
  );
  if (hard.length > 0) {
    return { ...candidate, preferences: { ...candidate.preferences, hard } };
  }
  const { preferences: _dropped, ...withoutPreferences } = candidate;
  return withoutPreferences;
}

export class CandidateRoster {
  readonly profiles: Profile[];
  readonly #rng: Rng;
  readonly #frozen = new Set<number>();
  readonly #shareCounts = new Map<string, number>();
  readonly #sharedPairs = new Set<string>();

  constructor(profiles: readonly Profile[], rng: Rng) {
    this.profiles = [...profiles];
    this.#rng = rng;
  }

  cast(client: Client, requirement: Requirement): Profile {
    const candidate =
      this.#reusable(client, requirement) ??
      this.#claimUnused(client, requirement);
    this.#sharedPairs.add(pairKey(client.id, candidate.id));
    this.#shareCounts.set(candidate.id, this.#sharesOf(candidate) + 1);
    return candidate;
  }

  isShared(clientId: string, candidateId: string): boolean {
    return this.#sharedPairs.has(pairKey(clientId, candidateId));
  }

  balancePools(clients: readonly Client[]): void {
    for (let round = 0; round < MAX_BALANCING_ROUNDS; round++) {
      const shortfalls = clients.flatMap((client) =>
        this.#poolShortfalls(client).map((requirement) => ({
          client,
          requirement,
        })),
      );
      if (shortfalls.length === 0) return;
      for (const { client, requirement } of shortfalls)
        this.#claimUnused(client, requirement);
    }
    throw new Error("Could not give every client a healthy unshared pool");
  }

  #sharesOf(candidate: Profile): number {
    return this.#shareCounts.get(candidate.id) ?? 0;
  }

  #reusable(client: Client, requirement: Requirement): Profile | undefined {
    let best: Profile | undefined;
    for (const index of this.#frozen) {
      const candidate = this.profiles[index];
      const isOpen =
        this.#sharesOf(candidate) < MAX_SHARES_PER_CANDIDATE &&
        !this.isShared(client.id, candidate.id);
      const isLessShared =
        !best || this.#sharesOf(candidate) < this.#sharesOf(best);
      if (isOpen && isLessShared && fits(client, candidate, requirement))
        best = candidate;
    }
    return best;
  }

  #claimUnused(client: Client, requirement: Requirement): Profile {
    const identityRules = client.preferences.hard.filter((rule) =>
      IDENTITY_FIELDS.includes(constraintField(rule)),
    );
    const index = this.profiles.findIndex(
      (candidate, position) =>
        !this.#frozen.has(position) &&
        candidate.gender !== client.gender &&
        rulesMeet(identityRules, candidate, requirement),
    );
    if (index < 0) throw new Error(`No unused candidate left for ${client.id}`);
    const fitted = this.#adjust(this.profiles[index], client, requirement);
    if (!fits(client, fitted, requirement))
      throw new Error(`Could not fit ${fitted.id} to ${client.id}`);
    this.profiles[index] = fitted;
    this.#frozen.add(index);
    return fitted;
  }

  #adjust(
    candidate: Profile,
    client: Client,
    requirement: Requirement,
  ): Profile {
    let fitted = candidate;
    for (const rule of client.preferences.hard) {
      const target = targetOutcome(rule, requirement);
      if (evaluateConstraint(rule, fitted).outcome !== target) {
        fitted = { ...fitted, ...outcomePatch(rule, target, this.#rng) };
      }
    }
    return withoutRulesFailing(fitted, client);
  }

  #poolShortfalls(client: Client): Requirement[] {
    const statuses = this.profiles
      .filter(
        (candidate) =>
          candidate.gender !== client.gender &&
          !this.isShared(client.id, candidate.id),
      )
      .map((candidate) => evaluateMutual(client, candidate).status);
    const clearCount = statuses.filter((status) => status === "clear").length;
    const missingClear = Array.from(
      { length: Math.max(0, MIN_CLEAR_IN_POOL - clearCount) },
      () => ALL_PASS,
    );
    if (statuses.includes("needs_check")) return missingClear;
    return [
      ...missingClear,
      { field: nullableRuleField(client), outcome: "unknown" },
    ];
  }
}

function nullableRuleField(client: Client): ConstraintField {
  const field = client.preferences.hard
    .map(constraintField)
    .find((name) => NULLABLE_RULE_FIELDS.includes(name));
  if (!field) throw new Error(`${client.id} has no rule on a nullable field`);
  return field;
}

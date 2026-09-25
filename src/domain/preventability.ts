import { constraintField, FIELD_LABELS, formatFieldValue } from "./fields";
import { evaluateConstraint, type Outcome } from "./rules";
import {
  type BooleanField,
  BooleanFieldSchema,
  type CategoricalField,
  CategoricalFieldSchema,
  type Client,
  type ConstraintField,
  type HardConstraint,
  type Preferences,
  type Profile,
  type RangeField,
  RangeFieldSchema,
  type ReasonCategory,
  type ReasonField,
  type RejectionReason,
} from "./schemas";

export type Verdict =
  | "preventable"
  | "data_gap"
  | "preference_drift"
  | "new_signal"
  | "soft_mismatch"
  | "subjective";

export const VERDICT_PRECEDENCE: readonly Verdict[] = [
  "preventable",
  "data_gap",
  "preference_drift",
  "new_signal",
  "soft_mismatch",
  "subjective",
];

export interface RuleReference {
  id: string;
  label: string;
}

export interface ReasonVerdict {
  reason: RejectionReason;
  verdict: Verdict;
  /** The client's hard rule this verdict rests on, when one covers the field. */
  rule: RuleReference | null;
  explanation: string;
}

export interface PreventabilityResult {
  verdicts: ReasonVerdict[];
  overall: Verdict;
}

const SUBJECTIVE_CATEGORIES: ReadonlySet<ReasonCategory> = new Set([
  "appearance_photos",
  "personality_vibe",
  "timing_availability",
]);

const OUTCOME_VERDICT: Record<Outcome, Verdict> = {
  fail: "preventable",
  unknown: "data_gap",
  pass: "preference_drift",
};

function explain(
  verdict: Verdict,
  field: ConstraintField,
  rule: RuleReference | null,
): string {
  const fieldName = FIELD_LABELS[field].toLowerCase();
  const ruleName = `'${rule?.label}'`;
  switch (verdict) {
    case "preventable":
      return `Blocked by rule ${ruleName}. Preference Guard would have stopped this send.`;
    case "data_gap":
      return `Rule ${ruleName} applies, but the candidate's ${fieldName} was blank. Preference Guard would have asked first.`;
    case "preference_drift":
      return `Rule ${ruleName} allowed this profile, yet the client said no. The rule may need tightening.`;
    case "new_signal":
      return `No stated preference covers ${fieldName}. A new signal to confirm with the client.`;
    case "soft_mismatch":
      return `Only a soft preference covers ${fieldName}. It lowers the ranking but is not a dealbreaker.`;
    case "subjective":
      return "Subjective reason. No rule could have caught this.";
  }
}

function hardVerdict(rules: HardConstraint[], candidate: Profile) {
  const outcomes = rules.map((rule) => ({
    rule,
    outcome: evaluateConstraint(rule, candidate).outcome,
  }));
  const decisive =
    outcomes.find(({ outcome }) => outcome === "fail") ??
    outcomes.find(({ outcome }) => outcome === "unknown") ??
    outcomes[0];
  return {
    verdict: OUTCOME_VERDICT[decisive.outcome],
    rule: { id: decisive.rule.id, label: decisive.rule.label },
  };
}

function judgeReason(
  reason: RejectionReason,
  preferences: Preferences,
  candidate: Profile,
): ReasonVerdict {
  const field = signalField(reason.field);
  if (field === null || SUBJECTIVE_CATEGORIES.has(reason.category)) {
    return {
      reason,
      verdict: "subjective",
      rule: null,
      explanation: explain("subjective", "city", null),
    };
  }
  const rules = preferences.hard.filter(
    (rule) => signalField(constraintField(rule)) === field,
  );
  if (rules.length > 0) {
    const { verdict, rule } = hardVerdict(rules, candidate);
    return {
      reason,
      verdict,
      rule,
      explanation: explain(verdict, field, rule),
    };
  }
  const verdict = preferences.soft.some(
    (pref) => signalField(pref.field) === field,
  )
    ? "soft_mismatch"
    : "new_signal";
  return {
    reason,
    verdict,
    rule: null,
    explanation: explain(verdict, field, null),
  };
}

export function classifyPreventability(
  reasons: RejectionReason[],
  clientPreferences: Preferences,
  candidate: Profile,
): PreventabilityResult {
  const verdicts = reasons.map((reason) =>
    judgeReason(reason, clientPreferences, candidate),
  );
  const overall =
    VERDICT_PRECEDENCE.find((verdict) =>
      verdicts.some((v) => v.verdict === verdict),
    ) ?? "subjective";
  return { verdicts, overall };
}

export interface AssessedRejection {
  candidate: Profile;
  verdicts: ReasonVerdict[];
}

export interface PreferenceSuggestion {
  field: ConstraintField;
  constraint: HardConstraint;
  evidence: string[];
  occurrences: number;
}

type WithoutProvenance<T> = T extends unknown
  ? Omit<T, "id" | "source">
  : never;
type ConstraintDraft = WithoutProvenance<HardConstraint>;

interface FieldSignal {
  rejected: Profile[];
  evidence: string[];
}

const SUGGESTION_THRESHOLD = 2;

const SIGNAL_VERDICTS: ReadonlySet<Verdict> = new Set([
  "new_signal",
  "preference_drift",
]);

/** Relocation complaints and relocation rules are both about where the couple will live. */
function signalField(field: ReasonField): ConstraintField | null {
  if (field === "none") return null;
  return field === "openToRelocate" ? "city" : field;
}

function signalEvidenceByField(
  verdicts: ReasonVerdict[],
): Map<ConstraintField, string[]> {
  const byField = new Map<ConstraintField, string[]>();
  for (const { reason, verdict } of verdicts) {
    const field = signalField(reason.field);
    if (field === null || !SIGNAL_VERDICTS.has(verdict)) continue;
    byField.set(field, [...(byField.get(field) ?? []), reason.evidence]);
  }
  return byField;
}

function collectSignals(
  assessed: AssessedRejection[],
): Map<ConstraintField, FieldSignal> {
  const signals = new Map<ConstraintField, FieldSignal>();
  for (const { candidate, verdicts } of assessed) {
    for (const [field, evidence] of signalEvidenceByField(verdicts)) {
      const signal = signals.get(field) ?? { rejected: [], evidence: [] };
      signals.set(field, {
        rejected: [...signal.rejected, candidate],
        evidence: [...signal.evidence, ...evidence],
      });
    }
  }
  return signals;
}

function draftRange(
  client: Client,
  field: RangeField,
  rejected: Profile[],
): ConstraintDraft | null {
  const values = rejected.map((profile) => profile[field]);
  const name = FIELD_LABELS[field];
  if (values.every((value) => value > client[field])) {
    const max = Math.min(...values) - 1;
    const label = `${name} at most ${formatFieldValue(field, max)}`;
    return { kind: "range", field, max, label };
  }
  if (values.every((value) => value < client[field])) {
    const min = Math.max(...values) + 1;
    const label = `${name} at least ${formatFieldValue(field, min)}`;
    return { kind: "range", field, min, label };
  }
  return null;
}

function draftNoneOf(
  field: CategoricalField,
  rejected: Profile[],
): ConstraintDraft | null {
  const known = rejected
    .map((profile) => profile[field])
    .filter((value) => value !== null);
  const disallowed = [...new Set(known)].sort();
  if (disallowed.length === 0) return null;
  const values = disallowed.map((value) => formatFieldValue(field, value));
  const label = `${FIELD_LABELS[field]} must not be ${values.join(" or ")}`;
  return { kind: "noneOf", field, disallowed, label };
}

function draftEquals(
  field: BooleanField,
  rejected: Profile[],
): ConstraintDraft | null {
  const known = new Set(
    rejected.map((profile) => profile[field]).filter((value) => value !== null),
  );
  if (known.size !== 1) return null;
  const [rejectedValue] = known;
  const value = !rejectedValue;
  const label = `${FIELD_LABELS[field]} must be ${formatFieldValue(field, value)}`;
  return { kind: "equals", field, value, label };
}

function draftLocation(client: Client): ConstraintDraft {
  return {
    kind: "location",
    allowedCities: [client.city],
    acceptIfOpenToRelocate: true,
    label: `Lives in ${client.city} or open to relocate`,
  };
}

function draftConstraint(
  client: Client,
  field: ConstraintField,
  rejected: Profile[],
): ConstraintDraft | null {
  const rangeField = RangeFieldSchema.safeParse(field);
  if (rangeField.success) return draftRange(client, rangeField.data, rejected);
  const categoricalField = CategoricalFieldSchema.safeParse(field);
  if (categoricalField.success) {
    return draftNoneOf(categoricalField.data, rejected);
  }
  const booleanField = BooleanFieldSchema.safeParse(field);
  if (booleanField.success) return draftEquals(booleanField.data, rejected);
  return draftLocation(client);
}

function toSuggestion(
  client: Client,
  field: ConstraintField,
  signal: FieldSignal,
): PreferenceSuggestion | null {
  const draft = draftConstraint(client, field, signal.rejected);
  if (draft === null) return null;
  return {
    field,
    constraint: {
      ...draft,
      id: `fb_${client.id}_${field}`,
      source: "feedback",
    },
    evidence: signal.evidence,
    occurrences: signal.rejected.length,
  };
}

export function suggestPreferenceUpdates(
  client: Client,
  assessed: AssessedRejection[],
): PreferenceSuggestion[] {
  return [...collectSignals(assessed)]
    .filter(([, signal]) => signal.rejected.length >= SUGGESTION_THRESHOLD)
    .map(([field, signal]) => toSuggestion(client, field, signal))
    .filter((suggestion) => suggestion !== null)
    .sort(
      (a, b) => b.occurrences - a.occurrences || a.field.localeCompare(b.field),
    );
}

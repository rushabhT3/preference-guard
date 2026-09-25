import { describe, expect, it } from "vitest";
import {
  type AssessedRejection,
  classifyPreventability,
  suggestPreferenceUpdates,
  type Verdict,
} from "@/domain/preventability";
import type {
  HardConstraint,
  Profile,
  ReasonCategory,
  ReasonField,
  RejectionReason,
  SoftPreference,
} from "@/domain/schemas";
import { makeClient, makeProfile, NON_SMOKER } from "./fixtures";

const NO_REGULAR_DRINKERS: HardConstraint = {
  id: "hc_drinking",
  kind: "noneOf",
  field: "drinking",
  disallowed: ["regularly"],
  label: "No regular drinkers",
  source: "intake",
};

const VEGETARIAN_ONLY: HardConstraint = {
  id: "hc_diet",
  kind: "oneOf",
  field: "diet",
  allowed: ["veg", "jain"],
  label: "Vegetarian only",
  source: "intake",
};

const NOT_JAIN: HardConstraint = {
  id: "hc_diet_not_jain",
  kind: "noneOf",
  field: "diet",
  disallowed: ["jain"],
  label: "Not Jain diet",
  source: "intake",
};

const PUNE_ONLY: HardConstraint = {
  id: "hc_city",
  kind: "location",
  allowedCities: ["Pune"],
  acceptIfOpenToRelocate: false,
  label: "Pune only",
  source: "intake",
};

const PREFERS_NUCLEAR_FAMILY: SoftPreference = {
  id: "sp_family",
  field: "familyType",
  prefer: ["nuclear"],
  weight: 1,
  label: "Prefers a nuclear family",
};

function reason(
  field: ReasonField,
  category: ReasonCategory = "other",
  evidence = `about ${field}`,
): RejectionReason {
  return { category, field, evidence, strength: "dealbreaker" };
}

describe("classifyPreventability", () => {
  const client = makeClient({
    preferences: {
      hard: [NON_SMOKER, NO_REGULAR_DRINKERS, VEGETARIAN_ONLY, PUNE_ONLY],
      soft: [PREFERS_NUCLEAR_FAMILY],
    },
  });
  const candidate = makeProfile({
    smoking: "regularly",
    drinking: null,
    diet: "veg",
    city: "Mumbai",
    familyType: "joint",
  });

  const REASON_FOR: Record<Verdict, RejectionReason> = {
    preventable: reason("smoking", "smoking"),
    data_gap: reason("drinking", "drinking"),
    preference_drift: reason("diet", "diet"),
    new_signal: reason("religion", "religion_community"),
    soft_mismatch: reason("familyType", "family"),
    subjective: reason("none", "appearance_photos"),
  };

  function verdictOf(rejectionReason: RejectionReason): Verdict {
    return classifyPreventability(
      [rejectionReason],
      client.preferences,
      candidate,
    ).verdicts[0].verdict;
  }

  it.each(Object.entries(REASON_FOR))(
    "judges a reason as %s",
    (expected, rejectionReason) => {
      expect(verdictOf(rejectionReason)).toBe(expected);
    },
  );

  it("treats a subjective category as subjective even when it names a field", () => {
    expect(verdictOf(reason("smoking", "appearance_photos"))).toBe(
      "subjective",
    );
  });

  it("checks an openToRelocate reason against the client's location rule", () => {
    expect(verdictOf(reason("openToRelocate", "location"))).toBe("preventable");
  });

  it("cites the failing rule when another rule on the same field passes", () => {
    const strictClient = makeClient({
      preferences: { hard: [VEGETARIAN_ONLY, NOT_JAIN], soft: [] },
    });
    const jain = makeProfile({ diet: "jain" });

    const [verdict] = classifyPreventability(
      [reason("diet", "diet")],
      strictClient.preferences,
      jain,
    ).verdicts;

    expect(verdict.verdict).toBe("preventable");
    expect(verdict.rule).toEqual({
      id: "hc_diet_not_jain",
      label: "Not Jain diet",
    });
  });

  it("explains a preventable reason in plain English", () => {
    const [verdict] = classifyPreventability(
      [REASON_FOR.preventable],
      client.preferences,
      candidate,
    ).verdicts;

    expect(verdict.explanation).toBe(
      "Blocked by rule 'Non-smoker only'. Preference Guard would have stopped this send.",
    );
  });

  const PRECEDENCE: Verdict[] = [
    "preventable",
    "data_gap",
    "preference_drift",
    "new_signal",
    "soft_mismatch",
    "subjective",
  ];

  it.each(PRECEDENCE.map((verdict, index) => [verdict, index] as const))(
    "overall is %s when it is the strongest verdict present",
    (expected, index) => {
      const reasons = PRECEDENCE.slice(index)
        .reverse()
        .map((verdict) => REASON_FOR[verdict]);

      const result = classifyPreventability(
        reasons,
        client.preferences,
        candidate,
      );

      expect(result.overall).toBe(expected);
    },
  );

  it("is subjective overall when no reasons were found", () => {
    const result = classifyPreventability([], client.preferences, candidate);

    expect(result).toEqual({ verdicts: [], overall: "subjective" });
  });
});

describe("suggestPreferenceUpdates", () => {
  const client = makeClient({
    id: "cl_test",
    age: 29,
    heightCm: 165,
    city: "Pune",
    preferences: {
      hard: [NO_REGULAR_DRINKERS],
      soft: [PREFERS_NUCLEAR_FAMILY],
    },
  });

  function rejection(
    candidateOverrides: Partial<Profile>,
    ...reasons: RejectionReason[]
  ): AssessedRejection {
    const candidate = makeProfile(candidateOverrides);
    const { verdicts } = classifyPreventability(
      reasons,
      client.preferences,
      candidate,
    );
    return { candidate, verdicts };
  }

  function suggest(assessed: AssessedRejection[]) {
    return suggestPreferenceUpdates(client, assessed);
  }

  it("ignores a new signal seen only once", () => {
    const assessed = [rejection({ diet: "non_veg" }, reason("diet"))];

    expect(suggest(assessed)).toEqual([]);
  });

  it("counts one rejection once per field, however many reasons cite it", () => {
    const assessed = [
      rejection(
        { diet: "non_veg" },
        reason("diet", "diet", "eats meat"),
        reason("diet", "diet", "non veg"),
      ),
    ];

    expect(suggest(assessed)).toEqual([]);
  });

  it("drafts a noneOf rule from two new signals on a categorical field", () => {
    const assessed = [
      rejection({ diet: "vegan" }, reason("diet", "diet", "vegan, too strict")),
      rejection({ diet: "non_veg" }, reason("diet", "diet", "eats meat")),
      rejection({ diet: "non_veg" }, reason("diet", "diet", "non veg")),
    ];

    expect(suggest(assessed)).toEqual([
      {
        field: "diet",
        constraint: {
          id: "fb_cl_test_diet",
          kind: "noneOf",
          field: "diet",
          disallowed: ["non_veg", "vegan"],
          label: "Diet must not be non-veg or vegan",
          source: "feedback",
        },
        evidence: ["vegan, too strict", "eats meat", "non veg"],
        occurrences: 3,
      },
    ]);
  });

  it("counts preference drift against an existing rule", () => {
    const assessed = [
      rejection({ drinking: "socially" }, reason("drinking", "drinking")),
      rejection({ drinking: "socially" }, reason("drinking", "drinking")),
    ];

    const [suggestion] = suggest(assessed);

    expect(suggestion.constraint).toMatchObject({
      kind: "noneOf",
      disallowed: ["socially"],
      label: "Drinking must not be socially",
    });
  });

  it("drafts an equals rule when rejected boolean values agree", () => {
    const assessed = [
      rejection({ hasChildren: true }, reason("hasChildren", "children")),
      rejection({ hasChildren: true }, reason("hasChildren", "children")),
    ];

    const [suggestion] = suggest(assessed);

    expect(suggestion.constraint).toEqual({
      id: "fb_cl_test_hasChildren",
      kind: "equals",
      field: "hasChildren",
      value: false,
      label: "Has children must be no",
      source: "feedback",
    });
  });

  it("skips a boolean field when rejected values disagree", () => {
    const assessed = [
      rejection({ hasChildren: true }, reason("hasChildren", "children")),
      rejection({ hasChildren: false }, reason("hasChildren", "children")),
    ];

    expect(suggest(assessed)).toEqual([]);
  });

  it("caps age just below the youngest rejected when all were older", () => {
    const assessed = [
      rejection({ age: 36 }, reason("age", "age")),
      rejection({ age: 40 }, reason("age", "age")),
    ];

    const [suggestion] = suggest(assessed);

    expect(suggestion.constraint).toMatchObject({
      kind: "range",
      field: "age",
      max: 35,
      label: "Age at most 35",
    });
    expect(suggestion.constraint).not.toHaveProperty("min");
  });

  it("floors height just above the tallest rejected when all were shorter", () => {
    const assessed = [
      rejection({ heightCm: 150 }, reason("heightCm", "height")),
      rejection({ heightCm: 158 }, reason("heightCm", "height")),
    ];

    const [suggestion] = suggest(assessed);

    expect(suggestion.constraint).toMatchObject({
      kind: "range",
      field: "heightCm",
      min: 159,
      label: "Height at least 159 cm",
    });
  });

  it("skips a range field when rejected values sit on both sides of the client", () => {
    const assessed = [
      rejection({ age: 24 }, reason("age", "age")),
      rejection({ age: 36 }, reason("age", "age")),
    ];

    expect(suggest(assessed)).toEqual([]);
  });

  it("drafts a location rule, counting openToRelocate reasons as city", () => {
    const assessed = [
      rejection({ city: "Dubai" }, reason("city", "location", "too far")),
      rejection(
        { city: "London" },
        reason("openToRelocate", "location", "won't move"),
      ),
    ];

    expect(suggest(assessed)).toEqual([
      {
        field: "city",
        constraint: {
          id: "fb_cl_test_city",
          kind: "location",
          allowedCities: ["Pune"],
          acceptIfOpenToRelocate: true,
          label: "Lives in Pune or open to relocate",
          source: "feedback",
        },
        evidence: ["too far", "won't move"],
        occurrences: 2,
      },
    ]);
  });

  it("skips a field when every rejected value is blank", () => {
    const assessed = [
      rejection({ smoking: null }, reason("smoking", "smoking")),
      rejection({ smoking: null }, reason("smoking", "smoking")),
    ];

    expect(suggest(assessed)).toEqual([]);
  });

  it("ignores preventable, soft mismatch and subjective reasons", () => {
    const assessed = [
      rejection(
        { drinking: "regularly", familyType: "joint" },
        reason("drinking", "drinking"),
        reason("familyType", "family"),
        reason("none", "personality_vibe"),
      ),
      rejection(
        { drinking: "regularly", familyType: "joint" },
        reason("drinking", "drinking"),
        reason("familyType", "family"),
        reason("none", "personality_vibe"),
      ),
    ];

    expect(suggest(assessed)).toEqual([]);
  });

  it("orders suggestions by occurrences, then field", () => {
    const assessed = [
      rejection(
        { hasChildren: true, age: 40 },
        reason("hasChildren"),
        reason("age"),
      ),
      rejection(
        { hasChildren: true, age: 41 },
        reason("hasChildren"),
        reason("age"),
      ),
      rejection({ diet: "vegan" }, reason("diet")),
      rejection({ diet: "vegan" }, reason("diet")),
      rejection({ diet: "vegan" }, reason("diet")),
    ];

    const fields = suggest(assessed).map((suggestion) => suggestion.field);

    expect(fields).toEqual(["diet", "age", "hasChildren"]);
  });
});

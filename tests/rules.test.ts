import { describe, expect, it } from "vitest";
import {
  evaluateCandidate,
  evaluateConstraint,
  evaluateMutual,
  type Outcome,
} from "@/domain/rules";
import type { HardConstraint, Profile } from "@/domain/schemas";
import { makeClient, makeProfile, NON_SMOKER } from "./fixtures";

const AGED_28_TO_35: HardConstraint = {
  id: "hc_age",
  kind: "range",
  field: "age",
  min: 28,
  max: 35,
  label: "Aged 28 to 35",
  source: "intake",
};

const AT_LEAST_170_CM: HardConstraint = {
  id: "hc_height",
  kind: "range",
  field: "heightCm",
  min: 170,
  label: "170 cm or taller",
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

const NO_CHILDREN: HardConstraint = {
  id: "hc_children",
  kind: "equals",
  field: "hasChildren",
  value: false,
  label: "No children",
  source: "intake",
};

const PUNE_OR_WILLING_TO_MOVE: HardConstraint = {
  id: "hc_city",
  kind: "location",
  allowedCities: ["Pune", "Mumbai"],
  acceptIfOpenToRelocate: true,
  label: "Pune or Mumbai, or willing to move",
  source: "intake",
};

const PUNE_ONLY: HardConstraint = {
  id: "hc_city_strict",
  kind: "location",
  allowedCities: ["Pune"],
  acceptIfOpenToRelocate: false,
  label: "Pune only",
  source: "intake",
};

const YOUNGER_THAN_28: HardConstraint = {
  id: "hc_candidate_age",
  kind: "range",
  field: "age",
  max: 27,
  label: "27 or younger",
  source: "intake",
};

interface OutcomeCase {
  name: string;
  constraint: HardConstraint;
  profile: Partial<Profile>;
  expected: Outcome;
}

const OUTCOME_CASES: OutcomeCase[] = [
  {
    name: "range: inside the bounds passes",
    constraint: AGED_28_TO_35,
    profile: { age: 31 },
    expected: "pass",
  },
  {
    name: "range: both bounds are inclusive",
    constraint: AGED_28_TO_35,
    profile: { age: 35 },
    expected: "pass",
  },
  {
    name: "range: below min fails",
    constraint: AGED_28_TO_35,
    profile: { age: 27 },
    expected: "fail",
  },
  {
    name: "range: above max fails",
    constraint: AGED_28_TO_35,
    profile: { age: 36 },
    expected: "fail",
  },
  {
    name: "range: min-only has no ceiling",
    constraint: AT_LEAST_170_CM,
    profile: { heightCm: 210 },
    expected: "pass",
  },
  {
    name: "range: min-only fails below min",
    constraint: AT_LEAST_170_CM,
    profile: { heightCm: 165 },
    expected: "fail",
  },
  {
    name: "oneOf: allowed value passes",
    constraint: VEGETARIAN_ONLY,
    profile: { diet: "jain" },
    expected: "pass",
  },
  {
    name: "oneOf: other value fails",
    constraint: VEGETARIAN_ONLY,
    profile: { diet: "non_veg" },
    expected: "fail",
  },
  {
    name: "oneOf: blank value is unknown",
    constraint: VEGETARIAN_ONLY,
    profile: { diet: null },
    expected: "unknown",
  },
  {
    name: "noneOf: other value passes",
    constraint: NON_SMOKER,
    profile: { smoking: "never" },
    expected: "pass",
  },
  {
    name: "noneOf: disallowed value fails",
    constraint: NON_SMOKER,
    profile: { smoking: "occasionally" },
    expected: "fail",
  },
  {
    name: "noneOf: blank value is unknown",
    constraint: NON_SMOKER,
    profile: { smoking: null },
    expected: "unknown",
  },
  {
    name: "equals: same value passes",
    constraint: NO_CHILDREN,
    profile: { hasChildren: false },
    expected: "pass",
  },
  {
    name: "equals: other value fails",
    constraint: NO_CHILDREN,
    profile: { hasChildren: true },
    expected: "fail",
  },
  {
    name: "equals: blank value is unknown",
    constraint: NO_CHILDREN,
    profile: { hasChildren: null },
    expected: "unknown",
  },
  {
    name: "location: allowed city passes",
    constraint: PUNE_OR_WILLING_TO_MOVE,
    profile: { city: "Mumbai", openToRelocate: false },
    expected: "pass",
  },
  {
    name: "location: other city but open to relocate passes",
    constraint: PUNE_OR_WILLING_TO_MOVE,
    profile: { city: "Dubai", openToRelocate: true },
    expected: "pass",
  },
  {
    name: "location: other city and not open to relocate fails",
    constraint: PUNE_OR_WILLING_TO_MOVE,
    profile: { city: "Dubai", openToRelocate: false },
    expected: "fail",
  },
  {
    name: "location: other city with blank relocation is unknown",
    constraint: PUNE_OR_WILLING_TO_MOVE,
    profile: { city: "Dubai", openToRelocate: null },
    expected: "unknown",
  },
  {
    name: "location: relocation ignored when the rule does not accept it",
    constraint: PUNE_ONLY,
    profile: { city: "Dubai", openToRelocate: true },
    expected: "fail",
  },
  {
    name: "location: blank relocation still fails when the rule does not accept it",
    constraint: PUNE_ONLY,
    profile: { city: "Dubai", openToRelocate: null },
    expected: "fail",
  },
];

describe("evaluateConstraint", () => {
  it.each(OUTCOME_CASES)("$name", ({ constraint, profile, expected }) => {
    const result = evaluateConstraint(constraint, makeProfile(profile));

    expect(result.outcome).toBe(expected);
  });

  it("writes the client-side message as '<Field>: <actual>. Client rule: <label>'", () => {
    const smoker = makeProfile({ smoking: "occasionally" });

    const result = evaluateConstraint(NON_SMOKER, smoker);

    expect(result.message).toBe(
      "Smoking: occasionally. Client rule: Non-smoker only",
    );
  });

  it("names the candidate's side when checking the candidate's own rule", () => {
    const smoker = makeProfile({ smoking: "regularly" });

    const result = evaluateConstraint(NON_SMOKER, smoker, "candidate");

    expect(result.message).toBe(
      "Smoking: regularly. Candidate rule: Non-smoker only",
    );
  });

  it("says 'not stated' for a blank value", () => {
    const result = evaluateConstraint(
      NON_SMOKER,
      makeProfile({ smoking: null }),
    );

    expect(result.message).toBe(
      "Smoking: not stated. Client rule: Non-smoker only",
    );
  });

  it("reports a location rule against the city field with relocation in the message", () => {
    const profile = makeProfile({ city: "Dubai", openToRelocate: false });

    const result = evaluateConstraint(PUNE_OR_WILLING_TO_MOVE, profile);

    expect(result).toMatchObject({
      field: "city",
      constraintId: "hc_city",
      message:
        "City: Dubai, open to relocate: no. Client rule: Pune or Mumbai, or willing to move",
    });
  });
});

describe("evaluateCandidate", () => {
  it("is clear when there are no dealbreakers", () => {
    const evaluation = evaluateCandidate({ hard: [], soft: [] }, makeProfile());

    expect(evaluation).toEqual({ status: "clear", results: [] });
  });

  it("is clear when every rule passes", () => {
    const evaluation = evaluateCandidate(
      { hard: [NON_SMOKER, AGED_28_TO_35], soft: [] },
      makeProfile(),
    );

    expect(evaluation.status).toBe("clear");
  });

  it("needs a check when a rule is unknown and none fails", () => {
    const evaluation = evaluateCandidate(
      { hard: [AGED_28_TO_35, NON_SMOKER], soft: [] },
      makeProfile({ smoking: null }),
    );

    expect(evaluation.status).toBe("needs_check");
  });

  it("is blocked when any rule fails, even alongside an unknown", () => {
    const evaluation = evaluateCandidate(
      { hard: [NON_SMOKER, AGED_28_TO_35], soft: [] },
      makeProfile({ smoking: null, age: 40 }),
    );

    expect(evaluation.status).toBe("blocked");
    expect(evaluation.results.map((result) => result.outcome)).toEqual([
      "unknown",
      "fail",
    ]);
  });
});

describe("evaluateMutual", () => {
  it("blocks on the client's rule", () => {
    const client = makeClient({
      preferences: { hard: [NON_SMOKER], soft: [] },
    });

    const mutual = evaluateMutual(
      client,
      makeProfile({ smoking: "regularly" }),
    );

    expect(mutual.status).toBe("blocked");
    expect(mutual.clientSide.status).toBe("blocked");
  });

  it("applies the candidate's own dealbreakers to the client", () => {
    const client = makeClient({ age: 29 });
    const candidate = makeProfile({
      preferences: { hard: [YOUNGER_THAN_28], soft: [] },
    });

    const mutual = evaluateMutual(client, candidate);

    expect(mutual.status).toBe("blocked");
    expect(mutual.clientSide.status).toBe("clear");
    expect(mutual.candidateSide?.results[0].message).toBe(
      "Age: 29. Candidate rule: 27 or younger",
    );
  });

  it("needs a check when the client's own field is blank for the candidate's rule", () => {
    const client = makeClient({ smoking: null });
    const candidate = makeProfile({
      preferences: { hard: [NON_SMOKER], soft: [] },
    });

    const mutual = evaluateMutual(client, candidate);

    expect(mutual.status).toBe("needs_check");
    expect(mutual.candidateSide?.status).toBe("needs_check");
  });

  it("takes the worse of the two sides", () => {
    const client = makeClient({
      age: 29,
      preferences: { hard: [NON_SMOKER], soft: [] },
    });
    const candidate = makeProfile({
      smoking: null,
      preferences: { hard: [YOUNGER_THAN_28], soft: [] },
    });

    const mutual = evaluateMutual(client, candidate);

    expect(mutual.clientSide.status).toBe("needs_check");
    expect(mutual.status).toBe("blocked");
  });

  it("has no candidate side when the candidate has no preferences on file", () => {
    const client = makeClient({
      preferences: { hard: [NON_SMOKER], soft: [] },
    });

    const mutual = evaluateMutual(client, makeProfile({ smoking: null }));

    expect(mutual.candidateSide).toBeNull();
    expect(mutual.status).toBe("needs_check");
  });
});

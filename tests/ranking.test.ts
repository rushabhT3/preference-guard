import { describe, expect, it } from "vitest";
import { candidatePool } from "@/domain/pool";
import {
  formatFit,
  rankCandidates,
  type SoftFit,
  softFit,
  softMatch,
} from "@/domain/ranking";
import type { HistoryEvent, SoftPreference } from "@/domain/schemas";
import { makeClient, makeProfile, NON_SMOKER } from "./fixtures";

const PREFERS_NON_DRINKER: SoftPreference = {
  id: "sp_drinking",
  field: "drinking",
  prefer: ["never"],
  weight: 3,
  label: "Prefers a non-drinker",
};

const PREFERS_TALL: SoftPreference = {
  id: "sp_height",
  field: "heightCm",
  prefer: { min: 175 },
  weight: 2,
  label: "Prefers 175 cm or taller",
};

const PREFERS_NUCLEAR_FAMILY: SoftPreference = {
  id: "sp_family",
  field: "familyType",
  prefer: ["nuclear"],
  weight: 1,
  label: "Prefers a nuclear family",
};

const PREFERS_UNDER_32: SoftPreference = {
  id: "sp_age",
  field: "age",
  prefer: { max: 31 },
  weight: 1,
  label: "Prefers under 32",
};

function fitIds(fit: SoftFit) {
  return {
    matched: fit.matched.map((pref) => pref.id),
    missed: fit.missed.map((pref) => pref.id),
    unknown: fit.unknown.map((pref) => pref.id),
  };
}

describe("softMatch", () => {
  it("matches a listed value", () => {
    expect(
      softMatch(PREFERS_NON_DRINKER, makeProfile({ drinking: "never" })),
    ).toBe("match");
  });

  it("misses an unlisted value", () => {
    expect(
      softMatch(PREFERS_NON_DRINKER, makeProfile({ drinking: "socially" })),
    ).toBe("miss");
  });

  it("is unknown when the value is blank", () => {
    expect(
      softMatch(PREFERS_NON_DRINKER, makeProfile({ drinking: null })),
    ).toBe("unknown");
  });

  it("treats numeric bounds as inclusive", () => {
    expect(softMatch(PREFERS_TALL, makeProfile({ heightCm: 175 }))).toBe(
      "match",
    );
    expect(softMatch(PREFERS_UNDER_32, makeProfile({ age: 31 }))).toBe("match");
  });

  it("misses outside numeric bounds", () => {
    expect(softMatch(PREFERS_TALL, makeProfile({ heightCm: 174 }))).toBe(
      "miss",
    );
    expect(softMatch(PREFERS_UNDER_32, makeProfile({ age: 32 }))).toBe("miss");
  });
});

describe("softFit", () => {
  it("weights each preference by its weight", () => {
    const profile = makeProfile({ drinking: "never", familyType: "joint" });

    const fit = softFit([PREFERS_NON_DRINKER, PREFERS_NUCLEAR_FAMILY], profile);

    expect(fit).toMatchObject({ low: 75, high: 75, unknownCount: 0 });
  });

  it("scores unknowns as misses for low and as matches for high", () => {
    const profile = makeProfile({
      drinking: null,
      heightCm: 170,
      familyType: "nuclear",
    });

    const fit = softFit(
      [PREFERS_NON_DRINKER, PREFERS_TALL, PREFERS_NUCLEAR_FAMILY],
      profile,
    );

    expect(fit).toMatchObject({ low: 17, high: 67, unknownCount: 1 });
    expect(fitIds(fit)).toEqual({
      matched: ["sp_family"],
      missed: ["sp_height"],
      unknown: ["sp_drinking"],
    });
  });

  it("is zero with no soft preferences", () => {
    expect(softFit([], makeProfile())).toMatchObject({
      low: 0,
      high: 0,
      unknownCount: 0,
    });
  });

  it("lists matched preferences by weight, then id", () => {
    const profile = makeProfile({
      drinking: "never",
      heightCm: 180,
      familyType: "nuclear",
      age: 30,
    });

    const fit = softFit(
      [
        PREFERS_UNDER_32,
        PREFERS_NUCLEAR_FAMILY,
        PREFERS_TALL,
        PREFERS_NON_DRINKER,
      ],
      profile,
    );

    expect(fitIds(fit).matched).toEqual([
      "sp_drinking",
      "sp_height",
      "sp_age",
      "sp_family",
    ]);
  });
});

describe("rankCandidates", () => {
  const client = makeClient({
    preferences: {
      hard: [NON_SMOKER],
      soft: [PREFERS_NON_DRINKER, PREFERS_NUCLEAR_FAMILY],
    },
  });

  function rankedIds(candidates: ReturnType<typeof makeProfile>[]) {
    return rankCandidates(client, candidates).map(
      ({ candidate }) => candidate.id,
    );
  }

  it("orders clear, then needs check, then blocked, regardless of fit", () => {
    const blocked = makeProfile({
      id: "cd_blocked",
      smoking: "regularly",
      drinking: "never",
    });
    const needsCheck = makeProfile({
      id: "cd_needs_check",
      smoking: null,
      drinking: "never",
    });
    const clear = makeProfile({
      id: "cd_clear",
      drinking: "regularly",
      familyType: "joint",
    });

    expect(rankedIds([blocked, needsCheck, clear])).toEqual([
      "cd_clear",
      "cd_needs_check",
      "cd_blocked",
    ]);
  });

  it("puts higher known fit first", () => {
    const weak = makeProfile({ id: "cd_a", drinking: "regularly" });
    const strong = makeProfile({ id: "cd_b", drinking: "never" });

    expect(rankedIds([weak, strong])).toEqual(["cd_b", "cd_a"]);
  });

  it("never lets a sparse profile outrank a complete one with equal known fit", () => {
    const sparse = makeProfile({
      id: "cd_a",
      drinking: "never",
      familyType: null,
    });
    const complete = makeProfile({
      id: "cd_b",
      drinking: "never",
      familyType: "joint",
    });

    const ranked = rankCandidates(client, [sparse, complete]);

    expect(ranked.map(({ candidate }) => candidate.id)).toEqual([
      "cd_b",
      "cd_a",
    ]);
    expect(ranked.map(({ fit }) => [fit.low, fit.high])).toEqual([
      [75, 75],
      [75, 100],
    ]);
  });

  it("breaks full ties on id so the order is stable", () => {
    const second = makeProfile({ id: "cd_2" });
    const first = makeProfile({ id: "cd_1" });

    expect(rankedIds([second, first])).toEqual(["cd_1", "cd_2"]);
  });

  it("carries the mutual evaluation for each candidate", () => {
    const smoker = makeProfile({ smoking: "regularly" });

    const [ranked] = rankCandidates(client, [smoker]);

    expect(ranked.evaluation.clientSide.results[0].message).toBe(
      "Smoking: regularly. Client rule: Non-smoker only",
    );
  });
});

describe("formatFit", () => {
  const fit: SoftFit = {
    low: 43,
    high: 71,
    unknownCount: 2,
    matched: [],
    missed: [],
    unknown: [],
  };

  it("shows the unknown count and upper bound when data is missing", () => {
    expect(formatFit(fit)).toBe("fit 43 (2 unknown, up to 71)");
  });

  it("shows only the score when nothing is unknown", () => {
    expect(formatFit({ ...fit, high: 43, unknownCount: 0 })).toBe("fit 43");
  });
});

describe("candidatePool", () => {
  const client = makeClient({ id: "cl_test", gender: "female" });

  function sharedTo(clientId: string, candidateId: string): HistoryEvent {
    return {
      id: `ev_${clientId}_${candidateId}`,
      sharedAt: "2026-09-10T09:00:00.000Z",
      matchmakerId: "mm_a",
      clientId,
      candidateId,
      stageReached: "shared",
      rejectionText: "Not for me",
    };
  }

  it("keeps candidates of the other gender never shared to this client", () => {
    const fresh = makeProfile({ id: "cd_fresh", gender: "male" });
    const alreadyShared = makeProfile({ id: "cd_shared", gender: "male" });
    const sharedElsewhere = makeProfile({ id: "cd_elsewhere", gender: "male" });
    const sameGender = makeProfile({ id: "cd_same", gender: "female" });
    const history = [
      sharedTo("cl_test", "cd_shared"),
      sharedTo("cl_other", "cd_elsewhere"),
    ];

    const pool = candidatePool(
      client,
      [fresh, alreadyShared, sharedElsewhere, sameGender],
      history,
    );

    expect(pool.map((candidate) => candidate.id)).toEqual([
      "cd_fresh",
      "cd_elsewhere",
    ]);
  });
});

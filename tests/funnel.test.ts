import { describe, expect, it } from "vitest";
import {
  acceptanceRate,
  blocksByField,
  byMatchmaker,
  computeFunnel,
  DEFAULT_ASSUMPTIONS,
  engineViolationRate,
  projectImpact,
  replayHistory,
  summarizeReplay,
} from "@/domain/funnel";
import type {
  Client,
  FunnelStage,
  HardConstraint,
  HistoryEvent,
  Profile,
} from "@/domain/schemas";
import { makeClient, makeProfile, NON_SMOKER } from "./fixtures";

function share(
  client: Client,
  candidate: Profile,
  stageReached: FunnelStage,
): HistoryEvent {
  return {
    id: `ev_${client.id}_${candidate.id}`,
    sharedAt: "2026-09-10T09:00:00.000Z",
    matchmakerId: client.matchmakerId,
    clientId: client.id,
    candidateId: candidate.id,
    stageReached,
    rejectionText: stageReached === "shared" ? "Not for me" : null,
  };
}

const NO_REGULAR_SMOKERS: HardConstraint = {
  id: "hc_smoking_regular",
  kind: "noneOf",
  field: "smoking",
  disallowed: ["regularly"],
  label: "No regular smokers",
  source: "intake",
};

const PUNE_OR_WILLING_TO_MOVE: HardConstraint = {
  id: "hc_city",
  kind: "location",
  allowedCities: ["Pune"],
  acceptIfOpenToRelocate: true,
  label: "Pune, or willing to move",
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

const CLIENT_A = makeClient({
  id: "cl_a",
  matchmakerId: "mm_a",
  age: 29,
  preferences: { hard: [NON_SMOKER], soft: [] },
});
const CLIENT_B = makeClient({
  id: "cl_b",
  matchmakerId: "mm_b",
  preferences: {
    hard: [NON_SMOKER, NO_REGULAR_SMOKERS, PUNE_OR_WILLING_TO_MOVE],
    soft: [],
  },
});

const COMPLIANT = makeProfile({ id: "cd_compliant" });
const SMOKER = makeProfile({ id: "cd_smoker", smoking: "regularly" });
const SMOKING_BLANK = makeProfile({ id: "cd_smoking_blank", smoking: null });
const WANTS_YOUNGER = makeProfile({
  id: "cd_wants_younger",
  preferences: { hard: [YOUNGER_THAN_28], soft: [] },
});
const FAR_SMOKER = makeProfile({
  id: "cd_far_smoker",
  smoking: "regularly",
  city: "Delhi NCR",
  openToRelocate: false,
});
const FAR_RELOCATION_BLANK = makeProfile({
  id: "cd_far_relocation_blank",
  city: "Mumbai",
  openToRelocate: null,
});
const SMOKER_RELOCATION_BLANK = makeProfile({
  id: "cd_smoker_relocation_blank",
  smoking: "regularly",
  city: "Mumbai",
  openToRelocate: null,
});

const HISTORY: HistoryEvent[] = [
  share(CLIENT_A, COMPLIANT, "meeting_completed"),
  share(CLIENT_A, SMOKER, "shared"),
  share(CLIENT_A, SMOKING_BLANK, "shared"),
  share(CLIENT_A, WANTS_YOUNGER, "accepted"),
  share(CLIENT_B, COMPLIANT, "accepted"),
  share(CLIENT_B, SMOKER, "shared"),
  share(CLIENT_B, FAR_SMOKER, "shared"),
  share(CLIENT_B, FAR_RELOCATION_BLANK, "shared"),
  share(CLIENT_B, SMOKING_BLANK, "meeting_completed"),
  share(CLIENT_B, SMOKER_RELOCATION_BLANK, "shared"),
];

const REPLAYED = replayHistory(
  HISTORY,
  [CLIENT_A, CLIENT_B],
  [
    COMPLIANT,
    SMOKER,
    SMOKING_BLANK,
    WANTS_YOUNGER,
    FAR_SMOKER,
    FAR_RELOCATION_BLANK,
    SMOKER_RELOCATION_BLANK,
  ],
);

describe("computeFunnel", () => {
  const stages: FunnelStage[] = [
    "shared",
    "shared",
    "shared",
    "shared",
    "accepted",
    "accepted",
    "contact_shared",
    "conversation_started",
    "meeting_fixed",
    "meeting_completed",
  ];
  const history = stages.map((stage) => share(CLIENT_A, COMPLIANT, stage));

  it("counts every event that reached each stage or beyond", () => {
    const rows = computeFunnel(history);

    expect(rows.map(({ label, count }) => [label, count])).toEqual([
      ["Profiles shared", 10],
      ["Accepted", 6],
      ["Contact shared", 4],
      ["Conversation started", 3],
      ["Meeting fixed", 2],
      ["Meeting completed", 1],
    ]);
  });

  it("reports step conversion and loss from the previous stage", () => {
    const rows = computeFunnel(history);

    expect(rows.map(({ stepConversion }) => stepConversion)).toEqual([
      null,
      6 / 10,
      4 / 6,
      3 / 4,
      2 / 3,
      1 / 2,
    ]);
    expect(rows.map(({ lost }) => lost)).toEqual([null, 4, 2, 1, 1, 1]);
  });

  it("computes the acceptance rate as accepted over shared", () => {
    expect(acceptanceRate(history)).toBe(0.6);
  });

  it("reports zeros for an empty history", () => {
    expect(acceptanceRate([])).toBe(0);
    expect(computeFunnel([]).map(({ count }) => count)).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
  });
});

describe("replayHistory", () => {
  it("marks every stage past shared as accepted", () => {
    expect(REPLAYED.map(({ isAccepted }) => isAccepted)).toEqual([
      true,
      false,
      false,
      true,
      true,
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  it("fails fast on an unknown client id", () => {
    const orphan = share(makeClient({ id: "cl_missing" }), COMPLIANT, "shared");

    expect(() => replayHistory([orphan], [CLIENT_A], [COMPLIANT])).toThrow(
      /cl_missing/,
    );
  });

  it("fails fast on an unknown candidate id", () => {
    const orphan = share(CLIENT_A, makeProfile({ id: "cd_missing" }), "shared");

    expect(() => replayHistory([orphan], [CLIENT_A], [COMPLIANT])).toThrow(
      /cd_missing/,
    );
  });
});

describe("summarizeReplay", () => {
  it("separates blocked and needs-check sends, rejections and acceptances", () => {
    expect(summarizeReplay(REPLAYED)).toEqual({
      sends: 10,
      blocked: 5,
      needsCheck: 3,
      rejectionsBlocked: 4,
      rejectionsNeedsCheck: 2,
      acceptancesBlocked: 1,
      accepted: 4,
      meetingsCompleted: 2,
    });
  });

  it("splits by matchmaker", () => {
    const counts = byMatchmaker(REPLAYED, (rows) => {
      const { sends, blocked, needsCheck } = summarizeReplay(rows);
      return { sends, blocked, needsCheck };
    });

    expect(counts).toEqual({
      all: { sends: 10, blocked: 5, needsCheck: 3 },
      mm_a: { sends: 4, blocked: 2, needsCheck: 1 },
      mm_b: { sends: 6, blocked: 3, needsCheck: 2 },
    });
  });
});

describe("engineViolationRate", () => {
  it("counts blocked sends only; needs check is never a violation", () => {
    const summary = summarizeReplay(REPLAYED);

    expect(engineViolationRate(summary)).toBe(0.5);
  });

  it("is zero with no sends", () => {
    expect(engineViolationRate(summarizeReplay([]))).toBe(0);
  });
});

describe("blocksByField", () => {
  it("attributes blocks to failing fields and checks to blank fields, per matchmaker", () => {
    expect(blocksByField(REPLAYED)).toEqual([
      {
        field: "smoking",
        blocked: { all: 4, mm_a: 1, mm_b: 3 },
        needsCheck: { all: 2, mm_a: 1, mm_b: 1 },
      },
      {
        field: "city",
        blocked: { all: 1, mm_a: 0, mm_b: 1 },
        needsCheck: { all: 1, mm_a: 0, mm_b: 1 },
      },
      {
        field: "age",
        blocked: { all: 1, mm_a: 1, mm_b: 0 },
        needsCheck: { all: 0, mm_a: 0, mm_b: 0 },
      },
    ]);
  });

  it("attributes a candidate-side failure to the candidate's rule field", () => {
    const acceptedButBlocked = REPLAYED.filter(
      ({ isAccepted, evaluation }) =>
        isAccepted && evaluation.status === "blocked",
    );

    expect(blocksByField(acceptedButBlocked).map(({ field }) => field)).toEqual(
      ["age"],
    );
  });

  it("does not count blank fields on a send that is already blocked", () => {
    const smokerWithBlankRelocation = REPLAYED.filter(
      ({ event }) => event.candidateId === SMOKER_RELOCATION_BLANK.id,
    );

    expect(
      blocksByField(smokerWithBlankRelocation).map(({ field }) => field),
    ).toEqual(["smoking"]);
  });
});

describe("projectImpact", () => {
  const assumptions = {
    searchHoursPerClientPerWeek: 2,
    clientCount: 5,
    days: 14,
  };

  it("derives the rates the scenarios are built from", () => {
    const projection = projectImpact(REPLAYED, assumptions);

    expect(projection.rates).toEqual({
      meetingsPerAccepted: 0.5,
      compliantRate: 0.6,
      hoursPerSend: 2,
    });
  });

  it("keeps the replay's own numbers as the baseline", () => {
    const projection = projectImpact(REPLAYED, assumptions);

    expect(projection.baseline).toEqual({
      sends: 10,
      accepted: 4,
      acceptanceRate: 0.4,
      meetings: 2,
    });
  });

  it("drops violating sends without replacing them", () => {
    const projection = projectImpact(REPLAYED, assumptions);

    expect(projection.dropped).toEqual({
      sends: 5,
      accepted: 3,
      acceptanceRate: 0.6,
      meetings: 1.5,
      sendsAvoided: 5,
      hoursSaved: 10,
    });
  });

  it("replaces violating sends with compliant ones at the compliant rate", () => {
    const projection = projectImpact(REPLAYED, assumptions);

    expect(projection.replaced).toEqual({
      sends: 10,
      accepted: 6,
      acceptanceRate: 0.6,
      meetings: 3,
    });
  });

  it("uses 2 h per client per week for 60 clients over 30 days by default", () => {
    const projection = projectImpact(REPLAYED);

    expect(projection.assumptions).toEqual(DEFAULT_ASSUMPTIONS);
    expect(projection.rates.hoursPerSend).toBeCloseTo((2 * 60 * (30 / 7)) / 10);
  });
});

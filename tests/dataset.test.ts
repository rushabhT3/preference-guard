import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyByKeywords } from "@/classifier/keyword";
import {
  candidates,
  clients,
  feedbackSamples,
  findCandidate,
  findClient,
  history,
  matchmakers,
} from "@/data";
import { constraintField } from "@/domain/fields";
import { classifyPreventability } from "@/domain/preventability";
import { evaluateMutual } from "@/domain/rules";
import { type Client, FUNNEL_STAGES, type Profile } from "@/domain/schemas";
import {
  buildDataset,
  MOCK_DATA_SEED,
  serializeDataset,
} from "../scripts/mock-data/build";

const DATA_DIR = join(import.meta.dirname, "..", "src", "data");
const SIGNAL_FIELDS = [
  "education",
  "incomeBandLakhs",
  "heightCm",
  "familyType",
  "motherTongue",
  "profession",
];
const VALUE_NAMED_FIELDS = [
  "city",
  "age",
  "heightCm",
  "smoking",
  "drinking",
  "maritalStatus",
] as const;

interface PairIds {
  clientId: string;
  candidateId: string;
}

function pairOf({ clientId, candidateId }: PairIds) {
  const client = findClient(clientId);
  const candidate = findCandidate(candidateId);
  if (!client || !candidate)
    throw new Error(`Unknown pair ${clientId}/${candidateId}`);
  return { client, candidate };
}

function judge(text: string, client: Client, candidate: Profile) {
  const { reasons, openness } = classifyByKeywords(text);
  return {
    openness,
    ...classifyPreventability(reasons, client.preferences, candidate),
  };
}

function tally<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items)
    counts[keyOf(item)] = (counts[keyOf(item)] ?? 0) + 1;
  return counts;
}

const pairKey = ({ clientId, candidateId }: PairIds) =>
  `${clientId}|${candidateId}`;
const sharedPairs = new Set(history.map(pairKey));

const replay = history.map((event) => {
  const { client, candidate } = pairOf(event);
  const mutual = evaluateMutual(client, candidate);
  return {
    event,
    client,
    candidate,
    mutual,
    flagged: mutual.clientSide.results.filter(
      (result) => result.outcome !== "pass",
    ),
    reading:
      event.rejectionText === null
        ? null
        : judge(event.rejectionText, client, candidate),
  };
});
const rejections = replay.filter(({ event }) => event.rejectionText !== null);
const acceptances = replay.filter(({ event }) => event.rejectionText === null);
const rejectionsWith = (status: string) =>
  rejections.filter(({ mutual }) => mutual.status === status);

describe("dataset contract", () => {
  it("has two matchmakers, 60 clients split 26/34 and 400 candidates split by gender", () => {
    expect(matchmakers.map(({ id }) => id)).toEqual(["mm_a", "mm_b"]);
    expect(tally(clients, ({ matchmakerId }) => matchmakerId)).toEqual({
      mm_a: 26,
      mm_b: 34,
    });
    expect(tally(candidates, ({ gender }) => gender)).toEqual({
      female: 200,
      male: 200,
    });
  });

  it("shares 435/565 and accepts 191/119, which round to 44% and 21%", () => {
    const accepted = tally(acceptances, ({ event }) => event.matchmakerId);
    expect(tally(replay, ({ event }) => event.matchmakerId)).toEqual({
      mm_a: 435,
      mm_b: 565,
    });
    expect(accepted).toEqual({ mm_a: 191, mm_b: 119 });
    expect([
      Math.round((100 * accepted.mm_a) / 435),
      Math.round((100 * accepted.mm_b) / 565),
    ]).toEqual([44, 21]);
  });

  it("reaches each funnel stage as often as the contract says", () => {
    const depth = (stage: (typeof FUNNEL_STAGES)[number]) =>
      FUNNEL_STAGES.indexOf(stage);
    const reached = FUNNEL_STAGES.map(
      (stage) =>
        history.filter((event) => depth(event.stageReached) >= depth(stage))
          .length,
    );
    expect(reached).toEqual([1000, 310, 210, 150, 75, 42]);
  });

  it("dates every send inside the 30 days ending 2026-09-24", () => {
    const dates = history.map(({ sharedAt }) => sharedAt).sort();
    expect(dates[0] >= "2026-08-26").toBe(true);
    expect(dates[dates.length - 1] < "2026-09-25").toBe(true);
  });
});

describe("replay over the history", () => {
  it("blocks 200 rejections, flags 41 for a check and wrongly blocks 10 acceptances", () => {
    expect(tally(rejections, ({ mutual }) => mutual.status)).toEqual({
      blocked: 200,
      needs_check: 41,
      clear: 449,
    });
    expect(tally(acceptances, ({ mutual }) => mutual.status)).toEqual({
      blocked: 10,
      clear: 300,
    });
  });

  it("splits the 241 caught rejections 61 for A and 180 for B", () => {
    const caught = rejections.filter(({ mutual }) => mutual.status !== "clear");
    expect(tally(caught, ({ event }) => event.matchmakerId)).toEqual({
      mm_a: 61,
      mm_b: 180,
    });
  });

  it("breaks exactly one client rule per flagged send and never the candidate's own rules", () => {
    const flaggedCounts = replay.map(({ mutual, flagged }) => [
      mutual.status === "clear",
      flagged.length,
    ]);
    expect(
      flaggedCounts.filter(([isClear, count]) =>
        isClear ? count !== 0 : count !== 1,
      ),
    ).toEqual([]);
    expect(
      replay.filter(({ mutual }) => mutual.candidateSide?.status === "blocked"),
    ).toEqual([]);
  });

  it("spreads the 241 over at least five dealbreaker fields, unevenly", () => {
    const counts = Object.values(
      tally(
        rejections.filter(({ flagged }) => flagged.length > 0),
        ({ flagged }) => flagged[0].field,
      ),
    );
    expect(counts.length).toBeGreaterThanOrEqual(5);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(3 * Math.min(...counts));
  });
});

describe("rejection text", () => {
  it("reads blocked rejections as preventable and needs-check ones as data gaps", () => {
    expect(
      tally(
        rejectionsWith("blocked"),
        ({ reading }) => reading?.overall ?? "unread",
      ),
    ).toEqual({ preventable: 200 });
    expect(
      tally(
        rejectionsWith("needs_check"),
        ({ reading }) => reading?.overall ?? "unread",
      ),
    ).toEqual({ data_gap: 41 });
  });

  it("names the violating value in blocked rejections", () => {
    const unnamed = rejectionsWith("blocked").filter(
      ({ event, candidate, flagged }) => {
        const field = VALUE_NAMED_FIELDS.find(
          (name) => name === flagged[0].field,
        );
        const text = event.rejectionText?.toLowerCase() ?? "";
        return (
          field !== undefined &&
          !text.includes(String(candidate[field]).toLowerCase())
        );
      },
    );
    expect(unnamed).toEqual([]);
  });

  it("never reads a clear rejection as a rule problem", () => {
    const verdicts = new Set(
      rejectionsWith("clear").map(({ reading }) => reading?.overall),
    );
    expect([...verdicts].sort()).toEqual([
      "new_signal",
      "soft_mismatch",
      "subjective",
    ]);
  });

  it("repeats the same new signal for at least three clients", () => {
    const signals = rejections.flatMap(({ client, reading }) =>
      (reading?.verdicts ?? [])
        .filter(({ verdict }) => verdict === "new_signal")
        .map(({ reason }) => `${client.id}|${reason.field}`),
    );
    const repeated = Object.entries(tally(signals, (signal) => signal)).filter(
      ([, count]) => count >= 2,
    );
    expect(
      new Set(repeated.map(([signal]) => signal.split("|")[0])).size,
    ).toBeGreaterThanOrEqual(3);
  });

  it("marks about fifteen rejections as open to later", () => {
    const openLater = rejections.filter(
      ({ reading }) => reading?.openness === "open_later",
    ).length;
    expect(openLater).toBeGreaterThanOrEqual(12);
    expect(openLater).toBeLessThanOrEqual(20);
  });
});

describe("feedback samples", () => {
  it("cover all six verdicts on real, unshared client/candidate pairs", () => {
    const verdicts = feedbackSamples.map((sample) => {
      const { client, candidate } = pairOf(sample);
      return judge(sample.feedbackText, client, candidate).overall;
    });
    expect(feedbackSamples).toHaveLength(12);
    expect(
      feedbackSamples.filter((sample) => sharedPairs.has(pairKey(sample))),
    ).toEqual([]);
    expect(new Set(verdicts)).toEqual(
      new Set([
        "preventable",
        "data_gap",
        "preference_drift",
        "new_signal",
        "soft_mismatch",
        "subjective",
      ]),
    );
  });
});

describe("entities", () => {
  it("never shares a candidate twice to one client or to a client of the same gender", () => {
    expect(sharedPairs.size).toBe(history.length);
    expect(
      replay.filter(
        ({ client, candidate }) => client.gender === candidate.gender,
      ),
    ).toEqual([]);
    expect(
      replay.filter(
        ({ client, event }) => client.matchmakerId !== event.matchmakerId,
      ),
    ).toEqual([]);
  });

  it("keeps clients fully known and leaves key candidate fields unknown about 15% of the time", () => {
    expect(
      clients.filter((client) => Object.values(client).includes(null)),
    ).toEqual([]);
    for (const field of ["smoking", "drinking", "wantsChildren"] as const) {
      const share =
        candidates.filter((candidate) => candidate[field] === null).length /
        candidates.length;
      expect(share, field).toBeGreaterThan(0.1);
      expect(share, field).toBeLessThan(0.2);
    }
  });

  it("gives clients 3-6 hard rules, 2-4 soft preferences and two open signal fields", () => {
    const misshapen = clients.filter(({ preferences: { hard, soft } }) => {
      const covered = new Set<string>([
        ...hard.map(constraintField),
        ...soft.map(({ field }) => field),
      ]);
      const openSignals = SIGNAL_FIELDS.filter((field) => !covered.has(field));
      return (
        hard.length < 3 ||
        hard.length > 6 ||
        soft.length < 2 ||
        soft.length > 4 ||
        openSignals.length < 2
      );
    });
    expect(misshapen.map(({ id }) => id)).toEqual([]);
  });

  it("leaves every client an unshared pool with clear, needs-check and blocked candidates", () => {
    const unhealthy = clients.filter((client) => {
      const pool = candidates.filter(
        (candidate) =>
          candidate.gender !== client.gender &&
          !sharedPairs.has(
            pairKey({ clientId: client.id, candidateId: candidate.id }),
          ),
      );
      const statuses = tally(
        pool,
        (candidate) => evaluateMutual(client, candidate).status,
      );
      return (
        (statuses.clear ?? 0) < 5 ||
        (statuses.needs_check ?? 0) < 1 ||
        (statuses.blocked ?? 0) < 3
      );
    });
    expect(unhealthy.map(({ id }) => id)).toEqual([]);
  });

  it("includes candidates whose own rules block a client", () => {
    const blockedByCandidate = clients.some((client) =>
      candidates.some(
        (candidate) =>
          candidate.gender !== client.gender &&
          evaluateMutual(client, candidate).candidateSide?.status === "blocked",
      ),
    );
    expect(blockedByCandidate).toBe(true);
  });
});

describe("generator", () => {
  it("rebuilds the committed files byte for byte from the seed", () => {
    const files = serializeDataset(buildDataset(MOCK_DATA_SEED));
    expect(serializeDataset(buildDataset(MOCK_DATA_SEED))).toEqual(files);
    for (const [fileName, contents] of files) {
      const committed = readFileSync(
        join(DATA_DIR, fileName),
        "utf8",
      ).replaceAll("\r\n", "\n");
      expect(committed === contents, fileName).toBe(true);
    }
  });
});

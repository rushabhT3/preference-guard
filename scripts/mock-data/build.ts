import type { Outcome } from "@/domain/rules";
import type {
  Client,
  FeedbackSample,
  FunnelStage,
  HistoryEvent,
  Matchmaker,
  Profile,
} from "@/domain/schemas";
import { createRng, type Rng } from "./prng";
import {
  createClient,
  type Gender,
  randomProfile,
  type ViolationField,
  withOwnPreferences,
} from "./profiles";
import { CandidateRoster } from "./roster";
import {
  openReasonTexts,
  type Pair,
  ruleOn,
  violationText,
  writeFeedbackSamples,
} from "./templates";
import { cells, rows } from "./vocabulary";

export interface Dataset {
  matchmakers: Matchmaker[];
  clients: Client[];
  candidates: Profile[];
  history: HistoryEvent[];
  feedbackSamples: FeedbackSample[];
}

type SlotKind = keyof typeof SLOT_OUTCOMES;

interface Slot {
  kind: SlotKind;
  field: ViolationField | null;
}

interface Casting {
  client: Client;
  candidate: Profile;
  slot: Slot;
  clientIndex: number;
}

export const MOCK_DATA_SEED = 20260925;
const CANDIDATE_COUNT = 400;
const MATCHMAKERS: Matchmaker[] = [
  { id: "mm_a", name: "Matchmaker A" },
  { id: "mm_b", name: "Matchmaker B" },
];
const CLIENT_COUNTS = [26, 34];
const SLOT_OUTCOMES = {
  accepted_clear: "pass",
  rejected_clear: "pass",
  rejected_blocked: "fail",
  rejected_needs_check: "unknown",
  accepted_violating: "fail",
} satisfies Record<string, Outcome>;

const SEND_TABLE = `
kind                 | field         | A   | B
accepted_clear       |               | 187 | 113
rejected_clear       |               | 183 | 266
rejected_blocked     | smoking       | 14  | 36
rejected_needs_check | smoking       | 3   | 7
rejected_blocked     | city          | 11  | 31
rejected_needs_check | city          | 3   | 7
accepted_violating   | city          | 1   | 1
rejected_blocked     | drinking      | 7   | 21
rejected_needs_check | drinking      | 3   | 7
accepted_violating   | drinking      | 0   | 1
rejected_blocked     | diet          | 7   | 23
accepted_violating   | diet          | 0   | 1
rejected_blocked     | age           | 6   | 18
accepted_violating   | age           | 2   | 2
rejected_blocked     | wantsChildren | 2   | 8
rejected_needs_check | wantsChildren | 2   | 9
rejected_blocked     | maritalStatus | 2   | 7
rejected_blocked     | heightCm      | 1   | 6
accepted_violating   | heightCm      | 1   | 1
`;

const REACHED_AT_LEAST: ReadonlyArray<readonly [FunnelStage, number]> = [
  ["accepted", 310],
  ["contact_shared", 210],
  ["conversation_started", 150],
  ["meeting_fixed", 75],
  ["meeting_completed", 42],
];

const FIRST_WORKDAY_START = Date.parse("2026-08-26T10:00:00+05:30");
const WINDOW_DAYS = 30;
const WORKDAY_MINUTES = 9 * 60;
const DAY_MINUTES = 24 * 60;
const MINUTE_MS = 60_000;
const DAYS_PER_STAGE_AFTER_ACCEPTANCE = 3;

const DATA_FILES: ReadonlyArray<readonly [keyof Dataset, string]> = [
  ["matchmakers", "matchmakers.json"],
  ["clients", "clients.json"],
  ["candidates", "candidates.json"],
  ["history", "history.json"],
  ["feedbackSamples", "feedback-samples.json"],
];

const repeat = <T>(count: number, value: T): T[] =>
  Array.from({ length: count }, () => value);
const entityId = (prefix: string, index: number, width: number) =>
  `${prefix}_${String(index).padStart(width, "0")}`;
const balancedGenders = (count: number): Gender[] => [
  ...repeat<Gender>(Math.ceil(count / 2), "female"),
  ...repeat<Gender>(Math.floor(count / 2), "male"),
];
const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

function spread(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  return Array.from(
    { length: parts },
    (_, index) => base + (index < total % parts ? 1 : 0),
  );
}

function chunk<T>(items: readonly T[], sizes: readonly number[]): T[][] {
  let offset = 0;
  return sizes.map((size) => {
    offset += size;
    return items.slice(offset - size, offset);
  });
}

function slotsFor(matchmakerIndex: number): Slot[] {
  return rows(SEND_TABLE)
    .slice(1)
    .flatMap((row) => {
      const [kind, field, ...counts] = cells(row);
      if (!(kind in SLOT_OUTCOMES))
        throw new Error(`Unknown slot kind ${kind}`);
      const slot = {
        kind: kind as SlotKind,
        field: (field || null) as ViolationField | null,
      };
      return repeat(Number(counts[matchmakerIndex]), slot);
    });
}

function dealSlots(matchmakerIndex: number, rng: Rng): Slot[][] {
  const slots = slotsFor(matchmakerIndex);
  const violations = slots.filter(({ field }) => field !== null);
  const clear = rng.shuffle(slots.filter(({ field }) => field === null));
  const clientCount = CLIENT_COUNTS[matchmakerIndex];
  const sends = rng.shuffle(spread(slots.length, clientCount));
  const violationCounts = rng.shuffle(spread(violations.length, clientCount));
  const clearChunks = chunk(
    clear,
    sends.map((count, index) => count - violationCounts[index]),
  );
  return chunk(violations, violationCounts).map((own, index) => [
    ...own,
    ...clearChunks[index],
  ]);
}

function planClients(rng: Rng): Array<{ client: Client; slots: Slot[] }> {
  const dealt = MATCHMAKERS.flatMap(({ id }, index) =>
    dealSlots(index, rng).map((slots) => ({ matchmakerId: id, slots })),
  );
  const genders = rng.shuffle(balancedGenders(dealt.length));
  return dealt.map(({ matchmakerId, slots }, index) => {
    const fields = slots.flatMap(({ field }) => (field ? [field] : []));
    const client = createClient(rng, {
      id: entityId("cl", index + 1, 3),
      gender: genders[index],
      matchmakerId,
      requiredFields: [...new Set(fields)],
      needsUnknownCity: slots.some(
        ({ kind, field }) =>
          kind === "rejected_needs_check" && field === "city",
      ),
    });
    return { client, slots };
  });
}

function createCandidates(rng: Rng): Profile[] {
  return rng.shuffle(balancedGenders(CANDIDATE_COUNT)).map((gender, index) => {
    const profile = randomProfile(rng, {
      id: entityId("cd", index + 1, 3),
      gender,
      allowUnknowns: true,
    });
    return withOwnPreferences(profile, rng);
  });
}

function castSlots(
  plans: ReturnType<typeof planClients>,
  roster: CandidateRoster,
): Casting[] {
  const queue = plans.flatMap(({ client, slots }, clientIndex) =>
    slots.map((slot) => ({ client, slot, clientIndex })),
  );
  const violationsFirst = [
    ...queue.filter(({ slot }) => slot.field !== null),
    ...queue.filter(({ slot }) => slot.field === null),
  ];
  return violationsFirst.map((entry) => {
    const requirement = {
      field: entry.slot.field,
      outcome: SLOT_OUTCOMES[entry.slot.kind],
    };
    return { ...entry, candidate: roster.cast(entry.client, requirement) };
  });
}

function violationTexts(
  castings: readonly Casting[],
  rng: Rng,
): Array<[Casting, string]> {
  return castings.flatMap((casting): Array<[Casting, string]> => {
    const { kind, field } = casting.slot;
    const rule = field && ruleOn(casting.client, field);
    if (!rule || kind === "accepted_violating") return [];
    const isHidden = kind === "rejected_needs_check";
    return [
      [
        casting,
        violationText({ rule, candidate: casting.candidate, isHidden }, rng),
      ],
    ];
  });
}

function openRejectionTexts(
  castings: readonly Casting[],
  rng: Rng,
): Array<[Casting, string]> {
  const open = castings.filter(({ slot }) => slot.kind === "rejected_clear");
  return [...Map.groupBy(open, ({ client }) => client.id).values()].flatMap(
    (group) => {
      const { client, clientIndex } = group[0];
      const candidates = group.map(({ candidate }) => candidate);
      const texts = openReasonTexts({ client, clientIndex, candidates }, rng);
      return group.map((casting, index): [Casting, string] => [
        casting,
        texts[index],
      ]);
    },
  );
}

function acceptedStages(): FunnelStage[] {
  return REACHED_AT_LEAST.flatMap(([stage, reached], index) =>
    repeat(reached - (REACHED_AT_LEAST[index + 1]?.[1] ?? 0), stage),
  );
}

function sharedAt(stage: FunnelStage, rng: Rng): string {
  const stagesPastAcceptance = Math.max(
    0,
    REACHED_AT_LEAST.findIndex(([reached]) => reached === stage),
  );
  const lastDay =
    WINDOW_DAYS - 1 - DAYS_PER_STAGE_AFTER_ACCEPTANCE * stagesPastAcceptance;
  const minutes =
    rng.int(0, lastDay) * DAY_MINUTES + rng.int(0, WORKDAY_MINUTES - 1);
  return new Date(FIRST_WORKDAY_START + minutes * MINUTE_MS)
    .toISOString()
    .replace(".000Z", "Z");
}

function compareEvents(
  left: Omit<HistoryEvent, "id">,
  right: Omit<HistoryEvent, "id">,
): number {
  return (
    compareText(left.sharedAt, right.sharedAt) ||
    compareText(left.clientId, right.clientId) ||
    compareText(left.candidateId, right.candidateId)
  );
}

function toHistory(castings: readonly Casting[], rng: Rng): HistoryEvent[] {
  const texts = new Map([
    ...violationTexts(castings, rng),
    ...openRejectionTexts(castings, rng),
  ]);
  const accepted = castings.filter((casting) => !texts.has(casting));
  const stages = rng.shuffle(acceptedStages());
  if (stages.length !== accepted.length)
    throw new Error("Acceptances do not match the funnel");
  const stageOf = new Map(
    accepted.map((casting, index) => [casting, stages[index]]),
  );
  const events = castings.map((casting) => {
    const stageReached = stageOf.get(casting) ?? "shared";
    return {
      sharedAt: sharedAt(stageReached, rng),
      matchmakerId: casting.client.matchmakerId,
      clientId: casting.client.id,
      candidateId: casting.candidate.id,
      stageReached,
      rejectionText: texts.get(casting) ?? null,
    };
  });
  return events
    .sort(compareEvents)
    .map((event, index) => ({ id: entityId("ev", index + 1, 4), ...event }));
}

function feedbackSamples(
  clients: readonly Client[],
  roster: CandidateRoster,
): FeedbackSample[] {
  const pairs: Pair[] = clients.flatMap((client) =>
    roster.profiles
      .filter(
        (candidate) =>
          candidate.gender !== client.gender &&
          !roster.isShared(client.id, candidate.id),
      )
      .map((candidate) => ({ client, candidate })),
  );
  return writeFeedbackSamples(pairs).map(
    ({ client, candidate, text }, index) => ({
      id: entityId("fs", index + 1, 2),
      clientId: client.id,
      candidateId: candidate.id,
      feedbackText: text,
    }),
  );
}

export function serializeDataset(
  dataset: Dataset,
): Array<[fileName: string, contents: string]> {
  return DATA_FILES.map(([key, fileName]) => [
    fileName,
    `${JSON.stringify(dataset[key], null, 2)}\n`,
  ]);
}

export function buildDataset(seed: number): Dataset {
  const rng = createRng(seed);
  const plans = planClients(rng);
  const clients = plans.map(({ client }) => client);
  const roster = new CandidateRoster(createCandidates(rng), rng);
  const castings = castSlots(plans, roster);
  roster.balancePools(clients);
  return {
    matchmakers: MATCHMAKERS,
    clients,
    candidates: roster.profiles,
    history: toHistory(castings, rng),
    feedbackSamples: feedbackSamples(clients, roster),
  };
}

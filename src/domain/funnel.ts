import {
  evaluateMutual,
  type MutualEvaluation,
  type Outcome,
  type Status,
} from "./rules";
import {
  type Client,
  type ConstraintField,
  FUNNEL_STAGES,
  type FunnelStage,
  type HistoryEvent,
  type MatchmakerId,
  type Profile,
} from "./schemas";

export type MatchmakerScope = "all" | MatchmakerId;

export const STAGE_LABELS: Record<FunnelStage, string> = {
  shared: "Profiles shared",
  accepted: "Accepted",
  contact_shared: "Contact shared",
  conversation_started: "Conversation started",
  meeting_fixed: "Meeting fixed",
  meeting_completed: "Meeting completed",
};

export interface FunnelRow {
  stage: FunnelStage;
  label: string;
  count: number;
  stepConversion: number | null;
  lost: number | null;
}

export interface ReplayedEvent {
  event: HistoryEvent;
  evaluation: MutualEvaluation;
  isAccepted: boolean;
}

export interface ReplaySummary {
  sends: number;
  blocked: number;
  needsCheck: number;
  rejectionsBlocked: number;
  rejectionsNeedsCheck: number;
  acceptancesBlocked: number;
  accepted: number;
  meetingsCompleted: number;
}

export interface FieldBlockRow {
  field: ConstraintField;
  blocked: Record<MatchmakerScope, number>;
  needsCheck: Record<MatchmakerScope, number>;
}

export interface ImpactAssumptions {
  searchHoursPerClientPerWeek: number;
  clientCount: number;
  days: number;
}

export const DEFAULT_ASSUMPTIONS: ImpactAssumptions = {
  searchHoursPerClientPerWeek: 2,
  clientCount: 60,
  days: 30,
};

export interface ScenarioOutcome {
  sends: number;
  accepted: number;
  acceptanceRate: number;
  meetings: number;
}

export interface DroppedScenario extends ScenarioOutcome {
  sendsAvoided: number;
  hoursSaved: number;
}

export interface ProjectionRates {
  meetingsPerAccepted: number;
  compliantRate: number;
  hoursPerSend: number;
}

export interface ImpactProjection {
  assumptions: ImpactAssumptions;
  summary: ReplaySummary;
  rates: ProjectionRates;
  baseline: ScenarioOutcome;
  dropped: DroppedScenario;
  replaced: ScenarioOutcome;
}

const DAYS_PER_WEEK = 7;

const ATTRIBUTED_OUTCOME: Record<Status, Outcome | null> = {
  blocked: "fail",
  needs_check: "unknown",
  clear: null,
};

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

function countReaching(history: HistoryEvent[], stage: FunnelStage): number {
  const threshold = FUNNEL_STAGES.indexOf(stage);
  return history.filter(
    (event) => FUNNEL_STAGES.indexOf(event.stageReached) >= threshold,
  ).length;
}

export function computeFunnel(history: HistoryEvent[]): FunnelRow[] {
  const counts = FUNNEL_STAGES.map((stage) => countReaching(history, stage));
  return FUNNEL_STAGES.map((stage, index) => {
    const count = counts[index];
    const previous = index === 0 ? null : counts[index - 1];
    return {
      stage,
      label: STAGE_LABELS[stage],
      count,
      stepConversion: previous === null ? null : ratio(count, previous),
      lost: previous === null ? null : previous - count,
    };
  });
}

export function acceptanceRate(history: HistoryEvent[]): number {
  return ratio(countReaching(history, "accepted"), history.length);
}

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function lookup<T>(index: Map<string, T>, id: string, kind: string): T {
  const item = index.get(id);
  if (item === undefined) throw new Error(`Unknown ${kind} id "${id}"`);
  return item;
}

export function replayHistory(
  history: HistoryEvent[],
  clients: Client[],
  candidates: Profile[],
): ReplayedEvent[] {
  const clientsById = indexById(clients);
  const candidatesById = indexById(candidates);
  return history.map((event) => ({
    event,
    evaluation: evaluateMutual(
      lookup(clientsById, event.clientId, "client"),
      lookup(candidatesById, event.candidateId, "candidate"),
    ),
    isAccepted: event.stageReached !== "shared",
  }));
}

function countWithStatus(rows: ReplayedEvent[], status: Status): number {
  return rows.filter((row) => row.evaluation.status === status).length;
}

export function summarizeReplay(replayed: ReplayedEvent[]): ReplaySummary {
  const rejected = replayed.filter((row) => !row.isAccepted);
  const accepted = replayed.filter((row) => row.isAccepted);
  return {
    sends: replayed.length,
    blocked: countWithStatus(replayed, "blocked"),
    needsCheck: countWithStatus(replayed, "needs_check"),
    rejectionsBlocked: countWithStatus(rejected, "blocked"),
    rejectionsNeedsCheck: countWithStatus(rejected, "needs_check"),
    acceptancesBlocked: countWithStatus(accepted, "blocked"),
    accepted: accepted.length,
    meetingsCompleted: replayed.filter(
      (row) => row.event.stageReached === "meeting_completed",
    ).length,
  };
}

export function byMatchmaker<T>(
  replayed: ReplayedEvent[],
  summarize: (rows: ReplayedEvent[]) => T,
): Record<MatchmakerScope, T> {
  const forMatchmaker = (id: MatchmakerId) =>
    summarize(replayed.filter((row) => row.event.matchmakerId === id));
  return {
    all: summarize(replayed),
    mm_a: forMatchmaker("mm_a"),
    mm_b: forMatchmaker("mm_b"),
  };
}

export function engineViolationRate(summary: ReplaySummary): number {
  return ratio(summary.blocked, summary.sends);
}

function attributedFields(evaluation: MutualEvaluation): ConstraintField[] {
  const outcome = ATTRIBUTED_OUTCOME[evaluation.status];
  const results = [
    ...evaluation.clientSide.results,
    ...(evaluation.candidateSide?.results ?? []),
  ];
  const fields = results
    .filter((result) => result.outcome === outcome)
    .map((result) => result.field);
  return [...new Set(fields)];
}

function zeroTally(): Record<MatchmakerScope, number> {
  return { all: 0, mm_a: 0, mm_b: 0 };
}

function totalAttributed(row: FieldBlockRow): number {
  return row.blocked.all + row.needsCheck.all;
}

function byAttributedTotal(a: FieldBlockRow, b: FieldBlockRow): number {
  return (
    totalAttributed(b) - totalAttributed(a) || a.field.localeCompare(b.field)
  );
}

export function blocksByField(replayed: ReplayedEvent[]): FieldBlockRow[] {
  const rows = new Map<ConstraintField, FieldBlockRow>();
  for (const { event, evaluation } of replayed) {
    for (const field of attributedFields(evaluation)) {
      const row = rows.get(field) ?? {
        field,
        blocked: zeroTally(),
        needsCheck: zeroTally(),
      };
      const tally =
        evaluation.status === "blocked" ? row.blocked : row.needsCheck;
      tally.all += 1;
      tally[event.matchmakerId] += 1;
      rows.set(field, row);
    }
  }
  return [...rows.values()].sort(byAttributedTotal);
}

function scenario(
  sends: number,
  accepted: number,
  meetings: number,
): ScenarioOutcome {
  return { sends, accepted, acceptanceRate: ratio(accepted, sends), meetings };
}

function projectionRates(
  summary: ReplaySummary,
  assumptions: ImpactAssumptions,
): ProjectionRates {
  const searchHours =
    assumptions.searchHoursPerClientPerWeek *
    assumptions.clientCount *
    (assumptions.days / DAYS_PER_WEEK);
  return {
    meetingsPerAccepted: ratio(summary.meetingsCompleted, summary.accepted),
    compliantRate: ratio(
      summary.accepted - summary.acceptancesBlocked,
      summary.sends - summary.blocked,
    ),
    hoursPerSend: ratio(searchHours, summary.sends),
  };
}

function dropViolations(
  summary: ReplaySummary,
  rates: ProjectionRates,
): DroppedScenario {
  const accepted = summary.accepted - summary.acceptancesBlocked;
  return {
    ...scenario(
      summary.sends - summary.blocked,
      accepted,
      accepted * rates.meetingsPerAccepted,
    ),
    sendsAvoided: summary.blocked,
    hoursSaved: summary.blocked * rates.hoursPerSend,
  };
}

function replaceViolations(
  summary: ReplaySummary,
  rates: ProjectionRates,
): ScenarioOutcome {
  const accepted = summary.sends * rates.compliantRate;
  return {
    sends: summary.sends,
    accepted,
    acceptanceRate: rates.compliantRate,
    meetings: accepted * rates.meetingsPerAccepted,
  };
}

export function projectImpact(
  replayed: ReplayedEvent[],
  assumptions: ImpactAssumptions = DEFAULT_ASSUMPTIONS,
): ImpactProjection {
  const summary = summarizeReplay(replayed);
  const rates = projectionRates(summary, assumptions);
  return {
    assumptions,
    summary,
    rates,
    baseline: scenario(
      summary.sends,
      summary.accepted,
      summary.meetingsCompleted,
    ),
    dropped: dropViolations(summary, rates),
    replaced: replaceViolations(summary, rates),
  };
}

import { candidates, clients, history, matchmakers } from "@/data";
import {
  blocksByField,
  byMatchmaker,
  computeFunnel,
  engineViolationRate,
  type MatchmakerScope,
  projectImpact,
  replayHistory,
  summarizeReplay,
} from "@/domain/funnel";

export function scopeLabels(): Record<MatchmakerScope, string> {
  const nameOf = (scope: MatchmakerScope) =>
    matchmakers.find(({ id }) => id === scope)?.name ?? scope;
  return { mm_a: nameOf("mm_a"), mm_b: nameOf("mm_b"), all: "All" };
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

function historyPeriod(): string {
  const dates = history.map(({ sharedAt }) => Date.parse(sharedAt));
  return DATE_FORMAT.formatRange(Math.min(...dates), Math.max(...dates));
}

export function impactView() {
  const replayed = replayHistory(history, clients, candidates);
  const summaries = byMatchmaker(replayed, summarizeReplay);
  return {
    labels: scopeLabels(),
    period: historyPeriod(),
    funnel: computeFunnel(history),
    summaries,
    violationRates: {
      all: engineViolationRate(summaries.all),
      mm_a: engineViolationRate(summaries.mm_a),
      mm_b: engineViolationRate(summaries.mm_b),
    },
    fieldRows: blocksByField(replayed),
    projection: projectImpact(replayed),
  };
}

export type ImpactView = ReturnType<typeof impactView>;

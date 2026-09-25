import type {
  CandidateView,
  ClientGroup,
  ClientOption,
  ClientView,
} from "@/components/workspace/types";
import { candidates, clients, history, matchmakers } from "@/data";
import { FIELD_LABELS } from "@/domain/fields";
import {
  acceptanceRate,
  engineViolationRate,
  replayHistory,
  summarizeReplay,
} from "@/domain/funnel";
import { candidatePool } from "@/domain/pool";
import {
  formatFit,
  type RankedCandidate,
  rankCandidates,
  type SoftFit,
} from "@/domain/ranking";
import type { ConstraintResult, Outcome, Side } from "@/domain/rules";
import type { Client, ConstraintField } from "@/domain/schemas";

const GAP_QUESTIONS: Partial<Record<ConstraintField, string>> = {
  city: "Would you be open to relocating after marriage?",
  openToRelocate: "Would you be open to relocating after marriage?",
  hasChildren: "Do you have children?",
  wantsChildren: "Do you want children in future?",
  smoking: "Do you smoke: never, occasionally or regularly?",
  drinking: "Do you drink: never, socially or regularly?",
  diet: "What is your diet: veg, eggetarian, non-veg, vegan or Jain?",
  community: "Which community do you belong to?",
  familyType: "Do you live in a nuclear or a joint family?",
};

const TOP_REASON_COUNT = 2;

function gapLabel(field: ConstraintField): string {
  return field === "city" ? "relocation" : FIELD_LABELS[field].toLowerCase();
}

function resultsWith(ranked: RankedCandidate, outcome: Outcome) {
  const { clientSide, candidateSide } = ranked.evaluation;
  const tag = (side: Side) => (result: ConstraintResult) => ({
    ...result,
    side,
  });
  return [
    ...clientSide.results.map(tag("client")),
    ...(candidateSide?.results ?? []).map(tag("candidate")),
  ].filter((result) => result.outcome === outcome);
}

function questionForField(field: ConstraintField): string {
  return (
    GAP_QUESTIONS[field] ??
    `Could you confirm your ${FIELD_LABELS[field].toLowerCase()}?`
  );
}

function candidateQuestion(
  fields: ConstraintField[],
  name: string,
): string | null {
  if (fields.length === 0) return null;
  const questions = [...new Set(fields.map(questionForField))];
  const firstName = name.split(" ")[0];
  return `Hi ${firstName}, before we share your profile, could you confirm a detail or two? ${questions.join(" ")}`;
}

function fitFields(fit: SoftFit) {
  return {
    fitScore: fit.low,
    fitCaption: fit.unknownCount > 0 ? `up to ${fit.high}` : "known fit",
    fitLabel: formatFit(fit),
    reasons: fit.matched.slice(0, TOP_REASON_COUNT).map(({ label }) => label),
  };
}

function gapFields(ranked: RankedCandidate) {
  const unknowns = resultsWith(ranked, "unknown");
  const clientGapFields = unknowns
    .filter(({ side }) => side === "client")
    .map(({ field }) => field);
  return {
    gaps: unknowns.map(({ side, message, field }) => ({
      side,
      message,
      fieldLabel: gapLabel(field),
    })),
    question: candidateQuestion(clientGapFields, ranked.candidate.name),
  };
}

function toCandidateView(ranked: RankedCandidate): CandidateView {
  const { candidate, evaluation, fit } = ranked;
  const { age, heightCm, city, profession } = candidate;
  return {
    id: candidate.id,
    name: candidate.name,
    meta: [`${age}`, `${heightCm} cm`, city, profession].join(" · "),
    status: evaluation.status,
    blockers: resultsWith(ranked, "fail").map(({ side, message }) => ({
      side,
      message,
    })),
    ...fitFields(fit),
    ...gapFields(ranked),
  };
}

function clientStats(client: Client): ClientView["stats"] {
  const events = history.filter((event) => event.clientId === client.id);
  const summary = summarizeReplay(replayHistory(events, clients, candidates));
  return {
    sends: events.length,
    acceptance: acceptanceRate(events),
    violationRate: engineViolationRate(summary),
  };
}

function toClientOption(client: Client): ClientOption {
  return {
    id: client.id,
    name: client.name,
    meta: `${client.age} · ${client.city}`,
  };
}

export function clientGroups(): ClientGroup[] {
  return matchmakers.map((matchmaker) => ({
    matchmakerName: matchmaker.name,
    clients: clients
      .filter((client) => client.matchmakerId === matchmaker.id)
      .map(toClientOption),
  }));
}

export function selectClient(clientId: string | undefined): Client | undefined {
  return clientId
    ? clients.find((client) => client.id === clientId)
    : clients[0];
}

export function clientView(client: Client): ClientView {
  const matchmaker = matchmakers.find(({ id }) => id === client.matchmakerId);
  return {
    ...toClientOption(client),
    meta: `${client.age} · ${client.city} · ${client.profession}`,
    matchmakerName: matchmaker?.name ?? client.matchmakerId,
    dealbreakers: client.preferences.hard.map(({ id, label, source }) => ({
      id,
      label,
      source,
    })),
    softPreferences: client.preferences.soft.map(({ id, label, weight }) => ({
      id,
      label,
      weight,
    })),
    stats: clientStats(client),
  };
}

export function candidateViews(client: Client): CandidateView[] {
  const pool = candidatePool(client, candidates, history);
  return rankCandidates(client, pool).map(toCandidateView);
}

import type { Client, HistoryEvent, Profile } from "./schemas";

export function candidatePool(
  client: Client,
  candidates: Profile[],
  history: HistoryEvent[],
): Profile[] {
  const sharedIds = new Set(
    history
      .filter((event) => event.clientId === client.id)
      .map((event) => event.candidateId),
  );
  return candidates.filter(
    (candidate) =>
      candidate.gender !== client.gender && !sharedIds.has(candidate.id),
  );
}

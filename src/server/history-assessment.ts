import { classifyByKeywords } from "@/classifier/keyword";
import {
  type AssessedRejection,
  classifyPreventability,
} from "@/domain/preventability";
import type { Client, HistoryEvent, Profile } from "@/domain/schemas";

export interface HistorySource {
  history: HistoryEvent[];
  findCandidate(id: string): Profile | undefined;
}

/**
 * Past rejections are read with the offline keyword classifier: re-reading a whole
 * history through the LLM on every request would cost one API call per rejection.
 */
export function assessPastRejections(
  client: Client,
  source: HistorySource,
): AssessedRejection[] {
  return source.history
    .filter(
      (event) => event.clientId === client.id && event.rejectionText !== null,
    )
    .flatMap((event) => {
      const candidate = source.findCandidate(event.candidateId);
      if (!candidate || event.rejectionText === null) return [];
      const { reasons } = classifyByKeywords(event.rejectionText);
      const { verdicts } = classifyPreventability(
        reasons,
        client.preferences,
        candidate,
      );
      return [{ candidate, verdicts }];
    });
}

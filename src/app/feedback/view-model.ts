import type { PersonOption, SampleView } from "@/components/feedback/types";
import {
  candidates,
  clients,
  feedbackSamples,
  findCandidate,
  findClient,
} from "@/data";
import type { FeedbackSample, Profile } from "@/domain/schemas";

function toPersonOption({
  id,
  name,
  gender,
  age,
  city,
}: Profile): PersonOption {
  return { id, name, gender, meta: `${age} · ${city}` };
}

function toSampleView(sample: FeedbackSample): SampleView {
  const client = findClient(sample.clientId);
  const candidate = findCandidate(sample.candidateId);
  if (!client || !candidate) {
    throw new Error(
      `Feedback sample ${sample.id} points at an unknown client or candidate`,
    );
  }
  return { ...sample, clientName: client.name, candidateName: candidate.name };
}

export function feedbackView() {
  return {
    samples: feedbackSamples.map(toSampleView),
    clients: clients.map(toPersonOption),
    candidates: candidates.map(toPersonOption),
  };
}

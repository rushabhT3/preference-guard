import { z } from "zod";
import {
  type Client,
  ClientSchema,
  FeedbackSampleSchema,
  HistoryEventSchema,
  MatchmakerSchema,
  type Profile,
  ProfileSchema,
} from "@/domain/schemas";
import candidatesJson from "./candidates.json";
import clientsJson from "./clients.json";
import feedbackSamplesJson from "./feedback-samples.json";
import historyJson from "./history.json";
import matchmakersJson from "./matchmakers.json";

export const matchmakers = z.array(MatchmakerSchema).parse(matchmakersJson);
export const clients = z.array(ClientSchema).parse(clientsJson);
export const candidates = z.array(ProfileSchema).parse(candidatesJson);
export const history = z.array(HistoryEventSchema).parse(historyJson);
export const feedbackSamples = z
  .array(FeedbackSampleSchema)
  .parse(feedbackSamplesJson);

const clientsById = new Map(clients.map((client) => [client.id, client]));
const candidatesById = new Map(
  candidates.map((candidate) => [candidate.id, candidate]),
);

export function findClient(id: string): Client | undefined {
  return clientsById.get(id);
}

export function findCandidate(id: string): Profile | undefined {
  return candidatesById.get(id);
}

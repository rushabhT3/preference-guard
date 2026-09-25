import { z } from "zod";
import type { ClassifyInput, RejectionClassifier } from "@/classifier/types";
import {
  type AssessedRejection,
  classifyPreventability,
  type PreferenceSuggestion,
  type ReasonVerdict,
  suggestPreferenceUpdates,
  type Verdict,
} from "@/domain/preventability";
import type {
  Client,
  Profile,
  RejectionClassification,
} from "@/domain/schemas";

export const MAX_FEEDBACK_LENGTH = 1000;

export const ClassifyRequestSchema = z.object({
  clientId: z.string().min(1),
  candidateId: z.string().min(1),
  feedbackText: z
    .string()
    .trim()
    .min(1, "Feedback text is empty")
    .max(
      MAX_FEEDBACK_LENGTH,
      `Feedback text is longer than ${MAX_FEEDBACK_LENGTH} characters`,
    ),
});

type ClassifyRequest = z.infer<typeof ClassifyRequestSchema>;

export interface ClassifyDeps {
  primary: RejectionClassifier;
  fallback: RejectionClassifier;
  findClient(id: string): Client | undefined;
  findCandidate(id: string): Profile | undefined;
  pastRejections(client: Client): AssessedRejection[];
  logError(message: string, context: Record<string, unknown>): void;
}

export interface ClassifyResponse {
  classification: RejectionClassification;
  verdicts: ReasonVerdict[];
  overall: Verdict;
  classifierUsed: string;
  fallbackReason: string | null;
  /** Drafted from this feedback plus the client's past rejections. */
  suggestions: PreferenceSuggestion[];
}

export type ClassifyResult =
  | { status: 200; body: ClassifyResponse }
  | { status: 400 | 404; body: { error: string } };

type ClassifierOutcome = Pick<
  ClassifyResponse,
  "classification" | "classifierUsed" | "fallbackReason"
>;

function notFound(error: string): ClassifyResult {
  return { status: 404, body: { error } };
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
    .join("; ");
}

function errorContext(error: unknown) {
  return error instanceof Error
    ? { errorName: error.name, errorMessage: error.message }
    : { errorName: typeof error, errorMessage: String(error) };
}

async function classifyWithFallback(
  request: ClassifyRequest,
  input: ClassifyInput,
  deps: ClassifyDeps,
): Promise<ClassifierOutcome> {
  const { primary, fallback } = deps;
  try {
    const classification = await primary.classify(input);
    return { classification, classifierUsed: primary.id, fallbackReason: null };
  } catch (error) {
    deps.logError("Primary classifier failed; using fallback", {
      clientId: request.clientId,
      candidateId: request.candidateId,
      classifierId: primary.id,
      ...errorContext(error),
    });
    return {
      classification: await fallback.classify(input),
      classifierUsed: fallback.id,
      fallbackReason: `${primary.id} was unavailable, so ${fallback.id} was used.`,
    };
  }
}

export async function handleClassify(
  body: unknown,
  deps: ClassifyDeps,
): Promise<ClassifyResult> {
  const parsed = ClassifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: describeIssues(parsed.error) } };
  }
  const request = parsed.data;
  const client = deps.findClient(request.clientId);
  if (!client) return notFound(`Unknown clientId: ${request.clientId}`);
  const candidate = deps.findCandidate(request.candidateId);
  if (!candidate) {
    return notFound(`Unknown candidateId: ${request.candidateId}`);
  }
  const input = { candidate, feedbackText: request.feedbackText };
  const outcome = await classifyWithFallback(request, input, deps);
  const { verdicts, overall } = classifyPreventability(
    outcome.classification.reasons,
    client.preferences,
    candidate,
  );
  const suggestions = suggestPreferenceUpdates(client, [
    ...deps.pastRejections(client),
    { candidate, verdicts },
  ]);
  return { status: 200, body: { ...outcome, verdicts, overall, suggestions } };
}

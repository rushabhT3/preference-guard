import type { Profile, RejectionClassification } from "@/domain/schemas";

export interface ClassifyInput {
  candidate: Profile;
  feedbackText: string;
}

export interface RejectionClassifier {
  /** Model id, or "keyword-fallback" for the offline classifier. */
  readonly id: string;
  classify(input: ClassifyInput): Promise<RejectionClassification>;
}

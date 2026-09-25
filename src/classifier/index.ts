import "server-only";
import { createAnthropicClassifier } from "./anthropic";
import { keywordClassifier } from "./keyword";
import type { RejectionClassifier } from "./types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5";

export interface ClassifierEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

export interface Classifiers {
  primary: RejectionClassifier;
  fallback: RejectionClassifier;
}

export function getClassifiers(env: ClassifierEnv): Classifiers {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { primary: keywordClassifier, fallback: keywordClassifier };
  }
  const model = env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
  return {
    primary: createAnthropicClassifier({ apiKey, model }),
    fallback: keywordClassifier,
  };
}

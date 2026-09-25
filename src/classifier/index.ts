import "server-only";
import { createGeminiClassifier } from "./gemini";
import { keywordClassifier } from "./keyword";
import type { RejectionClassifier } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export interface ClassifierEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

export interface Classifiers {
  primary: RejectionClassifier;
  fallback: RejectionClassifier;
}

export function getClassifiers(env: ClassifierEnv): Classifiers {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { primary: keywordClassifier, fallback: keywordClassifier };
  }
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return {
    primary: createGeminiClassifier({ apiKey, model }),
    fallback: keywordClassifier,
  };
}

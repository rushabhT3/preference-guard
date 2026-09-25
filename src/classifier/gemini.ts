import "server-only";
import { GoogleGenAI } from "@google/genai";
import { parseGeminiResponse, RESPONSE_JSON_SCHEMA } from "./gemini-response";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import type { RejectionClassifier } from "./types";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_TOKENS = 2048;

export interface GeminiClassifierOptions {
  apiKey: string;
  model: string;
}

export function createGeminiClassifier({
  apiKey,
  model,
}: GeminiClassifierOptions): RejectionClassifier {
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: REQUEST_TIMEOUT_MS },
  });
  return {
    id: model,
    classify: async ({ candidate, feedbackText }) => {
      const response = await client.models.generateContent({
        model,
        contents: buildUserPrompt(candidate, feedbackText),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_JSON_SCHEMA,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      });
      return parseGeminiResponse(response);
    },
  };
}

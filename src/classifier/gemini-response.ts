import { FinishReason, type GenerateContentResponse } from "@google/genai";
import { z } from "zod";
import {
  type RejectionClassification,
  RejectionClassificationSchema,
} from "@/domain/schemas";

export class ClassificationError extends Error {
  name = "ClassificationError";
}

/** Gemini's responseJsonSchema ignores `$schema`; every other keyword Zod emits here is supported. */
export const RESPONSE_JSON_SCHEMA: Record<string, unknown> = Object.fromEntries(
  Object.entries(z.toJSONSchema(RejectionClassificationSchema)).filter(
    ([key]) => key !== "$schema",
  ),
);

export type GeminiResponse = Pick<
  GenerateContentResponse,
  "candidates" | "promptFeedback" | "text"
>;

function responseText(response: GeminiResponse): string {
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) {
    throw new ClassificationError(`Gemini blocked the prompt: ${blockReason}`);
  }
  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason !== FinishReason.STOP) {
    throw new ClassificationError(
      `Gemini stopped early with finishReason "${finishReason ?? "none"}"`,
    );
  }
  if (!response.text) {
    throw new ClassificationError("Gemini returned no structured output");
  }
  return response.text;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ClassificationError("Gemini output was not valid JSON");
  }
}

/** Structured output guarantees JSON shape; values are still validated before use. */
export function parseGeminiResponse(
  response: GeminiResponse,
): RejectionClassification {
  const parsed = RejectionClassificationSchema.safeParse(
    parseJson(responseText(response)),
  );
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => issue.path.join("."));
    throw new ClassificationError(
      `Gemini output failed schema validation at ${paths.join(", ")}`,
    );
  }
  return parsed.data;
}

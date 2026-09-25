import type { ClassifyResponse } from "@/server/classify";
import type { ClassifyRequest } from "./types";

export type ClassificationState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; result: ClassifyResponse; request: ClassifyRequest };

const RATE_LIMITED_STATUS = 429;

function errorMessage(status: number, body: unknown): string {
  if (status === RATE_LIMITED_STATUS) {
    return "Ten classifications a minute is the demo limit. Try again shortly.";
  }
  const serverMessage = (body as { error?: unknown } | null)?.error;
  return typeof serverMessage === "string"
    ? serverMessage
    : `The classifier returned ${status}.`;
}

export async function requestClassification(
  request: ClassifyRequest,
): Promise<ClassificationState> {
  try {
    const response = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok)
      return { phase: "error", message: errorMessage(response.status, body) };
    return { phase: "done", result: body as ClassifyResponse, request };
  } catch {
    return {
      phase: "error",
      message:
        "Could not reach the classifier. Check the connection and try again.",
    };
  }
}

import { getClassifiers } from "@/classifier";
import { findCandidate, findClient, history } from "@/data";
import { handleClassify } from "@/server/classify";
import { assessPastRejections } from "@/server/history-assessment";
import { createRateLimiter } from "@/server/rate-limit";

const RATE_LIMIT = { limit: 10, windowMs: 60_000 };
const isAllowed = createRateLimiter(RATE_LIMIT);
const classifiers = getClassifiers({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
});

function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  return forwardedFor.split(",")[0].trim() || "unknown";
}

function logError(message: string, context: Record<string, unknown>): void {
  console.error(message, context);
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isAllowed(clientIp(request), Date.now())) {
    return Response.json(
      { error: "Too many requests. Try again in a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(RATE_LIMIT.windowMs / 1000) },
      },
    );
  }
  const body = await readJsonBody(request);
  if (body === undefined) {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  const result = await handleClassify(body, {
    ...classifiers,
    findClient,
    findCandidate,
    pastRejections: (client) =>
      assessPastRejections(client, { history, findCandidate }),
    logError,
  });
  return Response.json(result.body, { status: result.status });
}

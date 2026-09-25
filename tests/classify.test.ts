import { describe, expect, it, vi } from "vitest";
import { keywordClassifier } from "@/classifier/keyword";
import type { RejectionClassifier } from "@/classifier/types";
import type { AssessedRejection } from "@/domain/preventability";
import type {
  RejectionClassification,
  RejectionReason,
} from "@/domain/schemas";
import { type ClassifyDeps, handleClassify } from "@/server/classify";
import { makeClient, makeProfile, NON_SMOKER } from "./fixtures";

const CLIENT = makeClient({ preferences: { hard: [NON_SMOKER], soft: [] } });
const CANDIDATE = makeProfile({ smoking: "regularly" });
const FEEDBACK_TEXT = "He smokes daily, I said no smokers";

const SMOKING_CLASSIFICATION: RejectionClassification = {
  reasons: [
    {
      category: "smoking",
      field: "smoking",
      evidence: "He smokes daily",
      strength: "dealbreaker",
    },
  ],
  primaryCategory: "smoking",
  openness: "firm_no",
  summary: "The client declined because the candidate smokes.",
};

const VALID_BODY = {
  clientId: CLIENT.id,
  candidateId: CANDIDATE.id,
  feedbackText: FEEDBACK_TEXT,
};

function succeedingClassifier(id: string): RejectionClassifier {
  return { id, classify: async () => SMOKING_CLASSIFICATION };
}

function failingClassifier(id: string): RejectionClassifier {
  return {
    id,
    classify: async () => {
      throw new TypeError("upstream timed out");
    },
  };
}

function makeDeps(overrides: Partial<ClassifyDeps> = {}): ClassifyDeps {
  return {
    primary: succeedingClassifier("gemini-3.5-flash-lite"),
    fallback: keywordClassifier,
    findClient: (id) => (id === CLIENT.id ? CLIENT : undefined),
    findCandidate: (id) => (id === CANDIDATE.id ? CANDIDATE : undefined),
    pastRejections: () => [],
    logError: vi.fn(),
    ...overrides,
  };
}

describe("handleClassify validation", () => {
  it.each([
    ["a missing field", { clientId: CLIENT.id, candidateId: CANDIDATE.id }],
    ["blank feedback", { ...VALID_BODY, feedbackText: "   " }],
    [
      "feedback over 1000 chars",
      { ...VALID_BODY, feedbackText: "a".repeat(1001) },
    ],
    ["a non-object body", null],
  ])("returns 400 for %s", async (_label, body) => {
    const result = await handleClassify(body, makeDeps());

    expect(result.status).toBe(400);
  });

  it("names the invalid field in the 400 message", async () => {
    const body = { ...VALID_BODY, feedbackText: "" };

    const result = await handleClassify(body, makeDeps());

    expect(result.body).toEqual({
      error: "feedbackText: Feedback text is empty",
    });
  });

  it("returns 404 naming an unknown client", async () => {
    const body = { ...VALID_BODY, clientId: "cl_missing" };

    const result = await handleClassify(body, makeDeps());

    expect(result).toEqual({
      status: 404,
      body: { error: "Unknown clientId: cl_missing" },
    });
  });

  it("returns 404 naming an unknown candidate", async () => {
    const body = { ...VALID_BODY, candidateId: "cd_missing" };

    const result = await handleClassify(body, makeDeps());

    expect(result).toEqual({
      status: 404,
      body: { error: "Unknown candidateId: cd_missing" },
    });
  });
});

describe("handleClassify classification", () => {
  it("reports the primary classifier when it succeeds", async () => {
    const result = await handleClassify(VALID_BODY, makeDeps());

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      classifierUsed: "gemini-3.5-flash-lite",
      fallbackReason: null,
    });
  });

  it("falls back and says why when the primary classifier throws", async () => {
    const deps = makeDeps({
      primary: failingClassifier("gemini-3.5-flash-lite"),
    });

    const result = await handleClassify(VALID_BODY, deps);

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      classifierUsed: "keyword-fallback",
      fallbackReason: expect.stringContaining("gemini-3.5-flash-lite"),
    });
  });

  it("logs the failure with ids and error details but not the feedback", async () => {
    const logError = vi.fn();
    const deps = makeDeps({
      primary: failingClassifier("gemini-3.5-flash-lite"),
      logError,
    });

    await handleClassify(VALID_BODY, deps);

    expect(logError).toHaveBeenCalledWith(expect.any(String), {
      clientId: CLIENT.id,
      candidateId: CANDIDATE.id,
      classifierId: "gemini-3.5-flash-lite",
      errorName: "TypeError",
      errorMessage: "upstream timed out",
    });
    expect(JSON.stringify(logError.mock.calls)).not.toContain(FEEDBACK_TEXT);
  });

  it("judges a smoking reason against a non-smoker rule as preventable", async () => {
    const result = await handleClassify(VALID_BODY, makeDeps());

    expect(result.body).toMatchObject({
      overall: "preventable",
      verdicts: [{ verdict: "preventable", rule: { id: NON_SMOKER.id } }],
    });
  });

  it("classifies the trimmed feedback text", async () => {
    const classify = vi.fn(async () => SMOKING_CLASSIFICATION);
    const deps = makeDeps({
      primary: { id: "gemini-3.5-flash-lite", classify },
    });

    await handleClassify({ ...VALID_BODY, feedbackText: "  smokes  " }, deps);

    expect(classify).toHaveBeenCalledWith({
      candidate: CANDIDATE,
      feedbackText: "smokes",
    });
  });
});

describe("handleClassify suggestions", () => {
  const DRINKING_REASON: RejectionReason = {
    category: "drinking",
    field: "drinking",
    evidence: "drinks every weekend",
    strength: "unclear",
  };

  it("drafts a rule once the same unstated reason repeats", async () => {
    const pastRejection: AssessedRejection = {
      candidate: makeProfile({ id: "cd_past", drinking: "regularly" }),
      verdicts: [
        {
          reason: DRINKING_REASON,
          verdict: "new_signal",
          rule: null,
          explanation: "",
        },
      ],
    };
    const deps = makeDeps({
      primary: {
        id: "gemini-3.5-flash-lite",
        classify: async () => ({
          ...SMOKING_CLASSIFICATION,
          reasons: [DRINKING_REASON],
        }),
      },
      pastRejections: () => [pastRejection],
    });

    const result = await handleClassify(VALID_BODY, deps);

    expect(result.body).toMatchObject({
      suggestions: [{ field: "drinking", occurrences: 2 }],
    });
  });

  it("drafts nothing from a single occurrence", async () => {
    const result = await handleClassify(VALID_BODY, makeDeps());

    expect(result.body).toMatchObject({ suggestions: [] });
  });
});

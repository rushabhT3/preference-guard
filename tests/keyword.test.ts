import { describe, expect, it } from "vitest";
import { classifyByKeywords } from "@/classifier/keyword";
import type {
  RejectionClassification,
  RejectionReason,
} from "@/domain/schemas";

interface Sample {
  text: string;
  reasons: Omit<RejectionReason, "evidence">[];
  openness: RejectionClassification["openness"];
}

const SAMPLES: Sample[] = [
  {
    text: "He smokes, I clearly said no smokers.",
    reasons: [
      { category: "smoking", field: "smoking", strength: "dealbreaker" },
    ],
    openness: "firm_no",
  },
  {
    text: "Ladka sutta peeta hai, mujhe nahi chahiye",
    reasons: [
      { category: "smoking", field: "smoking", strength: "dealbreaker" },
    ],
    openness: "firm_no",
  },
  {
    text: "Daaru peeta hai roz, not ok for us",
    reasons: [
      { category: "drinking", field: "drinking", strength: "dealbreaker" },
    ],
    openness: "soft_no",
  },
  {
    text: "Non-veg khata hai, hum log strictly veg hain",
    reasons: [{ category: "diet", field: "diet", strength: "dealbreaker" }],
    openness: "firm_no",
  },
  {
    text: "Abhi nahi, maybe later. She is travelling for work this month.",
    reasons: [
      { category: "timing_availability", field: "none", strength: "unclear" },
    ],
    openness: "open_later",
  },
  {
    text: "He is a bit too old for her and would prefer someone in Bengaluru, not Delhi.",
    reasons: [
      { category: "age", field: "age", strength: "preference" },
      { category: "location", field: "city", strength: "preference" },
    ],
    openness: "soft_no",
  },
  {
    text: "She is divorced and has a son from her first marriage, client wants someone never married",
    reasons: [
      { category: "children", field: "hasChildren", strength: "dealbreaker" },
      {
        category: "marital_status",
        field: "maritalStatus",
        strength: "dealbreaker",
      },
    ],
    openness: "firm_no",
  },
  {
    text: "Photos dekh ke vibe nahi aayi",
    reasons: [
      { category: "appearance_photos", field: "none", strength: "unclear" },
      { category: "personality_vibe", field: "none", strength: "unclear" },
    ],
    openness: "soft_no",
  },
];

function withoutEvidence({ evidence: _evidence, ...rest }: RejectionReason) {
  return rest;
}

describe("classifyByKeywords", () => {
  it.each(SAMPLES)("classifies: $text", ({ text, reasons, openness }) => {
    const result = classifyByKeywords(text);

    expect(result.reasons.map(withoutEvidence)).toEqual(reasons);
    expect(result.openness).toBe(openness);
  });

  it("uses the first detected reason as the primary category", () => {
    const result = classifyByKeywords("Too old, and he lives in Dubai");

    expect(result.primaryCategory).toBe("age");
  });

  it("quotes the clause that triggered a reason as evidence", () => {
    const result = classifyByKeywords(
      "Profile is fine, but he drinks every weekend",
    );

    expect(result.reasons[0].evidence).toBe("he drinks every weekend");
  });

  it("returns one subjective 'other' reason when no keyword matches", () => {
    const result = classifyByKeywords("Nahi yaar, pata nahi kyun");

    expect(result.reasons).toEqual([
      {
        category: "other",
        field: "none",
        evidence: "Nahi yaar, pata nahi kyun",
        strength: "unclear",
      },
    ]);
    expect(result.summary).toBe("The client declined without a clear reason.");
  });
});

describe("classifyByKeywords strength", () => {
  it("reads a dealbreaker stated in a later sentence about the same reason", () => {
    const text = "He smokes regularly!! I have told you 10 times no smokers.";

    const { reasons, openness } = classifyByKeywords(text);

    expect(reasons[0]).toMatchObject({
      field: "smoking",
      strength: "dealbreaker",
    });
    expect(openness).toBe("firm_no");
  });
});

import { REASON_CATEGORY_LABELS } from "@/domain/fields";
import type {
  ReasonCategory,
  ReasonField,
  RejectionClassification,
  RejectionReason,
} from "@/domain/schemas";
import type { RejectionClassifier } from "./types";

interface KeywordRule {
  category: ReasonCategory;
  field: ReasonField;
  pattern: RegExp;
}

const CITY_NAMES =
  "hyderabad|bengaluru|bangalore|mumbai|pune|delhi|chennai|kolkata|ahmedabad|london|dubai|singapore|bay area";

/** Within a category the first matching rule wins, so specific rules come first. */
export const KEYWORD_RULES: readonly KeywordRule[] = [
  {
    category: "smoking",
    field: "smoking",
    pattern: /\bsmok|cigarette|\bsutta/i,
  },
  {
    category: "drinking",
    field: "drinking",
    pattern: /\bdrink|alcohol|daaru|\bbooze/i,
  },
  {
    category: "children",
    field: "hasChildren",
    pattern:
      /\b(has|have|with) (a |one |two )?(kid|child|son|daughter)|single (mom|mother|dad|father)/i,
  },
  {
    category: "children",
    field: "wantsChildren",
    pattern: /\bkids?\b|\bchildren|\bbab(y|ies)\b/i,
  },
  {
    category: "diet",
    field: "diet",
    pattern:
      /\bnon-?veg|\bveg(etarian|gie|an)?\b|\bmeat|\beggs?\b|\bchicken|\bmutton|\bfish\b/i,
  },
  {
    category: "age",
    field: "age",
    pattern: /\bold(er)?\b|\byoung(er)?\b|\bage\b|years (older|younger|elder)/i,
  },
  {
    category: "location",
    field: "city",
    pattern: new RegExp(
      `\\btoo far\\b|\\bfar away\\b|relocat|\\bmove\\b|\\bmoving\\b|\\bshift(ing)? to\\b|\\bcity\\b|\\babroad\\b|\\bnri\\b|long distance|\\b(${CITY_NAMES})\\b`,
      "i",
    ),
  },
  {
    category: "marital_status",
    field: "maritalStatus",
    pattern: /divorc|widow|second marriage|previously married/i,
  },
  {
    category: "height",
    field: "heightCm",
    pattern: /\btall|\bshort\b|\bheight|\bft\b|\binch/i,
  },
  {
    category: "income",
    field: "incomeBandLakhs",
    pattern: /salary|income|\bpackage\b|\bearn|\blpa\b|\blakhs?\b/i,
  },
  {
    category: "family",
    field: "familyType",
    pattern: /joint family|nuclear family|orthodox|\bin-?laws\b|\bfamily\b/i,
  },
  {
    category: "religion_community",
    field: "religion",
    pattern: /religio|inter-?faith|\bhindu|\bmuslim|\bchristian|\bsikh/i,
  },
  {
    category: "religion_community",
    field: "community",
    pattern: /\bcaste\b|communit|\bgotra\b|\bjati\b/i,
  },
  {
    category: "education_profession",
    field: "education",
    pattern: /\bdegree|\bmba\b|\bph\.?d\b|\bmasters\b|educat|qualif/i,
  },
  {
    category: "education_profession",
    field: "profession",
    pattern:
      /\bjob\b|profession|career|\bstartup|\bbusiness|\bdoctor|\bengineer|\bbanker/i,
  },
  {
    category: "other",
    field: "motherTongue",
    pattern:
      /mother tongue|\blanguage\b|\btamil|\btelugu|\bpunjabi|\bbengali|\bmarathi|\bgujarati|\bkannada|\bmalayal/i,
  },
  {
    category: "appearance_photos",
    field: "none",
    pattern: /\bphotos?\b|\bpics?\b|\blooks\b|appearance|not my type/i,
  },
  {
    category: "personality_vibe",
    field: "none",
    pattern: /\bvibe|\bclick|chemistry|boring|attitude|arrogant/i,
  },
  {
    category: "timing_availability",
    field: "none",
    pattern: /\bbusy\b|travell?ing|not ready|\bexams?\b|\btiming/i,
  },
];

const DEALBREAKER_PATTERN =
  /\bnever\b|clearly|strictly|at all\b|absolutely|dealbreaker|no way|at any cost|\bonly\b|not ok|nahi chahiye|\bno \w+ers\b/i;
const PREFERENCE_PATTERN =
  /prefer|ideally|would like|would have liked|\bbit\b|slightly|thoda/i;
const OPEN_LATER_PATTERN =
  /\blater\b|not now|abhi nahi|next month|few months|after (diwali|the wedding|exams)/i;
const FIRM_NO_PATTERN =
  /\bnever\b|not interested|no way|clearly|strictly|nahi chahiye|told you|\bno \w+ers\b/i;
const SENTENCE_SPLIT = /[.;!?\n]+/;
const CLAUSE_SPLIT = /,|\bbut\b|\balso\b/i;
const MAX_EVIDENCE_LENGTH = 80;

function clauses(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .flatMap((sentence) => sentence.split(CLAUSE_SPLIT))
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

/** Judged across every sentence that mentions the reason: "He smokes! I said no smokers." is absolute. */
function strengthOf(
  rule: KeywordRule,
  text: string,
): RejectionReason["strength"] {
  const mentions = text
    .split(SENTENCE_SPLIT)
    .filter((sentence) => rule.pattern.test(sentence));
  if (mentions.some((sentence) => DEALBREAKER_PATTERN.test(sentence))) {
    return "dealbreaker";
  }
  if (mentions.some((sentence) => PREFERENCE_PATTERN.test(sentence))) {
    return "preference";
  }
  return "unclear";
}

function detectReasons(text: string): RejectionReason[] {
  const seen = new Set<ReasonCategory>();
  const reasons: RejectionReason[] = [];
  for (const clause of clauses(text)) {
    for (const rule of KEYWORD_RULES) {
      if (seen.has(rule.category) || !rule.pattern.test(clause)) continue;
      seen.add(rule.category);
      reasons.push({
        category: rule.category,
        field: rule.field,
        evidence: clause.slice(0, MAX_EVIDENCE_LENGTH),
        strength: strengthOf(rule, text),
      });
    }
  }
  return reasons;
}

function opennessOf(text: string): RejectionClassification["openness"] {
  if (OPEN_LATER_PATTERN.test(text)) return "open_later";
  return FIRM_NO_PATTERN.test(text) ? "firm_no" : "soft_no";
}

function summarize(reasons: RejectionReason[]): string {
  const named = reasons
    .filter((reason) => reason.category !== "other" || reason.field !== "none")
    .map((reason) => REASON_CATEGORY_LABELS[reason.category]);
  if (named.length === 0) return "The client declined without a clear reason.";
  return `The client declined over ${named.join(" and ")}.`;
}

export function classifyByKeywords(
  feedbackText: string,
): RejectionClassification {
  const detected = detectReasons(feedbackText);
  const reasons: RejectionReason[] =
    detected.length > 0
      ? detected
      : [
          {
            category: "other",
            field: "none",
            evidence: feedbackText.trim().slice(0, MAX_EVIDENCE_LENGTH),
            strength: "unclear",
          },
        ];
  return {
    reasons,
    primaryCategory: reasons[0].category,
    openness: opennessOf(feedbackText),
    summary: summarize(reasons),
  };
}

export const keywordClassifier: RejectionClassifier = {
  id: "keyword-fallback",
  classify: async ({ feedbackText }) => classifyByKeywords(feedbackText),
};

import { Tag, type TagTone } from "@/components/Tag";
import type { Verdict } from "@/domain/preventability";

export const VERDICT_LABELS: Record<Verdict, string> = {
  preventable: "Preventable",
  data_gap: "Data gap",
  preference_drift: "Preference drift",
  new_signal: "New signal",
  soft_mismatch: "Soft mismatch",
  subjective: "Subjective",
};

const VERDICT_TONES: Record<Verdict, TagTone> = {
  preventable: "blocked",
  data_gap: "needs",
  preference_drift: "accent",
  new_signal: "accent",
  soft_mismatch: "neutral",
  subjective: "neutral",
};

export function VerdictTag({ verdict }: { verdict: Verdict }) {
  return (
    <Tag
      tone={VERDICT_TONES[verdict]}
      isDashed={verdict === "new_signal"}
      hasGlyph
    >
      {VERDICT_LABELS[verdict]}
    </Tag>
  );
}

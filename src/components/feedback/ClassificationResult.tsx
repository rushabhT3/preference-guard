import { Panel } from "@/components/Panel";
import { Tag } from "@/components/Tag";
import type { Verdict } from "@/domain/preventability";
import styles from "./ClassificationResult.module.css";
import { ReasonsTable } from "./ReasonsTable";
import type { ClassificationState } from "./request-classification";
import { VerdictTag } from "./VerdictTag";

const HEADLINES: Record<Verdict, string> = {
  preventable: "Preference Guard would have stopped this send.",
  data_gap: "Preference Guard would have asked before sending.",
  preference_drift:
    "The client's own rule allowed this. The rule may be too loose.",
  new_signal: "A reason no stated preference covers yet.",
  soft_mismatch: "A soft preference, not a dealbreaker.",
  subjective: "A judgment call no rule could have caught.",
};

const OPENNESS_LABELS = {
  firm_no: "Firm no",
  soft_no: "Soft no",
  open_later: "Open later",
} as const;

export function ClassificationResult({
  state,
}: {
  state: ClassificationState;
}) {
  if (state.phase !== "done") {
    return (
      <Panel title="Verdict">
        <p
          className={
            state.phase === "error" ? styles.error : styles.placeholder
          }
          role="status"
        >
          {state.phase === "idle" &&
            "Pick a sample or paste feedback. The model reads it; the rules engine decides."}
          {state.phase === "loading" && "Reading the feedback…"}
          {state.phase === "error" && state.message}
        </p>
      </Panel>
    );
  }
  const { classification, verdicts, overall, classifierUsed, fallbackReason } =
    state.result;
  const isKeyword = classifierUsed === "keyword-fallback";
  return (
    <Panel
      title="Verdict"
      meta={
        <Tag tone={isKeyword ? "neutral" : "accent"}>
          {isKeyword ? "Keyword fallback" : `Claude · ${classifierUsed}`}
        </Tag>
      }
    >
      <div className={styles.headline} role="status">
        <VerdictTag verdict={overall} />
        <p className={styles.sentence}>{HEADLINES[overall]}</p>
      </div>
      <p className={styles.summary}>
        {classification.summary}{" "}
        <Tag>{OPENNESS_LABELS[classification.openness]}</Tag>
      </p>
      {fallbackReason && <p className={styles.fallback}>{fallbackReason}</p>}
      <ReasonsTable verdicts={verdicts} />
    </Panel>
  );
}

import type { HardConstraint } from "@/domain/schemas";
import { Tag } from "./Tag";

type Source = HardConstraint["source"];

const SOURCE_LABELS: Record<Source, string> = {
  intake: "intake",
  feedback: "from feedback",
};

export function SourceTag({ source }: { source: Source }) {
  const isLearned = source === "feedback";
  return (
    <Tag tone={isLearned ? "accent" : "neutral"} isDashed={isLearned}>
      {SOURCE_LABELS[source]}
    </Tag>
  );
}

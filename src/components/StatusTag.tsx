import type { Status } from "@/domain/rules";
import { Tag, type TagTone } from "./Tag";

export const STATUS_LABELS: Record<Status, string> = {
  clear: "Clear",
  needs_check: "Needs check",
  blocked: "Blocked",
};

const STATUS_TONES: Record<Status, TagTone> = {
  clear: "clear",
  needs_check: "needs",
  blocked: "blocked",
};

export function StatusTag({ status }: { status: Status }) {
  return (
    <Tag tone={STATUS_TONES[status]} hasGlyph>
      {STATUS_LABELS[status]}
    </Tag>
  );
}

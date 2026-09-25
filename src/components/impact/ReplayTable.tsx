import { formatCount, formatPercent } from "@/components/format";
import {
  engineViolationRate,
  type MatchmakerScope,
  type ReplaySummary,
} from "@/domain/funnel";
import styles from "./DataTable.module.css";

export interface ReplayTableProps {
  labels: Record<MatchmakerScope, string>;
  summaries: Record<MatchmakerScope, ReplaySummary>;
}

interface ReplayRow {
  label: string;
  value: (summary: ReplaySummary) => string;
  isCost?: boolean;
}

const SCOPES: MatchmakerScope[] = ["mm_a", "mm_b", "all"];

const ROWS: ReplayRow[] = [
  { label: "Profiles shared", value: (s) => formatCount(s.sends) },
  {
    label: "Acceptance rate",
    value: (s) => formatPercent(s.sends === 0 ? 0 : s.accepted / s.sends),
  },
  {
    label: "Rejections the checker would block",
    value: (s) => formatCount(s.rejectionsBlocked),
  },
  {
    label: "Rejections flagged needs check",
    value: (s) => formatCount(s.rejectionsNeedsCheck),
  },
  {
    label: "Acceptances wrongly blocked",
    value: (s) => formatCount(s.acceptancesBlocked),
    isCost: true,
  },
  {
    label: "Engine violation rate",
    value: (s) => formatPercent(engineViolationRate(s)),
  },
];

export function ReplayTable({ labels, summaries }: ReplayTableProps) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="visually-hidden">
          Replay of the checker over 30 days, by matchmaker
        </caption>
        <thead>
          <tr>
            <th scope="col">Replayed over 30 days</th>
            {SCOPES.map((scope) => (
              <th key={scope} scope="col">
                {labels[scope]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ label, value, isCost }) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {SCOPES.map((scope) => (
                <td
                  key={scope}
                  className={isCost ? styles.emphasis : undefined}
                >
                  {value(summaries[scope])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

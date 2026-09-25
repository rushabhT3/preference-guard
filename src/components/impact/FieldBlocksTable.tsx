import { formatCount } from "@/components/format";
import { FIELD_LABELS } from "@/domain/fields";
import type { FieldBlockRow, MatchmakerScope } from "@/domain/funnel";
import { Bar } from "./Bar";
import styles from "./DataTable.module.css";

export interface FieldBlocksTableProps {
  labels: Record<MatchmakerScope, string>;
  rows: FieldBlockRow[];
}

const MATCHMAKERS = ["mm_a", "mm_b"] as const;

const total = (row: FieldBlockRow) => row.blocked.all + row.needsCheck.all;

export function FieldBlocksTable({ labels, rows }: FieldBlocksTableProps) {
  const largest = Math.max(1, ...rows.map(total));
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="visually-hidden">
          Which dealbreaker fields drive blocked and needs-check sends
        </caption>
        <thead>
          <tr>
            <th scope="col">Dealbreaker field</th>
            {MATCHMAKERS.map((id) => (
              <th key={`blocked-${id}`} scope="col">
                Blocked · {labels[id]}
              </th>
            ))}
            {MATCHMAKERS.map((id) => (
              <th key={`needs-${id}`} scope="col">
                Needs check · {labels[id]}
              </th>
            ))}
            <th scope="col" className={styles.barCell}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field}>
              <th scope="row">{FIELD_LABELS[row.field]}</th>
              {MATCHMAKERS.map((id) => (
                <td key={`blocked-${id}`}>{formatCount(row.blocked[id])}</td>
              ))}
              {MATCHMAKERS.map((id) => (
                <td key={`needs-${id}`} className={styles.muted}>
                  {formatCount(row.needsCheck[id])}
                </td>
              ))}
              <td className={styles.barCell}>
                <span className={styles.barWithValue}>
                  <Bar ratio={total(row) / largest} />
                  {formatCount(total(row))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.note}>
        A send that breaks two dealbreakers counts in both rows, so the rows can
        add up to more than the blocked total.
      </p>
    </div>
  );
}

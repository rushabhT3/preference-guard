import { formatCount, formatPercent } from "@/components/format";
import type { FunnelRow } from "@/domain/funnel";
import { Bar } from "./Bar";
import styles from "./DataTable.module.css";

export function FunnelTable({ rows }: { rows: FunnelRow[] }) {
  const shared = rows[0]?.count ?? 0;
  const biggestLoss = maxLost(rows);
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="visually-hidden">
          Last 30 days, stage by stage
        </caption>
        <thead>
          <tr>
            <th scope="col">Stage</th>
            <th scope="col" className={styles.barCell}>
              Share of profiles shared
            </th>
            <th scope="col">Count</th>
            <th scope="col">Step conversion</th>
            <th scope="col">Lost at step</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.stage}>
              <th scope="row">{row.label}</th>
              <td className={styles.barCell}>
                <Bar ratio={shared === 0 ? 0 : row.count / shared} />
              </td>
              <td>{formatCount(row.count)}</td>
              <td>
                {row.stepConversion === null
                  ? "—"
                  : formatPercent(row.stepConversion, 0)}
              </td>
              <td
                className={
                  row.lost === biggestLoss ? styles.emphasis : undefined
                }
              >
                {row.lost === null ? "—" : formatCount(row.lost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function maxLost(rows: FunnelRow[]): number {
  return Math.max(...rows.map(({ lost }) => lost ?? 0));
}

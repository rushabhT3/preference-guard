import { FIELD_LABELS, REASON_CATEGORY_LABELS } from "@/domain/fields";
import type { ReasonVerdict } from "@/domain/preventability";
import styles from "./ClassificationResult.module.css";
import { VerdictTag } from "./VerdictTag";

export function ReasonsTable({ verdicts }: { verdicts: ReasonVerdict[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="visually-hidden">
          Reasons found in the feedback
        </caption>
        <thead>
          <tr>
            <th scope="col">Reason</th>
            <th scope="col">Evidence</th>
            <th scope="col">Strength</th>
            <th scope="col">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {verdicts.map(({ reason, verdict, explanation }) => (
            <tr key={`${reason.category}-${reason.evidence}`}>
              <td>
                <span className={styles.category}>
                  {REASON_CATEGORY_LABELS[reason.category]}
                </span>
                <span className={styles.field}>
                  {reason.field === "none"
                    ? "no field"
                    : FIELD_LABELS[reason.field]}
                </span>
              </td>
              <td className={styles.evidence}>“{reason.evidence}”</td>
              <td>{reason.strength}</td>
              <td>
                <VerdictTag verdict={verdict} />
                <p className={styles.explanation}>{explanation}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

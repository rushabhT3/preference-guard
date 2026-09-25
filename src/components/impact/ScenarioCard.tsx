import styles from "./ScenarioCard.module.css";

export interface ScenarioFigure {
  label: string;
  value: string;
}

export interface ScenarioCardProps {
  eyebrow: string;
  title: string;
  figures: ScenarioFigure[];
  formulas: string[];
  isBaseline?: boolean;
}

export function ScenarioCard({
  eyebrow,
  title,
  figures,
  formulas,
  isBaseline = false,
}: ScenarioCardProps) {
  return (
    <article className={isBaseline ? styles.baseline : styles.card}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h3 className={styles.title}>{title}</h3>
      <dl className={styles.figures}>
        {figures.map(({ label, value }) => (
          <div key={label} className={styles.figure}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <ul
        className={styles.formulas}
        aria-label="How these numbers are computed"
      >
        {formulas.map((formula) => (
          <li key={formula}>{formula}</li>
        ))}
      </ul>
    </article>
  );
}

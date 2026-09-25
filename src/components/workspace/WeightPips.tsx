import styles from "./ClientCard.module.css";

const WEIGHT_STEPS = [1, 2, 3] as const;

export function WeightPips({ weight }: { weight: number }) {
  return (
    <span
      className={styles.weight}
      role="img"
      aria-label={`weight ${weight} of ${WEIGHT_STEPS.length}`}
    >
      {WEIGHT_STEPS.map((step) => (
        <span
          key={step}
          className={step <= weight ? styles.pipOn : styles.pip}
        />
      ))}
    </span>
  );
}

import { formatPercent } from "@/components/format";
import { Metric } from "@/components/Metric";
import { Panel } from "@/components/Panel";
import { SourceTag } from "@/components/SourceTag";
import styles from "./ClientCard.module.css";
import type { ClientView } from "./types";
import { WeightPips } from "./WeightPips";

export function ClientCard({ client }: { client: ClientView }) {
  const { dealbreakers, softPreferences, stats } = client;
  return (
    <Panel
      title="Preferences on file"
      meta={`${dealbreakers.length} dealbreakers`}
    >
      <ul className={styles.rules}>
        {dealbreakers.map((rule) => (
          <li key={rule.id} className={styles.rule}>
            <span>{rule.label}</span>
            <SourceTag source={rule.source} />
          </li>
        ))}
      </ul>
      <h3 className={styles.subhead}>Soft preferences</h3>
      <ul className={styles.softList}>
        {softPreferences.map((pref) => (
          <li key={pref.id} className={styles.soft}>
            <span>{pref.label}</span>
            <WeightPips weight={pref.weight} />
          </li>
        ))}
      </ul>
      <div className={styles.stats}>
        <Metric
          value={formatPercent(stats.acceptance, 0)}
          label="30-day acceptance"
          detail={`${stats.sends} profiles sent`}
        />
        <Metric
          value={formatPercent(stats.violationRate, 0)}
          label="Engine violation rate"
          detail="sends the checker blocks"
        />
      </div>
    </Panel>
  );
}

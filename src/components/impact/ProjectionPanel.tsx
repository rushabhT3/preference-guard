import { formatCount, formatPercent } from "@/components/format";
import type { ImpactProjection, ScenarioOutcome } from "@/domain/funnel";
import styles from "./ProjectionPanel.module.css";
import { ScenarioCard, type ScenarioFigure } from "./ScenarioCard";

const oneDecimal = (value: number) => value.toFixed(1);

function outcomeFigures(outcome: ScenarioOutcome): ScenarioFigure[] {
  return [
    { label: "Profiles shared", value: formatCount(outcome.sends) },
    { label: "Accepted", value: formatCount(outcome.accepted) },
    { label: "Acceptance rate", value: formatPercent(outcome.acceptanceRate) },
    { label: "Meetings completed", value: formatCount(outcome.meetings) },
  ];
}

function droppedFormulas({
  summary,
  rates,
  dropped,
}: ImpactProjection): string[] {
  return [
    `sends = ${summary.sends} − ${summary.blocked} blocked`,
    `accepted = ${summary.accepted} − ${summary.acceptancesBlocked} wrongly blocked`,
    `meetings = accepted × ${summary.meetingsCompleted}/${summary.accepted} = ${oneDecimal(dropped.meetings)}`,
    `hours saved = ${summary.blocked} × ${rates.hoursPerSend.toFixed(2)} h of search per send`,
  ];
}

function replacedFormulas({
  summary,
  rates,
  replaced,
}: ImpactProjection): string[] {
  const compliantAccepted = summary.accepted - summary.acceptancesBlocked;
  const compliantSends = summary.sends - summary.blocked;
  return [
    `compliantRate = ${compliantAccepted}/${compliantSends} = ${formatPercent(rates.compliantRate)}`,
    `accepted = ${summary.sends} × compliantRate = ${oneDecimal(replaced.accepted)}`,
    `meetings = accepted × ${summary.meetingsCompleted}/${summary.accepted} = ${oneDecimal(replaced.meetings)}`,
  ];
}

export function ProjectionPanel({
  projection,
}: {
  projection: ImpactProjection;
}) {
  const { baseline, dropped, replaced } = projection;
  return (
    <div className={styles.grid}>
      <ScenarioCard
        eyebrow="Recorded"
        title="Last 30 days"
        figures={outcomeFigures(baseline)}
        formulas={["As recorded in history.json"]}
        isBaseline
      />
      <ScenarioCard
        eyebrow="Scenario A"
        title="Drop violations, send nothing instead"
        figures={[
          ...outcomeFigures(dropped),
          {
            label: "Search hours saved",
            value: formatCount(dropped.hoursSaved),
          },
        ]}
        formulas={droppedFormulas(projection)}
      />
      <ScenarioCard
        eyebrow="Scenario B"
        title="Replace violations with compliant profiles"
        figures={outcomeFigures(replaced)}
        formulas={replacedFormulas(projection)}
      />
    </div>
  );
}

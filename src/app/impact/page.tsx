import type { Metadata } from "next";
import { formatCount, formatPercent } from "@/components/format";
import { FieldBlocksTable } from "@/components/impact/FieldBlocksTable";
import { FunnelTable } from "@/components/impact/FunnelTable";
import { ProjectionPanel } from "@/components/impact/ProjectionPanel";
import { ReplayTable } from "@/components/impact/ReplayTable";
import { Metric } from "@/components/Metric";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import styles from "./page.module.css";
import { impactView } from "./view-model";

export const metadata: Metadata = { title: "Impact" };

export default function ImpactPage() {
  const {
    labels,
    period,
    funnel,
    summaries,
    violationRates,
    fieldRows,
    projection,
  } = impactView();
  const { all } = summaries;
  return (
    <>
      <PageHeader
        index="03"
        section="Impact"
        meta={`Replay · ${period}`}
        title="What the checker would have caught"
        lede={`The rules engine replayed over all ${formatCount(all.sends)} profiles shared in the last 30 days. Every number on this page is computed from the history, none are typed in.`}
      />
      <div className={styles.metrics}>
        <Metric
          isDisplay
          value={formatPercent(violationRates.all)}
          label="Engine violation rate"
          detail={`${formatCount(all.blocked)} of ${formatCount(all.sends)} sends break a stated dealbreaker`}
        />
        <Metric
          isDisplay
          value={formatPercent(violationRates.mm_a)}
          label={labels.mm_a}
          detail={`${formatCount(summaries.mm_a.blocked)} of ${formatCount(summaries.mm_a.sends)} sends`}
        />
        <Metric
          isDisplay
          value={formatPercent(violationRates.mm_b)}
          label={labels.mm_b}
          detail={`${formatCount(summaries.mm_b.blocked)} of ${formatCount(summaries.mm_b.sends)} sends`}
        />
        <Metric
          isDisplay
          value={formatPercent(projection.rates.compliantRate)}
          label="Acceptance on compliant sends"
          detail={`vs ${formatPercent(projection.baseline.acceptanceRate)} on all sends today`}
        />
      </div>

      <Section
        index="3.1"
        title="The funnel"
        lede="Most of the loss happens at the first step, and part of it was self-inflicted."
      >
        <FunnelTable rows={funnel} />
      </Section>

      <Section
        index="3.2"
        title="Replay, by matchmaker"
        lede={`Needs-check sends are counted apart and never as violations. The ${formatCount(all.acceptancesBlocked)} acceptances the checker would have blocked are its cost.`}
      >
        <ReplayTable labels={labels} summaries={summaries} />
      </Section>

      <Section
        index="3.3"
        title="Which dealbreakers drive the blocks"
        lede="Fix the fields at the top first, in the intake form and in candidate data."
      >
        <FieldBlocksTable labels={labels} rows={fieldRows} />
      </Section>

      <Section
        index="3.4"
        title="Projection"
        lede="Two ways to use the checker, side by side. Neither is a promise; both rest on the assumptions below."
      >
        <ProjectionPanel projection={projection} />
        <ul className={styles.assumptions}>
          <li>
            Scenario B assumes replacement profiles exist in each client's pool.
          </li>
          <li>
            Clients react to replacements the way they reacted to this month's
            compliant sends.
          </li>
          <li>
            Later stages convert as they do today:{" "}
            {projection.summary.meetingsCompleted} meetings per{" "}
            {projection.summary.accepted} acceptances.
          </li>
          <li>
            Search time is {projection.assumptions.searchHoursPerClientPerWeek}{" "}
            h per client per week across {projection.assumptions.clientCount}{" "}
            clients, spread evenly over sends.
          </li>
          <li>
            The history is mock data generated to match the brief's funnel; the
            method, not the exact figures, is the point.
          </li>
        </ul>
      </Section>
    </>
  );
}

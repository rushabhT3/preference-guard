import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { CandidateBoard } from "@/components/workspace/CandidateBoard";
import { ClientCard } from "@/components/workspace/ClientCard";
import { ClientPicker } from "@/components/workspace/ClientPicker";
import styles from "./page.module.css";
import {
  candidateViews,
  clientGroups,
  clientView,
  selectClient,
} from "./view-model";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspacePage({
  searchParams,
}: PageProps<"/workspace">) {
  const { client: clientParam } = await searchParams;
  const client = selectClient(
    typeof clientParam === "string" ? clientParam : undefined,
  );
  if (!client) notFound();
  const view = clientView(client);

  return (
    <>
      <PageHeader
        index="01"
        section="Workspace"
        meta={view.matchmakerName}
        title={view.name}
        lede={`${view.meta}. Every candidate below has been checked against ${view.dealbreakers.length} dealbreakers on file, and against the candidate's own rules.`}
      />
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Client">
          <ClientPicker groups={clientGroups()} selectedId={view.id} />
          <ClientCard client={view} />
        </aside>
        <CandidateBoard client={view} candidates={candidateViews(client)} />
      </div>
    </>
  );
}

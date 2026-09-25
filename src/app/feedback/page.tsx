import type { Metadata } from "next";
import { FeedbackWorkbench } from "@/components/feedback/FeedbackWorkbench";
import { PageHeader } from "@/components/PageHeader";
import { feedbackView } from "./view-model";

export const metadata: Metadata = { title: "Feedback" };

export default function FeedbackPage() {
  const { samples, clients, candidates } = feedbackView();
  return (
    <>
      <PageHeader
        index="02"
        section="Feedback"
        meta="The model reads · the rules decide"
        title="Turn a rejection into a reason"
        lede="Claude reads free-text feedback and lists the reasons it states. It never sees the client's preferences. Code then checks each reason against those preferences to decide whether Preference Guard could have prevented the send."
      />
      <FeedbackWorkbench
        samples={samples}
        clients={clients}
        candidates={candidates}
      />
    </>
  );
}

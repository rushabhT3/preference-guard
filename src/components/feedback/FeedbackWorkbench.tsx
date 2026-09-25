"use client";

import { useRef, useState } from "react";
import { ClassificationResult } from "./ClassificationResult";
import { FeedbackForm } from "./FeedbackForm";
import styles from "./FeedbackWorkbench.module.css";
import {
  type ClassificationState,
  requestClassification,
} from "./request-classification";
import { SampleList } from "./SampleList";
import { SuggestionPanel } from "./SuggestionPanel";
import type { ClassifyRequest, PersonOption, SampleView } from "./types";

export interface FeedbackWorkbenchProps {
  samples: SampleView[];
  clients: PersonOption[];
  candidates: PersonOption[];
}

export function FeedbackWorkbench({
  samples,
  clients,
  candidates,
}: FeedbackWorkbenchProps) {
  const [draft, setDraft] = useState<ClassifyRequest>({
    clientId: samples[0]?.clientId ?? clients[0].id,
    candidateId: samples[0]?.candidateId ?? "",
    feedbackText: "",
  });
  const [state, setState] = useState<ClassificationState>({ phase: "idle" });
  const latestRequest = useRef(0);
  const isBusy = state.phase === "loading";

  const classify = async (request: ClassifyRequest) => {
    const requestNumber = ++latestRequest.current;
    setDraft(request);
    setState({ phase: "loading" });
    const next = await requestClassification(request);
    if (requestNumber === latestRequest.current) setState(next);
  };

  const result = state.phase === "done" ? state : null;
  return (
    <div className={styles.layout}>
      <div className={styles.inputs}>
        <SampleList samples={samples} isBusy={isBusy} onPick={classify} />
        <FeedbackForm
          draft={draft}
          clients={clients}
          candidates={candidates}
          isBusy={isBusy}
          onChange={setDraft}
          onSubmit={classify}
        />
      </div>
      <div className={styles.outputs}>
        <ClassificationResult state={state} />
        <SuggestionPanel
          clientName={
            clients.find(({ id }) => id === result?.request.clientId)?.name ??
            null
          }
          suggestions={result?.result.suggestions ?? []}
        />
      </div>
    </div>
  );
}

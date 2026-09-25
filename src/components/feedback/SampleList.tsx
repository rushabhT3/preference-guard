"use client";

import { padCount } from "@/components/format";
import { Panel } from "@/components/Panel";
import styles from "./SampleList.module.css";
import type { ClassifyRequest, SampleView } from "./types";

export interface SampleListProps {
  samples: SampleView[];
  isBusy: boolean;
  onPick: (request: ClassifyRequest) => void;
}

export function SampleList({ samples, isBusy, onPick }: SampleListProps) {
  return (
    <Panel title="Real-world samples" meta={`${samples.length} messages`}>
      <ol className={styles.samples}>
        {samples.map((sample, index) => (
          <li key={sample.id}>
            <button
              type="button"
              className={styles.sample}
              disabled={isBusy}
              onClick={() => onPick(sample)}
            >
              <span className={styles.header}>
                <span className={styles.index}>{padCount(index + 1)}</span>
                {sample.clientName} on {sample.candidateName}
              </span>
              <span className={styles.text}>“{sample.feedbackText}”</span>
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

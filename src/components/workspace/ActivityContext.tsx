"use client";

import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";

export type ActivityKind = "sent" | "override" | "sent_unverified";

export interface ActivityEntry {
  id: number;
  kind: ActivityKind;
  clientId: string;
  clientName: string;
  candidateId: string;
  candidateName: string;
  detail: string | null;
}

export type NewActivity = Omit<ActivityEntry, "id">;

interface ActivityContextValue {
  entries: ActivityEntry[];
  record: (activity: NewActivity) => void;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const record = useCallback((activity: NewActivity) => {
    setEntries((previous) => [
      { ...activity, id: previous.length + 1 },
      ...previous,
    ]);
  }, []);
  const value = useMemo(() => ({ entries, record }), [entries, record]);
  return <ActivityContext value={value}>{children}</ActivityContext>;
}

export function useActivity(): ActivityContextValue {
  const context = use(ActivityContext);
  if (!context) {
    throw new Error("useActivity must be used inside <ActivityProvider>");
  }
  return context;
}

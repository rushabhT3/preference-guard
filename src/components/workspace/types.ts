import type { Side, Status } from "@/domain/rules";
import type { ActivityKind } from "./ActivityContext";

export interface RuleLine {
  side: Side;
  message: string;
}

export interface GapLine extends RuleLine {
  fieldLabel: string;
}

export interface CandidateView {
  id: string;
  name: string;
  meta: string;
  status: Status;
  fitScore: number;
  fitCaption: string;
  fitLabel: string;
  reasons: string[];
  blockers: RuleLine[];
  gaps: GapLine[];
  question: string | null;
}

export interface ClientOption {
  id: string;
  name: string;
  meta: string;
}

export interface ClientGroup {
  matchmakerName: string;
  clients: ClientOption[];
}

export interface ClientView extends ClientOption {
  matchmakerName: string;
  dealbreakers: { id: string; label: string; source: "intake" | "feedback" }[];
  softPreferences: { id: string; label: string; weight: number }[];
  stats: { sends: number; acceptance: number; violationRate: number };
}

export interface SendRequest {
  candidate: CandidateView;
  kind: ActivityKind;
  detail: string | null;
}

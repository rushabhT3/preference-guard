export interface PersonOption {
  id: string;
  name: string;
  gender: "male" | "female";
  meta: string;
}

export interface SampleView {
  id: string;
  clientId: string;
  candidateId: string;
  clientName: string;
  candidateName: string;
  feedbackText: string;
}

export interface ClassifyRequest {
  clientId: string;
  candidateId: string;
  feedbackText: string;
}

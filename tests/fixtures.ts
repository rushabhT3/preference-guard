import type { Client, HardConstraint, Profile } from "@/domain/schemas";

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "cd_test",
    name: "Test Candidate",
    gender: "male",
    age: 31,
    heightCm: 175,
    city: "Pune",
    openToRelocate: true,
    maritalStatus: "never_married",
    hasChildren: false,
    wantsChildren: "yes",
    smoking: "never",
    drinking: "socially",
    diet: "veg",
    religion: "Hindu",
    community: "Maratha",
    motherTongue: "Marathi",
    education: "masters",
    profession: "Software engineer",
    incomeBandLakhs: "25-50",
    familyType: "nuclear",
    bio: "Test profile.",
    ...overrides,
  };
}

export function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    ...makeProfile({
      id: "cl_test",
      name: "Test Client",
      gender: "female",
      age: 29,
    }),
    matchmakerId: "mm_a",
    preferences: { hard: [], soft: [] },
    ...overrides,
  };
}

export const NON_SMOKER: HardConstraint = {
  id: "hc_smoking",
  kind: "noneOf",
  field: "smoking",
  disallowed: ["occasionally", "regularly"],
  label: "Non-smoker only",
  source: "intake",
};

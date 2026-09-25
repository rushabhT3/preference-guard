import type {
  ConstraintField,
  HardConstraint,
  Profile,
  ReasonCategory,
} from "./schemas";

export type FieldValue = string | number | boolean | null;

export const FIELD_LABELS: Record<ConstraintField, string> = {
  age: "Age",
  heightCm: "Height",
  city: "City",
  openToRelocate: "Open to relocate",
  maritalStatus: "Marital status",
  hasChildren: "Has children",
  wantsChildren: "Wants children",
  smoking: "Smoking",
  drinking: "Drinking",
  diet: "Diet",
  religion: "Religion",
  community: "Community",
  motherTongue: "Mother tongue",
  education: "Education",
  profession: "Profession",
  incomeBandLakhs: "Income",
  familyType: "Family type",
};

const VALUE_LABELS: Record<string, string> = {
  never_married: "never married",
  non_veg: "non-veg",
  "<10": "under ₹10 L",
  "10-25": "₹10–25 L",
  "25-50": "₹25–50 L",
  "50+": "₹50 L+",
};

export function readField(
  profile: Profile,
  field: ConstraintField,
): FieldValue {
  return profile[field];
}

export function formatFieldValue(
  field: ConstraintField,
  value: FieldValue,
): string {
  if (value === null) return "not stated";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (field === "heightCm") return `${value} cm`;
  return VALUE_LABELS[String(value)] ?? String(value);
}

export function constraintField(constraint: HardConstraint): ConstraintField {
  return constraint.kind === "location" ? "city" : constraint.field;
}

export const REASON_CATEGORY_LABELS: Record<ReasonCategory, string> = {
  age: "age",
  height: "height",
  location: "location",
  marital_status: "marital status",
  children: "children",
  smoking: "smoking",
  drinking: "drinking",
  diet: "diet",
  religion_community: "religion or community",
  education_profession: "education or profession",
  income: "income",
  family: "family",
  appearance_photos: "photos or looks",
  personality_vibe: "personality or vibe",
  timing_availability: "timing",
  other: "other",
};

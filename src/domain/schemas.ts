import { z } from "zod";

export const MatchmakerIdSchema = z.enum(["mm_a", "mm_b"]);
export const MatchmakerSchema = z.object({
  id: MatchmakerIdSchema,
  name: z.string().min(1),
});

export const GenderSchema = z.enum(["male", "female"]);
export const MaritalStatusSchema = z.enum([
  "never_married",
  "divorced",
  "widowed",
]);
export const WantsChildrenSchema = z.enum(["yes", "no", "open"]);
export const SmokingSchema = z.enum(["never", "occasionally", "regularly"]);
export const DrinkingSchema = z.enum(["never", "socially", "regularly"]);
export const DietSchema = z.enum([
  "veg",
  "eggetarian",
  "non_veg",
  "vegan",
  "jain",
]);
export const EducationSchema = z.enum([
  "bachelors",
  "masters",
  "doctorate",
  "professional",
]);
export const IncomeBandSchema = z.enum(["<10", "10-25", "25-50", "50+"]);
export const FamilyTypeSchema = z.enum(["nuclear", "joint"]);

export const RangeFieldSchema = z.enum(["age", "heightCm"]);
export const CategoricalFieldSchema = z.enum([
  "maritalStatus",
  "wantsChildren",
  "smoking",
  "drinking",
  "diet",
  "religion",
  "community",
  "motherTongue",
  "education",
  "profession",
  "incomeBandLakhs",
  "familyType",
]);
export const BooleanFieldSchema = z.enum(["hasChildren", "openToRelocate"]);

/** Every profile field a constraint or preference can reference. */
export const ConstraintFieldSchema = z.enum([
  ...RangeFieldSchema.options,
  ...CategoricalFieldSchema.options,
  ...BooleanFieldSchema.options,
  "city",
]);

const constraintBase = {
  id: z.string().min(1),
  label: z.string().min(1),
  source: z.enum(["intake", "feedback"]),
};

export const HardConstraintSchema = z.discriminatedUnion("kind", [
  z.object({
    ...constraintBase,
    kind: z.literal("range"),
    field: RangeFieldSchema,
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    ...constraintBase,
    kind: z.literal("oneOf"),
    field: CategoricalFieldSchema,
    allowed: z.array(z.string()).min(1),
  }),
  z.object({
    ...constraintBase,
    kind: z.literal("noneOf"),
    field: CategoricalFieldSchema,
    disallowed: z.array(z.string()).min(1),
  }),
  z.object({
    ...constraintBase,
    kind: z.literal("equals"),
    field: BooleanFieldSchema,
    value: z.boolean(),
  }),
  z.object({
    ...constraintBase,
    kind: z.literal("location"),
    allowedCities: z.array(z.string()).min(1),
    acceptIfOpenToRelocate: z.boolean(),
  }),
]);

export const SoftPreferenceSchema = z.object({
  id: z.string().min(1),
  field: ConstraintFieldSchema,
  prefer: z.union([
    z.array(z.string()).min(1),
    z.object({ min: z.number().optional(), max: z.number().optional() }),
  ]),
  weight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  label: z.string().min(1),
});

export const PreferencesSchema = z.object({
  hard: z.array(HardConstraintSchema),
  soft: z.array(SoftPreferenceSchema),
});

export const ProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  gender: GenderSchema,
  age: z.number().int(),
  heightCm: z.number().int(),
  city: z.string().min(1),
  openToRelocate: z.boolean().nullable(),
  maritalStatus: MaritalStatusSchema,
  hasChildren: z.boolean().nullable(),
  wantsChildren: WantsChildrenSchema.nullable(),
  smoking: SmokingSchema.nullable(),
  drinking: DrinkingSchema.nullable(),
  diet: DietSchema.nullable(),
  religion: z.string().min(1),
  community: z.string().nullable(),
  motherTongue: z.string().min(1),
  education: EducationSchema,
  profession: z.string().min(1),
  incomeBandLakhs: IncomeBandSchema,
  familyType: FamilyTypeSchema.nullable(),
  bio: z.string(),
  preferences: PreferencesSchema.optional(),
});

export const ClientSchema = ProfileSchema.extend({
  matchmakerId: MatchmakerIdSchema,
  preferences: PreferencesSchema,
});

/** Ordered: each stage implies every stage before it. "shared" alone means rejected. */
export const FUNNEL_STAGES = [
  "shared",
  "accepted",
  "contact_shared",
  "conversation_started",
  "meeting_fixed",
  "meeting_completed",
] as const;
export const FunnelStageSchema = z.enum(FUNNEL_STAGES);

export const HistoryEventSchema = z
  .object({
    id: z.string().min(1),
    sharedAt: z.iso.datetime(),
    matchmakerId: MatchmakerIdSchema,
    clientId: z.string().min(1),
    candidateId: z.string().min(1),
    stageReached: FunnelStageSchema,
    rejectionText: z.string().min(1).nullable(),
  })
  .refine(
    (event) =>
      (event.stageReached === "shared") === (event.rejectionText !== null),
    {
      message:
        "rejectionText is required exactly when the profile was rejected",
    },
  );

export const FeedbackSampleSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  candidateId: z.string().min(1),
  feedbackText: z.string().min(1).max(1000),
});

export const ReasonCategorySchema = z.enum([
  "age",
  "height",
  "location",
  "marital_status",
  "children",
  "smoking",
  "drinking",
  "diet",
  "religion_community",
  "education_profession",
  "income",
  "family",
  "appearance_photos",
  "personality_vibe",
  "timing_availability",
  "other",
]);

export const ReasonFieldSchema = z.enum([
  ...ConstraintFieldSchema.options,
  "none",
]);

export const RejectionReasonSchema = z.object({
  category: ReasonCategorySchema,
  field: ReasonFieldSchema,
  evidence: z
    .string()
    .describe("shortest phrase from the feedback showing this reason"),
  strength: z.enum(["dealbreaker", "preference", "unclear"]),
});

export const RejectionClassificationSchema = z.object({
  reasons: z.array(RejectionReasonSchema),
  primaryCategory: ReasonCategorySchema,
  openness: z.enum(["firm_no", "soft_no", "open_later"]),
  summary: z.string().describe("one plain-English sentence"),
});

export type MatchmakerId = z.infer<typeof MatchmakerIdSchema>;
export type Matchmaker = z.infer<typeof MatchmakerSchema>;
export type RangeField = z.infer<typeof RangeFieldSchema>;
export type CategoricalField = z.infer<typeof CategoricalFieldSchema>;
export type BooleanField = z.infer<typeof BooleanFieldSchema>;
export type ConstraintField = z.infer<typeof ConstraintFieldSchema>;
export type HardConstraint = z.infer<typeof HardConstraintSchema>;
export type SoftPreference = z.infer<typeof SoftPreferenceSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Client = z.infer<typeof ClientSchema>;
export type FunnelStage = z.infer<typeof FunnelStageSchema>;
export type HistoryEvent = z.infer<typeof HistoryEventSchema>;
export type FeedbackSample = z.infer<typeof FeedbackSampleSchema>;
export type ReasonCategory = z.infer<typeof ReasonCategorySchema>;
export type ReasonField = z.infer<typeof ReasonFieldSchema>;
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;
export type RejectionClassification = z.infer<
  typeof RejectionClassificationSchema
>;

import { constraintField } from "@/domain/fields";
import { evaluateConstraint } from "@/domain/rules";
import {
  type Client,
  type HardConstraint,
  HardConstraintSchema,
  type MatchmakerId,
  type Profile,
  type SoftPreference,
} from "@/domain/schemas";
import type { Rng } from "./prng";
import { outcomePatch } from "./roster";
import {
  ABROAD_CITIES,
  cells,
  HOBBIES,
  HUB_CITIES,
  list,
  PROFESSIONS,
  REGIONS,
  rows,
  TECH_PROFESSIONS,
  TRAIT_WEIGHTS,
  UNKNOWN_SHARES,
} from "./vocabulary";

export type Gender = Profile["gender"];
export type ViolationField =
  | "smoking"
  | "city"
  | "drinking"
  | "diet"
  | "age"
  | "wantsChildren"
  | "maritalStatus"
  | "heightCm";
type HardField = ViolationField | "hasChildren" | "religion" | "community";
export type SignalField = (typeof SIGNAL_FIELDS)[number];
type RuleSpec = {
  [K in HardConstraint["kind"]]: Omit<
    Extract<HardConstraint, { kind: K }>,
    "id" | "source"
  >;
}[HardConstraint["kind"]];

interface ProfileSeed {
  id: string;
  gender: Gender;
  allowUnknowns: boolean;
}

export interface ClientSeed {
  id: string;
  gender: Gender;
  matchmakerId: MatchmakerId;
  requiredFields: readonly HardField[];
  needsUnknownCity: boolean;
}

interface RuleDraw {
  rng: Rng;
  fields: readonly HardField[];
  count: number;
  mayAdaptOwner: boolean;
  needsUnknownCity: boolean;
}

export const SIGNAL_FIELDS = [
  "education",
  "incomeBandLakhs",
  "heightCm",
  "familyType",
  "motherTongue",
  "profession",
] as const;

const RULE_TABLE = `
smoking       | noneOf | occasionally, regularly | Non-smoker only
smoking       | noneOf | regularly               | No regular smokers
drinking      | noneOf | socially, regularly     | Non-drinker only
drinking      | noneOf | regularly               | No regular drinkers
diet          | oneOf  | veg, jain               | Vegetarian only
diet          | oneOf  | veg, eggetarian, jain   | Vegetarian or eggetarian
wantsChildren | oneOf  | yes, open               | Wants children, or open to it
wantsChildren | oneOf  | no, open                | Child-free, or open to it
maritalStatus | oneOf  | never_married           | Never married only
hasChildren   | equals | false                   | No children from a previous marriage
community     | oneOf  | Deshastha Brahmin, Niyogi Brahmin, Iyer, Iyengar, Madhwa Brahmin, Bengali Brahmin, Nagar Brahmin | Brahmin communities only
`;

const VALUE_KEYS: Record<string, string> = {
  oneOf: "allowed",
  noneOf: "disallowed",
  equals: "value",
};
const CLIENT_RULE_WEIGHTS: Record<HardField, number> = {
  age: 6,
  smoking: 4,
  city: 3,
  diet: 3,
  drinking: 3,
  religion: 2,
  wantsChildren: 2,
  maritalStatus: 2,
  hasChildren: 2,
  community: 1,
  heightCm: 1,
};
const OWN_RULE_WEIGHTS = {
  age: 3,
  city: 2,
  smoking: 2,
  drinking: 1,
  maritalStatus: 1,
  diet: 1,
};
const RULE_COUNTS = [3, 3, 3, 4, 4, 4, 4, 5, 5, 6];
const CORE_NULLABLE_FIELDS: HardField[] = [
  "smoking",
  "drinking",
  "wantsChildren",
];
const IDENTITY_FIELDS: HardField[] = ["religion", "community"];
const RESERVED_SIGNAL_COUNT = 2;
const ABROAD_SHARE = 0.12;
const OPEN_TO_RELOCATE_SHARE = 0.47;
const RELOCATION_CLAUSE_SHARE = 0.8;
const OWN_PREFERENCES_SHARE = 0.5;
const MIN_PARTNER_AGE = 22;
const PARTNER_HEIGHT_PIVOT_CM = 168;

function parseRuleRow(row: string): RuleSpec {
  const [field, kind, values, label] = cells(row);
  const value = kind === "equals" ? values === "true" : list(values);
  const rule = HardConstraintSchema.parse({
    id: field,
    kind,
    field,
    [VALUE_KEYS[kind]]: value,
    label,
    source: "intake",
  });
  const { id: _id, source: _source, ...spec } = rule;
  return spec;
}

const RULE_CATALOG = Map.groupBy(rows(RULE_TABLE).map(parseRuleRow), (spec) =>
  spec.kind === "location" ? "city" : spec.field,
);

export function randomProfile(rng: Rng, seed: ProfileSeed): Profile {
  const region = rng.weighted(REGIONS.map((r) => [r, r.weight] as const));
  const draw = rng.weightedKey;
  const orUnknown = <T>(field: keyof typeof UNKNOWN_SHARES, value: T) =>
    seed.allowUnknowns && rng.chance(UNKNOWN_SHARES[field]) ? null : value;
  const isFemale = seed.gender === "female";
  const maritalStatus = draw(TRAIT_WEIGHTS.maritalStatus);
  const profession = rng.pick(PROFESSIONS);
  const [hobby, otherHobby] = rng.shuffle(HOBBIES);
  return {
    id: seed.id,
    name: `${rng.pick(isFemale ? region.femaleNames : region.maleNames)} ${rng.pick(region.surnames)}`,
    gender: seed.gender,
    age: isFemale ? rng.int(24, 34) : rng.int(26, 37),
    heightCm: isFemale ? rng.int(150, 172) : rng.int(164, 188),
    city: rng.pick(rng.chance(ABROAD_SHARE) ? ABROAD_CITIES : region.cities),
    openToRelocate: orUnknown(
      "openToRelocate",
      rng.chance(OPEN_TO_RELOCATE_SHARE),
    ),
    maritalStatus,
    hasChildren: maritalStatus !== "never_married" && rng.chance(0.4),
    wantsChildren: orUnknown(
      "wantsChildren",
      draw(TRAIT_WEIGHTS.wantsChildren),
    ),
    smoking: orUnknown("smoking", draw(TRAIT_WEIGHTS.smoking)),
    drinking: orUnknown("drinking", draw(TRAIT_WEIGHTS.drinking)),
    diet:
      region.religion === "Jain"
        ? "jain"
        : orUnknown("diet", draw(TRAIT_WEIGHTS.diet)),
    religion: region.religion,
    community: orUnknown("community", rng.pick(region.communities)),
    motherTongue: region.motherTongue,
    education: draw(TRAIT_WEIGHTS.education),
    profession,
    incomeBandLakhs: draw(TRAIT_WEIGHTS.incomeBandLakhs),
    familyType: orUnknown("familyType", draw(TRAIT_WEIGHTS.familyType)),
    bio: `${profession} who enjoys ${hobby} and ${otherHobby}.`,
  };
}

const hardRule = (ownerId: string, spec: RuleSpec): HardConstraint => ({
  id: `${ownerId}_${spec.kind === "location" ? "city" : spec.field}`,
  ...spec,
  source: "intake",
});

function partnerRule(
  field: HardField,
  owner: Profile,
  draw: RuleDraw,
): RuleSpec | undefined {
  const { rng } = draw;
  const isFemale = owner.gender === "female";
  if (field === "age") {
    const min = isFemale
      ? owner.age - rng.int(0, 2)
      : Math.max(owner.age - rng.int(4, 6), MIN_PARTNER_AGE);
    const max = owner.age + (isFemale ? rng.int(4, 6) : rng.int(0, 2));
    return { kind: "range", field, min, max, label: `Age ${min}–${max}` };
  }
  if (field === "heightCm" && isFemale) {
    const min = Math.max(
      owner.heightCm + rng.int(5, 10),
      PARTNER_HEIGHT_PIVOT_CM,
    );
    return { kind: "range", field, min, label: `Height ${min} cm or more` };
  }
  if (field === "heightCm") {
    const max = Math.min(
      owner.heightCm - rng.int(3, 8),
      PARTNER_HEIGHT_PIVOT_CM,
    );
    return { kind: "range", field, max, label: `Height up to ${max} cm` };
  }
  if (field !== "city") return undefined;
  const cities = [
    owner.city,
    rng.pick(HUB_CITIES.filter((city) => city !== owner.city)),
  ];
  const relocation =
    draw.needsUnknownCity || rng.chance(RELOCATION_CLAUSE_SHARE);
  const label = `Lives in ${cities.join(" or ")}${relocation ? ", or open to relocate" : ""}`;
  return {
    kind: "location",
    allowedCities: cities,
    acceptIfOpenToRelocate: relocation,
    label,
  };
}

function lifestyleRules(field: HardField, owner: Profile): RuleSpec[] {
  if (field !== "religion") return RULE_CATALOG.get(field) ?? [];
  if (!["Hindu", "Sikh", "Jain"].includes(owner.religion)) return [];
  const allowed = [...new Set([owner.religion, "Hindu"])];
  return [
    { kind: "oneOf", field, allowed, label: `${allowed.join(" or ")} only` },
  ];
}

function chooseRule(
  field: HardField,
  owner: Profile,
  draw: RuleDraw,
): RuleSpec | undefined {
  const partner = partnerRule(field, owner, draw);
  if (partner) return partner;
  const options = lifestyleRules(field, owner);
  const kept = options.filter(
    (spec) =>
      evaluateConstraint(hardRule(owner.id, spec), owner).outcome !== "fail",
  );
  const mayAdapt = draw.mayAdaptOwner && !IDENTITY_FIELDS.includes(field);
  const choices = kept.length > 0 || !mayAdapt ? kept : options;
  return choices.length > 0 ? draw.rng.pick(choices) : undefined;
}

function weightedOrder<K extends string>(
  weights: Record<K, number>,
  rng: Rng,
): K[] {
  let remaining = Object.entries(weights) as [K, number][];
  const order: K[] = [];
  while (remaining.length > 0) {
    const key = rng.weighted(remaining);
    order.push(key);
    remaining = remaining.filter(([other]) => other !== key);
  }
  return order;
}

function drawRules(
  owner: Profile,
  draw: RuleDraw,
): { owner: Profile; hard: HardConstraint[] } {
  let adapted = owner;
  const hard: HardConstraint[] = [];
  for (const field of new Set(draw.fields)) {
    if (hard.length >= draw.count) break;
    const spec = chooseRule(field, adapted, draw);
    if (!spec) continue;
    const rule = hardRule(owner.id, spec);
    hard.push(rule);
    if (
      evaluateConstraint(rule, adapted).outcome === "fail" &&
      spec.kind !== "range"
    ) {
      adapted = { ...adapted, ...outcomePatch(rule, "pass", draw.rng) };
    }
  }
  return { owner: adapted, hard };
}

function softPreference(
  field: SignalField,
  owner: Profile,
): Pick<SoftPreference, "prefer" | "label"> {
  const { gender, heightCm, familyType, motherTongue } = owner;
  const tallest = Math.min(heightCm - 5, PARTNER_HEIGHT_PIVOT_CM - 3);
  const shortest = Math.max(heightCm + 8, PARTNER_HEIGHT_PIVOT_CM + 4);
  switch (field) {
    case "education":
      return {
        prefer: ["masters", "doctorate", "professional"],
        label: "Prefers a postgraduate",
      };
    case "incomeBandLakhs":
      return { prefer: ["25-50", "50+"], label: "Prefers income above ₹25 L" };
    case "heightCm":
      return gender === "male"
        ? {
            prefer: { max: tallest },
            label: `Prefers ${tallest} cm or shorter`,
          }
        : {
            prefer: { min: shortest },
            label: `Prefers ${shortest} cm or taller`,
          };
    case "familyType":
      return {
        prefer: [familyType ?? "nuclear"],
        label: `Prefers a ${familyType} family`,
      };
    case "motherTongue":
      return {
        prefer: [motherTongue],
        label: `Prefers a ${motherTongue} speaker`,
      };
    case "profession":
      return { prefer: TECH_PROFESSIONS, label: "Prefers someone in tech" };
  }
}

function softPreferences(
  owner: Profile,
  hard: readonly HardConstraint[],
  rng: Rng,
): SoftPreference[] {
  const hardFields = new Set<string>(hard.map(constraintField));
  const open = rng.shuffle(
    SIGNAL_FIELDS.filter((field) => !hardFields.has(field)),
  );
  const chosen = open.slice(
    RESERVED_SIGNAL_COUNT,
    RESERVED_SIGNAL_COUNT + rng.int(2, 4),
  );
  return chosen.map((field) => {
    const { prefer, label } = softPreference(field, owner);
    return {
      id: `${owner.id}_soft_${field}`,
      field,
      prefer,
      weight: rng.pick([1, 2, 3] as const),
      label,
    };
  });
}

export function createClient(rng: Rng, seed: ClientSeed): Client {
  const profile = randomProfile(rng, {
    id: seed.id,
    gender: seed.gender,
    allowUnknowns: false,
  });
  const hasCoreField = seed.requiredFields.some((field) =>
    CORE_NULLABLE_FIELDS.includes(field),
  );
  const required = hasCoreField
    ? seed.requiredFields
    : [...seed.requiredFields, rng.pick(CORE_NULLABLE_FIELDS)];
  const fields = [...required, ...weightedOrder(CLIENT_RULE_WEIGHTS, rng)];
  const count = Math.max(new Set(required).size, rng.pick(RULE_COUNTS));
  const draw = {
    rng,
    fields,
    count,
    mayAdaptOwner: true,
    needsUnknownCity: seed.needsUnknownCity,
  };
  const { owner, hard } = drawRules(profile, draw);
  const soft = softPreferences(owner, hard, rng);
  return {
    ...owner,
    matchmakerId: seed.matchmakerId,
    preferences: { hard, soft },
  };
}

export function withOwnPreferences(profile: Profile, rng: Rng): Profile {
  if (!rng.chance(OWN_PREFERENCES_SHARE)) return profile;
  const fields = weightedOrder(OWN_RULE_WEIGHTS, rng);
  const draw = {
    rng,
    fields,
    count: rng.int(1, 3),
    mayAdaptOwner: false,
    needsUnknownCity: false,
  };
  const { hard } = drawRules(profile, draw);
  return { ...profile, preferences: { hard, soft: [] } };
}

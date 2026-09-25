import { constraintField, readField } from "@/domain/fields";
import { evaluateConstraint, type Outcome } from "@/domain/rules";
import type {
  Client,
  ConstraintField,
  HardConstraint,
  Profile,
} from "@/domain/schemas";
import type { Rng } from "./prng";
import { SIGNAL_FIELDS, type SignalField } from "./profiles";
import { outcomePatch } from "./roster";
import { cells, rows } from "./vocabulary";

export interface Pair {
  client: Client;
  candidate: Profile;
}

export interface Violation {
  rule: HardConstraint;
  candidate: Profile;
  isHidden: boolean;
}

export interface OpenReasonInput {
  client: Client;
  candidates: readonly Profile[];
  clientIndex: number;
}

type Vars = Record<string, string>;

const SIGNAL_CLIENT_STRIDE = 12;
const SIGNAL_CLIENT_OFFSET = 5;
const SIGNAL_REPEATS = 2;
const OPEN_LATER_CLIENT_STRIDE = 4;
const FIELD_REASON_EVERY = 3;
const TAIL_CHANCE = 0.3;
const PAIRED_SUBJECTIVE_CHANCE = 0.35;
const NOTICEABLE_HEIGHT_GAP_CM = 6;

const lines = (table: string) => rows(table).map((row) => row.trim());
const keyedTable = (table: string) =>
  new Map(rows(table).map((row) => [cells(row)[0], cells(row).slice(1)]));

const FACTS = keyedTable(`
smoking             | {p} smokes {value} | apparently {p} smokes {value} | {p} smokes {value}, saw it on insta
drinking            | {p} drinks {value} | {p} said {p} drinks {value} | {p} drinks {value}, daaru is a no for us
diet:eggetarian     | {p} eats eggs | {p} is eggetarian, eats eggs daily
diet:non_veg        | {p} eats non-veg | {p} is non-veg | {p} is non-veg, chicken every weekend
age:above           | {p} is {value}, too old for me | {p} is {value}, way older than what I wanted | age {value}, too much of a gap
age:below           | {p} is {value}, too young for me | {p} is {value}, way younger than what I wanted | age {value}, too much of a gap
heightCm:above      | {p} is {value} cm, too tall for me | height is {value} cm, too tall
heightCm:below      | {p} is {value} cm, too short for me | height is {value} cm, too short
city:stays          | {p} is in {value} and won't relocate | {p} lives in {value}, not open to relocating
city:settled        | {p} is settled in {value} | {p} lives in {value} | {p} is based out of {value}
wantsChildren:yes   | {p} wants kids soon | {p} definitely wants children
wantsChildren:no    | {p} doesn't want kids | {p} said no kids at all | {p} is clear {p} doesn't want children
maritalStatus       | {p} is {value} | {value} profile, sorry
`);

const BLOCKED_FRAMES = lines(`
  {fact}, I clearly said {rule}
  sorry but {fact}. {rule} was the one thing we asked for
  {fact}!! we told you {rule}, pls check before sending
  kya yaar, {fact}. "{rule}" bola tha na
  Not ok - {fact}. my form says {rule}
  {Fact}. {rule} is non negotiable for my parents
  {fact}, definately not. {rule}
  {fact} and the photos were also meh. anyway {rule} was clear
`);

const HIDDEN_FRAMES = lines(`
  turns out {fact}, profile didn't say
  found out on the call that {fact}. this was not in the profile
  {fact} - why was this blank in the profile?
  pata chala {fact}, profile mein kuch nahi likha tha
  {Fact}. profile didn't mention it and {rule} matters to me
  spoke to them, {fact}. should have been checked before sharing
`);

const SUBJECTIVE = lines(`
  photos looked very different from the profile, not interested
  not my type honestly
  spoke once, no chemistry at all
  vibe nahi aayi. {p} seemed quite arrogant on the call
  {P} looks nice but the conversation was boring
  dint click, felt like an interview
  pics are too filtered, cant really tell. pass
  {p} is travelling for work most weekends, timing doesnt work
  honestly no spark, attitude felt off
`);

const OPEN_LATER = lines(`
  not now, maybe later
  abhi nahi, maybe after diwali
  {p} seems nice but I am busy till next month, ask again later
  not ready right now, can revisit in a few months
  timing is off for me. maybe later
  not now pls, lot going on at home. lets see in few months
`);

const TAILS = lines(`
  also no real chemistry on the call
  also the photos didn't do much for me
`);

const FIELD_REASONS = keyedTable(`
education       | different education level ({value} vs my {own}), not comfortable | {p} has a {value} degree, I was hoping for a closer match on education
incomeBandLakhs | income gap is too big ({value} vs my {own}) | {p} earns {value}, doesn't match what my parents had in mind
heightCm        | {p} is {value} cm, height gap with me is too little | not enough height difference, {p} is {value} cm and I am {own}
familyType      | {p} lives in a {value} family, I am used to a {own} setup | {value} family setup won't suit me
motherTongue    | language issue, {p} speaks {value} and I wanted someone who speaks {own} | different language at home ({value}), my parents won't be comfortable
profession      | {value} hours are crazy, that job won't suit me | career wise not a match ({value})
`);

const VALUE_WORDS: Record<string, string> = {
  bachelors: "bachelor's",
  masters: "master's",
  doctorate: "PhD",
  "<10": "under 10 LPA",
  "10-25": "10-25 LPA",
  "25-50": "25-50 LPA",
  "50+": "50+ LPA",
};

const SAMPLE_TEXTS = keyedTable(`
smoker         | {P} smokes {smoking}!! I have told you 10 times no smokers. pls check before sending such profiles
far-city       | Ma'am {p} is in {city}... I said {allowed} only. also looks much older than the photos
non-veg        | non veg khata hai, hum pure veg hain. sorry no
hidden-drinker | spoke on phone, {p} drinks every weekend it seems. profile mein kuch nahi likha tha
hidden-no-kids | {p} said no kids at all?? this was not on the profile. otherwise nice
age-drift      | {p} is {age}, feels too old for me honestly. I know it is within my range but still
city-drift     | {p} lives in {city} but at the other end, too far for me with this traffic
joint-family   | joint family with 3 generations in one house.. I want my own space. nice person otherwise
startup        | {p} runs a startup, too unstable for my parents. baaki sab theek hai
education      | education is just bachelors, i was hoping for masters atleast. photos r nice tho
photos         | photos dont match the person on video call. no chemistry. sorry
not-now        | abhi nahi yaar, busy with office and travel till diwali. maybe later
`);

const SAMPLE_MATCHERS: Record<string, (pair: Pair) => boolean> = {
  smoker: (pair) => outcomeOn(pair, "smoking") === "fail",
  "far-city": (pair) => outcomeOn(pair, "city") === "fail",
  "non-veg": (pair) =>
    outcomeOn(pair, "diet") === "fail" && pair.candidate.diet === "non_veg",
  "hidden-drinker": (pair) => outcomeOn(pair, "drinking") === "unknown",
  "hidden-no-kids": (pair) =>
    outcomeOn(pair, "wantsChildren") === "unknown" &&
    pair.client.wantsChildren === "yes",
  "age-drift": (pair) =>
    outcomeOn(pair, "age") === "pass" &&
    pair.candidate.age - pair.client.age >= 4,
  "city-drift": (pair) =>
    outcomeOn(pair, "city") === "pass" &&
    pair.candidate.city === pair.client.city,
  "joint-family": ({ client, candidate }) =>
    !hasPreference(client, "familyType") &&
    client.familyType === "nuclear" &&
    candidate.familyType === "joint",
  startup: ({ client, candidate }) =>
    !hasPreference(client, "profession") &&
    candidate.profession === "Startup founder",
  education: ({ client, candidate }) =>
    client.preferences.soft.some(({ field }) => field === "education") &&
    candidate.education === "bachelors",
  photos: () => true,
  "not-now": () => true,
};

function fill(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`"${template}" needs {${name}}`);
    return value;
  });
}

function templatesFor(table: Map<string, string[]>, key: string): string[] {
  const templates = table.get(key);
  if (!templates) throw new Error(`No rejection wording for ${key}`);
  return templates;
}

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
const describe = (value: unknown) =>
  VALUE_WORDS[String(value)] ?? String(value);

function voice(profile: Profile): Vars {
  const pronoun = profile.gender === "female" ? "she" : "he";
  return { p: pronoun, P: capitalize(pronoun) };
}

export function ruleOn(
  client: Client,
  field: ConstraintField,
): HardConstraint | undefined {
  return client.preferences.hard.find(
    (rule) => constraintField(rule) === field,
  );
}

function hasPreference(client: Client, field: ConstraintField): boolean {
  return (
    ruleOn(client, field) !== undefined ||
    client.preferences.soft.some((pref) => pref.field === field)
  );
}

function outcomeOn(
  { client, candidate }: Pair,
  field: ConstraintField,
): Outcome | undefined {
  const rule = ruleOn(client, field);
  return rule && evaluateConstraint(rule, candidate).outcome;
}

function factKey(rule: HardConstraint, profile: Profile): string {
  const field = constraintField(rule);
  const value = readField(profile, field);
  const side =
    rule.kind === "range" && rule.max !== undefined && Number(value) > rule.max
      ? "above"
      : "below";
  if (field === "age" || field === "heightCm") return `${field}:${side}`;
  if (field === "city")
    return profile.openToRelocate === false ? "city:stays" : "city:settled";
  if (field === "wantsChildren")
    return `wantsChildren:${value === "yes" ? "yes" : "no"}`;
  return field === "diet" ? `diet:${value}` : field;
}

function rulePhrase(rule: HardConstraint): string {
  if (rule.kind === "location")
    return `${rule.allowedCities.join(" or ")} only`;
  return rule.label.charAt(0).toLowerCase() + rule.label.slice(1);
}

export function violationText(
  { rule, candidate, isHidden }: Violation,
  rng: Rng,
): string {
  const hiddenTruth =
    rule.kind === "location"
      ? { openToRelocate: false }
      : outcomePatch(rule, "fail", rng);
  const revealed = isHidden ? { ...candidate, ...hiddenTruth } : candidate;
  const value = String(readField(revealed, constraintField(rule)));
  const fact = fill(rng.pick(templatesFor(FACTS, factKey(rule, revealed))), {
    ...voice(candidate),
    value,
  });
  const frame = rng.pick(isHidden ? HIDDEN_FRAMES : BLOCKED_FRAMES);
  return fill(frame, { fact, Fact: capitalize(fact), rule: rulePhrase(rule) });
}

function differs(field: SignalField, { client, candidate }: Pair): boolean {
  if (field !== "heightCm")
    return candidate[field] !== null && candidate[field] !== client[field];
  const gap =
    client.gender === "female"
      ? candidate.heightCm - client.heightCm
      : client.heightCm - candidate.heightCm;
  return gap < NOTICEABLE_HEIGHT_GAP_CM;
}

function fieldReasonText(
  field: SignalField,
  { client, candidate }: Pair,
  rng: Rng,
): string {
  const vars = {
    ...voice(candidate),
    value: describe(candidate[field]),
    own: describe(client[field]),
  };
  const text = fill(rng.pick(templatesFor(FIELD_REASONS, field)), vars);
  return rng.chance(TAIL_CHANCE) ? `${text}. ${rng.pick(TAILS)}` : text;
}

function subjectiveText(candidate: Profile, rng: Rng): string {
  const [reason, otherReason] = rng
    .shuffle(SUBJECTIVE)
    .map((template) => fill(template, voice(candidate)));
  return rng.chance(PAIRED_SUBJECTIVE_CHANCE)
    ? `${reason}. ${otherReason}`
    : reason;
}

function repeatedSignalField(
  client: Client,
  candidates: readonly Profile[],
): SignalField {
  const mismatches = (field: SignalField) =>
    candidates.filter((candidate) => differs(field, { client, candidate }))
      .length;
  return SIGNAL_FIELDS.filter((field) => !hasPreference(client, field)).reduce(
    (best, field) => (mismatches(field) > mismatches(best) ? field : best),
  );
}

export function openReasonTexts(
  { client, candidates, clientIndex }: OpenReasonInput,
  rng: Rng,
): string[] {
  const signalField =
    clientIndex % SIGNAL_CLIENT_STRIDE === SIGNAL_CLIENT_OFFSET
      ? repeatedSignalField(client, candidates)
      : null;
  const usedFields = new Set<SignalField>(signalField ? [signalField] : []);
  const openFields = SIGNAL_FIELDS.filter((field) => !ruleOn(client, field));
  let signalUses = 0;
  let owesOpenLater = clientIndex % OPEN_LATER_CLIENT_STRIDE === 0;
  const chooseField = (
    pair: Pair,
    position: number,
  ): SignalField | undefined => {
    if (
      signalField &&
      signalUses < SIGNAL_REPEATS &&
      differs(signalField, pair)
    ) {
      signalUses += 1;
      return signalField;
    }
    if (position % FIELD_REASON_EVERY !== 1) return undefined;
    const field = openFields.find(
      (option) => !usedFields.has(option) && differs(option, pair),
    );
    if (field) usedFields.add(field);
    return field;
  };
  const texts = candidates.map((candidate, position) => {
    const field = chooseField({ client, candidate }, position);
    if (field) return fieldReasonText(field, { client, candidate }, rng);
    if (!owesOpenLater) return subjectiveText(candidate, rng);
    owesOpenLater = false;
    return fill(rng.pick(OPEN_LATER), voice(candidate));
  });
  if (signalField && signalUses < SIGNAL_REPEATS)
    throw new Error(`${client.id} lacks repeated ${signalField} feedback`);
  return texts;
}

export function writeFeedbackSamples(
  pairs: readonly Pair[],
): Array<Pair & { text: string }> {
  const usedIds = new Set<string>();
  return Object.entries(SAMPLE_MATCHERS).map(([name, matches]) => {
    const pair = pairs.find(
      (option) =>
        !usedIds.has(option.client.id) &&
        !usedIds.has(option.candidate.id) &&
        matches(option),
    );
    if (!pair)
      throw new Error(`No client/candidate pair fits the "${name}" sample`);
    usedIds.add(pair.client.id).add(pair.candidate.id);
    const { client, candidate } = pair;
    const vars = {
      ...voice(candidate),
      city: candidate.city,
      age: String(candidate.age),
      smoking: String(candidate.smoking),
    };
    const allowed = ruleOn(client, "city");
    const allowedCities =
      allowed?.kind === "location" ? allowed.allowedCities.join(" or ") : "";
    return {
      ...pair,
      text: fill(templatesFor(SAMPLE_TEXTS, name)[0], {
        ...vars,
        allowed: allowedCities,
      }),
    };
  });
}

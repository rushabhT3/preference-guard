import { readField } from "./fields";
import { compareStatus, evaluateMutual, type MutualEvaluation } from "./rules";
import type { Client, Profile, SoftPreference } from "./schemas";

export type SoftMatch = "match" | "miss" | "unknown";

export interface SoftFit {
  low: number;
  high: number;
  unknownCount: number;
  matched: SoftPreference[];
  missed: SoftPreference[];
  unknown: SoftPreference[];
}

export interface RankedCandidate {
  candidate: Profile;
  evaluation: MutualEvaluation;
  fit: SoftFit;
}

interface NumericBounds {
  min?: number;
  max?: number;
}

function isWithin(value: number, { min, max }: NumericBounds): boolean {
  return (
    (min === undefined || value >= min) && (max === undefined || value <= max)
  );
}

export function softMatch(pref: SoftPreference, profile: Profile): SoftMatch {
  const value = readField(profile, pref.field);
  if (value === null) return "unknown";
  const isMatch = Array.isArray(pref.prefer)
    ? pref.prefer.includes(String(value))
    : typeof value === "number" && isWithin(value, pref.prefer);
  return isMatch ? "match" : "miss";
}

function byWeightThenId(a: SoftPreference, b: SoftPreference): number {
  return b.weight - a.weight || a.id.localeCompare(b.id);
}

function totalWeight(prefs: SoftPreference[]): number {
  return prefs.reduce((sum, pref) => sum + pref.weight, 0);
}

function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((100 * part) / whole);
}

export function softFit(prefs: SoftPreference[], profile: Profile): SoftFit {
  const sorted = [...prefs].sort(byWeightThenId);
  const withMatch = (match: SoftMatch) =>
    sorted.filter((pref) => softMatch(pref, profile) === match);
  const matched = withMatch("match");
  const unknown = withMatch("unknown");
  const whole = totalWeight(prefs);
  return {
    low: percentOf(totalWeight(matched), whole),
    high: percentOf(totalWeight(matched) + totalWeight(unknown), whole),
    unknownCount: unknown.length,
    matched,
    missed: withMatch("miss"),
    unknown,
  };
}

function compareRanked(a: RankedCandidate, b: RankedCandidate): number {
  return (
    compareStatus(a.evaluation.status, b.evaluation.status) ||
    b.fit.low - a.fit.low ||
    a.fit.unknownCount - b.fit.unknownCount ||
    a.candidate.id.localeCompare(b.candidate.id)
  );
}

export function rankCandidates(
  client: Client,
  candidates: Profile[],
): RankedCandidate[] {
  return candidates
    .map((candidate) => ({
      candidate,
      evaluation: evaluateMutual(client, candidate),
      fit: softFit(client.preferences.soft, candidate),
    }))
    .sort(compareRanked);
}

export function formatFit(fit: SoftFit): string {
  if (fit.unknownCount === 0) return `fit ${fit.low}`;
  return `fit ${fit.low} (${fit.unknownCount} unknown, up to ${fit.high})`;
}

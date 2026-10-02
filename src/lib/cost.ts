"use client";

import { ECONOMY_MODEL, MODEL, type Model, type Usage } from "./ai/call";

/** US dollars per million tokens (Anthropic list prices). */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

export function usageCost(u: Usage): number {
  const p = PRICES[u.model] ?? PRICES[MODEL];
  return (
    (u.input_tokens * p.input +
      u.output_tokens * p.output +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1_000_000
  );
}

/* ---------- Which model reads screenshots ---------- */

export type AiMode = "best" | "economy";
const MODE_STORAGE = "sws_ai_mode";
export const AI_MODE_EVENT = "sws:ai-mode";

export function getAiMode(): AiMode {
  try {
    return localStorage.getItem(MODE_STORAGE) === "economy" ? "economy" : "best";
  } catch {
    return "best";
  }
}

export function setAiMode(mode: AiMode) {
  try {
    localStorage.setItem(MODE_STORAGE, mode);
  } catch {
    /* not remembered */
  }
  window.dispatchEvent(new Event(AI_MODE_EVENT));
}

/** Model used to read screenshots (report writing always uses Opus). */
export const readingModel = (): Model => (getAiMode() === "economy" ? ECONOMY_MODEL : MODEL);

/* ---------- Spend this month (this browser) ---------- */

const SPEND_STORAGE = "sws_ai_spend";
/** Fired after each Claude call with `detail: { usd }`. */
export const SPEND_EVENT = "sws:spend";

export interface Spend {
  month: string;
  usd: number;
  calls: number;
}

const thisMonth = () => new Date().toISOString().slice(0, 7);

export function getSpend(): Spend {
  try {
    const s = JSON.parse(localStorage.getItem(SPEND_STORAGE) ?? "null") as Spend | null;
    if (s && s.month === thisMonth()) return s;
  } catch {
    /* fall through */
  }
  return { month: thisMonth(), usd: 0, calls: 0 };
}

export function recordUsage(u: Usage) {
  const usd = usageCost(u);
  const s = getSpend();
  try {
    localStorage.setItem(SPEND_STORAGE, JSON.stringify({ ...s, usd: s.usd + usd, calls: s.calls + 1 }));
  } catch {
    /* not remembered */
  }
  window.dispatchEvent(new CustomEvent(SPEND_EVENT, { detail: { usd } }));
}

export const formatUsd = (usd: number) => (usd < 0.01 && usd > 0 ? "< $0.01" : `$${usd.toFixed(2)}`);

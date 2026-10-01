"use client";

import type { Analysis } from "./ai/analyze";
import type { ProofreadRequest, RawSuggestion } from "./ai/proofread";
import type { WriteRequest } from "./ai/write";
import type { ReportText } from "./types";

/**
 * Static builds (GitHub Pages) have no server, so Claude is called straight
 * from the browser with each user's own API key, kept in their browser only.
 */
export const DIRECT_AI = process.env.NEXT_PUBLIC_DIRECT_AI === "1";

const KEY_STORAGE = "sws_anthropic_key";
export const NEED_KEY_EVENT = "sws:need-key";

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setApiKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage blocked: the key just won't be remembered */
  }
}

export const askForKey = () => window.dispatchEvent(new Event(NEED_KEY_EVENT));

async function browserClient() {
  const key = getApiKey();
  if (!key) {
    askForKey();
    throw new Error("Add your Anthropic API key first (Settings → API key).");
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

async function direct<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e && typeof e === "object" && "status" in e && e.status === 401) askForKey();
    throw e;
  }
}

/** POST JSON to one of our API routes; sends the user to /login on 401. */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    // Full reload so the login page can set the cookie and come back.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    throw new Error("Please sign in");
  }
  const data = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
  if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
  return data as T;
}

export async function analyzeShot(dataUrl: string, fileName: string): Promise<Analysis> {
  if (!DIRECT_AI) return postJson("/api/analyze", { dataUrl, fileName });
  const { analyzeScreenshot } = await import("./ai/analyze");
  return direct(async () => analyzeScreenshot(await browserClient(), dataUrl, fileName));
}

export async function writeText(body: WriteRequest): Promise<ReportText> {
  if (!DIRECT_AI) return postJson("/api/write", body);
  const { writeReport } = await import("./ai/write");
  return direct(async () => writeReport(await browserClient(), body));
}

export async function proofread(body: ProofreadRequest): Promise<{ suggestions: RawSuggestion[] }> {
  if (!DIRECT_AI) return postJson("/api/proofread", body);
  const { proofreadReport } = await import("./ai/proofread");
  return direct(async () => proofreadReport(await browserClient(), body));
}

/** Run `fn` over `items` with at most `limit` running at once. */
export async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!);
  });
  await Promise.all(workers);
}

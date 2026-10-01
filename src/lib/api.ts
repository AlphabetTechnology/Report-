"use client";

import Anthropic from "@anthropic-ai/sdk";
import { analyzeScreenshot, type Analysis } from "./ai/analyze";
import { MODEL } from "./ai/call";
import { proofreadReport, type ProofreadRequest, type RawSuggestion } from "./ai/proofread";
import { describeWebsite, type WebsiteRequest, type WebsiteSummary } from "./ai/website";
import { writeReport, type WriteRequest } from "./ai/write";
import type { ReportText } from "./types";

// The AI code is imported up front (not loaded on demand) so a tab that was open
// during a site update can still use it.

/**
 * Static builds (GitHub Pages) have no server, so Claude is called straight
 * from the browser with each user's own API key, kept in their browser only.
 */
export const DIRECT_AI = process.env.NEXT_PUBLIC_DIRECT_AI === "1";

const KEY_STORAGE = "sws_anthropic_key";
const VERIFIED_STORAGE = "sws_anthropic_verified";
export const NEED_KEY_EVENT = "sws:need-key";
/** Fired when the key is saved, removed or verified, so status badges update. */
export const KEY_CHANGED_EVENT = "sws:key-changed";

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

/** When the saved key was last confirmed to work (0 if never). */
export function keyVerifiedAt(): number {
  try {
    return Number(localStorage.getItem(VERIFIED_STORAGE)) || 0;
  } catch {
    return 0;
  }
}

export function setApiKey(key: string, verifiedAt = 0) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
    if (key && verifiedAt) localStorage.setItem(VERIFIED_STORAGE, String(verifiedAt));
    else localStorage.removeItem(VERIFIED_STORAGE);
  } catch {
    /* storage blocked: the key just won't be remembered */
  }
  window.dispatchEvent(new Event(KEY_CHANGED_EVENT));
}

/** "sk-ant-api03-…7Qx2" */
export function maskKey(key: string): string {
  return key.length > 16 ? `${key.slice(0, 12)}…${key.slice(-4)}` : "••••";
}

/**
 * Checks a key with Anthropic (a free model lookup, no tokens used).
 * Resolves on success, throws a plain-English error otherwise.
 */
export async function verifyApiKey(key: string): Promise<void> {
  const client = new Anthropic({ apiKey: key.trim(), dangerouslyAllowBrowser: true, maxRetries: 0, timeout: 20_000 });
  try {
    await client.models.retrieve(MODEL);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("Anthropic didn't accept this key. Check it was copied in full.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error("This key doesn't have access to Claude Opus 5.5.");
    if (e instanceof Anthropic.NotFoundError) throw new Error("This key's account can't use Claude Opus 5.5.");
    if (e instanceof Anthropic.RateLimitError) return; // the key works, just busy right now
    if (e instanceof Anthropic.APIConnectionError) throw new Error("Couldn't reach Anthropic. Check your internet connection.");
    if (e instanceof Anthropic.APIError) throw new Error(`Anthropic error ${e.status}: ${e.message}`);
    throw e;
  }
}

export const askForKey = () => window.dispatchEvent(new Event(NEED_KEY_EVENT));

async function browserClient() {
  const key = getApiKey();
  if (!key) {
    askForKey();
    throw new Error("Connect Claude first: Settings → Integrations → Claude.");
  }
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

async function direct<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e && typeof e === "object" && "status" in e && e.status === 401) {
      setApiKey(getApiKey(), 0); // no longer verified
      askForKey();
    }
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
  return direct(async () => analyzeScreenshot(await browserClient(), dataUrl, fileName));
}

export async function writeText(body: WriteRequest): Promise<ReportText> {
  if (!DIRECT_AI) return postJson("/api/write", body);
  return direct(async () => writeReport(await browserClient(), body));
}

export async function proofread(body: ProofreadRequest): Promise<{ suggestions: RawSuggestion[] }> {
  if (!DIRECT_AI) return postJson("/api/proofread", body);
  return direct(async () => proofreadReport(await browserClient(), body));
}

export async function readWebsite(body: WebsiteRequest): Promise<WebsiteSummary> {
  if (!DIRECT_AI) return postJson("/api/website", body);
  return direct(async () => describeWebsite(await browserClient(), body));
}

/** Run `fn` over `items` with at most `limit` running at once. */
export async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!);
  });
  await Promise.all(workers);
}

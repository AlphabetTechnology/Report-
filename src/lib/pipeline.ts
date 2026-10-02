"use client";

import { analyzeShot, dashboardPlatform as askPlatform, proofread, runPool, writeText } from "./api";
import { errorMessage } from "./errors";
import { formatMonth, formatPeriod, monthName } from "./format";
import { listFields } from "./fields";
import { imageForApi } from "./image";
import { contentBox, crop, findCards, hasDeviceFrame, type CardLayout } from "./split";
import { newId } from "./store";
import {
  KIND_SECTION,
  PLATFORM_LABEL,
  PLATFORMS,
  SHOT_KINDS,
  type Client,
  type Platform,
  type Report,
  type ReportText,
  type Shot,
  type ShotKind,
  type Suggestion,
} from "./types";

/**
 * Bump when screenshot reading or writing changes in a way existing reports
 * should pick up; reports made with an older version get an "Update" prompt.
 *   3: dashboards cut into cards
 *   4: bold themes, natural tone, one figure per metric
 *   5: LinkedIn, Pinterest, Google Business Profile; Activities & Engagement
 */
export const PIPELINE_VERSION = 5;

/**
 * Version of the screenshot reading alone. "Update report" only re-reads
 * screenshots read by an older version (reading costs the most).
 */
export const READ_VERSION = 5;

/** Screenshots read before versions were saved (no `read`) are always re-read once. */
export const shotsToReread = (r: Report) => r.shots.filter((s) => (s.read ?? 0) < READ_VERSION);

export type Update = (fn: (r: Report) => Report) => void;

/** Orders screenshots inside a section the way the template does (charts before phones, etc). */
export const kindRank = (k: ShotKind) => SHOT_KINDS.indexOf(k) * 1000;

const DASHBOARD_HINT = "This image is one card or part cut out of a larger analytics screenshot.";

export function cardHint(platform: Platform | null): string {
  return platform
    ? `${DASHBOARD_HINT} The dashboard is for ${PLATFORM_LABEL[platform]}, so the platform is "${platform}".`
    : DASHBOARD_HINT;
}

export function newShot(img: { dataUrl: string; width: number; height: number }, fileName: string, order: number): Shot {
  return {
    id: newId(),
    dataUrl: img.dataUrl,
    width: img.width,
    height: img.height,
    fileName,
    platform: null,
    kind: "other",
    section: "executive",
    order: kindRank("other") + (order % 1000),
    status: "pending",
  };
}

/**
 * Reads one screenshot with Claude and files the result into the report.
 * Returns "removed" when it was a cut-out header/banner with no data.
 */
export async function analyseShot(update: Update, shot: Shot, hint = shot.context): Promise<"ok" | "removed" | "error"> {
  const patch = (p: Partial<Shot>) =>
    update((r) => ({ ...r, shots: r.shots.map((s) => (s.id === shot.id ? { ...s, ...p } : s)) }));
  patch({ status: "analysing", error: undefined, context: hint });
  try {
    const a = await analyzeShot(await imageForApi(shot.dataUrl), shot.fileName, hint);
    if (a.useful === false && hint) {
      update((r) => ({ ...r, shots: r.shots.filter((s) => s.id !== shot.id) }));
      return "removed";
    }
    const platform = a.platform === "unknown" ? null : a.platform;
    update((r) => ({
      ...r,
      platforms:
        platform && !r.platforms.includes(platform)
          ? PLATFORMS.filter((p) => p === platform || r.platforms.includes(p))
          : r.platforms,
      shots: r.shots.map((s) =>
        s.id === shot.id
          ? {
              ...s,
              platform,
              kind: a.kind,
              section: KIND_SECTION[a.kind],
              order: kindRank(a.kind) + (s.order % 1000),
              status: "done",
              read: READ_VERSION,
              // Never delete a whole upload: if it looks empty or irrelevant, just hide it.
              hidden: a.empty === true || a.useful === false,
              extraction: {
                description: a.description,
                metrics: a.metrics,
                gender: a.gender,
                topAgeRange: a.topAgeRange,
                cities: a.cities,
                countries: a.countries,
                posts: a.posts,
              },
            }
          : s,
      ),
    }));
    return "ok";
  } catch (e) {
    patch({ status: "error", error: errorMessage(e, "Failed") });
    return "error";
  }
}

/** Platform of a whole dashboard, checked once (small image, one-word answer) so its cut-out cards know it. */
async function dashboardPlatform(dataUrl: string): Promise<Platform | null> {
  try {
    const p = await askPlatform(await imageForApi(dataUrl, 1000));
    return p === "unknown" ? null : p;
  } catch {
    return null;
  }
}

export interface ProcessResult {
  cutScreenshots: number;
  cards: number;
  removed: number;
  /** Uploads that were already phone mockups (shown as they are). */
  framed: string[];
}

interface Pending {
  image: { dataUrl: string; width: number; height: number };
  name: string;
  /** Known platform (when re-processing a screenshot the team already checked). */
  platform?: Platform | null;
  /** Shot this image replaces, when re-processing. */
  replaces?: string;
  /** Fingerprint of the uploaded file (see Shot.source). */
  source?: string;
  /** The team's own choices on the shot being replaced, kept after re-reading. */
  keep?: { hidden?: boolean; order: number };
}

/**
 * Cuts dashboards into cards, trims margins, then reads everything with Claude.
 * New shots are added to the report (or take the place of the ones they replace).
 */
export async function processImages(update: Update, items: Pending[], startOrder: number): Promise<ProcessResult> {
  let order = startOrder;
  const singles: Shot[] = [];
  const groups: { full: string; name: string; platform?: Platform | null; cards: Shot[] }[] = [];
  const replacements = new Map<string, Shot[]>();
  const kept = new Map<string, Pending>();

  // Trimmed screenshots: the platform read from the full image (the trim can cut
  // off Meta's "Facebook ▾ / Instagram ▾" switcher at the top).
  const trimmed = new Map<string, string>();
  const framedNames: string[] = [];
  for (const it of items) {
    const framed = await hasDeviceFrame(it.image.dataUrl).catch(() => false);
    const layout: CardLayout = framed
      ? { type: "none" }
      : await findCards(it.image.dataUrl).catch(() => ({ type: "none" }) as const);
    let made: Shot[];
    if (layout.type === "grid") {
      const cards: Shot[] = [];
      for (const [j, r] of layout.cards.entries()) {
        cards.push({ ...newShot(await crop(it.image.dataUrl, r, 2), `${it.name} · part ${j + 1}`, order++), source: it.source });
      }
      groups.push({ full: it.image.dataUrl, name: it.name, platform: it.platform, cards });
      made = cards;
    } else {
      // A ready-made mockup is cropped to the phone, so its plain background doesn't show as a box.
      const box = framed ? await contentBox(it.image.dataUrl).catch(() => null) : null;
      const img =
        layout.type === "trim"
          ? await crop(it.image.dataUrl, layout.rect, 4)
          : box
            ? await crop(it.image.dataUrl, box, 0)
            : it.image;
      const s = { ...newShot(img, it.name, order++), source: it.source, ...(framed ? { framed: true } : {}) };
      if (framed) framedNames.push(it.name);
      singles.push(s);
      if (it.replaces) kept.set(s.id, it);
      if (layout.type === "trim") trimmed.set(s.id, it.image.dataUrl);
      made = [s];
    }
    if (it.replaces) replacements.set(it.replaces, made);
  }

  update((r) => {
    const shots: Shot[] = [];
    for (const s of r.shots) shots.push(...(replacements.get(s.id) ?? [s]));
    const added = [...singles, ...groups.flatMap((g) => g.cards)].filter(
      (s) => !shots.some((x) => x.id === s.id),
    );
    return { ...r, shots: [...shots, ...added] };
  });

  let removed = 0;
  const count = (res: string) => {
    if (res === "removed") removed++;
  };
  await Promise.all([
    runPool(singles, 3, async (s) => {
      const full = trimmed.get(s.id);
      const [res, fullPlatform] = await Promise.all([analyseShot(update, s), full ? dashboardPlatform(full) : null]);
      count(res);
      if (res === "ok" && fullPlatform) {
        update((r) => ({ ...r, shots: r.shots.map((x) => (x.id === s.id ? { ...x, platform: fullPlatform } : x)) }));
      }
      // Re-reading must not undo the team's corrections: platform, hidden, order.
      const k = kept.get(s.id);
      if (res === "ok" && k) {
        update((r) => ({
          ...r,
          shots: r.shots.map((x) =>
            x.id === s.id
              ? {
                  ...x,
                  platform: k.platform ?? x.platform,
                  hidden: k.keep?.hidden ?? x.hidden,
                  order: k.keep ? kindRank(x.kind) + (k.keep.order % 1000) : x.order,
                }
              : x,
          ),
        }));
      }
    }),
    runPool(groups, 1, async (g) => {
      const platform = g.platform ?? (await dashboardPlatform(g.full));
      await runPool(g.cards, 3, async (c) => count(await analyseShot(update, c, cardHint(platform))));
    }),
  ]);
  return {
    cutScreenshots: groups.length,
    cards: groups.reduce((t, g) => t + g.cards.length, 0),
    removed,
    framed: framedNames,
  };
}

/** Re-runs the latest screenshot reading on screenshots read by an older version. */
export async function reprocessShots(update: Update, report: Report): Promise<ProcessResult> {
  const stale = shotsToReread(report);
  const cards = stale.filter((s) => s.context);
  const whole = stale.filter((s) => !s.context && s.dataUrl);
  const [res] = await Promise.all([
    processImages(
      update,
      whole.map((s) => ({
        image: { dataUrl: s.dataUrl, width: s.width, height: s.height },
        name: s.fileName,
        platform: s.platform,
        replaces: s.id,
        source: s.source,
        keep: { hidden: s.hidden, order: s.order },
      })),
      report.shots.length,
    ),
    runPool(cards, 3, async (s) => {
      await analyseShot(update, s);
    }),
  ]);
  return res;
}

/** A screenshot Claude found was tagged with the wrong platform while writing. */
export interface PlatformCorrection {
  id: string;
  platform: Platform;
}

/** Moves screenshots Claude found under the wrong platform (e.g. Instagram audience tagged Facebook). */
export function applyCorrections(r: Report, fixes: PlatformCorrection[]): Report {
  if (!fixes.length) return r;
  const byId = new Map(fixes.map((f) => [f.id, f.platform]));
  const shots = r.shots.map((s) => (byId.has(s.id) ? { ...s, platform: byId.get(s.id)! } : s));
  const used = new Set([...r.platforms, ...fixes.map((f) => f.platform)]);
  return { ...r, shots, platforms: PLATFORMS.filter((p) => used.has(p)) };
}

/** Asks Claude to write all the report text (and to spot screenshots under the wrong platform). */
export async function writeReportText(
  report: Report,
  client: Client | undefined,
): Promise<{ text: ReportText; fixes: PlatformCorrection[] }> {
  const english = client?.english ?? "en-GB";
  const shots = report.shots.filter((s) => s.extraction && !s.hidden);
  const { platformFixes = [], ...text } = await writeText({
    client: {
      name: client?.name ?? "",
      description: client?.description ?? "",
      website: client?.website ?? "",
      english,
    },
    period: formatPeriod(report.periodStart, report.periodEnd, english),
    month: `${monthName(report.periodStart)} (${formatMonth(report.periodStart)})`,
    platforms: report.platforms.map((p) => PLATFORM_LABEL[p]),
    shots: shots.map((s) => ({ platform: s.platform, kind: s.kind, section: s.section, extraction: s.extraction })),
  });
  const fixes = platformFixes
    .filter((f) => shots[f.screenshot] && shots[f.screenshot].platform !== f.platform)
    .map((f) => ({ id: shots[f.screenshot].id, platform: f.platform }));
  return { text, fixes };
}

/** Proofreads the report text; returns suggestions to review. */
export async function proofreadText(report: Report, client: Client | undefined): Promise<Suggestion[]> {
  if (!report.text) return [];
  const { suggestions } = await proofread({
    english: client?.english ?? "en-GB",
    clientName: client?.name ?? "",
    fields: listFields(report.text),
    facts: report.shots
      .filter((s) => s.extraction && !s.hidden)
      .map((s) => ({ platform: s.platform, section: s.section, metrics: s.extraction!.metrics })),
  });
  return suggestions.map((s) => ({
    id: newId(),
    path: s.fieldId,
    original: s.original,
    replacement: s.replacement,
    reason: s.reason,
    type: s.type,
  }));
}

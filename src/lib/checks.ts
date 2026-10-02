import { listFields } from "./fields";
import { PLATFORM_LABEL, type Report, type Shot } from "./types";

/**
 * Safety checks so a confused reading never slips into a client report
 * unnoticed. Nothing here calls Claude: they compare what was read.
 */

export interface ShotIssue {
  shotId: string;
  message: string;
}

const fileOf = (s: Shot) => s.fileName.split(" · ")[0];
const day = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** Problems with individual screenshots, for the Screenshots tab. */
export function shotIssues(report: Report): ShotIssue[] {
  const out: ShotIssue[] = [];
  const shots = report.shots.filter((s) => s.status === "done" && !s.hidden);
  const push = (s: Shot, message: string) => {
    if (!s.checked) out.push({ shotId: s.id, message });
  };

  for (const s of shots) {
    if (!s.platform) {
      push(s, "No platform: pick one so it goes in the right place.");
    } else if (s.platformSure === false) {
      push(s, `Claude wasn't sure this is ${PLATFORM_LABEL[s.platform]}. Check the platform.`);
    }
    // A screenshot from another month (the date range shown doesn't touch the report period).
    const from = day(s.extraction?.periodStart ?? "");
    const to = day(s.extraction?.periodEnd ?? "");
    if (from && to && (to < report.periodStart || from > report.periodEnd)) {
      push(s, `It shows ${short(from)} – ${short(to)}, but this report is for ${short(report.periodStart)} – ${short(report.periodEnd)}.`);
    }
  }

  // The same numbers in two screenshots: usually one file uploaded twice, or a mix-up.
  const seen = new Map<string, Shot>();
  for (const s of shots) {
    const m = s.extraction?.metrics ?? [];
    if (m.length < 2) continue;
    const key = `${s.kind}|${m.map((x) => `${x.label.toLowerCase()}=${x.value}`).sort().join(";")}`;
    const first = seen.get(key);
    if (first) push(s, `Shows exactly the same numbers as ${fileOf(first)}.`);
    else seen.set(key, s);
  }

  // Two different audiences under one platform: one probably belongs to another platform.
  const followers = (s: Shot) => s.extraction?.metrics.find((m) => /follower/i.test(m.label))?.value;
  const byPlatform = new Map<string, Shot[]>();
  for (const s of shots.filter((x) => x.kind === "demographics" && x.platform && followers(x))) {
    byPlatform.set(s.platform!, [...(byPlatform.get(s.platform!) ?? []), s]);
  }
  for (const [p, list] of byPlatform) {
    if (new Set(list.map(followers)).size < 2) continue;
    for (const s of list) {
      push(
        s,
        `There are ${list.length} audience screenshots for ${PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL]} with different follower counts (${list.map(followers).join(" and ")}). One may belong to another platform.`,
      );
    }
  }
  return out;
}

/* ---------- numbers in the text that the screenshots don't show ---------- */

export interface NumberIssue {
  fieldId: string;
  label: string;
  number: string;
}

const NUM = /(?<![\w.])(\d[\d,]*(?:\.\d+)?)(\s?[KkMm](?![a-z]))?(%)?/g;
const MONTH_WORDS =
  "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
/** "14 September", "21st Sept", "September 14": capitalised month names only, as whole words. */
const MONTH_AFTER = new RegExp(`^(?:st|nd|rd|th)?\\.?\\s+(?:${MONTH_WORDS})\\b`);
const MONTH_BEFORE = new RegExp(`\\b(?:${MONTH_WORDS})\\.?\\s+$`);

interface Num {
  /** Digits plus unit, e.g. "1418", "1.5k", "48.4%". */
  key: string;
  value: number;
  pct: boolean;
}

function parse(m: RegExpMatchArray): Num {
  const digits = m[1].replace(/,/g, "");
  const unit = (m[2] ?? "").trim().toLowerCase();
  const pct = !!m[3];
  const v = Number(digits);
  return { key: `${digits}${unit}${pct ? "%" : ""}`, value: unit === "k" ? v * 1000 : unit === "m" ? v * 1_000_000 : v, pct };
}

/** Every number written anywhere in the screenshot readings. */
function knownNumbers(report: Report): Num[] {
  const out: Num[] = [];
  for (const s of report.shots) {
    if (!s.extraction || s.hidden) continue;
    for (const m of JSON.stringify(s.extraction).matchAll(NUM)) out.push(parse(m));
  }
  return out;
}

export const numberKey = (i: NumberIssue) => `${i.fieldId}|${i.number}`;

/**
 * Numbers in the report text that don't appear in any screenshot reading.
 * Claude is told never to invent or work out numbers; this catches it if it does.
 * Dates, years, age ranges and small counts (1–12, e.g. "3 Reels") are not checked,
 * nor numbers the team marked as checked.
 */
export function numberIssues(report: Report): NumberIssue[] {
  if (!report.text) return [];
  const known = knownNumbers(report);
  const keys = new Set(known.map((k) => k.key));
  const confirmed = new Set(report.checkedNumbers ?? []);
  const out: NumberIssue[] = [];
  for (const f of listFields(report.text)) {
    for (const m of f.text.matchAll(NUM)) {
      const n = parse(m);
      const at = m.index ?? 0;
      const after = f.text.slice(at + m[0].length, at + m[0].length + 14);
      const before = f.text.slice(Math.max(0, at - 14), at);
      const isYear = !m[2] && !m[3] && /^(19|20)\d\d$/.test(m[1]);
      const isDate = MONTH_AFTER.test(after) || MONTH_BEFORE.test(before);
      const small = !m[2] && !m[3] && !m[1].includes(".") && n.value <= 12;
      const isAge = /^\s*[–-]\s*\d/.test(after) || /\d\s*[–-]\s*$/.test(before);
      if (isYear || isDate || small || isAge) continue;
      // Same digits and unit, or the same value written another way (1.5K = 1,500); a
      // percentage only matches a percentage.
      if (keys.has(n.key) || known.some((k) => k.pct === n.pct && Math.abs(k.value - n.value) < 1e-9)) continue;
      const issue = { fieldId: f.id, label: f.label, number: m[0].trim() };
      if (!confirmed.has(numberKey(issue))) out.push(issue);
    }
  }
  return out;
}

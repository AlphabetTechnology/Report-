import { PLATFORM_LABEL, type EnglishVariant, type Platform } from "./types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
};

export const MONTH_NAMES = MONTHS;

/** UK "1 September 2026", US "September 1, 2026" */
export function formatDate(iso: string, english: EnglishVariant): string {
  if (!iso) return "";
  const { y, m, d } = parse(iso);
  return english === "en-US" ? `${MONTHS[m - 1]} ${d}, ${y}` : `${d} ${MONTHS[m - 1]} ${y}`;
}

/** UK "01/10/2026", US "10/01/2026" */
export function formatShortDate(iso: string, english: EnglishVariant): string {
  if (!iso) return "";
  const { y, m, d } = parse(iso);
  return english === "en-US" ? `${pad2(m)}/${pad2(d)}/${y}` : `${pad2(d)}/${pad2(m)}/${y}`;
}

/** UK "1 September – 30 September 2026", US "September 1 – September 30, 2026" */
export function formatPeriod(start: string, end: string, english: EnglishVariant): string {
  if (!start || !end) return "";
  const s = parse(start);
  const e = parse(end);
  const sameYear = s.y === e.y;
  if (english === "en-US") {
    return `${MONTHS[s.m - 1]} ${s.d}${sameYear ? "" : `, ${s.y}`} – ${MONTHS[e.m - 1]} ${e.d}, ${e.y}`;
  }
  return `${s.d} ${MONTHS[s.m - 1]}${sameYear ? "" : ` ${s.y}`} – ${e.d} ${MONTHS[e.m - 1]} ${e.y}`;
}

/** "September 2026" */
export function formatMonth(iso: string): string {
  if (!iso) return "";
  const { y, m } = parse(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

export function monthName(iso: string): string {
  return iso ? MONTHS[parse(iso).m - 1] : "";
}

/** "Facebook & Instagram", "Facebook, Instagram & TikTok" */
export function formatPlatforms(platforms: Platform[]): string {
  const names = platforms.map((p) => PLATFORM_LABEL[p]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** First and last day of the month before `today`. */
export function previousMonth(today = new Date()): { start: string; end: string } {
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const last = new Date(today.getFullYear(), today.getMonth(), 0);
  return { start: toIso(first), end: toIso(last) };
}

export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

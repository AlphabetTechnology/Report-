import { Fragment, type ReactNode } from "react";

/*
 * Report typography rules:
 * - **text**  → bold (key themes; Claude marks these)
 * - numbers   → highlighted automatically in brand blue (296, 1,418, 39.3%, 1.5K, 1m 26s)
 *               but not dates or years ("1 September", "September 1", "2026")
 * - quotes    → typographic (’ “ ”)
 */

const MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";

// A metric-like number, optionally with a unit, or a duration such as "1m 26s".
const NUMBER = /(\d+m\s\d+s|\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|\d+(?:\.\d+)?\s?(?:%|K\b|M\b)|\d+(?:\.\d+)?)/g;
const DATE_AFTER = new RegExp(`^\\s?(?:–\\s?\\d+\\s)?${MONTH}`); // "1 September", "1 – 30 September"
const DATE_BEFORE = new RegExp(`${MONTH}\\s?$`); // "September 1"

/** Curly apostrophes and quotes. */
export function smartQuotes(s: string): string {
  return s
    .replace(/(\w)'(\w)/g, "$1’$2") // Aakaar's
    .replace(/(^|[\s(\[—–-])'/g, "$1‘")
    .replace(/'/g, "’")
    .replace(/(^|[\s(\[—–-])"/g, "$1“")
    .replace(/"/g, "”");
}

function numbers(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(NUMBER)) {
    const start = m.index ?? 0;
    const value = m[0];
    const before = text.slice(0, start);
    const after = text.slice(start + value.length);
    const isYear = /^(19|20)\d\d$/.test(value);
    const isDate = DATE_AFTER.test(after) || DATE_BEFORE.test(before);
    const inWord = /[A-Za-z-]$/.test(before) || /^[A-Za-z]/.test(after.replace(/^(K|M)\b/, "")); // "3-second", "COVID19"
    if (isYear || isDate || inWord) continue;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <span className="rpt-num" key={`${keyBase}-${start}`}>
        {value}
      </span>,
    );
    last = start + value.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** One line of report text with bold themes and highlighted numbers. */
export function inline(text: string): ReactNode[] {
  return smartQuotes(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{numbers(part.slice(2, -2), `b${i}`)}</strong>
      ) : (
        <Fragment key={i}>{numbers(part, `t${i}`)}</Fragment>
      ),
    );
}

/** Paragraphs separated by blank lines; single newlines become line breaks. */
export function Rich({ text }: { text: string }) {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <>
      {paras.map((p, i) => (
        <p key={i}>
          {p.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

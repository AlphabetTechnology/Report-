import { PLATFORM_LABEL, SECTIONS, type ReportText } from "./types";

export interface TextField {
  id: string;
  label: string;
  text: string;
}

const sectionTitle = (key: string) => SECTIONS.find((s) => s.key === key)?.title ?? key;

/** Every piece of prose in the report, with a path to find it again. */
export function listFields(t: ReportText): TextField[] {
  const f: TextField[] = [{ id: "executiveSummary", label: "Executive Summary", text: t.executiveSummary }];
  t.blocks.forEach((b, i) => {
    const where = `${sectionTitle(b.section)} – ${PLATFORM_LABEL[b.platform]}`;
    b.metrics.forEach((m, j) =>
      f.push({ id: `blocks.${i}.metrics.${j}.label`, label: `${where} (metric label)`, text: m.label }),
    );
    f.push({ id: `blocks.${i}.text`, label: where, text: b.text });
  });
  t.audience.forEach((a, i) => {
    const where = `Audience – ${PLATFORM_LABEL[a.platform]}`;
    f.push({ id: `audience.${i}.text`, label: where, text: a.text });
    f.push({ id: `audience.${i}.locationsText`, label: `${where} (locations)`, text: a.locationsText });
  });
  t.topContent.forEach((c, i) => {
    const where = `Top Content – ${PLATFORM_LABEL[c.platform]}`;
    c.items.forEach((it, j) => {
      f.push({ id: `topContent.${i}.items.${j}.title`, label: `${where} (post title)`, text: it.title });
      f.push({ id: `topContent.${i}.items.${j}.detail`, label: `${where} (post stats)`, text: it.detail });
    });
    f.push({ id: `topContent.${i}.summary`, label: where, text: c.summary });
  });
  if (t.activities) {
    f.push({ id: "activities.summary", label: "Activities & Engagement", text: t.activities.summary });
    t.activities.items.forEach((it, i) =>
      f.push({ id: `activities.items.${i}`, label: `Activities & Engagement (point ${i + 1})`, text: it }),
    );
  }
  t.focus.forEach((x, i) => {
    f.push({ id: `focus.${i}.title`, label: `Focus ${i + 1} – title`, text: x.title });
    f.push({ id: `focus.${i}.situation`, label: `Focus ${i + 1} – current situation`, text: x.situation });
    f.push({ id: `focus.${i}.implementation`, label: `Focus ${i + 1} – implementation`, text: x.implementation });
  });
  f.push({ id: "conclusion", label: "Conclusion", text: t.conclusion });
  return f;
}

export function getAt(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), obj);
}

/** Returns a copy of `obj` with the value at `path` replaced. */
export function setAt<T>(obj: T, path: string, value: unknown): T {
  const copy = structuredClone(obj);
  const keys = path.split(".");
  let cur = copy as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
  return copy;
}

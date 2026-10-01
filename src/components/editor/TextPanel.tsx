"use client";

import { useState } from "react";
import { postJson } from "@/lib/api";
import { formatMonth, formatPeriod, monthName } from "@/lib/format";
import { setAt } from "@/lib/fields";
import {
  PLATFORM_LABEL,
  SECTIONS,
  type Client,
  type Metric,
  type NamedValue,
  type Report,
  type ReportText,
} from "@/lib/types";

function AutoText({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea className="textarea" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function PairRows<T extends Metric | NamedValue>({
  rows,
  keys,
  placeholders,
  onChange,
}: {
  rows: T[];
  keys: [keyof T, keyof T];
  placeholders: [string, string];
  onChange: (rows: T[]) => void;
}) {
  return (
    <div>
      {rows.map((r, i) => (
        <div className="metric-row" key={i}>
          {keys.map((k, n) => (
            <input
              key={String(k)}
              className="input"
              placeholder={placeholders[n]}
              value={String(r[k])}
              onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
            />
          ))}
          <button className="btn small ghost danger" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button
        className="btn small ghost"
        onClick={() => onChange([...rows, { [keys[0]]: "", [keys[1]]: "" } as unknown as T])}
      >
        + Add row
      </button>
    </div>
  );
}

const sectionTitle = (key: string) => SECTIONS.find((s) => s.key === key)?.title ?? key;

export default function TextPanel({
  report,
  client,
  update,
}: {
  report: Report;
  client: Client | undefined;
  update: (fn: (r: Report) => Report) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = report.text;
  const readable = report.shots.filter((s) => s.extraction);
  const reading = report.shots.some((s) => s.status === "pending" || s.status === "analysing");

  const set = (path: string, value: unknown) =>
    update((r) => (r.text ? { ...r, text: setAt(r.text, path, value) } : r));

  async function generate() {
    if (t && !confirm("Replace all the current text with a fresh version from Claude?")) return;
    setBusy(true);
    setError("");
    try {
      const text = await postJson<ReportText>("/api/write", {
        client: {
          name: client?.name ?? "",
          description: client?.description ?? "",
          english: client?.english ?? "en-GB",
        },
        period: formatPeriod(report.periodStart, report.periodEnd),
        month: `${monthName(report.periodStart)} (${formatMonth(report.periodStart)})`,
        platforms: report.platforms.map((p) => PLATFORM_LABEL[p]),
        shots: readable.map((s) => ({
          platform: s.platform,
          kind: s.kind,
          section: s.section,
          extraction: s.extraction,
        })),
      });
      update((r) => ({ ...r, text, suggestions: [] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not write the text");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="notice">
        Claude writes every paragraph from the numbers in your screenshots, in{" "}
        {client?.english === "en-US" ? "US" : "UK"} English and the SWS house style. You can edit anything below; the
        preview updates as you type.
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn accent" disabled={busy || reading || !readable.length} onClick={generate}>
          {busy ? (
            <>
              <span className="spinner" /> Writing… (about a minute)
            </>
          ) : t ? (
            "Rewrite all text"
          ) : (
            "Write report text with Claude"
          )}
        </button>
        {!readable.length && <span className="small muted">Add screenshots first.</span>}
        {reading && <span className="small muted">Waiting for screenshots to be read…</span>}
      </div>
      {error && <div className="notice err">{error}</div>}

      {t && (
        <>
          <h3>Executive Summary</h3>
          <p className="small muted" style={{ marginTop: -4 }}>
            Wrap words in **double asterisks** to make them bold.
          </p>
          <AutoText rows={8} value={t.executiveSummary} onChange={(v) => set("executiveSummary", v)} />

          {t.blocks.map((b, i) => (
            <div className="text-group" key={`b${i}`} style={{ marginTop: 12 }}>
              <div className="head">
                {sectionTitle(b.section)} <span className="chip blue">{PLATFORM_LABEL[b.platform]}</span>
              </div>
              <PairRows
                rows={b.metrics}
                keys={["label", "value"]}
                placeholders={["Label", "Value"]}
                onChange={(rows) => set(`blocks.${i}.metrics`, rows)}
              />
              <div style={{ height: 8 }} />
              <AutoText value={b.text} onChange={(v) => set(`blocks.${i}.text`, v)} />
            </div>
          ))}

          {t.audience.map((a, i) => (
            <div className="text-group" key={`a${i}`}>
              <div className="head">
                Audience Overview <span className="chip blue">{PLATFORM_LABEL[a.platform]}</span>
              </div>
              <PairRows
                rows={a.metrics}
                keys={["label", "value"]}
                placeholders={["Label", "Value"]}
                onChange={(rows) => set(`audience.${i}.metrics`, rows)}
              />
              <div className="small muted" style={{ margin: "8px 0 4px" }}>
                Gender split
              </div>
              <PairRows
                rows={a.gender}
                keys={["label", "value"]}
                placeholders={["Women", "60%"]}
                onChange={(rows) => set(`audience.${i}.gender`, rows)}
              />
              <div style={{ height: 8 }} />
              <AutoText value={a.text} onChange={(v) => set(`audience.${i}.text`, v)} />
              <div className="small muted" style={{ margin: "8px 0 4px" }}>
                Leading locations
              </div>
              <PairRows
                rows={a.locations}
                keys={["name", "value"]}
                placeholders={["City", "8.2%"]}
                onChange={(rows) => set(`audience.${i}.locations`, rows)}
              />
              <div className="small muted" style={{ margin: "8px 0 4px" }}>
                Top countries
              </div>
              <PairRows
                rows={a.countries}
                keys={["name", "value"]}
                placeholders={["Country", "78.2%"]}
                onChange={(rows) => set(`audience.${i}.countries`, rows)}
              />
              <div style={{ height: 8 }} />
              <AutoText value={a.locationsText} onChange={(v) => set(`audience.${i}.locationsText`, v)} />
            </div>
          ))}

          {t.topContent.map((c, i) => (
            <div className="text-group" key={`c${i}`}>
              <div className="head">
                Top Content <span className="chip blue">{PLATFORM_LABEL[c.platform]}</span>
              </div>
              <PairRows
                rows={c.items.map((x) => ({ label: x.title, value: x.detail }))}
                keys={["label", "value"]}
                placeholders={["Post title", "161 views and 12 likes."]}
                onChange={(rows) => set(`topContent.${i}.items`, rows.map((r) => ({ title: r.label, detail: r.value })))}
              />
              <div style={{ height: 8 }} />
              <AutoText value={c.summary} onChange={(v) => set(`topContent.${i}.summary`, v)} />
            </div>
          ))}

          <h3>Focus for the Next Month</h3>
          {t.focus.map((f, i) => (
            <div className="text-group" key={`f${i}`}>
              <div className="row" style={{ marginBottom: 6 }}>
                <input className="input" value={f.title} onChange={(e) => set(`focus.${i}.title`, e.target.value)} />
                <button
                  className="btn small ghost danger"
                  onClick={() => set("focus", t.focus.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
              <label className="field" style={{ marginBottom: 6 }}>
                <span>Current Situation</span>
                <AutoText rows={2} value={f.situation} onChange={(v) => set(`focus.${i}.situation`, v)} />
              </label>
              <label className="field" style={{ marginBottom: 0 }}>
                <span>Implementation</span>
                <AutoText rows={2} value={f.implementation} onChange={(v) => set(`focus.${i}.implementation`, v)} />
              </label>
            </div>
          ))}
          <button
            className="btn small"
            onClick={() => set("focus", [...t.focus, { title: "", situation: "", implementation: "" }])}
          >
            + Add focus point
          </button>

          <h3>Conclusion</h3>
          <AutoText rows={7} value={t.conclusion} onChange={(v) => set("conclusion", v)} />
        </>
      )}
    </div>
  );
}

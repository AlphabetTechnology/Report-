"use client";

import { errorMessage } from "@/lib/errors";
import { useState } from "react";
import Icon from "@/components/Icon";
import { proofreadText } from "@/lib/pipeline";
import { getAt, listFields, setAt } from "@/lib/fields";
import type { Client, Report, Suggestion } from "@/lib/types";

const TYPE_CHIP: Record<Suggestion["type"], string> = {
  grammar: "red",
  spelling: "red",
  number: "red",
  consistency: "orange",
  style: "blue",
};

/** Applies a suggestion; returns null when the text has changed since. */
function apply(report: Report, s: Suggestion): Report | null {
  if (!report.text) return null;
  const current = getAt(report.text, s.path);
  if (typeof current !== "string" || !current.includes(s.original)) return null;
  return { ...report, text: setAt(report.text, s.path, current.replace(s.original, s.replacement)) };
}

export default function ProofreadPanel({
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
  const [checked, setChecked] = useState(false);
  const english = client?.english ?? "en-GB";
  const fields = report.text ? listFields(report.text) : [];
  const labelFor = new Map(fields.map((f) => [f.id, f.label]));

  async function check() {
    if (!report.text) return;
    setBusy(true);
    setError("");
    try {
      const suggestions = await proofreadText(report, client);
      update((r) => ({ ...r, proofreadAt: Date.now(), suggestions }));
      setChecked(true);
    } catch (e) {
      setError(errorMessage(e, "Proofreading failed"));
    } finally {
      setBusy(false);
    }
  }

  function accept(s: Suggestion) {
    update((r) => {
      const next = apply(r, s) ?? r;
      return { ...next, suggestions: next.suggestions.filter((x) => x.id !== s.id) };
    });
  }

  function acceptAll() {
    update((r) => {
      let next = r;
      for (const s of r.suggestions) next = apply(next, s) ?? next;
      return { ...next, suggestions: [] };
    });
  }

  const dismiss = (s: Suggestion) =>
    update((r) => ({ ...r, suggestions: r.suggestions.filter((x) => x.id !== s.id) }));

  if (!report.text) {
    return <div className="notice warn">Write the report text first (Text tab), then proofread it here.</div>;
  }

  return (
    <div>
      <div className="ai-card">
        <h4>
          <Icon name="spell" size={17} />
          Proofread for {english === "en-GB" ? "🇬🇧 UK" : "🇺🇸 US"} English
        </h4>
        <p>
          Grammar, spelling, wording, date style and consistent labels, plus a check that every number in the text
          matches the screenshots. Nothing changes until you accept it.
        </p>
      <div className="row">
        <button className="btn accent" disabled={busy} onClick={check}>
          {busy ? (
            <>
              <span className="spinner" /> Proofreading…
            </>
          ) : (
            "Check grammar & wording"
          )}
        </button>
        <div className="spacer" />
        {report.suggestions.length > 1 && (
          <button className="btn small glass" onClick={acceptAll}>
            <Icon name="check" size={14} />
            Accept all ({report.suggestions.length})
          </button>
        )}
      </div>
      </div>
      {error && <div className="notice err">{error}</div>}
      {checked && !busy && report.suggestions.length === 0 && (
        <div className="notice" style={{ background: "var(--ok-soft)", color: "#0b6b3e" }}>
          <Icon name="checkCircle" size={16} />
          No issues left. The report is ready to send.
        </div>
      )}
      {report.suggestions.map((s) => (
        <div className="suggestion" key={s.id}>
          <div className="where">
            <span className={`chip ${TYPE_CHIP[s.type]}`}>{s.type}</span> {labelFor.get(s.path) ?? s.path}
          </div>
          <div className="diff">
            <del>{s.original}</del> → <ins>{s.replacement}</ins>
          </div>
          <div className="reason">{s.reason}</div>
          <div className="row">
            <button className="btn small primary" onClick={() => accept(s)}>
              <Icon name="check" size={14} />
              Accept
            </button>
            <button className="btn small ghost" onClick={() => dismiss(s)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

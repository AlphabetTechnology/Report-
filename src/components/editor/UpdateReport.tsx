"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { errorMessage } from "@/lib/errors";
import { applyCorrections, PIPELINE_VERSION, proofreadText, reprocessShots, shotsToReread, writeReportText, type Update } from "@/lib/pipeline";
import type { Client, Report } from "@/lib/types";

type Step = "shots" | "text" | "proof";
const STEPS: { key: Step; label: string; detail: string }[] = [
  { key: "shots", label: "Re-reading screenshots", detail: "Cuts dashboards into cards and places each one again" },
  { key: "text", label: "Rewriting the report text", detail: "Fresh wording with bold key points" },
  { key: "proof", label: "Proofreading", detail: "Grammar, spelling, dates and numbers" },
];

export const isOutdated = (r: Report) => !!r.text && (r.pipeline ?? 1) < PIPELINE_VERSION;

/**
 * One click to bring an existing report up to the latest version of the tool:
 * re-read every screenshot, rewrite the text, then proofread it.
 */
export default function UpdateReport({
  report,
  latest,
  client,
  update,
  onClose,
  onReview,
}: {
  report: Report;
  /** The report as it is right now (it changes while the update runs). */
  latest: () => Report;
  client: Client | undefined;
  update: Update;
  onClose: () => void;
  onReview: () => void;
}) {
  const [step, setStep] = useState<Step | "idle" | "done">("idle");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState(0);
  // Screenshots already read by the current version are kept (re-reading is the costly part).
  const [stale] = useState(() => shotsToReread(report).length);
  const total = report.shots.length;
  const done = report.shots.filter((s) => s.status === "done" || s.status === "error").length;

  // Let React apply state updates before reading the report again.
  const settle = () => new Promise((r) => setTimeout(r, 50));

  async function run() {
    setError("");
    try {
      setStep("shots");
      await reprocessShots(update, latest());
      await settle();

      setStep("text");
      const { text, fixes } = await writeReportText(latest(), client);
      update((r) => ({
        ...applyCorrections(r, fixes),
        text,
        suggestions: [],
        proofreadAt: undefined,
        pipeline: PIPELINE_VERSION,
      }));
      await settle();

      setStep("proof");
      const found = await proofreadText(latest(), client);
      update((r) => ({ ...r, suggestions: found, proofreadAt: Date.now() }));
      setSuggestions(found.length);
      setStep("done");
    } catch (e) {
      setError(errorMessage(e, "The update stopped"));
    }
  }

  const index = STEPS.findIndex((s) => s.key === step);
  const running = step !== "idle" && step !== "done" && !error;

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && !running && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div className="ic">
            <Icon name="refresh" />
          </div>
          <div>
            <h2>Update report</h2>
            <p>Rebuild this report with the latest version of the tool.</p>
          </div>
        </div>
        <div className="modal-body">
          {step === "idle" && (
            <div className="notice warn">
              <Icon name="pen" size={16} />
              <span>
                The text is rewritten from scratch, so <strong>edits you made to the text will be replaced</strong>. Your
                screenshots, client and dates stay as they are.
              </span>
            </div>
          )}
          <div className="upd-steps">
            {STEPS.map((s, i) => {
              const state =
                step === "done" || (index > i && !error) ? "done" : index === i ? (error ? "err" : "run") : "todo";
              return (
                <div className={`upd-step ${state}`} key={s.key}>
                  <span className="dot">
                    {state === "done" ? (
                      <Icon name="check" size={13} stroke={3} />
                    ) : state === "run" ? (
                      <span className="spinner" style={{ width: 13, height: 13 }} />
                    ) : state === "err" ? (
                      <Icon name="x" size={13} stroke={3} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div>
                    <strong>{s.label}</strong>
                    <small>
                      {s.key === "shots" && !stale
                        ? "Already up to date, skipped"
                        : s.key === "shots" && state === "run" && total
                          ? `${done} of ${total} done`
                          : s.detail}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
          {error && <div className="notice err">{error}</div>}
          {step === "done" && (
            <div className="notice" style={{ background: "var(--ok-soft)", color: "#0b6b3e" }}>
              <Icon name="checkCircle" size={16} />
              <span>
                Report updated.{" "}
                {suggestions
                  ? `Proofreading found ${suggestions} suggestion${suggestions === 1 ? "" : "s"} to review.`
                  : "Proofreading found nothing to fix."}
              </span>
            </div>
          )}
        </div>
        <div className="modal-foot">
          {step === "idle" && (
            <>
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button className="btn accent" onClick={run}>
                <Icon name="refresh" size={16} />
                Update report
              </button>
            </>
          )}
          {error && (
            <>
              <button className="btn" onClick={onClose}>
                Close
              </button>
              <button className="btn primary" onClick={run}>
                Try again
              </button>
            </>
          )}
          {step === "done" &&
            (suggestions ? (
              <button className="btn primary" onClick={onReview}>
                Review suggestions
                <Icon name="arrowRight" size={15} />
              </button>
            ) : (
              <button className="btn primary" onClick={onClose}>
                Done
              </button>
            ))}
          {running && <span className="small muted">This takes a minute or two. Keep this tab open.</span>}
        </div>
      </div>
    </div>
  );
}

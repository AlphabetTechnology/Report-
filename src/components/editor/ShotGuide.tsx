"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { PlatformIcon } from "@/components/report/icons";
import { CAPTURE_RULES, guideStatus, PLATFORM_GUIDE } from "@/lib/guide";
import { PLATFORM_LABEL, type Report } from "@/lib/types";

/**
 * The team's screenshot standard: how to take screenshots, and a checklist per
 * platform that ticks itself off as Claude reads each upload. Every item is
 * required: the text can't be written until each one is added, or marked as not
 * available for this client.
 */
export default function ShotGuide({ report, update }: { report: Report; update: (fn: (r: Report) => Report) => void }) {
  const status = guideStatus(report);
  const missing = status.filter((g) => !g.added && !g.notAvailable).length;
  const [open, setOpen] = useState(report.shots.length === 0 || missing > 0);
  const reading = report.shots.some((s) => s.status === "pending" || s.status === "analysing");

  const setSkipped = (key: string, on: boolean) =>
    update((r) => {
      const rest = (r.notAvailable ?? []).filter((k) => k !== key);
      return { ...r, notAvailable: on ? [...rest, key] : rest };
    });

  return (
    <div className={`guide${missing ? " missing" : ""}`}>
      <button className="guide-head" onClick={() => setOpen(!open)}>
        <Icon name="checkCircle" size={16} />
        <strong>Required screenshots</strong>
        <span className={`chip ${missing ? "orange" : "green"}`}>
          {missing ? `${missing} missing` : "All added"}
        </span>
        <span className="spacer" />
        <Icon name={open ? "up" : "down"} size={15} />
      </button>
      {open && (
        <div className="guide-body">
          {missing > 0 && (
            <p className="guide-need">
              Upload every screenshot on this list before the text is written
              {reading ? " (the list ticks itself as Claude reads each one)" : ""}. If a client really doesn&apos;t have one,
              click <b>Not available</b> next to it.
            </p>
          )}
          <ul className="guide-rules">
            {CAPTURE_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {report.platforms.map((p) => (
            <div className="guide-platform" key={p}>
              <div className="guide-pname">
                <span className="ic">
                  <PlatformIcon platform={p} />
                </span>
                {PLATFORM_LABEL[p]}
                <span className="where">{PLATFORM_GUIDE[p].where}</span>
              </div>
              {status
                .filter((g) => g.platform === p)
                .map((g) => (
                  <div
                    className={`guide-item${g.added ? " ok" : g.notAvailable ? " na" : " need"}`}
                    key={g.key}
                  >
                    <span className="tick">
                      {g.added ? <Icon name="check" size={12} stroke={3} /> : g.notAvailable ? <Icon name="x" size={11} stroke={3} /> : null}
                    </span>
                    <span className="guide-label">
                      {g.label}
                      {!g.added && !g.notAvailable && <span className="guide-req">Required</span>}
                      {g.notAvailable && <span className="guide-na">Not available for this client</span>}
                    </span>
                    {!g.added && (
                      <button
                        className="btn small ghost guide-skip"
                        title={
                          g.notAvailable
                            ? "Make this screenshot required again"
                            : "This client doesn't have this (e.g. no page on that platform yet): don't ask for it"
                        }
                        onClick={() => setSkipped(g.key, !g.notAvailable)}
                      >
                        {g.notAvailable ? "Undo" : "Not available"}
                      </button>
                    )}
                  </div>
                ))}
            </div>
          ))}
          {!report.platforms.length && <p className="small muted">Pick the platforms in the Details tab to see what to capture.</p>}
          {missing > 0 && !reading && report.shots.length > 0 && (
            <p className="small muted" style={{ margin: "8px 0 0" }}>
              Uploaded it but it isn&apos;t ticked? Click the screenshot and set its <b>Platform</b> and <b>Type</b>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

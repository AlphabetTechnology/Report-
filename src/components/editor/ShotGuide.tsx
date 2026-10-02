"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { PlatformIcon } from "@/components/report/icons";
import { CAPTURE_RULES, PLATFORM_GUIDE } from "@/lib/guide";
import { PLATFORM_LABEL, type Report } from "@/lib/types";

/**
 * The team's screenshot standard: how to take screenshots, and a checklist per
 * platform that ticks itself off as Claude reads each upload.
 */
export default function ShotGuide({ report }: { report: Report }) {
  const [open, setOpen] = useState(report.shots.length === 0);
  const done = (kinds: string[], p: string) =>
    report.shots.some((s) => s.platform === p && !s.hidden && s.status === "done" && kinds.includes(s.kind));
  const lists = report.platforms.map((p) => {
    const items = PLATFORM_GUIDE[p].items.map((it) => ({ ...it, ok: done(it.kinds, p) }));
    return { p, items, missing: items.filter((i) => !i.ok).length };
  });
  const missing = lists.reduce((t, l) => t + l.missing, 0);

  return (
    <div className="guide">
      <button className="guide-head" onClick={() => setOpen(!open)}>
        <Icon name="checkCircle" size={16} />
        <strong>Screenshot checklist</strong>
        <span className={`chip ${missing ? "orange" : "green"}`}>
          {missing ? `${missing} to add` : "All added"}
        </span>
        <span className="spacer" />
        <Icon name={open ? "up" : "down"} size={15} />
      </button>
      {open && (
        <div className="guide-body">
          <ul className="guide-rules">
            {CAPTURE_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {lists.map(({ p, items }) => (
            <div className="guide-platform" key={p}>
              <div className="guide-pname">
                <span className="ic">
                  <PlatformIcon platform={p} />
                </span>
                {PLATFORM_LABEL[p]}
                <span className="where">{PLATFORM_GUIDE[p].where}</span>
              </div>
              {items.map((it) => (
                <div className={`guide-item${it.ok ? " ok" : ""}`} key={it.label}>
                  <span className="tick">{it.ok ? <Icon name="check" size={12} stroke={3} /> : null}</span>
                  {it.label}
                </div>
              ))}
            </div>
          ))}
          {!report.platforms.length && <p className="small muted">Pick the platforms in the Details tab to see what to capture.</p>}
        </div>
      )}
    </div>
  );
}

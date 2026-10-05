"use client";

import { useMemo } from "react";
import Icon from "@/components/Icon";
import { toneIssues, toneKey } from "@/lib/checks";
import type { Report } from "@/lib/types";

/**
 * Wording that points the client at a drop or a weak result ("views went down",
 * "only 8"). Claude is told to leave these out; this lists any that slipped in.
 */
export default function ToneCheck({ report, update }: { report: Report; update: (fn: (r: Report) => Report) => void }) {
  const issues = useMemo(() => toneIssues(report), [report]);
  if (!report.text || !issues.length) return null;
  const one = issues.length === 1;
  return (
    <div className="notice warn" style={{ marginTop: 12 }}>
      <Icon name="pen" size={16} />
      <span>
        <strong>{one ? "This wording points out a drop" : `${issues.length} phrases point out a drop`} or a weak result.</strong>{" "}
        The client will read this report, so reword {one ? "it" : "them"} positively or remove {one ? "it" : "them"} in the
        Text tab (Proofread suggests a rewording). If it should stay, click Keep.
        {issues.map((i, n) => (
          <span key={n} className="numcheck">
            <span className="numcheck-where">
              {i.label}
              {i.bold ? " · in bold" : ""}
            </span>
            <span className="numcheck-quote">
              {i.before}
              <mark>{i.phrase}</mark>
              {i.after}
            </span>
            <button
              className="btn small ghost"
              title="Keep this wording: stop flagging it"
              onClick={() => update((r) => ({ ...r, checkedTone: [...(r.checkedTone ?? []), toneKey(i)] }))}
            >
              <Icon name="check" size={12} /> Keep
            </button>
          </span>
        ))}
      </span>
    </div>
  );
}

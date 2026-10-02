"use client";

import { useMemo } from "react";
import Icon from "@/components/Icon";
import { numberIssues, numberKey } from "@/lib/checks";
import type { Report } from "@/lib/types";

/**
 * Numbers in the report text that no screenshot shows. Claude is told never to
 * invent or calculate figures; this lists any that slipped in, to check by eye.
 */
export default function NumberCheck({ report, update }: { report: Report; update: (fn: (r: Report) => Report) => void }) {
  const issues = useMemo(() => numberIssues(report), [report]);
  if (!report.text || !issues.length) return null;
  return (
    <div className="notice warn" style={{ marginTop: 12 }}>
      <Icon name="eye" size={16} />
      <span>
        <strong>
          {issues.length} number{issues.length === 1 ? "" : "s"} in the text {issues.length === 1 ? "isn't" : "aren't"} in
          any screenshot.
        </strong>{" "}
        Check {issues.length === 1 ? "it" : "them"} before sending; Claude may have worked {issues.length === 1 ? "it" : "them"} out or
        misread a screenshot.
        {issues.map((i, n) => (
          <span key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span>
              <b>{i.number}</b> in {i.label}
            </span>
            <button
              className="btn small ghost"
              title="The number is right (e.g. a target you set): stop flagging it"
              onClick={() => update((r) => ({ ...r, checkedNumbers: [...(r.checkedNumbers ?? []), numberKey(i)] }))}
            >
              <Icon name="check" size={12} /> It&apos;s right
            </button>
          </span>
        ))}
      </span>
    </div>
  );
}

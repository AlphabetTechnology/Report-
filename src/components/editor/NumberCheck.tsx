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
          Please double-check {issues.length === 1 ? "this number" : `these ${issues.length} numbers`}.
        </strong>{" "}
        Claude wrote {issues.length === 1 ? "it" : "them"} in the text, but {issues.length === 1 ? "it isn't" : "they aren't"} shown
        in any screenshot, so {issues.length === 1 ? "it" : "they"} may be worked out or misread. If it&apos;s correct, click
        It&apos;s right; if not, fix it in the Text tab.
        {issues.map((i, n) => (
          <span key={n} className="numcheck">
            <span className="numcheck-where">{i.label}</span>
            <span className="numcheck-quote">
              {i.before}
              <mark>{i.number}</mark>
              {i.after}
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

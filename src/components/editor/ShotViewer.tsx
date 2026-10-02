"use client";
/* eslint-disable @next/next/no-img-element -- local data URLs */

import { useEffect } from "react";
import Icon from "@/components/Icon";
import {
  PLATFORM_LABEL,
  PLATFORMS,
  SECTIONS,
  SHOT_KIND_LABEL,
  SHOT_KINDS,
  SHOT_SECTIONS,
  type Platform,
  type Shot,
  type ShotKind,
  type ShotSection,
} from "@/lib/types";

const sectionTitle = (s: ShotSection) => SECTIONS.find((x) => x.key === s)!.title;

/**
 * Full-size view of an uploaded screenshot, with everything Claude read from it
 * and any warnings, so a wrong reading is easy to spot and fix on the spot.
 */
export default function ShotViewer({
  shots,
  index,
  issues,
  onIndex,
  onClose,
  onPatch,
}: {
  shots: Shot[];
  index: number;
  issues: Map<string, string[]>;
  onIndex: (i: number) => void;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<Shot>) => void;
}) {
  const s = shots[index];
  const prev = () => index > 0 && onIndex(index - 1);
  const next = () => index < shots.length - 1 && onIndex(index + 1);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "SELECT") return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < shots.length - 1) onIndex(index + 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, shots.length, onClose, onIndex]);

  if (!s) return null;
  const x = s.extraction;
  const warn = issues.get(s.id) ?? [];
  const rows = (list: { label?: string; name?: string; value: string }[]) =>
    list.map((m, i) => (
      <div className="kv" key={i}>
        <span>{m.label ?? m.name}</span>
        <b>{m.value}</b>
      </div>
    ));

  return (
    <div className="viewer-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="viewer" role="dialog" aria-label={`Screenshot ${index + 1} of ${shots.length}`}>
        <div className="viewer-img">
          <img src={s.dataUrl} alt={s.fileName} />
          <button className="viewer-nav left" onClick={prev} disabled={index === 0} title="Previous (←)">
            <Icon name="arrowLeft" size={20} />
          </button>
          <button className="viewer-nav right" onClick={next} disabled={index === shots.length - 1} title="Next (→)">
            <Icon name="arrowRight" size={20} />
          </button>
        </div>
        <aside className="viewer-side">
          <div className="viewer-top">
            <span className="small muted">
              {index + 1} of {shots.length}
            </span>
            <button className="btn small ghost icon" onClick={onClose} title="Close (Esc)">
              <Icon name="x" size={16} />
            </button>
          </div>
          <h3 title={s.fileName}>{s.fileName}</h3>
          <p className="small muted" style={{ margin: "0 0 10px" }}>
            {s.width} × {s.height} px{s.framed ? " · already a phone mockup" : ""}
            {s.hidden ? " · hidden from the report" : ""}
          </p>

          {warn.length > 0 && (
            <div className="notice warn" style={{ margin: "0 0 12px" }}>
              <Icon name="eye" size={15} />
              <span>
                {warn.map((w, i) => (
                  <span key={i} style={{ display: "block" }}>
                    {w}
                  </span>
                ))}
                <button
                  className="btn small"
                  style={{ marginTop: 8 }}
                  title="You looked and it's right: stop flagging this screenshot"
                  onClick={() => onPatch(s.id, { checked: true, platformSure: true })}
                >
                  <Icon name="check" size={13} /> It&apos;s right, mark as checked
                </button>
              </span>
            </div>
          )}

          <label className="field">
            <span>Platform</span>
            <select
              className="select"
              value={s.platform ?? ""}
              onChange={(e) => onPatch(s.id, { platform: (e.target.value || null) as Platform | null, platformSure: true })}
            >
              <option value="">No platform</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Section</span>
            <select className="select" value={s.section} onChange={(e) => onPatch(s.id, { section: e.target.value as ShotSection })}>
              {SHOT_SECTIONS.map((k) => (
                <option key={k} value={k}>
                  {sectionTitle(k)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Type</span>
            <select className="select" value={s.kind} onChange={(e) => onPatch(s.id, { kind: e.target.value as ShotKind })}>
              {SHOT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {SHOT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>

          <div className="viewer-read">
            <div className="viewer-h">What Claude read</div>
            {!x ? (
              <p className="small muted">{s.status === "error" ? s.error : "Not read yet."}</p>
            ) : (
              <>
                {x.description && <p className="small">{x.description}</p>}
                {x.periodStart && x.periodEnd && (
                  <div className="kv">
                    <span>Dates shown</span>
                    <b>
                      {x.periodStart} – {x.periodEnd}
                    </b>
                  </div>
                )}
                {rows(x.metrics)}
                {rows(x.gender)}
                {x.topAgeRange && (
                  <div className="kv">
                    <span>Largest age group</span>
                    <b>{x.topAgeRange}</b>
                  </div>
                )}
                {x.cities.length > 0 && <div className="viewer-sub">Cities</div>}
                {rows(x.cities)}
                {x.countries.length > 0 && <div className="viewer-sub">Countries</div>}
                {rows(x.countries)}
                {x.posts.length > 0 && <div className="viewer-sub">Posts</div>}
                {x.posts.map((p, i) => (
                  <div className="kv" key={i}>
                    <span>{p.title}</span>
                    <b>{[p.views && `${p.views} views`, p.likes && `${p.likes} likes`].filter(Boolean).join(", ")}</b>
                  </div>
                ))}
                {!x.metrics.length && !x.posts.length && !x.cities.length && !x.gender.length && (
                  <p className="small muted">No numbers on this one.</p>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

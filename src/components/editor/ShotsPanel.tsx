"use client";
/* eslint-disable @next/next/no-img-element -- local data URLs */

import { useState } from "react";
import Icon from "@/components/Icon";
import { analyzeShot, runPool } from "@/lib/api";
import { imageForApi, prepareScreenshot } from "@/lib/image";
import { newId } from "@/lib/store";
import {
  KIND_SECTION,
  PLATFORM_LABEL,
  PLATFORMS,
  SECTIONS,
  SHOT_KIND_LABEL,
  SHOT_KINDS,
  SHOT_SECTIONS,
  type Platform,
  type Report,
  type Shot,
  type ShotKind,
  type ShotSection,
} from "@/lib/types";


const sectionTitle = (s: ShotSection) => SECTIONS.find((x) => x.key === s)!.title;

/** Orders screenshots inside a section the way the template does (charts before phones, etc). */
const kindRank = (k: ShotKind) => SHOT_KINDS.indexOf(k) * 1000;

export default function ShotsPanel({
  report,
  update,
}: {
  report: Report;
  update: (fn: (r: Report) => Report) => void;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patchShot = (id: string, patch: Partial<Shot>) =>
    update((r) => ({ ...r, shots: r.shots.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  async function analyse(shot: Shot) {
    patchShot(shot.id, { status: "analysing", error: undefined });
    try {
      const a = await analyzeShot(await imageForApi(shot.dataUrl), shot.fileName);
      const platform = a.platform === "unknown" ? null : a.platform;
      update((r) => {
        const platforms =
          platform && !r.platforms.includes(platform)
            ? PLATFORMS.filter((p) => p === platform || r.platforms.includes(p))
            : r.platforms;
        return {
          ...r,
          platforms,
          shots: r.shots.map((s) =>
            s.id === shot.id
              ? {
                  ...s,
                  platform,
                  kind: a.kind,
                  section: KIND_SECTION[a.kind],
                  order: kindRank(a.kind) + (s.order % 1000),
                  status: "done",
                  extraction: {
                    description: a.description,
                    metrics: a.metrics,
                    gender: a.gender,
                    topAgeRange: a.topAgeRange,
                    cities: a.cities,
                    countries: a.countries,
                    posts: a.posts,
                  },
                }
              : s,
          ),
        };
      });
    } catch (e) {
      patchShot(shot.id, { status: "error", error: e instanceof Error ? e.message : "Failed" });
    }
  }

  async function addFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setError("");
    setBusy(true);
    try {
      const base = report.shots.length;
      const shots: Shot[] = [];
      for (const [i, f] of images.entries()) {
        const img = await prepareScreenshot(f);
        shots.push({
          id: newId(),
          dataUrl: img.dataUrl,
          width: img.width,
          height: img.height,
          fileName: f.name || `pasted-${i + 1}.png`,
          platform: null,
          kind: "other",
          section: "executive",
          order: kindRank("other") + ((base + i) % 1000),
          status: "pending",
        });
      }
      update((r) => ({ ...r, shots: [...r.shots, ...shots] }));
      await runPool(shots, 3, analyse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add images");
    } finally {
      setBusy(false);
    }
  }

  function move(shot: Shot, dir: -1 | 1) {
    const group = report.shots
      .filter((s) => s.section === shot.section && s.platform === shot.platform)
      .sort((a, b) => a.order - b.order);
    const i = group.findIndex((s) => s.id === shot.id);
    const other = group[i + dir];
    if (!other) return;
    update((r) => ({
      ...r,
      shots: r.shots.map((s) =>
        s.id === shot.id ? { ...s, order: other.order } : s.id === other.id ? { ...s, order: shot.order } : s,
      ),
    }));
  }

  const pending = report.shots.filter((s) => s.status === "pending" || s.status === "analysing").length;
  const failed = report.shots.filter((s) => s.status === "error");

  return (
    <div
      onPaste={(e) => {
        const files = Array.from(e.clipboardData.files);
        if (files.length) addFiles(files);
      }}
    >
      <label
        className={`dropzone${over ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <div className="ic">
          <Icon name="upload" size={24} />
        </div>
        <strong>Drop screenshots here</strong>
        <span className="small muted">
          or click to choose, or paste (Ctrl/Cmd+V). Add them all at once: Facebook, Instagram, TikTok and YouTube.
        </span>
        <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />
      </label>

      {(busy || pending > 0) && (
        <div className="notice" style={{ marginTop: 12 }}>
          <span className="spinner" style={{ marginRight: 8, verticalAlign: -2 }} />
          Claude is reading {pending} screenshot{pending === 1 ? "" : "s"} and placing {pending === 1 ? "it" : "them"} in
          the report…
        </div>
      )}
      {error && <div className="notice err">{error}</div>}
      {failed.length > 0 && (
        <div className="notice err" style={{ marginTop: 12 }}>
          {failed.length} screenshot(s) could not be read.{" "}
          <button className="btn small" onClick={() => runPool(failed, 3, analyse)}>
            Retry
          </button>
        </div>
      )}

      {report.shots.length > 0 && (
        <p className="small muted" style={{ marginTop: 12 }}>
          Check each screenshot is in the right place. Change the platform, section or type if Claude got it wrong; the
          preview updates straight away.
        </p>
      )}

      {SHOT_SECTIONS.map((section) => {
        const inSection = report.shots
          .filter((s) => s.section === section)
          .sort(
            (a, b) =>
              (a.platform ? PLATFORMS.indexOf(a.platform) : 9) - (b.platform ? PLATFORMS.indexOf(b.platform) : 9) ||
              a.order - b.order,
          );
        if (!inSection.length) return null;
        return (
          <div key={section}>
            <div className="group-title">
              {sectionTitle(section)} <span className="chip">{inSection.length}</span>
            </div>
            {inSection.map((s) => (
              <div className="shot" key={s.id}>
                <a href={s.dataUrl} target="_blank" rel="noreferrer" title="Open full size">
                  <img src={s.dataUrl} alt="" />
                </a>
                <div style={{ minWidth: 0 }}>
                  <div className="meta">
                    {s.status === "analysing" || s.status === "pending" ? (
                      <span className="chip blue">
                        <span className="spinner" style={{ width: 10, height: 10 }} /> Reading
                      </span>
                    ) : s.status === "error" ? (
                      <span className="chip red" title={s.error}>
                        Error
                      </span>
                    ) : s.platform ? (
                      <span className="chip green">{PLATFORM_LABEL[s.platform]}</span>
                    ) : (
                      <span className="chip orange">Platform?</span>
                    )}
                    <span className="name" title={s.extraction?.description ?? s.fileName}>
                      {s.extraction?.description ?? s.fileName}
                    </span>
                  </div>
                  <div className="controls">
                    <select
                      className="select"
                      value={s.platform ?? ""}
                      onChange={(e) => patchShot(s.id, { platform: (e.target.value || null) as Platform | null })}
                    >
                      <option value="">No platform</option>
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {PLATFORM_LABEL[p]}
                        </option>
                      ))}
                    </select>
                    <select
                      className="select"
                      value={s.section}
                      onChange={(e) => patchShot(s.id, { section: e.target.value as ShotSection })}
                    >
                      {SHOT_SECTIONS.map((x) => (
                        <option key={x} value={x}>
                          {sectionTitle(x)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="select"
                      value={s.kind}
                      onChange={(e) => patchShot(s.id, { kind: e.target.value as ShotKind })}
                    >
                      {SHOT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {SHOT_KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                    <div className="row" style={{ gap: 2 }}>
                      <button className="btn small ghost icon" title="Move up" onClick={() => move(s, -1)}>
                        <Icon name="up" size={15} />
                      </button>
                      <button className="btn small ghost icon" title="Move down" onClick={() => move(s, 1)}>
                        <Icon name="down" size={15} />
                      </button>
                      <button className="btn small ghost icon" title="Read again" onClick={() => analyse(s)}>
                        <Icon name="refresh" size={14} />
                      </button>
                      <button
                        className="btn small ghost icon danger"
                        title="Remove"
                        onClick={() => update((r) => ({ ...r, shots: r.shots.filter((x) => x.id !== s.id) }))}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

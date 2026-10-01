"use client";
/* eslint-disable @next/next/no-img-element -- local data URLs */

import { errorMessage } from "@/lib/errors";
import { useState } from "react";
import Icon from "@/components/Icon";
import { analyzeShot, runPool } from "@/lib/api";
import { imageForApi, prepareScreenshot } from "@/lib/image";
import { crop, findCards, type CardLayout } from "@/lib/split";
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
  const [info, setInfo] = useState("");
  const [removed, setRemoved] = useState(0);

  const patchShot = (id: string, patch: Partial<Shot>) =>
    update((r) => ({ ...r, shots: r.shots.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  async function analyse(shot: Shot, hint = shot.context) {
    patchShot(shot.id, { status: "analysing", error: undefined, context: hint });
    try {
      const a = await analyzeShot(await imageForApi(shot.dataUrl), shot.fileName, hint);
      if (a.useful === false && hint) {
        // A page header or banner cut out of a dashboard: no report data, drop it.
        update((r) => ({ ...r, shots: r.shots.filter((s) => s.id !== shot.id) }));
        setRemoved((n) => n + 1);
        return;
      }
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
                  // Never delete a whole upload: if it looks empty or irrelevant, just hide it.
                  hidden: a.empty === true || a.useful === false,
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
      patchShot(shot.id, { status: "error", error: errorMessage(e, "Failed") });
    }
  }

  async function addFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setError("");
    setInfo("");
    setRemoved(0);
    setBusy(true);
    try {
      let seq = report.shots.length;
      const make = (img: { dataUrl: string; width: number; height: number }, fileName: string): Shot => ({
        id: newId(),
        dataUrl: img.dataUrl,
        width: img.width,
        height: img.height,
        fileName,
        platform: null,
        kind: "other",
        section: "executive",
        order: kindRank("other") + (seq++ % 1000),
        status: "pending",
      });

      const singles: Shot[] = [];
      const groups: { full: string; name: string; cards: Shot[] }[] = [];
      for (const [i, f] of images.entries()) {
        const img = await prepareScreenshot(f);
        const name = f.name || `pasted-${i + 1}.png`;
        const layout: CardLayout = await findCards(img.dataUrl).catch(() => ({ type: "none" }) as const);
        if (layout.type === "grid") {
          // A dashboard with several cards: one image per card, so each goes to its own section.
          const cards: Shot[] = [];
          for (const [j, r] of layout.cards.entries()) {
            cards.push(make(await crop(img.dataUrl, r, 2), `${name} · part ${j + 1}`));
          }
          groups.push({ full: img.dataUrl, name, cards });
        } else if (layout.type === "trim") {
          singles.push(make(await crop(img.dataUrl, layout.rect, 4), name));
        } else {
          singles.push(make(img, name));
        }
      }
      const added = [...singles, ...groups.flatMap((g) => g.cards)];
      update((r) => ({ ...r, shots: [...r.shots, ...added] }));
      if (groups.length) {
        const n = groups.reduce((t, g) => t + g.cards.length, 0);
        setInfo(
          `Cut ${groups.length} screenshot${groups.length === 1 ? "" : "s"} into ${n} separate parts so each one goes to its own section.`,
        );
      }

      await Promise.all([
        runPool(singles, 3, (s) => analyse(s)),
        runPool(groups, 1, async (g) => {
          // Read the whole dashboard once to learn its platform (cards alone often don't show it).
          let hint = "This image is one card or part cut out of a larger analytics screenshot.";
          try {
            const full = await analyzeShot(await imageForApi(g.full), g.name);
            if (full.platform !== "unknown") {
              hint += ` The dashboard is for ${PLATFORM_LABEL[full.platform]}, so the platform is "${full.platform}".`;
            }
          } catch {
            /* the cards are still read on their own */
          }
          await runPool(g.cards, 3, (c) => analyse(c, hint));
        }),
      ]);
    } catch (e) {
      setError(errorMessage(e, "Could not add images"));
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
      {info && (
        <div className="notice" style={{ marginTop: 12 }}>
          <Icon name="scissors" size={16} />
          <span>
            {info}
            {removed > 0 && ` Removed ${removed} piece${removed === 1 ? "" : "s"} with no data (page header, banners).`}
          </span>
        </div>
      )}
      {report.shots.some((s) => s.hidden) && (
        <div className="notice warn" style={{ marginTop: 12 }}>
          <Icon name="eyeOff" size={16} />
          <span>
            Cards showing 0 (e.g. Link clicks 0) are hidden from the report. Click the eye on a card to show it.
          </span>
        </div>
      )}
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
              <div className={`shot${s.hidden ? " dim" : ""}`} key={s.id}>
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
                    ) : s.hidden ? (
                      <span className="chip" title="Not shown in the report">
                        <Icon name="eyeOff" size={12} /> Hidden
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
                      <button
                        className="btn small ghost icon"
                        title={s.hidden ? "Show in report" : "Hide from report"}
                        onClick={() => patchShot(s.id, { hidden: !s.hidden })}
                      >
                        <Icon name={s.hidden ? "eyeOff" : "eye"} size={15} />
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

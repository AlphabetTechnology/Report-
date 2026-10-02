"use client";
/* eslint-disable @next/next/no-img-element -- local data URLs */

import { errorMessage } from "@/lib/errors";
import { useState } from "react";
import Icon from "@/components/Icon";
import { runPool } from "@/lib/api";
import { analyseShot, processImages } from "@/lib/pipeline";
import { prepareScreenshot } from "@/lib/image";
import { checkFileSize, checkResolution, getRules, setRules, type UploadRules } from "@/lib/upload-rules";
import {
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
  const [rejected, setRejected] = useState<{ name: string; reason: string }[]>([]);

  const patchShot = (id: string, patch: Partial<Shot>) =>
    update((r) => ({ ...r, shots: r.shots.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const analyse = async (shot: Shot) => {
    await analyseShot(update, shot);
  };

  async function addFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setError("");
    setInfo("");
    setRemoved(0);
    setBusy(true);
    const rules = getRules();
    const refused: { name: string; reason: string }[] = [];
    try {
      const items = [];
      // The same file uploaded twice (in this batch or before) would print twice.
      const seen = new Map(report.shots.filter((s) => s.source).map((s) => [s.source!, s.fileName.split(" · ")[0]]));
      for (const [i, f] of images.entries()) {
        const name = f.name || `pasted-${i + 1}.png`;
        const source = await fingerprint(f);
        if (seen.has(source)) {
          refused.push({ name, reason: `the same screenshot as ${seen.get(source)}, which is already in this report.` });
          continue;
        }
        seen.set(source, name);
        const sizeProblem = checkFileSize(f, rules);
        if (sizeProblem) {
          refused.push({ name, reason: sizeProblem });
          continue;
        }
        const image = await prepareScreenshot(f);
        const resProblem = checkResolution(image.width, image.height, rules);
        if (resProblem) {
          refused.push({ name, reason: resProblem });
          continue;
        }
        items.push({ image, name, source });
      }
      if (!items.length) return;
      const res = await processImages(update, items, report.shots.length);
      setRemoved(res.removed);
      if (res.cutScreenshots) {
        setInfo(
          `Cut ${res.cutScreenshots} screenshot${res.cutScreenshots === 1 ? "" : "s"} into ${res.cards} separate parts so each one goes to its own section.`,
        );
      }
    } catch (e) {
      setError(errorMessage(e, "Could not add images"));
    } finally {
      setRejected(refused);
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
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>
      <RulesLine />

      {rejected.length > 0 && (
        <div className="notice err" style={{ marginTop: 12 }}>
          <Icon name="x" size={16} />
          <span>
            <strong>
              {rejected.length} screenshot{rejected.length === 1 ? " was" : "s were"} not added:
            </strong>
            {rejected.map((r, i) => (
              <span key={i} style={{ display: "block", marginTop: 4 }}>
                <b>{r.name}</b> is {r.reason}
              </span>
            ))}
          </span>
        </div>
      )}

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

/** Short fingerprint of a file's bytes. */
async function fingerprint(file: File): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-1", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The upload limits, shown under the drop zone and editable by the team. */
function RulesLine() {
  const [draft, setDraft] = useState<Record<keyof UploadRules, string> | null>(null);
  const rules = getRules();
  if (!draft) {
    return (
      <p className="small muted" style={{ margin: "8px 0 0" }}>
        Accepted: at least {rules.minKb} KB and {rules.minPx} px on the long side, up to {rules.maxMb} MB.{" "}
        <button
          className="link-btn"
          onClick={() => setDraft({ minKb: String(rules.minKb), minPx: String(rules.minPx), maxMb: String(rules.maxMb) })}
        >
          Change
        </button>
      </p>
    );
  }
  const parsed = { minKb: Number(draft.minKb), minPx: Number(draft.minPx), maxMb: Number(draft.maxMb) };
  const valid =
    Object.values(draft).every((v) => v.trim() !== "") &&
    parsed.minKb >= 0 &&
    parsed.minPx >= 0 &&
    parsed.maxMb > 0 &&
    parsed.maxMb * 1024 > parsed.minKb;
  const num = (k: keyof UploadRules) => (
    <input
      className="input"
      type="number"
      min={0}
      step="any"
      value={draft[k]}
      style={{ width: 76, padding: "4px 8px" }}
      onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
    />
  );
  return (
    <div className="rules-edit small">
      <label>Min size (KB) {num("minKb")}</label>
      <label>Min long side (px) {num("minPx")}</label>
      <label>Max size (MB) {num("maxMb")}</label>
      <button
        className="btn small primary"
        disabled={!valid}
        title={valid ? undefined : "Enter numbers; the maximum must be above 0 and above the minimum"}
        onClick={() => {
          setRules(parsed);
          setDraft(null);
        }}
      >
        Save
      </button>
      <button className="btn small ghost" onClick={() => setDraft(null)}>
        Cancel
      </button>
    </div>
  );
}

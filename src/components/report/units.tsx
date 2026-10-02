/* eslint-disable @next/next/no-img-element -- report pages are printed, plain <img> keeps them exact */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { eraseChangeLabels } from "@/lib/split";
import {
  PLATFORM_LABEL,
  SECTIONS,
  type Metric,
  type Platform,
  type Report,
  type SectionKey,
  type Shot,
  type ShotSection,
} from "@/lib/types";
import { Badge, PLATFORM_BAR, PLATFORM_RING, PlatformIcon } from "./icons";
import { inline, Rich } from "./richtext";

export { Rich };

export interface Unit {
  key: string;
  node: ReactNode;
  /** Keep this unit on the same page as the one after it (headings, intros). */
  keepWithNext?: boolean;
  /** Screenshot cards can be scaled down a little to fit the page. */
  shrinkable?: boolean;
}

export interface BuiltSection {
  key: SectionKey;
  number: number;
  title: string;
  units: Unit[];
}

/* ---------- text helpers ---------- */

const Placeholder = () => (
  <p style={{ color: "#9aa3ad", fontStyle: "italic" }}>
    Text appears here once you generate it in the Text tab.
  </p>
);

/* ---------- screenshot sizing ---------- */

const WIDE_KINDS = new Set(["demographics", "locations", "top_content"]);

function fit(shot: Shot, maxW: number, maxH: number) {
  const aspect = shot.width / shot.height;
  const w = Math.min(maxW, maxH * aspect);
  return { w, h: w / aspect };
}

function limitsFor(shot: Shot) {
  // Audience screenshots carry small print (towns, countries): give them most of a page.
  if (shot.kind === "demographics" || shot.kind === "locations") return { maxW: 176, maxH: 205 };
  if (WIDE_KINDS.has(shot.kind)) return { maxW: 176, maxH: 110 };
  if (shot.kind === "content_overview") return { maxW: 150, maxH: 86 };
  // A long scrolling capture gets most of a page's height so it stays readable.
  if (isLongShot(shot)) return { maxW: 118, maxH: 200 };
  if (isWideShot(shot)) return { maxW: 172, maxH: 70 };
  return { maxW: 118, maxH: 70 };
}

/** Whether to erase Meta's red/green change labels from screenshots. */
export const HideChangesContext = createContext(true);

const cleaned = new Map<string, Promise<string>>();

/** Keeps a cache to its most recent entries so a long session doesn't hold every image ever shown. */
function remember<V>(cache: Map<string, V>, key: string, value: V, max = 120) {
  cache.set(key, value);
  while (cache.size > max) cache.delete(cache.keys().next().value!);
}

/** The screenshot with change labels erased (computed once per image). */
function useCleanImage(shot: Shot): string {
  const hide = useContext(HideChangesContext);
  const key = `${shot.id}:${shot.dataUrl.length}`;
  const [clean, setClean] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!hide || !shot.dataUrl) return;
    let alive = true;
    if (!cleaned.has(key)) remember(cleaned, key, eraseChangeLabels(shot.dataUrl).catch(() => shot.dataUrl));
    cleaned.get(key)!.then((url) => alive && setClean({ key, url }));
    return () => {
      alive = false;
    };
  }, [hide, key, shot.dataUrl]);
  return hide && clean?.key === key ? clean.url : shot.dataUrl;
}

function ShotImg({ shot, w, h }: { shot: Shot; w: number; h: number }) {
  const src = useCleanImage(shot);
  return (
    <img
      className="rpt-shot"
      src={src}
      alt={shot.fileName}
      style={{ width: `${w}mm`, height: `${h}mm` }}
    />
  );
}

/** Longer than a phone screen: a scrolling capture, shown as a tall plain card. */
const isLongShot = (s: Shot) => s.width / s.height < 0.38;
/** A whole phone screenshot (tall and narrow); pieces cut from a bigger screenshot are not. */
const isPhoneShot = (s: Shot) => s.width / s.height < 0.7 && !isLongShot(s) && !s.context && !s.framed;
/** A banner-shaped screenshot, too wide to share a row. */
const isWideShot = (s: Shot) => s.width / s.height > 2.2;

function Card({
  shots,
  platform,
  badge3d,
  badge = true,
}: {
  shots: Shot[];
  platform: Platform | null;
  badge3d: boolean;
  badge?: boolean;
}) {
  if (shots.length === 1 && shots[0].framed) {
    const { w, h } = fit(shots[0], 110, 165);
    return (
      <div className="rpt-card-wrap" style={badge && platform ? undefined : { paddingTop: "3mm" }}>
        <div className="rpt-framed" data-grow="phone" style={{ ["--corner" as string]: `${w * 0.12}mm` }}>
          {badge && platform && <Badge platform={platform} style3d={badge3d} />}
          <ShotImg shot={shots[0]} w={w} h={h} />
        </div>
      </div>
    );
  }
  const n = shots.length;
  const portrait = shots.every((s) => s.width / s.height < 0.85);
  const colW = (172 - (n - 1) * 2.4) / Math.max(n, 1);
  const sized =
    n > 1
      ? shots.map((s) => ({ s, ...fit(s, colW, portrait ? 100 : n === 2 ? 74 : 60) }))
      : shots.map((s) => ({ s, ...fit(s, limitsFor(s).maxW, limitsFor(s).maxH) }));
  const showBadge = badge && platform;
  return (
    <div className="rpt-card-wrap" style={showBadge ? undefined : { paddingTop: "3mm" }}>
      <div className={`rpt-card${showBadge ? " has-badge" : ""}`} data-grow="card">
        {showBadge && <Badge platform={platform} style3d={badge3d} />}
        {sized.map(({ s, w, h }) => (
          <ShotImg key={s.id} shot={s} w={w} h={h} />
        ))}
      </div>
    </div>
  );
}

/* ---------- phone screenshots: the SWS brand panel ---------- */

/** Height ÷ width of a modern phone screen (19.5:9). */
const PHONE_ASPECT = 19.5 / 9;

const screenColours = new Map<string, Promise<string>>();

/** Background colour of a screenshot, to fill the rest of a phone screen. */
function useScreenColour(src: string): string {
  const [colour, setColour] = useState<{ src: string; c: string } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!screenColours.has(src)) {
      remember(
        screenColours,
        src,
        new Promise<string>((resolve) => {
          const img = new Image();
          img.onload = () => {
            // The most common colour is the screen's background (white, or black in dark mode).
            const c = document.createElement("canvas");
            c.width = 48;
            c.height = 48;
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(img, 0, 0, 48, 48);
            const d = ctx.getImageData(0, 0, 48, 48).data;
            const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
            for (let i = 0; i < d.length; i += 4) {
              const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
              const e = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
              e.n++;
              e.r += d[i];
              e.g += d[i + 1];
              e.b += d[i + 2];
              counts.set(key, e);
            }
            const top = [...counts.values()].sort((a, b) => b.n - a.n)[0];
            resolve(top ? `rgb(${Math.round(top.r / top.n)},${Math.round(top.g / top.n)},${Math.round(top.b / top.n)})` : "#fff");
          };
          img.onerror = () => resolve("#fff");
          img.src = src;
        }),
      );
    }
    screenColours.get(src)!.then((c) => alive && setColour({ src, c }));
    return () => {
      alive = false;
    };
  }, [src]);
  return colour?.src === src ? colour.c : "#fff";
}

/**
 * A realistic phone. It always has a real phone shape: a short (cropped)
 * screenshot sits at the top of the screen, the rest in its own background
 * colour; a long one is cut at the bottom.
 */
function PhoneFrame({ shot, w }: { shot: Shot; w: number }) {
  const src = useCleanImage(shot);
  const fill = useScreenColour(src);
  const r = w * 0.19;
  return (
    <div className="rpt-pphone" style={{ borderRadius: `${r}mm` }}>
      <i className="b1" />
      <i className="b2" />
      <i className="b3" />
      <div className="bez" style={{ borderRadius: `${r - 0.7}mm` }}>
        <div className="scr" style={{ width: `${w}mm`, height: `${w * PHONE_ASPECT}mm`, background: fill, borderRadius: `${r - 2.3}mm` }}>
          <img src={src} alt={shot.fileName} />
        </div>
      </div>
    </div>
  );
}

interface PanelInfo {
  headline: Metric | null;
  tiles: Metric[];
  period: string;
}

/** The numbers shown beside a phone: the section's main figure, then the platform's headline figures. */
function panelInfo(report: Report, p: Platform | null, period: string, section?: string): PanelInfo {
  const blocks = (report.text?.blocks ?? []).filter((b) => b.platform === p);
  const own = blocks.filter((b) => b.section === section).flatMap((b) => b.metrics);
  const seen = new Set<string>();
  const all = [...own, ...blocks.flatMap((b) => b.metrics)].filter((m) => {
    const k = m.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const want = [/^views$|platform views|^views/i, /reach|viewers|impressions/i, /interaction|engagement/i, /visit/i, /follow/i];
  const headline = own[0] ?? all.find((m) => want[0].test(m.label)) ?? all[0] ?? null;
  const tiles: Metric[] = [];
  for (const rx of want) {
    const m = all.find((x) => rx.test(x.label) && x !== headline && !tiles.includes(x));
    if (m) tiles.push(m);
  }
  for (const m of all) if (tiles.length < 4 && m !== headline && !tiles.includes(m)) tiles.push(m);
  return { headline, tiles: tiles.slice(0, 4), period };
}

/**
 * One to three phone screenshots on the SWS-blue panel. In the summary and the
 * number sections the month's figures sit beside them; elsewhere (top content,
 * activities, audience) just the platform name, so figures aren't repeated.
 */
function PhonePanel({ shots, platform, info }: { shots: Shot[]; platform: Platform | null; info: PanelInfo | null }) {
  const n = shots.length;
  const hasStats = !!info?.headline;
  const stacked = n >= 3 || !hasStats;
  const w = stacked ? (n >= 3 ? 37 : n === 2 ? 44 : 50) : n === 2 ? 38 : 50;
  return (
    <div className="rpt-ppanel-wrap">
      <div className={`rpt-ppanel${stacked ? " stacked" : ""}${n === 2 ? " two" : ""}`} data-grow="card">
        <div className="phones">
          {shots.map((s) => (
            <PhoneFrame key={s.id} shot={s} w={w} />
          ))}
        </div>
        {hasStats ? (
          <div className="side">
            <div className="head">
              <div className="k">
                {platform && (
                  <span className="ic">
                    <PlatformIcon platform={platform} />
                  </span>
                )}
                {platform ? `${PLATFORM_LABEL[platform]} ` : ""}
                {info!.headline!.label}
              </div>
              <div className="v">{info!.headline!.value}</div>
              {info!.period && <div className="note">{info!.period}</div>}
            </div>
            {info!.tiles.length > 0 && (
              <div className="tiles">
                {info!.tiles.map((t, i) => (
                  <div className="tile" key={i}>
                    <b>{t.value}</b>
                    <span>{t.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          platform && (
            <div className="plain">
              <span className="ic">
                <PlatformIcon platform={platform} />
              </span>
              {PLATFORM_LABEL[platform]}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/** Turns the screenshots of one platform in one section into units. */
function shotUnits(
  keyBase: string,
  shots: Shot[],
  platform: Platform | null,
  badge3d: boolean,
  panel: PanelInfo | null,
  badge = true,
): Unit[] {
  const units: Unit[] = [];
  // Screenshots of one platform are laid out by shape, in the team's order: phone
  // screens (and profile grids) up to three on the SWS phone panel, ordinary cards
  // two across, and wide banners, long scrolling captures, dashboards and
  // ready-made mockups each on their own. So 2, 3 or 10 uploads all lay out neatly.
  // A phone screenshot always goes on the phone panel, whatever kind of data it shows.
  const shape = (s: Shot): "phone" | "card" | "single" =>
    s.framed
      ? "single"
      : isPhoneShot(s) || (s.kind === "profile_grid" && !s.context)
        ? "phone"
        : WIDE_KINDS.has(s.kind) || s.kind === "content_overview" || isWideShot(s) || isLongShot(s)
          ? "single"
          : "card";
  const perRow = { phone: 3, card: 2, single: 1 };
  const chunks: { shots: Shot[]; type: "phone" | "card" | "single" }[] = [];
  for (const s of shots) {
    const type = shape(s);
    const last = chunks[chunks.length - 1];
    if (last && last.type === type && last.shots.length < perRow[type]) last.shots.push(s);
    else chunks.push({ shots: [s], type });
  }
  let statsShown = false;
  chunks.forEach(({ shots: row, type }, i) => {
    if (type === "phone") {
      // The numbers go beside the first panel only, so they aren't repeated.
      const info = statsShown ? null : panel;
      statsShown ||= !!panel?.headline;
      units.push({ key: `${keyBase}-${row[0].id}`, shrinkable: true, node: <PhonePanel shots={row} platform={platform} info={info} /> });
      return;
    }
    units.push({
      key: `${keyBase}-${row[0].id}`,
      shrinkable: true,
      // Every card on its own carries the platform badge; in a run of rows, the first.
      node: (
        <Card
          shots={row}
          platform={platform}
          badge3d={badge3d}
          badge={badge && (i === 0 || type === "single" || chunks[i - 1].type !== type)}
        />
      ),
    });
  });
  return units;
}

/** Headline numbers as stat cards: small label, big brand-coloured value. */
function StatTiles({ metrics, platform }: { metrics: { label: string; value: string }[]; platform?: Platform | null }) {
  if (!metrics.length) return null;
  const accent = platform ? PLATFORM_RING[platform] : "#1471b9";
  return (
    <div className="rpt-stats">
      {metrics.map((m, i) => (
        <div className="rpt-stat" key={i} style={{ borderLeftColor: accent }}>
          <span className="lbl">{m.label}</span>
          <span className="val">{m.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Executive summary strip: each platform's headline numbers side by side. */
function AtAGlance({ report }: { report: Report }) {
  const t = report.text;
  if (!t) return null;
  const pick = (p: Platform) => {
    const all = t.blocks.filter((b) => b.platform === p).flatMap((b) => b.metrics);
    const want = [/^views$|platform views|^views/i, /reach|viewers/i, /interaction/i, /visit/i];
    const chosen: { label: string; value: string }[] = [];
    for (const rx of want) {
      const m = all.find((x) => rx.test(x.label) && !chosen.includes(x));
      if (m) chosen.push(m);
    }
    return chosen;
  };
  const rows = orderedPlatforms(report)
    .map((p) => ({ p, metrics: pick(p) }))
    .filter((r) => r.metrics.length);
  if (!rows.length) return null;
  return (
    <div className="rpt-glance">
      <div className="rpt-glance-title">At a glance</div>
      {rows.map(({ p, metrics }) => (
        <div className="rpt-glance-row" key={p}>
          <div className="rpt-glance-plat">
            <span className="ic">
              <PlatformIcon platform={p} />
            </span>
            {PLATFORM_LABEL[p]}
          </div>
          <StatTiles metrics={metrics} platform={p} />
        </div>
      ))}
    </div>
  );
}

/* ---------- section builders ---------- */

const BADGE_3D: Record<ShotSection, boolean> = {
  executive: true,
  reach: true,
  views: false,
  engagement: false,
  visits: true,
  audience: true,
  top_content: false,
  activities: false,
};

function shotsFor(report: Report, section: ShotSection, platform: Platform | null) {
  return report.shots
    .filter((s) => s.section === section && s.platform === platform && !s.hidden)
    .sort((a, b) => a.order - b.order);
}

/** Platforms that appear in the report, in the order chosen on the cover. */
function orderedPlatforms(report: Report): Platform[] {
  const extra = report.shots
    .map((s) => s.platform)
    .filter((p): p is Platform => !!p && !report.platforms.includes(p));
  return [...report.platforms, ...new Set(extra)];
}

function buildExecutive(report: Report, period: string): Unit[] {
  const text = report.text?.executiveSummary;
  const units: Unit[] = [
    { key: "exec-text", node: text ? <Rich text={text} /> : <Placeholder /> },
    { key: "exec-glance", node: <AtAGlance report={report} /> },
  ];
  for (const p of [...orderedPlatforms(report), null]) {
    units.push(...shotUnits(`exec-${p}`, shotsFor(report, "executive", p), p, true, panelInfo(report, p, period)));
  }
  return units;
}

function buildMetricSection(
  report: Report,
  section: "reach" | "views" | "engagement" | "visits",
  period: string,
): Unit[] {
  const units: Unit[] = [];
  for (const p of orderedPlatforms(report)) {
    const block = report.text?.blocks.find((b) => b.section === section && b.platform === p);
    const shots = shotsFor(report, section, p);
    if (!block && !shots.length) continue;
    const panel = panelInfo(report, p, period, section);
    units.push({
      key: `${section}-${p}-intro`,
      keepWithNext: shots.length > 0,
      node: (
        <>
          <h2 className="rpt-platform-title">{PLATFORM_LABEL[p]}</h2>
          {block ? (
            <>
              <StatTiles metrics={block.metrics} platform={p} />
              {block.text && <Rich text={block.text} />}
            </>
          ) : (
            <Placeholder />
          )}
        </>
      ),
    });
    units.push(...shotUnits(`${section}-${p}`, shots, p, BADGE_3D[section], panel));
  }
  units.push(...shotUnits(`${section}-none`, shotsFor(report, section, null), null, false, null));
  return units;
}

function buildAudience(report: Report): Unit[] {
  const units: Unit[] = [];
  for (const p of orderedPlatforms(report)) {
    const a = report.text?.audience.find((x) => x.platform === p);
    const shots = shotsFor(report, "audience", p);
    if (!a && !shots.length) continue;
    const demo = shots.filter((s) => s.kind !== "locations");
    const loc = shots.filter((s) => s.kind === "locations");
    const bar = PLATFORM_BAR[p];

    units.push({
      key: `aud-${p}-bar`,
      keepWithNext: true,
      node: (
        <div className="rpt-sub-bar big orange">
          {PLATFORM_LABEL[p]}
          <Badge platform={p} style3d />
        </div>
      ),
    });
    units.push({
      key: `aud-${p}-intro`,
      keepWithNext: demo.length > 0,
      node: a ? (
        <>
          <StatTiles metrics={[...a.metrics, ...a.gender]} platform={p} />
          {a.text && <Rich text={a.text} />}
        </>
      ) : (
        <Placeholder />
      ),
    });
    units.push(...shotUnits(`aud-${p}-demo`, demo, p, true, null, false));

    if (a && (a.locations.length || a.countries.length)) {
      if (a.locations.length) {
        units.push({
          key: `aud-${p}-loc`,
          keepWithNext: true,
          node: (
            <>
              <div className={`rpt-sub-bar ${bar}`}>
                Leading Locations:
                <Badge platform={p} style3d />
              </div>
              <ul className="rpt-bullets">
                {a.locations.map((l, i) => (
                  <li key={i}>
                    {inline(`${l.name} – ${l.value}`)}
                  </li>
                ))}
              </ul>
            </>
          ),
        });
      }
      units.push({
        key: `aud-${p}-countries`,
        keepWithNext: loc.length > 0,
        node: (
          <>
            {a.countries.length > 0 && (
              <>
                <div className={`rpt-sub-bar ${bar}`}>
                  Top Countries:
                  <Badge platform={p} style3d />
                </div>
                <ul className="rpt-bullets">
                  {a.countries.map((l, i) => (
                    <li key={i}>
                      {inline(`${l.name} – ${l.value}`)}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {a.locationsText && <Rich text={a.locationsText} />}
          </>
        ),
      });
    }
    units.push(...shotUnits(`aud-${p}-locshots`, loc, p, true, null, false));
  }
  units.push(...shotUnits(`aud-none`, shotsFor(report, "audience", null), null, false, null, false));
  return units;
}

function buildTopContent(report: Report): Unit[] {
  const units: Unit[] = [];
  for (const p of orderedPlatforms(report)) {
    const t = report.text?.topContent.find((x) => x.platform === p);
    const shots = shotsFor(report, "top_content", p);
    if (!t && !shots.length) continue;
    units.push({
      key: `top-${p}-intro`,
      keepWithNext: shots.length > 0,
      node: (
        <>
          <h2 className="rpt-platform-title">{PLATFORM_LABEL[p]}</h2>
          {t ? (
            <>
              {t.items.map((it, i) => (
                <div className="rpt-top-item" key={i}>
                  <strong>{inline(it.title)} —</strong> {inline(it.detail)}
                </div>
              ))}
              {t.summary && (
                <div style={{ marginTop: "2mm" }}>
                  <Rich text={t.summary} />
                </div>
              )}
            </>
          ) : (
            <Placeholder />
          )}
        </>
      ),
    });
    units.push(...shotUnits(`top-${p}`, shots, p, false, null));
  }
  units.push(...shotUnits(`top-none`, shotsFor(report, "top_content", null), null, false, null));
  return units;
}

function buildFocus(report: Report): Unit[] {
  const focus = report.text?.focus ?? [];
  if (!focus.length) return report.text ? [] : [{ key: "focus-ph", node: <Placeholder /> }];
  return focus.map((f, i) => ({
    key: `focus-${i}`,
    node: (
      <div className="rpt-focus">
        <div className="rpt-focus-num">{String(i + 1).padStart(2, "0")}</div>
        <div className="rpt-focus-main">
          <h3>{inline(f.title)}</h3>
          <div className="rpt-focus-row situation">
            <span className="tag">Current Situation</span>
            <span>{inline(f.situation)}</span>
          </div>
          <div className="rpt-focus-row action">
            <span className="tag">Implementation</span>
            <span>{inline(f.implementation)}</span>
          </div>
        </div>
      </div>
    ),
  }));
}

function buildActivities(report: Report): Unit[] {
  const a = report.text?.activities;
  const units: Unit[] = [];
  const hasShots = report.shots.some((s) => s.section === "activities" && !s.hidden);
  if (!hasShots && !a?.summary && !a?.items.length) return units;
  units.push({
    key: "act-intro",
    keepWithNext: hasShots,
    node:
      a && (a.summary || a.items.length) ? (
        <>
          {a.summary && <Rich text={a.summary} />}
          {a.items.length > 0 && (
            <ul className="rpt-activity-list">
              {a.items.map((it, i) => (
                <li key={i}>{inline(it)}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Placeholder />
      ),
  });
  for (const p of [...orderedPlatforms(report), null]) {
    const shots = shotsFor(report, "activities", p);
    if (!shots.length) continue;
    if (p && orderedPlatforms(report).length > 1) {
      units.push({
        key: `act-${p}-title`,
        keepWithNext: true,
        node: <h2 className="rpt-platform-title" style={{ marginTop: "3mm" }}>{PLATFORM_LABEL[p]}</h2>,
      });
    }
    units.push(...shotUnits(`act-${p}`, shots, p, false, null));
  }
  return units;
}

function buildConclusion(report: Report): Unit[] {
  const t = report.text?.conclusion;
  return [{ key: "conclusion", node: t ? <Rich text={t} /> : <Placeholder /> }];
}

/** All sections that have something to show, numbered in order. */
export function buildSections(report: Report, period = ""): BuiltSection[] {
  const out: BuiltSection[] = [];
  for (const s of SECTIONS) {
    let units: Unit[];
    switch (s.key) {
      case "executive":
        units = buildExecutive(report, period);
        break;
      case "reach":
      case "views":
      case "engagement":
      case "visits":
        units = buildMetricSection(report, s.key, period);
        break;
      case "audience":
        units = buildAudience(report);
        break;
      case "top_content":
        units = buildTopContent(report);
        break;
      case "activities":
        units = buildActivities(report);
        break;
      case "focus":
        units = buildFocus(report);
        break;
      case "conclusion":
        units = buildConclusion(report);
        break;
    }
    if (!units.length) continue;
    const number = out.length + 1;
    const colour = number % 2 === 1 ? "orange" : "blue";
    const bar: Unit = {
      key: `${s.key}-bar`,
      keepWithNext: true,
      node: (
        <div className={`rpt-section-bar ${colour}`}>
          {number}. {s.title}
        </div>
      ),
    };
    out.push({ key: s.key, number, title: s.title, units: [bar, ...units] });
  }
  return out;
}

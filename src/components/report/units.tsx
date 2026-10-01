/* eslint-disable @next/next/no-img-element -- report pages are printed, plain <img> keeps them exact */
import { Fragment, type ReactNode } from "react";
import {
  PLATFORM_LABEL,
  SECTIONS,
  type Platform,
  type Report,
  type SectionKey,
  type Shot,
  type ShotSection,
} from "@/lib/types";
import { Badge, PLATFORM_BAR, PlatformIcon } from "./icons";

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

function inline(text: string): ReactNode[] {
  // **bold** markers, as used in the SWS reports.
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function Rich({ text }: { text: string }) {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <>
      {paras.map((p, i) => (
        <p key={i}>
          {p.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

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
  if (WIDE_KINDS.has(shot.kind)) return { maxW: 176, maxH: 110 };
  if (shot.kind === "content_overview") return { maxW: 150, maxH: 86 };
  return { maxW: 122, maxH: 78 };
}

function ShotImg({ shot, w, h }: { shot: Shot; w: number; h: number }) {
  return (
    <img
      className="rpt-shot"
      src={shot.dataUrl}
      alt={shot.fileName}
      style={{ width: `${w}mm`, height: `${h}mm` }}
    />
  );
}

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
  const sized =
    shots.length === 2
      ? shots.map((s) => ({ s, ...fit(s, 84, 74) }))
      : shots.map((s) => ({ s, ...fit(s, limitsFor(s).maxW, limitsFor(s).maxH) }));
  const showBadge = badge && platform;
  return (
    <div className="rpt-card-wrap" style={showBadge ? undefined : { paddingTop: "3mm" }}>
      <div className="rpt-card">
        {showBadge && <Badge platform={platform} style3d={badge3d} />}
        {sized.map(({ s, w, h }) => (
          <ShotImg key={s.id} shot={s} w={w} h={h} />
        ))}
      </div>
    </div>
  );
}

function Phone({ shot, platform, caption }: { shot: Shot; platform: Platform | null; caption: string }) {
  const { w, h } = fit(shot, 76, 150);
  return (
    <div className="rpt-phone-unit">
      <div className="rpt-phone-rings" />
      {platform && (
        <div className="rpt-phone-icon">
          <PlatformIcon platform={platform} />
        </div>
      )}
      <div className="rpt-phone">
        <img src={shot.dataUrl} alt={shot.fileName} style={{ width: `${w}mm`, height: `${h}mm` }} />
      </div>
      {caption && <div className="rpt-phone-caption">{caption}</div>}
    </div>
  );
}

/** Turns the screenshots of one platform in one section into units. */
function shotUnits(
  keyBase: string,
  shots: Shot[],
  platform: Platform | null,
  badge3d: boolean,
  phoneCaption: string,
  badge = true,
): Unit[] {
  const units: Unit[] = [];
  const grids = shots.filter((s) => s.kind === "profile_grid");
  const rest = shots.filter((s) => s.kind !== "profile_grid");
  // Two small charts for the same platform sit side by side, as in the template.
  const pairable =
    rest.length === 2 && rest.every((s) => !WIDE_KINDS.has(s.kind) && s.kind !== "content_overview");
  if (pairable) {
    units.push({
      key: `${keyBase}-pair`,
      shrinkable: true,
      node: <Card shots={rest} platform={platform} badge3d={badge3d} badge={badge} />,
    });
  } else {
    for (const s of rest) {
      units.push({
        key: `${keyBase}-${s.id}`,
        shrinkable: true,
        node: <Card shots={[s]} platform={platform} badge3d={badge3d} badge={badge} />,
      });
    }
  }
  for (const s of grids) {
    units.push({
      key: `${keyBase}-${s.id}`,
      node: <Phone shot={s} platform={platform} caption={phoneCaption} />,
    });
  }
  return units;
}

function MetricLines({ metrics }: { metrics: { label: string; value: string }[] }) {
  if (!metrics.length) return null;
  return (
    <div className="rpt-metrics">
      {metrics.map((m, i) => (
        <div key={i}>
          <strong>{m.label}:</strong>
          {m.value}
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
};

function shotsFor(report: Report, section: ShotSection, platform: Platform | null) {
  return report.shots
    .filter((s) => s.section === section && s.platform === platform)
    .sort((a, b) => a.order - b.order);
}

/** Platforms that appear in the report, in the order chosen on the cover. */
function orderedPlatforms(report: Report): Platform[] {
  const extra = report.shots
    .map((s) => s.platform)
    .filter((p): p is Platform => !!p && !report.platforms.includes(p));
  return [...report.platforms, ...new Set(extra)];
}

function buildExecutive(report: Report): Unit[] {
  const text = report.text?.executiveSummary;
  const units: Unit[] = [
    { key: "exec-text", node: text ? <Rich text={text} /> : <Placeholder /> },
  ];
  for (const p of [...orderedPlatforms(report), null]) {
    units.push(...shotUnits(`exec-${p}`, shotsFor(report, "executive", p), p, true, ""));
  }
  return units;
}

function buildMetricSection(report: Report, section: "reach" | "views" | "engagement" | "visits"): Unit[] {
  const units: Unit[] = [];
  for (const p of orderedPlatforms(report)) {
    const block = report.text?.blocks.find((b) => b.section === section && b.platform === p);
    const shots = shotsFor(report, section, p);
    if (!block && !shots.length) continue;
    const viewsMetric = block?.metrics.find((m) => /views/i.test(m.label) && !/second/i.test(m.label));
    const caption = viewsMetric ? `${PLATFORM_LABEL[p]} Views: ${viewsMetric.value}` : "";
    units.push({
      key: `${section}-${p}-intro`,
      keepWithNext: shots.length > 0,
      node: (
        <>
          <h2 className="rpt-platform-title">{PLATFORM_LABEL[p]}</h2>
          {block ? (
            <>
              <MetricLines metrics={block.metrics} />
              {block.text && <Rich text={block.text} />}
            </>
          ) : (
            <Placeholder />
          )}
        </>
      ),
    });
    units.push(...shotUnits(`${section}-${p}`, shots, p, BADGE_3D[section], caption));
  }
  units.push(...shotUnits(`${section}-none`, shotsFor(report, section, null), null, false, ""));
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
          <MetricLines metrics={a.metrics} />
          {a.gender.length > 0 && (
            <div className="rpt-metrics">
              <strong>Gender Split:</strong>
              {a.gender.map((g, i) => (
                <div key={i}>
                  {g.label}: {g.value}
                </div>
              ))}
            </div>
          )}
          {a.text && <Rich text={a.text} />}
        </>
      ) : (
        <Placeholder />
      ),
    });
    units.push(...shotUnits(`aud-${p}-demo`, demo, p, true, "", false));

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
                    {l.name} – {l.value}
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
                      {l.name} – {l.value}
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
    units.push(...shotUnits(`aud-${p}-locshots`, loc, p, true, "", false));
  }
  units.push(...shotUnits(`aud-none`, shotsFor(report, "audience", null), null, false, "", false));
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
                  <strong>{it.title} —</strong> {it.detail}
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
    units.push(...shotUnits(`top-${p}`, shots, p, false, ""));
  }
  units.push(...shotUnits(`top-none`, shotsFor(report, "top_content", null), null, false, ""));
  return units;
}

function buildFocus(report: Report): Unit[] {
  const focus = report.text?.focus ?? [];
  if (!focus.length) return report.text ? [] : [{ key: "focus-ph", node: <Placeholder /> }];
  return focus.map((f, i) => ({
    key: `focus-${i}`,
    node: (
      <div className="rpt-focus">
        <h3>{f.title}</h3>
        <div className="rpt-focus-body">
          <div>
            <strong>Current Situation:</strong>
            {f.situation}
          </div>
          <div>
            <strong>Implementation:</strong>
            {f.implementation}
          </div>
        </div>
      </div>
    ),
  }));
}

function buildConclusion(report: Report): Unit[] {
  const t = report.text?.conclusion;
  return [{ key: "conclusion", node: t ? <Rich text={t} /> : <Placeholder /> }];
}

/** All sections that have something to show, numbered in order. */
export function buildSections(report: Report): BuiltSection[] {
  const out: BuiltSection[] = [];
  for (const s of SECTIONS) {
    let units: Unit[];
    switch (s.key) {
      case "executive":
        units = buildExecutive(report);
        break;
      case "reach":
      case "views":
      case "engagement":
      case "visits":
        units = buildMetricSection(report, s.key);
        break;
      case "audience":
        units = buildAudience(report);
        break;
      case "top_content":
        units = buildTopContent(report);
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

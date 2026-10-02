"use client";
/* eslint-disable @next/next/no-img-element -- report pages are printed, plain <img> keeps them exact */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatMonth, formatPeriod, formatPlatforms, pad2 } from "@/lib/format";
import { SECTIONS, type Client, type Report } from "@/lib/types";
import { Footer, Star, WaveTop } from "./icons";
import { buildSections, HideChangesContext, type BuiltSection, type Unit } from "./units";
import "./report.css";
import { asset } from "@/lib/asset";

const MM = 96 / 25.4;
/** Usable height between the top wave and the footer wave. */
const CONTENT_HEIGHT_MM = 246;

/** Screenshots may shrink to this share of their size to fill a page. */
const MIN_SHRINK = 0.6;
/** ...or grow to use space a page would otherwise leave empty: phone mockups
 * a lot, desktop dashboard cards only a little so they match other pages. */
const MAX_GROW = { phone: 1.5, card: 1.15 };
/** A small card may grow further, up to this width (a wide card still only 1.15x). */
const CARD_GROW_WIDTH_MM = 130;
/** Width of the page body, which a grown screenshot must stay inside. */
const BODY_WIDTH_MM = 180;
/** Space above a section that starts part-way down a page. */
const SECTION_GAP_MM = 9;
/** A section only starts part-way down a page when at least this much room is left. */
const MIN_ROOM_FOR_SECTION = 0.3;

interface Placed {
  unit: Unit;
  scale: number;
  /** First unit of a section that starts below another one on the same page. */
  gapAbove?: boolean;
}

interface ContentPage {
  units: Placed[];
  /** Sections whose first unit is on this page. */
  starts: string[];
}

interface Measured {
  heights: Record<string, number>;
  /** Width of the growable part (screenshot card or phones) of a unit. */
  widths: Record<string, number>;
  /** Which kind of growable part a unit has. */
  kinds: Record<string, "phone" | "card">;
}

function paginate(sections: BuiltSection[], { heights, widths, kinds }: Measured): ContentPage[] {
  const cap = CONTENT_HEIGHT_MM * MM;
  const gap = SECTION_GAP_MM * MM;
  const pages: ContentPage[] = [];
  const height = (u: Unit) => heights[u.key] ?? 0;
  const minHeight = (u: Unit) => height(u) * (u.shrinkable ? MIN_SHRINK : 1);
  let cur: Placed[] = [];
  let starts: string[] = [];
  let used = 0;
  const newPage = () => {
    if (cur.length) pages.push({ units: cur, starts });
    cur = [];
    starts = [];
    used = 0;
  };
  for (const section of sections) {
    const units = section.units;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const h = height(u);
      // A heading or intro should not be left alone at the bottom of a page.
      let need = minHeight(u);
      for (let j = i; units[j]?.keepWithNext && units[j + 1]; j++) {
        need += minHeight(units[j + 1]);
        if (need > cap) break;
      }
      // If the group cannot fit even on an empty page, only the unit itself matters.
      if (need > cap) need = minHeight(u);
      const first = i === 0;
      if (first && cur.length) {
        // Start the section here only if its opening fits and enough of the page is left.
        const room = cap - used - gap;
        if (room < cap * MIN_ROOM_FOR_SECTION || need > room) newPage();
      } else if (cur.length && used + Math.min(need, cap) > cap) {
        newPage();
      }
      const gapAbove = first && cur.length > 0;
      if (gapAbove) used += gap;
      if (first) starts.push(section.key);
      // Shrink a screenshot a little rather than leave a half-empty page.
      const room = cap - used;
      const scale = u.shrinkable && h > room ? Math.max(MIN_SHRINK, room / h) : 1;
      cur.push({ unit: u, scale, gapAbove });
      used += h * scale;
    }
  }
  newPage();

  // Screenshots on a page with space left over grow (within the page width) to use it.
  for (const page of pages) {
    const total = page.units.reduce((t, p) => t + height(p.unit) * p.scale + (p.gapAbove ? gap : 0), 0);
    const spare = cap - total;
    const growable = page.units.filter((p) => p.scale === 1 && widths[p.unit.key]);
    const growH = growable.reduce((t, p) => t + height(p.unit), 0);
    if (spare < 12 * MM || !growH) continue;
    const factor = 1 + (spare * 0.96) / growH;
    for (const p of growable) {
      const byWidth = (BODY_WIDTH_MM * MM) / widths[p.unit.key];
      const kind = kinds[p.unit.key] ?? "card";
      const cap =
        kind === "phone"
          ? MAX_GROW.phone
          : Math.min(MAX_GROW.phone, Math.max(MAX_GROW.card, (CARD_GROW_WIDTH_MM * MM) / widths[p.unit.key]));
      p.scale = Math.max(1, Math.min(factor, byWidth, cap));
    }
  }
  return pages;
}

const TOC_PHOTO: Record<string, number> = {
  executive: 1,
  reach: 2,
  views: 3,
  engagement: 4,
  visits: 5,
  audience: 6,
  top_content: 7,
  activities: 5,
  focus: 8,
  conclusion: 9,
};
const TOC_IMAGE: Record<string, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.key, asset(`/template/toc/${TOC_PHOTO[s.key] ?? 1}.jpg`)]),
);
const TOC_COLOURS = ["c-blue", "c-orange", "c-sky"];

function Cover({ report, client }: { report: Report; client: Client | undefined }) {
  return (
    <section className="rpt-page rpt-cover">
      <img className="rpt-cover-photo" src={asset("/template/cover/photo.jpg")} alt="" />
      <div className="rpt-cover-bottom" />
      <div className="rpt-cover-glow" />
      <div className="rpt-cover-fade" />
      <img className="rpt-float" src={asset("/template/cover/float-app.png")} alt="" style={{ left: "176mm", top: "28mm", width: "28mm" }} />
      <img className="rpt-float" src={asset("/template/cover/float-spark.png")} alt="" style={{ left: "171mm", top: "118mm", width: "27mm" }} />
      <img className="rpt-float" src={asset("/template/cover/float-instagram.png")} alt="" style={{ left: "2mm", top: "158mm", width: "30mm" }} />
      <img className="rpt-float" src={asset("/template/cover/float-youtube.png")} alt="" style={{ left: "175mm", top: "212mm", width: "31mm" }} />
      <div className="rpt-cover-title">
        <span className="w social" data-text="SOCIAL">SOCIAL</span>
        <span className="w media" data-text="MEDIA">MEDIA</span>
        <span className="sub" data-text="PERFORMANCE REPORT">PERFORMANCE REPORT</span>
      </div>
      <div className="rpt-prep for">
        <div className="rpt-prep-label">Prepared for</div>
        {client?.logoDataUrl ? (
          <img src={client.logoDataUrl} alt={client.name} />
        ) : (
          <div style={{ fontWeight: 700, fontSize: "15pt", marginTop: "3mm" }}>{client?.name}</div>
        )}
      </div>
      <img className="rpt-float" src={asset("/template/cover/float-facebook.png")} alt="" style={{ left: "94mm", top: "167mm", width: "30mm" }} />
      <div className="rpt-prep by">
        <div className="rpt-prep-label">Prepared by</div>
        <img src={asset("/template/sws-logo.png")} alt="SWS Strategic Web Success" />
      </div>
      <div className="rpt-cover-info">
        <div>
          <b>Brand:</b>
          {client?.name ?? ""}
        </div>
        <div>
          <b>Reporting Period:</b>
          {formatPeriod(report.periodStart, report.periodEnd, client?.english ?? "en-GB")}
        </div>
        <div>
          <b>Prepared:</b>
          {formatMonth(report.preparedDate)}
        </div>
        <div>
          <b>Platforms:</b>
          {formatPlatforms(report.platforms)}
        </div>
      </div>
      <Footer page={1} />
    </section>
  );
}

function Contents({ sections, firstPage }: { sections: BuiltSection[]; firstPage: Record<string, number> }) {
  // Up to 10 sections must fit between the title and the footer (about 220mm).
  const rowHeight = Math.min(26, 220 / Math.max(sections.length, 1));
  return (
    <section className="rpt-page">
      <div className="rpt-toc-bars">
        <i style={{ background: "#f7941f" }} />
        <i style={{ background: "#1471b9" }} />
      </div>
      <div className="rpt-toc-title">
        <span>TABLE OF</span>
        <span className="c">CONTENTS</span>
      </div>
      <div className="rpt-toc-list">
        {sections.map((s, i) => (
          <div className="rpt-toc-row" key={s.key} style={{ height: `${rowHeight}mm` }}>
            <img src={TOC_IMAGE[s.key]} alt="" />
            <span className={`rpt-toc-num ${TOC_COLOURS[i % 3]}`}>{pad2(s.number)}</span>
            <span className="rpt-toc-name">{s.title}</span>
            <span className={`rpt-toc-page ${TOC_COLOURS[i % 3]}`}>{pad2(firstPage[s.key] ?? 0)}</span>
          </div>
        ))}
      </div>
      <Footer page={2} />
    </section>
  );
}

function ThankYou() {
  return (
    <section className="rpt-page rpt-thanks">
      <WaveTop />
      <Star x={8} y={10} size={44} color="#fdf2e4" />
      <Star x={150} y={185} size={46} color="#fdf2e4" />
      <Star x={126} y={36} size={12} color="#f7941f" />
      <Star x={118} y={44} size={7} color="#f7941f" />
      <Star x={104} y={52} size={4.5} color="#7aa7d8" />
      <Star x={99} y={56} size={3.6} color="#d9d9d9" />
      <img className="rpt-thanks-logo" src={asset("/template/sws-logo.png")} alt="SWS Strategic Web Success" />
      <div className="rpt-thanks-text">Thank you!</div>
      <Footer url={false} />
    </section>
  );
}

/**
 * The full A4 report. Units are measured off-screen, then packed into pages
 * so screenshots and text flow automatically whatever the client uploads.
 */
export default function ReportDocument({
  report,
  client,
  onPageCount,
}: {
  report: Report;
  client: Client | undefined;
  onPageCount?: (n: number) => void;
}) {
  const english = client?.english ?? "en-GB";
  const sections = useMemo(
    () => buildSections(report, formatPeriod(report.periodStart, report.periodEnd, english)),
    [report, english],
  );
  const measureRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const measure = useCallback(() => {
    const root = measureRef.current;
    if (!root) return;
    const heights: Record<string, number> = {};
    const widths: Record<string, number> = {};
    const kinds: Record<string, "phone" | "card"> = {};
    root.querySelectorAll<HTMLElement>("[data-unit]").forEach((el) => {
      heights[el.dataset.unit!] = el.getBoundingClientRect().height;
      const grow = el.querySelector<HTMLElement>("[data-grow]");
      if (grow) {
        widths[el.dataset.unit!] = grow.getBoundingClientRect().width;
        kinds[el.dataset.unit!] = grow.dataset.grow === "phone" ? "phone" : "card";
      }
    });
    const same = (a: Record<string, number>, b: Record<string, number>) =>
      Object.keys(a).length === Object.keys(b).length &&
      Object.entries(a).every(([k, v]) => Math.abs((b[k] ?? -1) - v) < 0.5);
    setMeasured((prev) => (prev && same(heights, prev.heights) && same(widths, prev.widths) ? prev : { heights, widths, kinds }));
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [sections, mounted, measure]);

  useLayoutEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
    };
  }, [measure]);

  const pages = useMemo(() => (measured ? paginate(sections, measured) : []), [sections, measured]);

  const firstPage: Record<string, number> = {};
  pages.forEach((p, i) => {
    for (const key of p.starts) firstPage[key] ??= i + 3;
  });

  const total = pages.length + 3;
  useLayoutEffect(() => {
    onPageCount?.(total);
  }, [total, onPageCount]);

  return (
    <HideChangesContext.Provider value={report.hideChanges !== false}>
    <div className="rpt">
      {mounted &&
        createPortal(
          // Measured outside the zoomed preview so heights are true A4 sizes.
          <div className="rpt rpt-measure" ref={measureRef} aria-hidden>
            {sections.flatMap((s) =>
              s.units.map((u) => (
                <div className="rpt-unit" data-unit={u.key} key={u.key}>
                  {u.node}
                </div>
              )),
            )}
          </div>,
          document.body,
        )}

      <Cover report={report} client={client} />
      <Contents sections={sections} firstPage={firstPage} />
      {pages.map((p, i) => (
        <section className="rpt-page" key={i}>
          <WaveTop />
          <div className="rpt-body">
            {p.units.map(({ unit, scale, gapAbove }) => (
              <div
                className="rpt-unit"
                key={unit.key}
                style={{
                  ...(scale !== 1 ? { zoom: scale } : null),
                  ...(gapAbove ? { marginTop: `${SECTION_GAP_MM / scale}mm` } : null),
                }}
              >
                {unit.node}
              </div>
            ))}
          </div>
          <Footer page={i + 3} />
        </section>
      ))}
      <ThankYou />
    </div>
    </HideChangesContext.Provider>
  );
}

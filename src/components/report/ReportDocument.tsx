"use client";
/* eslint-disable @next/next/no-img-element -- report pages are printed, plain <img> keeps them exact */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatMonth, formatPeriod, formatPlatforms, pad2 } from "@/lib/format";
import { SECTIONS, type Client, type Report } from "@/lib/types";
import { Footer, Star, WaveTop } from "./icons";
import { buildSections, type BuiltSection, type Unit } from "./units";
import "./report.css";

const MM = 96 / 25.4;
/** Usable height between the top wave and the footer wave. */
const CONTENT_HEIGHT_MM = 246;

/** Screenshots may shrink to this share of their size to fill a page. */
const MIN_SHRINK = 0.6;

interface Placed {
  unit: Unit;
  scale: number;
}

interface ContentPage {
  section: BuiltSection;
  units: Placed[];
}

function paginate(sections: BuiltSection[], heights: Record<string, number>): ContentPage[] {
  const cap = CONTENT_HEIGHT_MM * MM;
  const pages: ContentPage[] = [];
  const height = (u: Unit) => heights[u.key] ?? 0;
  const minHeight = (u: Unit) => height(u) * (u.shrinkable ? MIN_SHRINK : 1);
  for (const section of sections) {
    let cur: Placed[] = [];
    let used = 0;
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
      if (cur.length && used + Math.min(need, cap) > cap) {
        pages.push({ section, units: cur });
        cur = [];
        used = 0;
      }
      // Shrink a screenshot a little rather than leave a half-empty page.
      const room = cap - used;
      const scale = u.shrinkable && h > room ? Math.max(MIN_SHRINK, room / h) : 1;
      cur.push({ unit: u, scale });
      used += h * scale;
    }
    if (cur.length) pages.push({ section, units: cur });
  }
  return pages;
}

const TOC_IMAGE: Record<string, string> = Object.fromEntries(
  SECTIONS.map((s, i) => [s.key, `/template/toc/${i + 1}.jpg`]),
);
const TOC_COLOURS = ["c-blue", "c-orange", "c-sky"];

function Cover({ report, client }: { report: Report; client: Client | undefined }) {
  return (
    <section className="rpt-page rpt-cover">
      <img className="rpt-cover-photo" src="/template/cover/photo.jpg" alt="" />
      <div className="rpt-cover-bottom" />
      <div className="rpt-cover-glow" />
      <div className="rpt-cover-fade" />
      <img className="rpt-float" src="/template/cover/float-app.png" alt="" style={{ left: "176mm", top: "28mm", width: "28mm" }} />
      <img className="rpt-float" src="/template/cover/float-spark.png" alt="" style={{ left: "171mm", top: "118mm", width: "27mm" }} />
      <img className="rpt-float" src="/template/cover/float-instagram.png" alt="" style={{ left: "2mm", top: "158mm", width: "30mm" }} />
      <img className="rpt-float" src="/template/cover/float-youtube.png" alt="" style={{ left: "175mm", top: "212mm", width: "31mm" }} />
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
      <img className="rpt-float" src="/template/cover/float-facebook.png" alt="" style={{ left: "94mm", top: "167mm", width: "30mm" }} />
      <div className="rpt-prep by">
        <div className="rpt-prep-label">Prepared by</div>
        <img src="/template/sws-logo.png" alt="SWS Strategic Web Success" />
      </div>
      <div className="rpt-cover-info">
        <div>
          <b>Brand:</b>
          {client?.name ?? ""}
        </div>
        <div>
          <b>Reporting Period:</b>
          {formatPeriod(report.periodStart, report.periodEnd)}
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
  const rowHeight = sections.length > 9 ? 23 : 26;
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
      <img className="rpt-thanks-logo" src="/template/sws-logo.png" alt="SWS Strategic Web Success" />
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
  const sections = useMemo(() => buildSections(report), [report]);
  const measureRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number> | null>(null);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const measure = useCallback(() => {
    const root = measureRef.current;
    if (!root) return;
    const next: Record<string, number> = {};
    root.querySelectorAll<HTMLElement>("[data-unit]").forEach((el) => {
      next[el.dataset.unit!] = el.getBoundingClientRect().height;
    });
    setHeights((prev) => {
      if (prev && Object.keys(next).length === Object.keys(prev).length &&
          Object.entries(next).every(([k, v]) => Math.abs((prev[k] ?? -1) - v) < 0.5)) {
        return prev;
      }
      return next;
    });
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

  const pages = useMemo(() => (heights ? paginate(sections, heights) : []), [sections, heights]);

  const firstPage: Record<string, number> = {};
  pages.forEach((p, i) => {
    firstPage[p.section.key] ??= i + 3;
  });

  const total = pages.length + 3;
  useLayoutEffect(() => {
    onPageCount?.(total);
  }, [total, onPageCount]);

  return (
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
            {p.units.map(({ unit, scale }) => (
              <div className="rpt-unit" key={unit.key} style={scale < 1 ? { zoom: scale } : undefined}>
                {unit.node}
              </div>
            ))}
          </div>
          <Footer page={i + 3} />
        </section>
      ))}
      <ThankYou />
    </div>
  );
}

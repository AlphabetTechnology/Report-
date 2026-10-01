"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import DetailsPanel from "@/components/editor/DetailsPanel";
import ProofreadPanel from "@/components/editor/ProofreadPanel";
import ShotsPanel from "@/components/editor/ShotsPanel";
import TextPanel from "@/components/editor/TextPanel";
import ReportDocument from "@/components/report/ReportDocument";
import { ClientLogo } from "@/components/ClientForm";
import Icon, { type IconName } from "@/components/Icon";
import { formatMonth, formatPeriod, monthName } from "@/lib/format";
import { reportProgress } from "@/lib/progress";
import { getReport, listClients, saveReport } from "@/lib/store";
import type { Client, Report } from "@/lib/types";

const TABS: { key: "details" | "shots" | "text" | "proof"; label: string; icon: IconName }[] = [
  { key: "details", label: "Details", icon: "settings" },
  { key: "shots", label: "Screenshots", icon: "image" },
  { key: "text", label: "Text", icon: "pen" },
  { key: "proof", label: "Proofread", icon: "spell" },
];
type Tab = (typeof TABS)[number]["key"];

function Bar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar no-print">
      <Link className="btn ghost icon" href="/" title="Back to dashboard">
        <Icon name="arrowLeft" />
      </Link>
      {children}
    </header>
  );
}

const A4_WIDTH_PX = (210 * 96) / 25.4;

export default function ReportEditor() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("shots");
  const [saved, setSaved] = useState(true);
  const [pageCount, setPageCount] = useState(0);
  const [fitZoom, setFitZoom] = useState(0.8);
  const [zoomOverride, setZoomOverride] = useState<number | null>(null);
  const zoom = zoomOverride ?? fitZoom;
  const dirty = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getReport(id), listClients()]).then(([r, c]) => {
      setClients(c);
      if (!r) setMissing(true);
      else {
        setReport(r);
        if (r.shots.length && !r.text) setTab("text");
        else if (r.text) setTab("proof");
      }
    });
  }, [id]);

  const update = useCallback((fn: (r: Report) => Report) => {
    dirty.current = true;
    setSaved(false);
    setReport((r) => (r ? { ...fn(r), updatedAt: Date.now() } : r));
  }, []);

  // Autosave shortly after each change.
  useEffect(() => {
    if (!report || !dirty.current) return;
    const t = setTimeout(() => {
      saveReport(report).then(() => {
        dirty.current = false;
        setSaved(true);
      });
    }, 600);
    return () => clearTimeout(t);
  }, [report]);

  // Fit the A4 preview to the available width.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setFitZoom(Math.min(1, (entry.contentRect.width - 48) / A4_WIDTH_PX));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [report === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  if (missing) {
    return (
      <>
        <Bar />
        <main className="main">
          <div className="empty-state">
            This report is not in this browser. <Link href="/">Back to reports</Link>
          </div>
        </main>
      </>
    );
  }
  if (!report) return <Bar />;

  const client = clients.find((c) => c.id === report.clientId);

  function downloadPdf() {
    // The browser's "Save as PDF" uses the page title as the file name,
    // e.g. September_2026_Aakaar_SM_report.
    const original = document.title;
    const name = (client?.name ?? "Client").replace(/[^\w]+/g, "_");
    document.title = `${monthName(report!.periodStart)}_${report!.periodStart.slice(0, 4)}_${name}_SM_report`;
    window.print();
    document.title = original;
  }

  const progress = reportProgress(report);
  const tabDone: Record<Tab, boolean> = {
    details: true,
    shots: progress.shots,
    text: progress.text,
    proof: progress.proofread,
  };
  const unplaced = report.shots.filter((s) => s.status === "done" && !s.platform).length;

  return (
    <>
      <Bar>
        <div className="who">
          <ClientLogo client={client} size={38} />
          <div style={{ minWidth: 0 }}>
            <strong>
              {client?.name} · {formatMonth(report.periodStart)}
            </strong>
            <small>{formatPeriod(report.periodStart, report.periodEnd, client?.english ?? "en-GB")}</small>
          </div>
        </div>
        <div className="spacer" />
        <span className={`chip ${progress.proofread ? "green" : progress.text ? "orange" : "blue"}`}>
          <span className="dot" />
          {progress.label}
        </span>
        <span className={`save-state${saved ? " ok" : ""}`}>
          {saved ? <Icon name="checkCircle" size={15} /> : <span className="spinner" style={{ width: 12, height: 12 }} />}
          {saved ? "Saved" : "Saving"} · {pageCount} pages
        </span>
        <button className="btn accent" onClick={downloadPdf}>
          <Icon name="download" size={16} />
          Download PDF
        </button>
      </Bar>
      <div className="editor">
        <aside className="editor-side no-print">
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.key} className={`tab${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
                <Icon name={t.icon} size={17} />
                {t.label}
                {t.key === "proof" && report.suggestions.length > 0 ? (
                  <span className="badge">{report.suggestions.length}</span>
                ) : (
                  t.key !== "details" &&
                  tabDone[t.key] && (
                    <span className="done">
                      <Icon name="check" size={9} stroke={4} />
                    </span>
                  )
                )}
              </button>
            ))}
          </nav>
          <div className="side-body">
            {tab === "details" && (
              <DetailsPanel
                report={report}
                client={client}
                clients={clients}
                update={update}
                onClientSaved={(c) => setClients((cs) => cs.map((x) => (x.id === c.id ? c : x)))}
              />
            )}
            {tab === "shots" && (
              <>
                {unplaced > 0 && (
                  <div className="notice warn">
                    {unplaced} screenshot(s) have no platform. Pick one so they appear in the right place.
                  </div>
                )}
                <ShotsPanel report={report} update={update} />
              </>
            )}
            {tab === "text" && <TextPanel report={report} client={client} update={update} />}
            {tab === "proof" && <ProofreadPanel report={report} client={client} update={update} />}
          </div>
          <div className="side-foot">
            <p className="small muted" style={{ margin: 0 }}>
              Download PDF opens the print window: choose <strong>Save as PDF</strong>, paper A4, margins None, and tick{" "}
              <strong>Background graphics</strong>.
            </p>
          </div>
        </aside>
        <div className="preview" ref={previewRef}>
          <div className="zoom-bar no-print">
            <div>
              <button className="btn small ghost icon" title="Zoom out" onClick={() => setZoomOverride(Math.max(0.3, zoom - 0.1))}>
                <Icon name="zoomOut" size={16} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button className="btn small ghost icon" title="Zoom in" onClick={() => setZoomOverride(Math.min(2, zoom + 0.1))}>
                <Icon name="zoomIn" size={16} />
              </button>
              <button className="btn small ghost" onClick={() => setZoomOverride(null)}>
                Fit
              </button>
            </div>
          </div>
          <div className="preview-inner" style={{ zoom }}>
            <ReportDocument report={report} client={client} onPageCount={setPageCount} />
          </div>
        </div>
      </div>
    </>
  );
}

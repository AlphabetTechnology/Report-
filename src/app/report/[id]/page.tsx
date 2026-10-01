"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import DetailsPanel from "@/components/editor/DetailsPanel";
import ProofreadPanel from "@/components/editor/ProofreadPanel";
import ShotsPanel from "@/components/editor/ShotsPanel";
import TextPanel from "@/components/editor/TextPanel";
import ReportDocument from "@/components/report/ReportDocument";
import TopBar from "@/components/TopBar";
import { formatMonth, monthName } from "@/lib/format";
import { getReport, listClients, saveReport } from "@/lib/store";
import type { Client, Report } from "@/lib/types";

const TABS = [
  { key: "details", label: "Details" },
  { key: "shots", label: "Screenshots" },
  { key: "text", label: "Text" },
  { key: "proof", label: "Proofread" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const A4_WIDTH_PX = (210 * 96) / 25.4;

export default function ReportEditor() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("shots");
  const [saved, setSaved] = useState(true);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(0.8);
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
      setZoom(Math.min(1, (entry.contentRect.width - 48) / A4_WIDTH_PX));
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
        <TopBar />
        <main className="page-wrap">
          <div className="panel empty-state">
            This report is not in this browser. <Link href="/">Back to reports</Link>
          </div>
        </main>
      </>
    );
  }
  if (!report) return <TopBar />;

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

  const unplaced = report.shots.filter((s) => s.status === "done" && !s.platform).length;

  return (
    <>
      <TopBar>
        <span className="crumb">/</span>
        <strong>
          {client?.name} — {formatMonth(report.periodStart)}
        </strong>
        <div className="spacer" />
        <span className="small muted">
          {saved ? "Saved" : "Saving…"} · {pageCount} pages
        </span>
        <button className="btn primary" onClick={downloadPdf}>
          Download PDF
        </button>
      </TopBar>
      <div className="editor">
        <aside className="editor-side no-print">
          <nav className="tabs">
            {TABS.map((t, i) => (
              <button key={t.key} className={`tab${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
                <span className="n">{i + 1}</span>
                {t.label}
                {t.key === "proof" && report.suggestions.length > 0 && (
                  <span className="chip orange">{report.suggestions.length}</span>
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
          <div className="no-print" style={{ padding: "10px 18px", borderTop: "1px solid var(--line)" }}>
            <p className="small muted" style={{ margin: 0 }}>
              Download PDF opens the print window: choose <strong>Save as PDF</strong>, paper A4, margins None, and tick{" "}
              <strong>Background graphics</strong>.
            </p>
          </div>
        </aside>
        <div className="preview" ref={previewRef}>
          <div className="preview-inner" style={{ zoom }}>
            <ReportDocument report={report} client={client} onPageCount={setPageCount} />
          </div>
        </div>
      </div>
    </>
  );
}

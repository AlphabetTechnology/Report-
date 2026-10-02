"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import DetailsPanel from "@/components/editor/DetailsPanel";
import ProofreadPanel from "@/components/editor/ProofreadPanel";
import ShotsPanel from "@/components/editor/ShotsPanel";
import TextPanel from "@/components/editor/TextPanel";
import UpdateReport, { isOutdated } from "@/components/editor/UpdateReport";
import ReportDocument from "@/components/report/ReportDocument";
import { ClientLogo } from "@/components/ClientForm";
import Icon, { type IconName } from "@/components/Icon";
import { openSettings } from "@/components/SettingsDialog";
import SyncBadge from "@/components/SyncBadge";
import { formatUsd, SPEND_EVENT } from "@/lib/cost";
import { formatMonth, formatPeriod, monthName } from "@/lib/format";
import { reportProgress } from "@/lib/progress";
import { missingShots } from "@/lib/guide";
import { DATA_CHANGED, getReport, listClients, saveReport } from "@/lib/store";
import { PLATFORM_LABEL, type Client, type Report } from "@/lib/types";

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
  const id = useSearchParams().get("id") ?? "";
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
  const reportRef = useRef<Report | null>(null);
  const [updating, setUpdating] = useState(false);
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

  // A colleague changed this report and Drive sync brought it in: show it,
  // unless there are unsaved edits here (those win and sync back up).
  useEffect(() => {
    const onChange = (e: Event) => {
      const ids = (e as CustomEvent<{ ids: string[] }>).detail?.ids ?? [];
      if (dirty.current) return;
      if (ids.includes(id)) {
        getReport(id).then((r) => (r ? setReport(r) : setMissing(true)));
      }
      listClients().then(setClients);
    };
    window.addEventListener(DATA_CHANGED, onChange);
    return () => window.removeEventListener(DATA_CHANGED, onChange);
  }, [id]);

  const update = useCallback((fn: (r: Report) => Report) => {
    dirty.current = true;
    setSaved(false);
    setReport((r) => (r ? { ...fn(r), updatedAt: Date.now() } : r));
  }, []);

  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  // Claude calls made while this report is open are its cost.
  useEffect(() => {
    const onSpend = (e: Event) => {
      const usd = (e as CustomEvent<{ usd: number }>).detail?.usd ?? 0;
      if (usd) update((r) => ({ ...r, aiCost: (r.aiCost ?? 0) + usd }));
    };
    window.addEventListener(SPEND_EVENT, onSpend);
    return () => window.removeEventListener(SPEND_EVENT, onSpend);
  }, [update]);

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
    const missing = missingShots(report!);
    if (missing.length) {
      alert(
        `This report can't be downloaded yet: ${missing.length} required screenshot${missing.length === 1 ? " is" : "s are"} missing.\n\n` +
          missing.map((g) => `• ${PLATFORM_LABEL[g.platform]}: ${g.label}`).join("\n") +
          "\n\nUpload them in the Screenshots tab, or mark one Not available there if this client doesn't have it.",
      );
      setTab("shots");
      return;
    }
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
          {report.aiCost ? (
            <span title="Claude usage on this report so far (estimated from Anthropic's prices)"> · AI {formatUsd(report.aiCost)}</span>
          ) : null}
        </span>
        <button
          className="btn ghost"
          title="Re-read screenshots, rewrite and proofread with the latest version of the tool"
          disabled={!report.shots.length}
          onClick={() => setUpdating(true)}
        >
          <Icon name="refresh" size={16} />
          Update report
        </button>
        <SyncBadge />
        <button className="btn ghost icon" title="Integrations: Claude & Google Drive" onClick={openSettings}>
          <Icon name="link" size={17} />
        </button>
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
          {isOutdated(report) && (
            <div className="outdated-bar">
              <Icon name="sparkles" size={16} />
              <span style={{ flex: 1 }}>Made with an older version of the tool. Update to get the latest improvements.</span>
              <button className="btn small accent" onClick={() => setUpdating(true)}>
                Update
              </button>
            </div>
          )}
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
      {updating && (
        <UpdateReport
          report={report}
          latest={() => reportRef.current ?? report}
          client={client}
          update={update}
          onClose={() => setUpdating(false)}
          onReview={() => {
            setUpdating(false);
            setTab("proof");
          }}
        />
      )}
    </>
  );
}

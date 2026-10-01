"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ClientForm, { ClientLogo, ENGLISH_LABEL } from "@/components/ClientForm";
import DateField from "@/components/DateField";
import Icon, { type IconName } from "@/components/Icon";
import { PlatformIcon } from "@/components/report/icons";
import { formatMonth, formatPeriod, formatShortDate, MONTH_NAMES, previousMonth, toIso } from "@/lib/format";
import { reportProgress } from "@/lib/progress";
import {
  deleteClient,
  deleteReport,
  exportAll,
  importAll,
  listClients,
  listReports,
  newId,
  saveReport,
} from "@/lib/store";
import { PLATFORM_LABEL, PLATFORMS, type Client, type Platform, type Report } from "@/lib/types";

type View = "dashboard" | "reports" | "clients";
type Filter = "all" | "progress" | "ready";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/* ---------------- new report modal ---------------- */

function NewReportForm({
  clients,
  initialClientId,
  onClose,
}: {
  clients: Client[];
  initialClientId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const prev = previousMonth();
  const [clientId, setClientId] = useState(initialClientId ?? clients[0]?.id ?? "");
  const [start, setStart] = useState(prev.start);
  const [end, setEnd] = useState(prev.end);
  const [platforms, setPlatforms] = useState<Platform[]>(["facebook", "instagram"]);
  const client = clients.find((c) => c.id === clientId);
  const english = client?.english ?? "en-GB";
  const [y, m] = start.split("-").map(Number);
  const thisYear = new Date().getFullYear();

  function setMonth(year: number, month: number) {
    setStart(toIso(new Date(year, month - 1, 1)));
    setEnd(toIso(new Date(year, month, 0)));
  }

  async function create() {
    const now = Date.now();
    const report: Report = {
      id: newId(),
      clientId,
      periodStart: start,
      periodEnd: end,
      preparedDate: toIso(new Date()),
      platforms,
      shots: [],
      text: null,
      suggestions: [],
      createdAt: now,
      updatedAt: now,
    };
    await saveReport(report);
    router.push(`/report/${report.id}`);
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div className="ic">
            <Icon name="file" />
          </div>
          <div>
            <h2>New report</h2>
            <p>Pick the client, month and platforms. You can change these later.</p>
          </div>
        </div>
        <div className="modal-body">
          <label className="field">
            <span>Client</span>
            <select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Reporting month</span>
            <div className="row">
              <select className="select" value={m} onChange={(e) => setMonth(y, +e.target.value)}>
                {MONTH_NAMES.map((n, i) => (
                  <option key={n} value={i + 1}>
                    {n}
                  </option>
                ))}
              </select>
              <select className="select" style={{ width: 110 }} value={y} onChange={(e) => setMonth(+e.target.value, m)}>
                {[thisYear - 2, thisYear - 1, thisYear, thisYear + 1].map((yy) => (
                  <option key={yy} value={yy}>
                    {yy}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <DateField label="From" english={english} value={start} onChange={setStart} />
            </div>
            <div style={{ flex: 1 }}>
              <DateField label="To" english={english} value={end} onChange={setEnd} />
            </div>
          </div>
          <div className="notice" style={{ marginTop: -4 }}>
            <Icon name="calendar" size={16} />
            <span>
              Cover will read <strong>{formatPeriod(start, end, english)}</strong> ({ENGLISH_LABEL[english]} style)
            </span>
          </div>
          <div className="field">
            <span>Platforms</span>
            <div className="row wrap">
              {PLATFORMS.map((p) => {
                const on = platforms.includes(p);
                return (
                  <label key={p} className={`check${on ? " on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      hidden
                      onChange={() =>
                        setPlatforms(
                          on ? platforms.filter((x) => x !== p) : PLATFORMS.filter((x) => x === p || platforms.includes(x)),
                        )
                      }
                    />
                    <span className="pi">
                      <PlatformIcon platform={p} />
                    </span>
                    {PLATFORM_LABEL[p]}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!clientId || !platforms.length || !start || !end} onClick={create}>
            Create report
            <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- cards ---------------- */

function ReportCard({
  report,
  client,
  onDuplicate,
  onDelete,
}: {
  report: Report;
  client: Client | undefined;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const english = client?.english ?? "en-GB";
  const p = reportProgress(report);
  const steps: [string, boolean][] = [
    ["Screenshots", p.shots],
    ["Text", p.text],
    ["Proofread", p.proofread],
  ];
  return (
    <div className="r-card">
      <div className="top">
        <div className="month">
          {MONTH_NAMES[Number(report.periodStart.slice(5, 7)) - 1]}
          <small>{report.periodStart.slice(0, 4)}</small>
        </div>
      </div>
      <div className="logo-wrap">
        <ClientLogo client={client} size={52} />
      </div>
      <div className="body">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Link className="name" href={`/report/${report.id}`}>
              {client?.name ?? "Unknown client"}
            </Link>
            <div className="period">{formatPeriod(report.periodStart, report.periodEnd, english)}</div>
          </div>
          <span className={`chip ${p.proofread ? "green" : p.text ? "orange" : "blue"}`}>
            <span className="dot" />
            {p.label}
          </span>
        </div>
        <div className="plat-icons">
          {report.platforms.map((pl) => (
            <span key={pl} title={PLATFORM_LABEL[pl]}>
              <PlatformIcon platform={pl} />
            </span>
          ))}
          <span style={{ width: "auto", padding: "0 8px", fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>
            <Icon name="image" size={13} />
            &nbsp;{report.shots.length}
          </span>
        </div>
        <div className="steps">
          {steps.map(([label, done], i) => (
            <span key={label} style={{ display: "contents" }}>
              {i > 0 && <span className="ln" />}
              <span className={`s${done ? " done" : ""}`}>
                <i>{done && <Icon name="check" size={10} stroke={3.5} />}</i>
                {label}
              </span>
            </span>
          ))}
        </div>
        <div className="progress">
          <b className={p.percent === 100 ? "full" : ""} style={{ width: `${Math.max(p.percent, 4)}%` }} />
        </div>
      </div>
      <div className="foot">
        <span className="when">
          <Icon name="clock" size={13} />
          Edited {formatShortDate(toIso(new Date(report.updatedAt)), english)}
        </span>
        <button className="btn small ghost icon" title="Duplicate" onClick={onDuplicate}>
          <Icon name="copy" size={15} />
        </button>
        <button className="btn small ghost icon danger" title="Delete" onClick={onDelete}>
          <Icon name="trash" size={15} />
        </button>
        <Link className="btn small primary" href={`/report/${report.id}`}>
          Open
          <Icon name="arrowRight" size={14} />
        </Link>
      </div>
    </div>
  );
}

function Kpi({ icon, value, label, bg }: { icon: IconName; value: number; label: string; bg: string }) {
  return (
    <div className="kpi">
      <div className="ic" style={{ background: bg }}>
        <Icon name={icon} size={22} />
      </div>
      <div>
        <div className="num">{value}</div>
        <div className="lbl">{label}</div>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function Home() {
  const [clients, setClients] = useState<Client[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [creating, setCreating] = useState<{ clientId?: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [c, r] = await Promise.all([listClients(), listReports()]);
    setClients(c);
    setReports(r);
    setLoaded(true);
  }

  useEffect(() => {
    // Initial load from IndexedDB.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return {
      total: reports.length,
      month: reports.filter((r) => toIso(new Date(r.createdAt)).startsWith(thisMonth)).length,
      ready: reports.filter((r) => reportProgress(r).proofread).length,
      clients: clients.length,
    };
  }, [reports, clients]);

  const visibleReports = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      const c = clientById.get(r.clientId);
      const text = `${c?.name ?? ""} ${formatMonth(r.periodStart)}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      const ready = reportProgress(r).proofread;
      if (filter === "ready" && !ready) return false;
      if (filter === "progress" && ready) return false;
      return true;
    });
  }, [reports, clientById, query, filter]);

  async function duplicate(r: Report) {
    const now = new Date().getTime();
    await saveReport({ ...structuredClone(r), id: newId(), createdAt: now, updatedAt: now });
    refresh();
  }

  async function removeReport(r: Report) {
    const name = clientById.get(r.clientId)?.name ?? "this client";
    if (!confirm(`Delete the ${formatMonth(r.periodStart)} report for ${name}? This cannot be undone.`)) return;
    await deleteReport(r.id);
    refresh();
  }

  async function removeClient(c: Client) {
    const count = reports.filter((r) => r.clientId === c.id).length;
    if (count) {
      alert(`${c.name} has ${count} report(s). Delete those first.`);
      return;
    }
    if (!confirm(`Delete client ${c.name}?`)) return;
    await deleteClient(c.id);
    refresh();
  }

  async function backup() {
    const blob = new Blob([await exportAll()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sws-reports-backup-${toIso(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      const n = await importAll(await file.text());
      alert(`Imported ${n} items.`);
      refresh();
    } catch {
      alert("That file is not a Report Builder backup.");
    }
  }

  const newReport = () => (clients.length ? setCreating({}) : setEditing("new"));

  const reportsBlock = (limit?: number) => {
    const list = limit ? visibleReports.slice(0, limit) : visibleReports;
    if (!loaded) return null;
    if (!reports.length) {
      return (
        <div className="empty-state">
          <div className="ic">
            <Icon name="file" size={26} />
          </div>
          <h3>No reports yet</h3>
          <p>{clients.length ? "Create your first report: it takes a few minutes." : "Add a client first, then create a report."}</p>
          <button className="btn primary" onClick={newReport}>
            <Icon name="plus" size={16} />
            {clients.length ? "New report" : "Add client"}
          </button>
        </div>
      );
    }
    if (!list.length) return <div className="empty-state">No reports match.</div>;
    return (
      <div className="grid-cards">
        {list.map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            client={clientById.get(r.clientId)}
            onDuplicate={() => duplicate(r)}
            onDelete={() => removeReport(r)}
          />
        ))}
      </div>
    );
  };

  const clientsBlock = (
    <div className="grid-cards">
      {clients.map((c) => {
        const count = reports.filter((r) => r.clientId === c.id).length;
        return (
          <div className="c-card" key={c.id}>
            <div className="head">
              <ClientLogo client={c} size={60} />
              <div style={{ minWidth: 0 }}>
                <div className="name">{c.name}</div>
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  <span className="chip">{ENGLISH_LABEL[c.english]}</span>
                  <span className="chip blue">
                    {count} report{count === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>
            <div className="desc">{c.description || "No description yet. Add one so Claude writes more relevant text."}</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn small primary" onClick={() => setCreating({ clientId: c.id })}>
                <Icon name="plus" size={14} />
                New report
              </button>
              <button className="btn small" onClick={() => setEditing(c)}>
                <Icon name="edit" size={14} />
                Edit
              </button>
              <div className="spacer" />
              <button className="btn small ghost icon danger" title="Delete client" onClick={() => removeClient(c)}>
                <Icon name="trash" size={15} />
              </button>
            </div>
          </div>
        );
      })}
      {loaded && !clients.length && (
        <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
          <div className="ic">
            <Icon name="users" size={26} />
          </div>
          <h3>No clients yet</h3>
          <p>Add a client with their logo and UK or US English.</p>
          <button className="btn primary" onClick={() => setEditing("new")}>
            <Icon name="plus" size={16} />
            Add client
          </button>
        </div>
      )}
    </div>
  );

  const toolbar = (
    <>
      <div className="search">
        <Icon name="search" size={16} />
        <input className="input" placeholder="Search client or month" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="seg">
        {(
          [
            ["all", "All"],
            ["progress", "In progress"],
            ["ready", "Ready"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand-tile" href="/">
          <img src="/template/sws-logo.png" alt="SWS" />
          <div>
            Report Builder
            <small>Social media reports</small>
          </div>
        </Link>
        <div className="nav-label">Workspace</div>
        {(
          [
            ["dashboard", "home", "Dashboard", null],
            ["reports", "file", "Reports", reports.length],
            ["clients", "users", "Clients", clients.length],
          ] as const
        ).map(([key, icon, label, count]) => (
          <button key={key} className={`nav-item${view === key ? " on" : ""}`} onClick={() => setView(key)}>
            <Icon name={icon} size={18} />
            {label}
            {count !== null && <span className="count">{count}</span>}
          </button>
        ))}
        <div className="nav-label" style={{ marginTop: 22 }}>
          Data
        </div>
        <button className="nav-item" onClick={backup}>
          <Icon name="download" size={18} />
          Export backup
        </button>
        <button className="nav-item" onClick={() => importRef.current?.click()}>
          <Icon name="upload" size={18} />
          Import backup
        </button>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
        <div className="sidebar-foot">
          Reports are saved in this browser. Export a backup to share them with a colleague.
        </div>
      </aside>

      <main className="main">
        {view === "dashboard" && (
          <>
            <section className="hero">
              <div>
                <span className="eyebrow">
                  <Icon name="sparkles" size={14} />
                  AI-powered by Claude
                </span>
                <h1>
                  {greeting()}. <br />
                  Screenshots in, <em>client-ready report</em> out.
                </h1>
                <p>
                  Drop in the month&apos;s Facebook, Instagram, TikTok and YouTube screenshots. Claude sorts them, writes
                  the commentary and proofreads it, all in the SWS template.
                </p>
                <div className="row">
                  <button className="btn accent lg" onClick={newReport}>
                    <Icon name="plus" size={18} />
                    New report
                  </button>
                  <button className="btn glass lg" onClick={() => setEditing("new")}>
                    <Icon name="users" size={18} />
                    Add client
                  </button>
                </div>
              </div>
              <div className="hero-art">
                <div className="mini-cover" style={{ right: 96, top: 14, transform: "rotate(-8deg)", opacity: 0.85 }}>
                  <img src="/template/cover/photo.jpg" alt="" />
                  <div className="t">
                    <b>SOCIAL</b>
                    <i>MEDIA</i>
                  </div>
                  <div className="wave" />
                </div>
                <div className="mini-cover" style={{ right: 14, top: 0, transform: "rotate(5deg)" }}>
                  <img src="/template/cover/photo.jpg" alt="" />
                  <div className="t">
                    <b>SOCIAL</b>
                    <i>MEDIA</i>
                  </div>
                  <div className="wave" />
                </div>
              </div>
            </section>

            <div className="kpis">
              <Kpi icon="file" value={stats.total} label="Reports" bg="var(--grad-brand)" />
              <Kpi icon="calendar" value={stats.month} label="Created this month" bg="linear-gradient(135deg,#7b61ff,#a78bfa)" />
              <Kpi icon="checkCircle" value={stats.ready} label="Ready to send" bg="linear-gradient(135deg,#12a35f,#3cc985)" />
              <Kpi icon="users" value={stats.clients} label="Clients" bg="var(--grad-orange)" />
            </div>

            <div className="section-head">
              <div>
                <h2>Recent reports</h2>
                <div className="sub">Pick up where you left off</div>
              </div>
              <div className="spacer" />
              {reports.length > 6 && (
                <button className="btn small ghost" onClick={() => setView("reports")}>
                  View all
                  <Icon name="arrowRight" size={14} />
                </button>
              )}
            </div>
            {reportsBlock(6)}

            <div className="section-head">
              <div>
                <h2>Clients</h2>
                <div className="sub">Logos, language and date style for each brand</div>
              </div>
              <div className="spacer" />
              <button className="btn small" onClick={() => setEditing("new")}>
                <Icon name="plus" size={14} />
                Add client
              </button>
            </div>
            {clientsBlock}
          </>
        )}

        {view === "reports" && (
          <>
            <div className="section-head" style={{ marginTop: 4 }}>
              <div>
                <h2>Reports</h2>
                <div className="sub">{reports.length} in total</div>
              </div>
              <div className="spacer" />
              {toolbar}
              <button className="btn primary" onClick={newReport}>
                <Icon name="plus" size={16} />
                New report
              </button>
            </div>
            {reportsBlock()}
          </>
        )}

        {view === "clients" && (
          <>
            <div className="section-head" style={{ marginTop: 4 }}>
              <div>
                <h2>Clients</h2>
                <div className="sub">{clients.length} brands</div>
              </div>
              <div className="spacer" />
              <button className="btn primary" onClick={() => setEditing("new")}>
                <Icon name="plus" size={16} />
                Add client
              </button>
            </div>
            {clientsBlock}
          </>
        )}
      </main>

      {editing && (
        <ClientForm
          client={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {creating && (
        <NewReportForm clients={clients} initialClientId={creating.clientId} onClose={() => setCreating(null)} />
      )}
    </div>
  );
}

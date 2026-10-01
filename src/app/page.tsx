"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ClientForm, { ClientLogo } from "@/components/ClientForm";
import TopBar from "@/components/TopBar";
import { formatMonth, formatPeriod, formatPlatforms, previousMonth, toIso } from "@/lib/format";
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

function NewReportForm({ clients, onClose }: { clients: Client[]; onClose: () => void }) {
  const router = useRouter();
  const prev = previousMonth();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [start, setStart] = useState(prev.start);
  const [end, setEnd] = useState(prev.end);
  const [platforms, setPlatforms] = useState<Platform[]>(["facebook", "instagram"]);

  function setMonth(value: string) {
    // value is "yyyy-mm"
    const [y, m] = value.split("-").map(Number);
    setStart(toIso(new Date(y, m - 1, 1)));
    setEnd(toIso(new Date(y, m, 0)));
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
        <h2>New report</h2>
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
        <label className="field">
          <span>Reporting month</span>
          <input className="input" type="month" value={start.slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <div className="row">
          <label className="field" style={{ flex: 1 }}>
            <span>From</span>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>To</span>
            <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
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
                      setPlatforms(on ? platforms.filter((x) => x !== p) : PLATFORMS.filter((x) => x === p || platforms.includes(x)))
                    }
                  />
                  {PLATFORM_LABEL[p]}
                </label>
              );
            })}
          </div>
        </div>
        <div className="row">
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!clientId || !platforms.length || !start || !end} onClick={create}>
            Create report
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [clients, setClients] = useState<Client[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [creating, setCreating] = useState(false);
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

  const clientById = new Map(clients.map((c) => [c.id, c]));

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

  return (
    <>
      <TopBar>
        <div className="spacer" />
        <button className="btn small ghost" onClick={backup}>
          Export backup
        </button>
        <button className="btn small ghost" onClick={() => importRef.current?.click()}>
          Import backup
        </button>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
      </TopBar>
      <main className="page-wrap">
        <div className="section-head" style={{ marginTop: 0 }}>
          <h2>Reports</h2>
          <div className="spacer" />
          <button
            className="btn primary"
            disabled={!clients.length}
            title={clients.length ? "" : "Add a client first"}
            onClick={() => setCreating(true)}
          >
            + New report
          </button>
        </div>
        <div className="panel">
          {!loaded ? (
            <div className="empty-state">Loading…</div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              {clients.length
                ? "No reports yet. Click “New report” to start."
                : "Start by adding a client below, then create a report."}
            </div>
          ) : (
            reports.map((r) => {
              const c = clientById.get(r.clientId);
              return (
                <div className="report-row" key={r.id}>
                  <ClientLogo client={c} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/report/${r.id}`} style={{ fontWeight: 700, textDecoration: "none" }}>
                      {c?.name ?? "Unknown client"} — {formatMonth(r.periodStart)}
                    </Link>
                    <div className="small muted">
                      {formatPeriod(r.periodStart, r.periodEnd)} · {formatPlatforms(r.platforms)} · {r.shots.length} screenshots
                    </div>
                  </div>
                  <span className={`chip ${r.text ? "green" : ""}`}>{r.text ? "Text written" : "Draft"}</span>
                  <Link className="btn small" href={`/report/${r.id}`}>
                    Open
                  </Link>
                  <button className="btn small ghost" onClick={() => duplicate(r)}>
                    Duplicate
                  </button>
                  <button className="btn small ghost danger" onClick={() => removeReport(r)}>
                    Delete
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="section-head">
          <h2>Clients</h2>
          <div className="spacer" />
          <button className="btn" onClick={() => setEditing("new")}>
            + Add client
          </button>
        </div>
        <div className="cards">
          {clients.map((c) => (
            <div className="panel client-card" key={c.id}>
              <ClientLogo client={c} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div className="small muted">{c.english === "en-GB" ? "UK English" : "US English"}</div>
                <div className="row" style={{ gap: 4, marginTop: 6 }}>
                  <button className="btn small" onClick={() => setEditing(c)}>
                    Edit
                  </button>
                  <button className="btn small ghost danger" onClick={() => removeClient(c)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {loaded && !clients.length && <div className="panel empty-state">No clients yet.</div>}
        </div>
        <p className="small muted" style={{ marginTop: 30 }}>
          Clients and reports are saved in this browser. Use “Export backup” to move them to another computer or share
          them with a colleague.
        </p>
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
      {creating && <NewReportForm clients={clients} onClose={() => setCreating(false)} />}
    </>
  );
}

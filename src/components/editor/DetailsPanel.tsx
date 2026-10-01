"use client";

import { useState } from "react";
import ClientForm, { ClientLogo } from "@/components/ClientForm";
import { PLATFORM_LABEL, PLATFORMS, type Client, type Report } from "@/lib/types";

export default function DetailsPanel({
  report,
  client,
  clients,
  update,
  onClientSaved,
}: {
  report: Report;
  client: Client | undefined;
  clients: Client[];
  update: (fn: (r: Report) => Report) => void;
  onClientSaved: (c: Client) => void;
}) {
  const [editing, setEditing] = useState(false);
  const set = (patch: Partial<Report>) => update((r) => ({ ...r, ...patch }));

  return (
    <div>
      <h3>Client</h3>
      <div className="row" style={{ marginBottom: 14 }}>
        <ClientLogo client={client} />
        <select className="select" value={report.clientId} onChange={(e) => set({ clientId: e.target.value })}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn small" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
      <p className="small muted" style={{ marginTop: -6 }}>
        Logo, name and UK/US English come from the client. Editing them here updates every report for this client.
      </p>

      <h3>Reporting period</h3>
      <div className="row">
        <label className="field" style={{ flex: 1 }}>
          <span>From</span>
          <input className="input" type="date" value={report.periodStart} onChange={(e) => set({ periodStart: e.target.value })} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>To</span>
          <input className="input" type="date" value={report.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} />
        </label>
      </div>
      <label className="field">
        <span>Prepared (date the report is sent; the cover shows the month)</span>
        <input className="input" type="date" value={report.preparedDate} onChange={(e) => set({ preparedDate: e.target.value })} />
      </label>

      <h3>Platforms on the cover</h3>
      <div className="row wrap">
        {PLATFORMS.map((p) => {
          const on = report.platforms.includes(p);
          return (
            <label key={p} className={`check${on ? " on" : ""}`}>
              <input
                type="checkbox"
                hidden
                checked={on}
                onChange={() =>
                  set({
                    platforms: on
                      ? report.platforms.filter((x) => x !== p)
                      : PLATFORMS.filter((x) => x === p || report.platforms.includes(x)),
                  })
                }
              />
              {PLATFORM_LABEL[p]}
            </label>
          );
        })}
      </div>
      <p className="small muted">Platforms are also added automatically when Claude finds their screenshots.</p>

      {editing && client && (
        <ClientForm
          client={client}
          onClose={() => setEditing(false)}
          onSaved={(c) => {
            setEditing(false);
            onClientSaved(c);
          }}
        />
      )}
    </div>
  );
}

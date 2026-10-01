"use client";

import { useState } from "react";
import ClientForm, { ClientLogo } from "@/components/ClientForm";
import DateField from "@/components/DateField";
import { formatDate, formatPeriod } from "@/lib/format";
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
  const english = client?.english ?? "en-GB";

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
      <DateField label="From" english={english} value={report.periodStart} onChange={(v) => set({ periodStart: v })} />
      <DateField label="To" english={english} value={report.periodEnd} onChange={(v) => set({ periodEnd: v })} />
      <DateField
        label="Prepared (date the report is sent; the cover shows the month)"
        english={english}
        value={report.preparedDate}
        onChange={(v) => set({ preparedDate: v })}
      />
      <div className="notice" style={{ marginTop: -2 }}>
        Cover will read: <strong>{formatPeriod(report.periodStart, report.periodEnd, english)}</strong>
        <br />
        <span className="small">
          {english === "en-GB" ? "UK" : "US"} date style, from the client settings. Prepared on{" "}
          {formatDate(report.preparedDate, english)}.
        </span>
      </div>

      <h3>Screenshots</h3>
      <label className={`check${report.hideChanges !== false ? " on" : ""}`} style={{ width: "100%" }}>
        <input
          type="checkbox"
          hidden
          checked={report.hideChanges !== false}
          onChange={() => set({ hideChanges: report.hideChanges === false })}
        />
        <div>
          <div>Hide Meta&apos;s change percentages</div>
          <div className="small muted">
            Removes the red/green “↓ 99.7%” comparison labels from screenshots in the report.
          </div>
        </div>
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

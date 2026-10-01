"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { openSettings, useSync } from "@/components/SettingsDialog";
import { reconnect } from "@/lib/sync";

function ago(t: number, now: number) {
  const s = Math.round((now - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

/** Small Google Drive status shown in the sidebar and the editor top bar. */
export default function SyncBadge({ dark = false }: { dark?: boolean }) {
  const sync = useSync();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  let icon: "cloud" | "cloudOff" = "cloud";
  let text: string;
  let tone = "";
  let onClick: () => void = openSettings;
  switch (sync.state) {
    case "off":
      icon = "cloudOff";
      text = "Connect Google Drive";
      break;
    case "syncing":
      text = "Syncing…";
      break;
    case "reconnect":
      icon = "cloudOff";
      text = "Reconnect Drive";
      tone = "warn";
      onClick = () => {
        reconnect().catch(() => openSettings());
      };
      break;
    case "error":
      icon = "cloudOff";
      text = "Sync problem";
      tone = "err";
      break;
    default:
      text = sync.lastSync ? `Synced ${ago(sync.lastSync, Math.max(now, sync.lastSync))}` : "Drive connected";
      tone = "ok";
  }

  return (
    <button
      className={`sync-badge ${tone}${dark ? " dark" : ""}`}
      onClick={onClick}
      title={sync.error ?? (sync.folderName ? `Google Drive folder: ${sync.folderName}` : "Google Drive sync")}
    >
      {sync.state === "syncing" ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <Icon name={icon} size={16} />}
      {text}
    </button>
  );
}

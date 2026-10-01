"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Icon from "@/components/Icon";
import { DIRECT_AI, getApiKey, NEED_KEY_EVENT, setApiKey } from "@/lib/api";
import { getGoogleClientId, setGoogleClientId } from "@/lib/google";
import {
  connectDrive,
  DEFAULT_FOLDER,
  disconnectDrive,
  driveEnabled,
  folderSetting,
  getServerSyncStatus,
  getSyncStatus,
  setFolderSetting,
  startSync,
  subscribeSync,
  syncNow,
} from "@/lib/sync";

export const OPEN_SETTINGS = "sws:open-settings";
export const openSettings = () => {
  window.dispatchEvent(new Event(OPEN_SETTINGS));
};

export const useSync = () => useSyncExternalStore(subscribeSync, getSyncStatus, getServerSyncStatus);

/** App-wide settings: Claude API key (static site) and Google Drive sync. */
export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [folder, setFolder] = useState(DEFAULT_FOLDER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sync = useSync();

  useEffect(() => {
    startSync();
    const show = () => {
      setKey(getApiKey());
      setClientId(getGoogleClientId());
      setFolder(folderSetting());
      setError("");
      setOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS, show);
    window.addEventListener(NEED_KEY_EVENT, show);
    return () => {
      window.removeEventListener(OPEN_SETTINGS, show);
      window.removeEventListener(NEED_KEY_EVENT, show);
    };
  }, []);

  if (!open) return null;
  const connected = driveEnabled();

  function saveSettings() {
    if (DIRECT_AI) setApiKey(key.trim());
    if (clientId.trim() !== getGoogleClientId()) setGoogleClientId(clientId.trim());
    if (folder.trim() !== folderSetting()) setFolderSetting(folder.trim() || DEFAULT_FOLDER);
  }

  async function connect() {
    saveSettings();
    setBusy(true);
    setError("");
    try {
      await connectDrive();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to Google Drive");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-head">
          <div className="ic">
            <Icon name="settings" />
          </div>
          <div>
            <h2>Settings</h2>
            <p>Saved in this browser only.</p>
          </div>
        </div>
        <div className="modal-body">
          {DIRECT_AI && (
            <>
              <h3 style={{ fontSize: 15, marginBottom: 10 }}>Claude</h3>
              <label className="field">
                <span>Anthropic API key</span>
                <input
                  className="input"
                  type="password"
                  placeholder="sk-ant-…"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
              </label>
              <div className="notice">
                <Icon name="lock" size={16} />
                <span>
                  Sent only to Anthropic. Create one at{" "}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                    console.anthropic.com
                  </a>{" "}
                  with a monthly spending limit. Don&apos;t save it on shared computers.
                </span>
              </div>
            </>
          )}

          <h3 style={{ fontSize: 15, margin: "8px 0 10px" }}>Google Drive sync</h3>
          <div className={`notice${connected ? "" : " warn"}`}>
            <Icon name={connected ? "cloud" : "cloudOff"} size={16} />
            <span>
              {!connected
                ? "Not connected. Reports are saved in this browser only."
                : sync.state === "reconnect"
                  ? "Connected, but Google needs a quick sign-in again (click anywhere or Sync now)."
                  : sync.state === "error"
                    ? `Last sync failed: ${sync.error}`
                    : `Connected${sync.folderName ? ` to “${sync.folderName}”` : ""}. Everything syncs automatically every minute and after each change.`}
            </span>
          </div>
          <label className="field">
            <span>Google OAuth client ID</span>
            <input
              className="input"
              placeholder="1234567890-abc.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Drive folder (name, or a link to a folder shared with you)</span>
            <input className="input" value={folder} onChange={(e) => setFolder(e.target.value)} />
          </label>
          <p className="small muted" style={{ marginTop: -6 }}>
            Everyone on the team should use the same folder. The first person creates it by connecting, then shares it
            in Google Drive (Editor access); colleagues paste the folder link here.
          </p>
          {error && <div className="notice err">{error}</div>}
          <div className="row wrap">
            {!connected ? (
              <button className="btn primary" disabled={busy || !clientId.trim()} onClick={connect}>
                {busy ? <span className="spinner" /> : <Icon name="cloud" size={16} />}
                Connect Google Drive
              </button>
            ) : (
              <>
                <button
                  className="btn"
                  disabled={busy || sync.state === "syncing"}
                  onClick={async () => {
                    saveSettings();
                    if (sync.state === "reconnect") await connect();
                    else await syncNow();
                  }}
                >
                  {sync.state === "syncing" ? <span className="spinner" /> : <Icon name="refresh" size={15} />}
                  Sync now
                </button>
                <button className="btn ghost danger" onClick={disconnectDrive}>
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>
        <div className="modal-foot">
          {DIRECT_AI && getApiKey() && (
            <button
              className="btn ghost danger"
              onClick={() => {
                setApiKey("");
                setKey("");
              }}
            >
              Remove API key
            </button>
          )}
          <div className="spacer" />
          <button
            className="btn primary"
            onClick={() => {
              saveSettings();
              setOpen(false);
              syncNow();
            }}
          >
            <Icon name="check" size={16} />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

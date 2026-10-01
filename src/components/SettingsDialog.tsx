"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Icon from "@/components/Icon";
import {
  DIRECT_AI,
  getApiKey,
  KEY_CHANGED_EVENT,
  keyVerifiedAt,
  maskKey,
  NEED_KEY_EVENT,
  setApiKey,
  verifyApiKey,
} from "@/lib/api";
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

/* ---------- Claude connection status (for badges) ---------- */

export interface ClaudeStatus {
  connected: boolean;
  verifiedAt: number;
  masked: string;
}

let claudeSnapshot: ClaudeStatus = { connected: !DIRECT_AI, verifiedAt: 0, masked: "" };
function readClaude(): ClaudeStatus {
  if (!DIRECT_AI) return claudeSnapshot;
  const key = getApiKey();
  const next = { connected: !!key, verifiedAt: keyVerifiedAt(), masked: key ? maskKey(key) : "" };
  if (
    next.connected !== claudeSnapshot.connected ||
    next.verifiedAt !== claudeSnapshot.verifiedAt ||
    next.masked !== claudeSnapshot.masked
  ) {
    claudeSnapshot = next;
  }
  return claudeSnapshot;
}
const subscribeClaude = (l: () => void) => {
  window.addEventListener(KEY_CHANGED_EVENT, l);
  window.addEventListener("storage", l);
  return () => {
    window.removeEventListener(KEY_CHANGED_EVENT, l);
    window.removeEventListener("storage", l);
  };
};
const serverClaude: ClaudeStatus = { connected: !DIRECT_AI, verifiedAt: 0, masked: "" };
export const useClaudeStatus = () => useSyncExternalStore(subscribeClaude, readClaude, () => serverClaude);

/* ---------- helpers ---------- */

function when(t: number) {
  if (!t) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

function StatusPill({ tone, children }: { tone: "ok" | "off" | "warn" | "err" | "busy"; children: React.ReactNode }) {
  return (
    <span className={`int-pill ${tone}`}>
      {tone === "busy" ? <span className="spinner" style={{ width: 11, height: 11 }} /> : <span className="dot" />}
      {children}
    </span>
  );
}

function ClaudeLogo() {
  // Simple starburst in Claude's brand orange.
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <g stroke="#D97757" strokeWidth="2.6" strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={12 + Math.cos(a) * 2.2} y1={12 + Math.sin(a) * 2.2} x2={12 + Math.cos(a) * 9.5} y2={12 + Math.sin(a) * 9.5} />;
        })}
      </g>
    </svg>
  );
}

function DriveLogo() {
  return (
    <svg viewBox="0 0 87.3 78" aria-hidden>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5A9.06 9.06 0 0 0 0 53h27.5z" fill="#00ac47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335" />
      <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

/* ---------- the dialog ---------- */

/** Integrations: Claude (AI) and Google Drive (storage & sync). */
export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const claude = useClaudeStatus();
  const sync = useSync();

  // Claude card state
  const [key, setKey] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [checking, setChecking] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [keyOk, setKeyOk] = useState("");

  // Drive card state
  const [clientId, setClientId] = useState("");
  const [folder, setFolder] = useState(DEFAULT_FOLDER);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveError, setDriveError] = useState("");

  useEffect(() => {
    startSync();
    const show = () => {
      setKey("");
      setEditingKey(!getApiKey());
      setKeyError("");
      setKeyOk("");
      setClientId(getGoogleClientId());
      setFolder(folderSetting());
      setShowAdvanced(!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
      setDriveError("");
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
  const driveOn = driveEnabled();

  async function connectClaude(candidate: string) {
    setChecking(true);
    setKeyError("");
    setKeyOk("");
    try {
      await verifyApiKey(candidate);
      setApiKey(candidate.trim(), Date.now());
      setEditingKey(false);
      setKey("");
      setKeyOk("Connected. Claude is ready to read screenshots and write reports.");
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : "Could not check the key");
    } finally {
      setChecking(false);
    }
  }

  async function testClaude() {
    const k = getApiKey();
    if (!k) return;
    setChecking(true);
    setKeyError("");
    setKeyOk("");
    try {
      await verifyApiKey(k);
      setApiKey(k, Date.now());
      setKeyOk("Connection works.");
    } catch (e) {
      setApiKey(k, 0);
      setKeyError(e instanceof Error ? e.message : "Could not check the key");
    } finally {
      setChecking(false);
    }
  }

  function saveDriveSettings() {
    if (clientId.trim() !== getGoogleClientId()) setGoogleClientId(clientId.trim());
    if (folder.trim() !== folderSetting()) setFolderSetting(folder.trim() || DEFAULT_FOLDER);
  }

  async function connectGoogle() {
    saveDriveSettings();
    setDriveBusy(true);
    setDriveError("");
    try {
      await connectDrive();
    } catch (e) {
      setDriveError(e instanceof Error ? e.message : "Could not connect to Google Drive");
    } finally {
      setDriveBusy(false);
    }
  }

  // Claude status pill
  const claudeTone = !DIRECT_AI ? "ok" : checking ? "busy" : keyError ? "err" : claude.connected ? "ok" : "off";
  const claudeLabel = !DIRECT_AI
    ? "Connected"
    : checking
      ? "Checking…"
      : keyError
        ? "Not working"
        : claude.connected
          ? "Connected"
          : "Not connected";

  // Drive status pill
  const driveTone = !driveOn
    ? "off"
    : sync.state === "syncing" || driveBusy
      ? "busy"
      : sync.state === "reconnect"
        ? "warn"
        : sync.state === "error"
          ? "err"
          : "ok";
  const driveLabel = !driveOn
    ? "Not connected"
    : sync.state === "syncing" || driveBusy
      ? "Syncing…"
      : sync.state === "reconnect"
        ? "Sign-in needed"
        : sync.state === "error"
          ? "Sync problem"
          : "Connected";

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-head">
          <div className="ic">
            <Icon name="link" />
          </div>
          <div>
            <h2>Integrations</h2>
            <p>Connect Claude for AI and Google Drive for shared storage.</p>
          </div>
        </div>

        <div className="modal-body">
          {/* ---------------- Claude ---------------- */}
          <section className={`int-card${claudeTone === "ok" ? " on" : ""}`}>
            <div className="int-head">
              <div className="int-logo">
                <ClaudeLogo />
              </div>
              <div className="int-title">
                <strong>Claude by Anthropic</strong>
                <span>Reads screenshots, writes and proofreads reports</span>
              </div>
              <StatusPill tone={claudeTone}>{claudeLabel}</StatusPill>
            </div>

            {!DIRECT_AI ? (
              <div className="int-meta">
                <div>
                  <Icon name="lock" size={14} /> API key managed securely on the server
                </div>
              </div>
            ) : claude.connected && !editingKey ? (
              <>
                <div className="int-meta">
                  <div>
                    <Icon name="lock" size={14} /> Key <code>{claude.masked}</code>
                  </div>
                  <div>
                    <Icon name="sparkles" size={14} /> Model: Claude Opus 5.5
                  </div>
                  <div>
                    <Icon name="checkCircle" size={14} />{" "}
                    {claude.verifiedAt ? `Verified ${when(claude.verifiedAt)}` : "Not verified yet"}
                  </div>
                </div>
                <div className="row">
                  <button className="btn small" disabled={checking} onClick={testClaude}>
                    <Icon name="refresh" size={14} />
                    Test connection
                  </button>
                  <button className="btn small ghost" onClick={() => setEditingKey(true)}>
                    <Icon name="edit" size={14} />
                    Change key
                  </button>
                  <div className="spacer" />
                  <button
                    className="btn small ghost danger"
                    onClick={() => {
                      setApiKey("");
                      setEditingKey(true);
                      setKeyOk("");
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="row" style={{ alignItems: "stretch" }}>
                  <input
                    className="input"
                    type="password"
                    placeholder="Paste your API key (sk-ant-…)"
                    value={key}
                    autoFocus
                    onChange={(e) => setKey(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && key.trim() && connectClaude(key)}
                  />
                  <button className="btn primary" disabled={!key.trim() || checking} onClick={() => connectClaude(key)}>
                    {checking ? <span className="spinner" /> : <Icon name="link" size={15} />}
                    {checking ? "Checking" : "Connect"}
                  </button>
                </div>
                <p className="small muted" style={{ margin: "8px 0 0" }}>
                  Get a key at{" "}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                    console.anthropic.com
                  </a>{" "}
                  and set a monthly spending limit. It&apos;s stored only in this browser and sent only to Anthropic.
                  {claude.connected && (
                    <>
                      {" "}
                      <button className="link-btn" onClick={() => setEditingKey(false)}>
                        Keep current key
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
            {keyError && <div className="int-msg err">{keyError}</div>}
            {keyOk && <div className="int-msg ok">{keyOk}</div>}
          </section>

          {/* ---------------- Google Drive ---------------- */}
          <section className={`int-card${driveTone === "ok" ? " on" : ""}`}>
            <div className="int-head">
              <div className="int-logo">
                <DriveLogo />
              </div>
              <div className="int-title">
                <strong>Google Drive</strong>
                <span>Saves reports to a shared team folder and keeps everyone in sync</span>
              </div>
              <StatusPill tone={driveTone}>{driveLabel}</StatusPill>
            </div>

            {driveOn ? (
              <>
                <div className="int-meta">
                  <div>
                    <Icon name="file" size={14} /> Folder <strong>{sync.folderName ?? folderSetting()}</strong>
                    {sync.folderId && (
                      <>
                        {" "}
                        ·{" "}
                        <a href={`https://drive.google.com/drive/folders/${sync.folderId}`} target="_blank" rel="noreferrer">
                          Open in Drive
                        </a>
                      </>
                    )}
                  </div>
                  <div>
                    <Icon name="clock" size={14} />{" "}
                    {sync.state === "reconnect"
                      ? "Google sign-in expired: click Reconnect (or anywhere in the app)"
                      : sync.state === "error"
                        ? sync.error
                        : sync.lastSync
                          ? `Last synced ${when(sync.lastSync)} · syncs every minute and after each change`
                          : "Waiting for first sync"}
                  </div>
                </div>
                <div className="row">
                  {sync.state === "reconnect" ? (
                    <button className="btn small primary" disabled={driveBusy} onClick={connectGoogle}>
                      <Icon name="refresh" size={14} />
                      Reconnect
                    </button>
                  ) : (
                    <button className="btn small" disabled={sync.state === "syncing"} onClick={() => syncNow()}>
                      <Icon name="refresh" size={14} />
                      Sync now
                    </button>
                  )}
                  <div className="spacer" />
                  <button className="btn small ghost danger" onClick={disconnectDrive}>
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="field" style={{ marginBottom: 10 }}>
                  <span>Team folder (name, or paste a link to a folder shared with you)</span>
                  <input className="input" value={folder} onChange={(e) => setFolder(e.target.value)} />
                </label>
                {showAdvanced ? (
                  <label className="field" style={{ marginBottom: 10 }}>
                    <span>Google OAuth client ID</span>
                    <input
                      className="input"
                      placeholder="1234567890-abc.apps.googleusercontent.com"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    />
                  </label>
                ) : (
                  <button className="link-btn small" style={{ marginBottom: 10 }} onClick={() => setShowAdvanced(true)}>
                    Advanced: change Google client ID
                  </button>
                )}
                <div className="row">
                  <button className="btn primary" disabled={driveBusy || !clientId.trim()} onClick={connectGoogle}>
                    {driveBusy ? <span className="spinner" /> : <Icon name="cloud" size={15} />}
                    Connect Google Drive
                  </button>
                  {!clientId.trim() && (
                    <span className="small muted">Needs a Google client ID: see GOOGLE_DRIVE_SETUP.md</span>
                  )}
                </div>
              </>
            )}
            {driveError && <div className="int-msg err">{driveError}</div>}
          </section>
        </div>

        <div className="modal-foot">
          <button
            className="btn primary"
            onClick={() => {
              if (!driveOn) saveDriveSettings();
              setOpen(false);
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

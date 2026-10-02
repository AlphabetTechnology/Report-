"use client";

import { clear, createStore, del, get, set } from "idb-keyval";
import {
  createFolder,
  downloadBlob,
  downloadJson,
  findFolder,
  getFolder,
  listFolder,
  parseFolderId,
  setProperties,
  trash,
  upload,
  type DriveFile,
} from "./drive";
import { getGoogleClientId, hasToken, NeedsAuthError, signIn, signOut } from "./google";
import {
  clearTombstone,
  DATA_CHANGED,
  deleteClient,
  deleteReport,
  getClient,
  getReport,
  listClients,
  listReports,
  listTombstones,
  LOCAL_CHANGE,
  saveClient,
  saveReport,
  type Kind,
} from "./store";
import type { Client, Report, Shot } from "./types";
import { errorMessage } from "@/lib/errors";

/*
 * Two-way sync between this browser and a shared Google Drive folder.
 *
 * - The portal always saves locally first; Drive is a mirror shared by the team.
 * - Each client and report is one JSON file; each screenshot is its own image
 *   file, uploaded once, so editing text only re-uploads a small file.
 * - When both sides changed, the most recent change wins.
 * - Runs every minute, a few seconds after each edit, and when the tab is focused.
 */

const ENABLED_KEY = "sws_drive_enabled";
const FOLDER_ID_KEY = "sws_drive_folder_id";
/** Folder the per-item sync records belong to. */
const META_FOLDER_KEY = "sws_drive_meta_folder";
const FOLDER_NAME_KEY = "sws_drive_folder_name";
export const DEFAULT_FOLDER = "SWS Reports";
const INTERVAL_MS = 60_000;
const DEBOUNCE_MS = 3_000;

export type SyncState = "off" | "reconnect" | "syncing" | "idle" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSync?: number;
  error?: string;
  folderName?: string;
  folderId?: string;
}

/* ---------- small persistent settings ---------- */

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k) ?? "";
    } catch {
      return "";
    }
  },
  set: (k: string, v: string) => {
    try {
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const driveEnabled = () => ls.get(ENABLED_KEY) === "1";
export const folderSetting = () => ls.get(FOLDER_NAME_KEY) || DEFAULT_FOLDER;

/** Folder name, or a folder link/id shared by a colleague. */
export function setFolderSetting(value: string) {
  ls.set(FOLDER_NAME_KEY, value.trim());
  ls.set(FOLDER_ID_KEY, "");
}

/* ---------- status store (for React via useSyncExternalStore) ---------- */

let status: SyncStatus = { state: "off" };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export const getSyncStatus = () => status;
export const getServerSyncStatus = (): SyncStatus => ({ state: "off" });
export function subscribeSync(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/* ---------- what we last synced, to tell remote deletions from new items ---------- */

const metaStore = () => createStore("sws-report-builder-sync", "meta");
interface Meta {
  fileId: string;
  synced: number;
}
const metaKey = (kind: Kind, id: string) => `${kind}:${id}`;

/* ---------- helpers ---------- */

interface Remote {
  file: DriveFile;
  updated: number;
  deleted: boolean;
}

const updatedOf = (x: Client | Report) => ("periodStart" in x ? x.updatedAt : (x.updatedAt ?? x.createdAt));

function blobFromDataUrl(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function dataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const jsonBlob = (x: unknown) => new Blob([JSON.stringify(x)], { type: "application/json" });
const slug = (s: string) => s.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

async function ensureFolder(): Promise<string> {
  const saved = ls.get(FOLDER_ID_KEY);
  if (saved && (await getFolder(saved))) return saved;
  const wanted = folderSetting();
  const asId = parseFolderId(wanted);
  let folder = wanted.includes("/") || /^[\w-]{25,}$/.test(asId) ? await getFolder(asId) : null;
  if (!folder) {
    const name = wanted.includes("/") ? DEFAULT_FOLDER : wanted;
    folder = (await findFolder(name)) ?? (await createFolder(name));
  }
  ls.set(FOLDER_ID_KEY, folder.id);
  // Sync records ("this was on Drive before") only make sense for the folder they
  // came from. A different folder must not make local reports look deleted.
  if (ls.get(META_FOLDER_KEY) !== folder.id) {
    await clear(metaStore());
    ls.set(META_FOLDER_KEY, folder.id);
  }
  setStatus({ folderName: folder.name, folderId: folder.id });
  return folder.id;
}

/* ---------- the sync pass ---------- */

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (!driveEnabled() || !getGoogleClientId()) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce() {
  if (!hasToken()) {
    setStatus({ state: "reconnect" });
    return;
  }
  setStatus({ state: "syncing", error: undefined });
  try {
    const changedIds = await pass();
    setStatus({ state: "idle", lastSync: Date.now() });
    if (changedIds.length) window.dispatchEvent(new CustomEvent(DATA_CHANGED, { detail: { ids: changedIds } }));
  } catch (e) {
    if (e instanceof NeedsAuthError) setStatus({ state: "reconnect" });
    else setStatus({ state: "error", error: errorMessage(e, "Sync failed") });
  }
}

async function pass(): Promise<string[]> {
  const folderId = await ensureFolder();
  const files = await listFolder(folderId);
  const changed: string[] = [];

  const remote: Record<Kind, Map<string, Remote>> = { client: new Map(), report: new Map() };
  const shotFiles = new Map<string, DriveFile>();
  for (const f of files) {
    const p = f.appProperties ?? {};
    if (p.swsType === "shot" && p.swsId) shotFiles.set(p.swsId, f);
    if ((p.swsType === "client" || p.swsType === "report") && p.swsId) {
      const r = { file: f, updated: Number(p.swsUpdated) || 0, deleted: p.swsDeleted === "1" };
      const prev = remote[p.swsType].get(p.swsId);
      // Two people may have created the same item at once: keep the newest.
      if (!prev || r.updated > prev.updated) remote[p.swsType].set(p.swsId, r);
    }
  }

  // 1. Deletions made in this browser.
  for (const t of await listTombstones()) {
    const r = remote[t.kind].get(t.id);
    if (r && !r.deleted && r.updated <= t.at) {
      await setProperties(r.file.id, { ...r.file.appProperties, swsDeleted: "1", swsUpdated: String(t.at) });
      await trash(r.file.id);
      if (t.kind === "report") {
        for (const f of shotFiles.values()) if (f.appProperties?.swsReport === t.id) await trash(f.id);
      }
      remote[t.kind].delete(t.id);
    }
    await clearTombstone(t);
    await del(metaKey(t.kind, t.id), metaStore());
  }

  // 2. Clients, then reports.
  const localClients = new Map((await listClients()).map((c) => [c.id, c]));
  const localReports = new Map((await listReports()).map((r) => [r.id, r]));

  for (const kind of ["client", "report"] as const) {
    const locals: Map<string, Client | Report> = kind === "client" ? localClients : localReports;
    const ids = new Set([...locals.keys(), ...remote[kind].keys()]);
    for (const id of ids) {
      const L = locals.get(id);
      const R = remote[kind].get(id);
      const M = await get<Meta>(metaKey(kind, id), metaStore());
      const lu = L ? updatedOf(L) : 0;

      if (R?.deleted) {
        if (L && lu > R.updated) {
          await push(kind, L, folderId, shotFiles, R.file.id);
        } else if (L) {
          await (kind === "client" ? deleteClient(id, { fromSync: true }) : deleteReport(id, { fromSync: true }));
          await del(metaKey(kind, id), metaStore());
          changed.push(id);
        }
        continue;
      }
      if (L && R) {
        if (R.updated > lu) {
          await pull(kind, R, locals.get(id), shotFiles);
          changed.push(id);
        } else if (lu > R.updated) {
          await push(kind, L, folderId, shotFiles, R.file.id);
        } else {
          if (!M) await set(metaKey(kind, id), { fileId: R.file.id, synced: lu } satisfies Meta, metaStore());
          if (kind === "report" && (await fillMissingImages(L as Report, shotFiles))) changed.push(id);
        }
      } else if (L) {
        if (M && lu <= M.synced && files.length > 0) {
          // It was synced before and has since been removed from Drive. (A completely
          // empty folder is never trusted for this: it could be a wrong or new folder.)
          await (kind === "client" ? deleteClient(id, { fromSync: true }) : deleteReport(id, { fromSync: true }));
          await del(metaKey(kind, id), metaStore());
          changed.push(id);
        } else {
          await push(kind, L, folderId, shotFiles);
        }
      } else if (R) {
        await pull(kind, R, undefined, shotFiles);
        changed.push(id);
      }
    }
  }
  return changed;
}

async function push(
  kind: Kind,
  item: Client | Report,
  folderId: string,
  shotFiles: Map<string, DriveFile>,
  fileId?: string,
) {
  const updated = String(updatedOf(item));
  let payload: unknown = item;
  let name: string;

  if (kind === "report") {
    const r = item as Report;
    // Upload screenshots that Drive doesn't have yet; they never change afterwards.
    for (const s of r.shots) {
      if (!s.dataUrl || shotFiles.has(s.id)) continue;
      const blob = blobFromDataUrl(s.dataUrl);
      const ext = blob.type === "image/jpeg" ? "jpg" : "png";
      const id = await upload(
        folderId,
        { name: `shot-${s.id}.${ext}`, mimeType: blob.type, appProperties: { swsType: "shot", swsId: s.id, swsReport: r.id } },
        blob,
      );
      shotFiles.set(s.id, { id, name: `shot-${s.id}.${ext}`, appProperties: { swsType: "shot", swsId: s.id, swsReport: r.id } });
    }
    // Remove screenshots that were deleted from the report.
    const keep = new Set(r.shots.map((s) => s.id));
    for (const [shotId, f] of shotFiles) {
      if (f.appProperties?.swsReport === r.id && !keep.has(shotId)) {
        await trash(f.id);
        shotFiles.delete(shotId);
      }
    }
    payload = { ...r, shots: r.shots.map((s) => ({ ...s, dataUrl: "" })) };
    name = `report-${r.periodStart.slice(0, 7)}-${slug(r.clientId)}-${r.id}.json`;
  } else {
    name = `client-${slug((item as Client).name)}-${item.id}.json`;
  }

  const newId = await upload(
    folderId,
    { name, mimeType: "application/json", appProperties: { swsType: kind, swsId: item.id, swsUpdated: updated } },
    jsonBlob(payload),
    fileId,
  );
  await set(metaKey(kind, item.id), { fileId: newId, synced: Number(updated) } satisfies Meta, metaStore());
}

/** True when the item was edited in this browser after `seen` was read (keep the edit). */
async function editedSince(kind: Kind, seen: Client | Report | undefined, id: string): Promise<boolean> {
  const now = kind === "client" ? await getClient(id) : await getReport(id);
  return !!now && updatedOf(now) > (seen ? updatedOf(seen) : 0);
}

async function pull(kind: Kind, r: Remote, local: Client | Report | undefined, shotFiles: Map<string, DriveFile>) {
  if (kind === "client") {
    const c = await downloadJson<Client>(r.file.id);
    if (await editedSince(kind, local, c.id)) return;
    await saveClient(c, { fromSync: true });
    await set(metaKey(kind, c.id), { fileId: r.file.id, synced: updatedOf(c) } satisfies Meta, metaStore());
    return;
  }
  const remoteReport = await downloadJson<Report>(r.file.id);
  const localShots = new Map(((local as Report | undefined)?.shots ?? []).map((s) => [s.id, s]));
  const shots: Shot[] = [];
  for (const s of remoteReport.shots) {
    let dataUrl = localShots.get(s.id)?.dataUrl ?? "";
    const f = shotFiles.get(s.id);
    if (!dataUrl && f) dataUrl = await dataUrlFromBlob(await downloadBlob(f.id));
    shots.push({ ...s, dataUrl });
  }
  const merged = { ...remoteReport, shots };
  // Edited here while the screenshots downloaded: keep the edit; the next pass merges.
  if (await editedSince(kind, local, merged.id)) return;
  await saveReport(merged, { fromSync: true });
  await set(metaKey(kind, merged.id), { fileId: r.file.id, synced: merged.updatedAt } satisfies Meta, metaStore());
}

/** Screenshots a colleague was still uploading last time: fetch them now. */
async function fillMissingImages(r: Report, shotFiles: Map<string, DriveFile>): Promise<boolean> {
  const missing = r.shots.filter((s) => !s.dataUrl && shotFiles.has(s.id));
  if (!missing.length) return false;
  const images = new Map<string, string>();
  for (const s of missing) images.set(s.id, await dataUrlFromBlob(await downloadBlob(shotFiles.get(s.id)!.id)));
  // Add the images to the report as it is now, so edits made meanwhile are kept.
  const current = (await getReport(r.id)) ?? r;
  const shots = current.shots.map((s) => (!s.dataUrl && images.has(s.id) ? { ...s, dataUrl: images.get(s.id)! } : s));
  await saveReport({ ...current, shots }, { fromSync: true });
  return true;
}

/* ---------- lifecycle ---------- */

let started = false;
let debounce: ReturnType<typeof setTimeout> | undefined;

/** Called once when the app loads. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener(LOCAL_CHANGE, () => {
    clearTimeout(debounce);
    debounce = setTimeout(syncNow, DEBOUNCE_MS);
  });
  setInterval(syncNow, INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncNow();
  });
  // Google tokens last an hour. When one runs out, the next click anywhere
  // quietly signs in again (Google needs a click to open its window).
  document.addEventListener(
    "click",
    () => {
      if (status.state === "reconnect" && driveEnabled()) reconnect().catch(() => {});
    },
    true,
  );

  if (driveEnabled()) {
    setStatus({ state: hasToken() ? "idle" : "reconnect", folderName: folderSetting() });
    syncNow();
  }
}

/** First connection, from the Settings button. */
export async function connectDrive() {
  await signIn(true);
  ls.set(ENABLED_KEY, "1");
  setStatus({ state: "idle", folderName: folderSetting() });
  await syncNow();
}

let reconnecting: Promise<void> | null = null;

export function reconnect(): Promise<void> {
  reconnecting ??= signIn(false)
    .then(() => syncNow())
    .finally(() => {
      reconnecting = null;
    });
  return reconnecting;
}

export function disconnectDrive() {
  ls.set(ENABLED_KEY, "");
  signOut();
  setStatus({ state: "off", lastSync: undefined, error: undefined });
}

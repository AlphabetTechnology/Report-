"use client";

import { currentToken, dropToken, NeedsAuthError } from "./google";

/** Minimal Google Drive v3 REST client for the browser. */

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const ALL_DRIVES = "supportsAllDrives=true";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  appProperties?: Record<string, string>;
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${currentToken()}`, ...(init.headers ?? {}) },
  });
  if (res.status === 401) {
    dropToken();
    throw new NeedsAuthError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.error?.message ?? `${res.status} ${res.statusText}`;
    throw Object.assign(new Error(`Google Drive: ${msg}`), { status: res.status });
  }
  return res;
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export async function getFolder(id: string): Promise<DriveFile | null> {
  try {
    const res = await call(`${API}/files/${id}?fields=id,name,trashed,mimeType&${ALL_DRIVES}`);
    const f = await res.json();
    return f.trashed || f.mimeType !== FOLDER_MIME ? null : f;
  } catch (e) {
    // Only "not found" means the folder is gone. Any other error (rate limit,
    // server error) must stop the sync, never send it to a different folder.
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

export async function findFolder(name: string): Promise<DriveFile | null> {
  const query = `mimeType='${FOLDER_MIME}' and name='${q(name)}' and trashed=false`;
  const res = await call(
    `${API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=10&includeItemsFromAllDrives=true&${ALL_DRIVES}`,
  );
  const { files } = (await res.json()) as { files: DriveFile[] };
  return files[0] ?? null;
}

export async function createFolder(name: string): Promise<DriveFile> {
  const res = await call(`${API}/files?fields=id,name&${ALL_DRIVES}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
  });
  return res.json();
}

export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = "";
  do {
    const query = `'${folderId}' in parents and trashed=false`;
    const res = await call(
      `${API}/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,modifiedTime,appProperties)` +
        `&pageSize=1000&includeItemsFromAllDrives=true&${ALL_DRIVES}${pageToken ? `&pageToken=${pageToken}` : ""}`,
    );
    const page = (await res.json()) as { files: DriveFile[]; nextPageToken?: string };
    out.push(...page.files);
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

export async function downloadJson<T>(fileId: string): Promise<T> {
  return (await call(`${API}/files/${fileId}?alt=media&${ALL_DRIVES}`)).json();
}

export async function downloadBlob(fileId: string): Promise<Blob> {
  return (await call(`${API}/files/${fileId}?alt=media&${ALL_DRIVES}`)).blob();
}

interface UploadMeta {
  name: string;
  mimeType: string;
  appProperties: Record<string, string>;
}

const MULTIPART_LIMIT = 4 * 1024 * 1024;

/** Creates a file (no fileId) or replaces its content and properties. Returns the file id. */
export async function upload(folderId: string, meta: UploadMeta, data: Blob, fileId?: string): Promise<string> {
  const metadata = fileId ? { name: meta.name, appProperties: meta.appProperties } : { ...meta, parents: [folderId] };
  const method = fileId ? "PATCH" : "POST";
  const base = `${UPLOAD}/files${fileId ? `/${fileId}` : ""}`;

  if (data.size < MULTIPART_LIMIT) {
    const boundary = `sws${Math.random().toString(36).slice(2)}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${meta.mimeType}\r\n\r\n`,
      data,
      `\r\n--${boundary}--`,
    ]);
    const res = await call(`${base}?uploadType=multipart&fields=id&${ALL_DRIVES}`, {
      method,
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    return (await res.json()).id;
  }

  // Large files: resumable upload in one go.
  const start = await call(`${base}?uploadType=resumable&fields=id&${ALL_DRIVES}`, {
    method,
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": meta.mimeType },
    body: JSON.stringify(metadata),
  });
  const location = start.headers.get("Location");
  if (!location) throw new Error("Google Drive did not accept the upload");
  const res = await call(location, { method: "PUT", headers: { "Content-Type": meta.mimeType }, body: data });
  return (await res.json()).id;
}

export async function setProperties(fileId: string, appProperties: Record<string, string>) {
  await call(`${API}/files/${fileId}?fields=id&${ALL_DRIVES}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appProperties }),
  });
}

/** Moves a file to the bin; only the owner may do this, so failures are ignored. */
export async function trash(fileId: string) {
  try {
    await call(`${API}/files/${fileId}?fields=id&${ALL_DRIVES}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
  } catch (e) {
    if (e instanceof NeedsAuthError) throw e;
  }
}

/** Accepts a folder link (…/folders/<id>) or a bare id. */
export function parseFolderId(input: string): string {
  const m = /folders\/([\w-]+)/.exec(input) ?? /[?&]id=([\w-]+)/.exec(input);
  return m ? m[1] : input.trim();
}

"use client";

import { createStore, del, entries, get, set, values } from "idb-keyval";
import type { Client, Report } from "./types";

// Everything is saved in the browser's IndexedDB first (the portal works
// offline); src/lib/sync.ts then mirrors it to Google Drive when connected.
const clientStore = () => createStore("sws-report-builder", "clients");
const reportStore = () => createStore("sws-report-builder-reports", "reports");
const tombStore = () => createStore("sws-report-builder-deleted", "deleted");

/** Fired after the user changes data, so Drive sync can push it. */
export const LOCAL_CHANGE = "sws:local-change";
/** Fired after sync brings in changes from Drive, so screens can reload. */
export const DATA_CHANGED = "sws:data-changed";

export type Kind = "client" | "report";
export interface Tombstone {
  kind: Kind;
  id: string;
  at: number;
}

interface SaveOptions {
  /** Used by sync: keep timestamps as they are and don't trigger another sync. */
  fromSync?: boolean;
}

const changed = (opts?: SaveOptions) => {
  if (!opts?.fromSync && typeof window !== "undefined") window.dispatchEvent(new Event(LOCAL_CHANGE));
};

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function listClients(): Promise<Client[]> {
  const all = await values<Client>(clientStore());
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export const getClient = (id: string) => get<Client>(id, clientStore());

export async function saveClient(c: Client, opts?: SaveOptions) {
  await set(c.id, opts?.fromSync ? c : { ...c, updatedAt: Date.now() }, clientStore());
  changed(opts);
}

export async function deleteClient(id: string, opts?: SaveOptions) {
  await del(id, clientStore());
  if (!opts?.fromSync) await set(`client:${id}`, { kind: "client", id, at: Date.now() } satisfies Tombstone, tombStore());
  changed(opts);
}

export async function listReports(): Promise<Report[]> {
  const all = await values<Report>(reportStore());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export const getReport = (id: string) => get<Report>(id, reportStore());

export async function saveReport(r: Report, opts?: SaveOptions) {
  await set(r.id, r, reportStore());
  changed(opts);
}

export async function deleteReport(id: string, opts?: SaveOptions) {
  await del(id, reportStore());
  if (!opts?.fromSync) await set(`report:${id}`, { kind: "report", id, at: Date.now() } satisfies Tombstone, tombStore());
  changed(opts);
}

export async function listTombstones(): Promise<Tombstone[]> {
  return (await entries<string, Tombstone>(tombStore())).map(([, t]) => t);
}

export const clearTombstone = (t: Tombstone) => del(`${t.kind}:${t.id}`, tombStore());

/** Backup / move data between browsers or team members. */
export async function exportAll(): Promise<string> {
  return JSON.stringify({
    version: 1,
    clients: await listClients(),
    reports: await listReports(),
  });
}

export async function importAll(json: string): Promise<number> {
  const data = JSON.parse(json) as { clients?: Client[]; reports?: Report[] };
  let n = 0;
  for (const c of data.clients ?? []) {
    await saveClient(c);
    n++;
  }
  for (const r of data.reports ?? []) {
    await saveReport({ ...r, updatedAt: Date.now() });
    n++;
  }
  return n;
}

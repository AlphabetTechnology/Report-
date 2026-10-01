"use client";

import { createStore, del, get, set, values } from "idb-keyval";
import type { Client, Report } from "./types";

// Everything is kept in the browser's IndexedDB, so no database is needed.
const clientStore = () => createStore("sws-report-builder", "clients");
const reportStore = () => createStore("sws-report-builder-reports", "reports");

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function listClients(): Promise<Client[]> {
  const all = await values<Client>(clientStore());
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export const getClient = (id: string) => get<Client>(id, clientStore());
export const saveClient = (c: Client) => set(c.id, c, clientStore());
export const deleteClient = (id: string) => del(id, clientStore());

export async function listReports(): Promise<Report[]> {
  const all = await values<Report>(reportStore());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export const getReport = (id: string) => get<Report>(id, reportStore());
export const saveReport = (r: Report) => set(r.id, r, reportStore());
export const deleteReport = (id: string) => del(id, reportStore());

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
    await saveReport(r);
    n++;
  }
  return n;
}

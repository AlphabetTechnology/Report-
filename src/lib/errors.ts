/** Fired when the browser is running an older copy of the portal than the server has. */
export const NEW_VERSION_EVENT = "sws:new-version";

export function isChunkError(e: unknown): boolean {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e ?? "");
  return /ChunkLoadError|Loading chunk|Failed to load chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    text,
  );
}

/** A message fit to show the team. Out-of-date tabs get a reload prompt instead of a code error. */
export function errorMessage(e: unknown, fallback: string): string {
  if (isChunkError(e)) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(NEW_VERSION_EVENT));
    return "The portal was updated while this tab was open. Reload the page (Cmd/Ctrl + Shift + R) and try again.";
  }
  return e instanceof Error && e.message ? e.message : fallback;
}

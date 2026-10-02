import { numberIssues, shotIssues } from "./checks";
import { missingShots } from "./guide";
import type { Report } from "./types";

export interface Progress {
  shots: boolean;
  text: boolean;
  /** Proofread with no suggestions left, and nothing for the safety checks to flag. */
  proofread: boolean;
  /** Things the safety checks flagged (screenshots to check, numbers not in any screenshot). */
  toCheck: number;
  /** Required checklist screenshots not uploaded yet. */
  missing: number;
  /** 0–100 */
  percent: number;
  label: "Draft" | "Missing screenshots" | "Needs text" | "Needs proofread" | "Needs a look" | "Ready to send";
}

export function reportProgress(r: Report): Progress {
  const missing = missingShots(r).length;
  const shots = r.shots.length > 0 && r.shots.every((s) => s.status === "done") && missing === 0;
  const text = !!r.text;
  const toCheck = shotIssues(r).length + numberIssues(r).length;
  const proofDone = text && !!r.proofreadAt && r.suggestions.length === 0;
  const proofread = proofDone && toCheck === 0 && missing === 0;
  const done = [shots, text, proofread].filter(Boolean).length;
  const label = proofread
    ? "Ready to send"
    : missing && r.shots.length && r.shots.every((s) => s.status === "done" || s.status === "error")
      ? "Missing screenshots"
    : proofDone
      ? "Needs a look"
      : text
        ? "Needs proofread"
        : shots
          ? "Needs text"
          : "Draft";
  return { shots, text, proofread, toCheck, missing, percent: Math.round((done / 3) * 100), label };
}

import { numberIssues, shotIssues } from "./checks";
import type { Report } from "./types";

export interface Progress {
  shots: boolean;
  text: boolean;
  /** Proofread with no suggestions left, and nothing for the safety checks to flag. */
  proofread: boolean;
  /** Things the safety checks flagged (screenshots to check, numbers not in any screenshot). */
  toCheck: number;
  /** 0–100 */
  percent: number;
  label: "Draft" | "Needs text" | "Needs proofread" | "Needs a look" | "Ready to send";
}

export function reportProgress(r: Report): Progress {
  const shots = r.shots.length > 0 && r.shots.every((s) => s.status === "done");
  const text = !!r.text;
  const toCheck = shotIssues(r).length + numberIssues(r).length;
  const proofDone = text && !!r.proofreadAt && r.suggestions.length === 0;
  const proofread = proofDone && toCheck === 0;
  const done = [shots, text, proofread].filter(Boolean).length;
  const label = proofread
    ? "Ready to send"
    : proofDone
      ? "Needs a look"
      : text
        ? "Needs proofread"
        : shots
          ? "Needs text"
          : "Draft";
  return { shots, text, proofread, toCheck, percent: Math.round((done / 3) * 100), label };
}

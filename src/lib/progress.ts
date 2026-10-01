import type { Report } from "./types";

export interface Progress {
  shots: boolean;
  text: boolean;
  proofread: boolean;
  /** 0–100 */
  percent: number;
  label: "Draft" | "Needs text" | "Needs proofread" | "Ready to send";
}

export function reportProgress(r: Report): Progress {
  const shots = r.shots.length > 0 && r.shots.every((s) => s.status === "done");
  const text = !!r.text;
  const proofread = text && !!r.proofreadAt && r.suggestions.length === 0;
  const done = [shots, text, proofread].filter(Boolean).length;
  const label = proofread ? "Ready to send" : text ? "Needs proofread" : shots ? "Needs text" : "Draft";
  return { shots, text, proofread, percent: Math.round((done / 3) * 100), label };
}

"use client";

/** Limits that keep blurry or compressed screenshots out of client reports. */
export interface UploadRules {
  /** Files smaller than this are usually compressed copies (WhatsApp, thumbnails). */
  minKb: number;
  /** Long side in pixels; below this the text in the screenshot prints blurry. */
  minPx: number;
  maxMb: number;
}

export const DEFAULT_RULES: UploadRules = { minKb: 30, minPx: 500, maxMb: 20 };

const STORAGE = "sws_upload_rules";
export const RULES_EVENT = "sws:upload-rules";

export function getRules(): UploadRules {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null") as Partial<UploadRules> | null;
    return { ...DEFAULT_RULES, ...saved };
  } catch {
    return DEFAULT_RULES;
  }
}

export function setRules(rules: UploadRules) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(rules));
  } catch {
    /* not remembered */
  }
  window.dispatchEvent(new Event(RULES_EVENT));
}

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

/** Reason a file is refused before it is read, or "" when its size is fine. */
export function checkFileSize(file: File, rules: UploadRules): string {
  if (file.size < rules.minKb * 1024) {
    return `only ${kb(file.size)} (minimum ${rules.minKb} KB). It looks compressed; upload the original screenshot.`;
  }
  if (file.size > rules.maxMb * 1024 * 1024) return `${kb(file.size)} (maximum ${rules.maxMb} MB).`;
  return "";
}

/** Reason a loaded image is refused for low resolution, or "". */
export function checkResolution(width: number, height: number, rules: UploadRules): string {
  const long = Math.max(width, height);
  return long < rules.minPx
    ? `only ${width}×${height} pixels (minimum ${rules.minPx} on the long side). It would print blurry.`
    : "";
}

"use client";

/**
 * Finds the white "cards" in an analytics screenshot (Meta Business Suite,
 * TikTok Studio, YouTube Studio all draw white cards on a tinted background).
 *
 * - A grid of cards side by side (e.g. Views / Reach / Interactions / Visits)
 *   is cut into one image per card, so each card can go to its own report section.
 * - Anything else is just trimmed to the cards (drops the page header and margins).
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CardLayout =
  | { type: "grid"; cards: Rect[] }
  | { type: "trim"; rect: Rect }
  | { type: "none" };

const union = (rs: Rect[]): Rect => {
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

const MAX_SIDE = 1000; // detection runs on a smaller copy; rects are scaled back

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = src;
  });
}

/** Segments [a, b) where the profile is "card", joining gaps narrower than minGap. */
function segments(profile: Float32Array, minGap: number): [number, number][] {
  const segs: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= profile.length; i++) {
    const on = i < profile.length && profile[i] >= 0.5;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      const last = segs[segs.length - 1];
      if (last && start - last[1] < minGap) last[1] = i;
      else segs.push([start, i]);
      start = -1;
    }
  }
  return segs;
}

export function detectLayout(white: Uint8Array, W: number, H: number): Rect[] {
  const minGap = Math.max(4, Math.round(Math.max(W, H) * 0.0055));
  const out: Rect[] = [];

  const cut = (r: Rect, horizontal: boolean, depth: number, settled: boolean) => {
    if (depth > 8) {
      out.push(r);
      return;
    }
    const len = horizontal ? r.h : r.w;
    const profile = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      let n = 0;
      if (horizontal) {
        const row = (r.y + i) * W;
        for (let x = r.x; x < r.x + r.w; x++) n += white[row + x];
        profile[i] = n / r.w;
      } else {
        const x = r.x + i;
        for (let y = r.y; y < r.y + r.h; y++) n += white[y * W + x];
        profile[i] = n / r.h;
      }
    }
    const segs = segments(profile, minGap);
    if (!segs.length) return;
    const sub = ([a, b]: [number, number]): Rect =>
      horizontal ? { x: r.x, y: r.y + a, w: r.w, h: b - a } : { x: r.x + a, y: r.y, w: b - a, h: r.h };
    if (segs.length === 1) {
      const s = sub(segs[0]);
      if (settled) out.push(s);
      else cut(s, !horizontal, depth + 1, true);
      return;
    }
    for (const seg of segs) cut(sub(seg), !horizontal, depth + 1, false);
  };

  cut({ x: 0, y: 0, w: W, h: H }, true, 0, false);
  return out.filter((r) => r.w >= W * 0.15 && r.h >= Math.max(24, H * 0.04));
}

/** True when at least two cards sit side by side (a dashboard grid). */
function isGrid(rects: Rect[]): boolean {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x;
      if (apart && overlap > Math.min(a.h, b.h) * 0.5) return true;
    }
  }
  return false;
}

export async function findCards(dataUrl: string): Promise<CardLayout> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const W = Math.round(img.width * scale);
  const H = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const white = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < white.length; i++, p += 4) {
    white[i] = data[p] >= 248 && data[p + 1] >= 248 && data[p + 2] >= 248 ? 1 : 0;
  }

  const rects = detectLayout(white, W, H);
  if (!rects.length) return { type: "none" };
  const back = (r: Rect): Rect => ({
    x: Math.round(r.x / scale),
    y: Math.round(r.y / scale),
    w: Math.round(r.w / scale),
    h: Math.round(r.h / scale),
  });

  if (rects.length >= 2 && isGrid(rects)) {
    const cards = rects.sort((a, b) => a.y - b.y || a.x - b.x).map(back);
    return { type: "grid", cards };
  }

  // Otherwise trim to the area covered by cards if that removes a real margin.
  const all = union(rects);
  if (all.w * all.h > W * H * 0.92) return { type: "none" };
  return { type: "trim", rect: back(all) };
}

/** Crops part of an image; keeps PNG so text stays sharp. */
export async function crop(dataUrl: string, r: Rect, pad = 0): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(dataUrl);
  const x = Math.max(0, r.x - pad);
  const y = Math.max(0, r.y - pad);
  const w = Math.min(img.width - x, r.w + pad * 2);
  const h = Math.min(img.height - y, r.h + pad * 2);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, x, y, w, h, 0, 0, w, h);
  return { dataUrl: canvas.toDataURL("image/png"), width: w, height: h };
}

/**
 * Erases Meta's comparison labels ("↓ 99.7%" in red, "↑ 12%" in green) by
 * painting them over with the card background. Only small, wide clusters of
 * strong red/green are touched, so logos and charts stay as they are.
 * Returns the original data URL when nothing was found.
 */
export async function eraseChangeLabels(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const W = img.width;
  const H = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, W, H);
  const d = image.data;

  // Strong red or green text pixels.
  const core = new Uint8Array(W * H);
  let any = false;
  for (let i = 0, p = 0; i < core.length; i++, p += 4) {
    const r = d[p];
    const g = d[p + 1];
    const b = d[p + 2];
    const red = r >= 130 && g <= 90 && b <= 100 && r - g >= 80;
    const green = g >= 100 && r <= 90 && b <= 120 && g - r >= 50 && g - b >= 20;
    if (red || green) {
      core[i] = 1;
      any = true;
    }
  }
  if (!any) return dataUrl;

  // Group glyphs of one label: join core pixels up to `gap` px apart horizontally.
  const gap = Math.max(4, Math.round(W * 0.008));
  const seen = new Uint8Array(W * H);
  const boxes: { x0: number; y0: number; x1: number; y1: number; n: number }[] = [];
  const stack: number[] = [];
  for (let start = 0; start < core.length; start++) {
    if (!core[start] || seen[start]) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      const y = (i - x) / W;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -gap; dx <= gap; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const j = yy * W + xx;
          if (core[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    boxes.push({ x0, y0, x1, y1, n });
  }

  // Small text breaks into several pieces ("92.3", "%", the arrow): join pieces
  // on the same line that are no more than a character or two apart.
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const c = boxes[j];
      const ha = a.y1 - a.y0 + 1;
      const hc = c.y1 - c.y0 + 1;
      const overlap = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0) + 1;
      const gapX = Math.max(a.x0, c.x0) - Math.min(a.x1, c.x1) - 1;
      // Same line, or the top and bottom strokes of the same small text (≤ 2px apart).
      const sameLine = overlap >= Math.min(ha, hc) * 0.5 || overlap >= -2;
      if (sameLine && gapX <= Math.max(ha, hc, 6) * 1.6) parent[find(j)] = find(i);
    }
  }
  const merged = new Map<number, (typeof boxes)[number]>();
  boxes.forEach((b, i) => {
    const root = find(i);
    const m = merged.get(root);
    if (!m) merged.set(root, { ...b });
    else {
      m.x0 = Math.min(m.x0, b.x0);
      m.y0 = Math.min(m.y0, b.y0);
      m.x1 = Math.max(m.x1, b.x1);
      m.y1 = Math.max(m.y1, b.y1);
      m.n += b.n;
    }
  });
  const groups = [...merged.values()];

  const maxH = Math.max(14, Math.round(Math.min(H, 1400) * 0.06));
  // Instagram's logo contains strong magenta; Meta's labels never do (their
  // anti-aliased edges can look faintly orange or purple, but not magenta).
  const nearLogoColours = (b: (typeof boxes)[number]) => {
    let n = 0;
    for (let y = Math.max(0, b.y0 - 2); y <= Math.min(H - 1, b.y1 + 2); y++) {
      for (let x = Math.max(0, b.x0 - 2); x <= Math.min(W - 1, b.x1 + 2); x++) {
        const p = (y * W + x) * 4;
        if (d[p] > 150 && d[p + 2] > 150 && d[p + 1] < 70) n++;
      }
    }
    return n >= 3;
  };
  // A label is a short, wide run of thin text strokes. Logos (e.g. Instagram's
  // gradient icon) are solid blocks of colour, so they fail the density test.
  const labels = groups.filter((b) => {
    const w = b.x1 - b.x0 + 1;
    const h = b.y1 - b.y0 + 1;
    const density = b.n / (w * h);
    return h >= 5 && h <= maxH && w >= h * 1.8 && b.n >= 8 && density < 0.55 && !nearLogoColours(b);
  });

  let changed = false;
  for (const b of labels) {
    const bh = b.y1 - b.y0 + 1;
    // Include the ↑/↓ arrow (and any stray coloured pixels) just left of the label.
    const rx0 = Math.max(0, b.x0 - bh * 3);
    const ry0 = Math.max(0, b.y0 - 2);
    const ry1 = Math.min(H - 1, b.y1 + 2);
    const x1 = b.x1;
    let x0 = b.x0, y0 = b.y0, y1 = b.y1;
    for (let y = ry0; y <= ry1; y++) {
      for (let x = rx0; x < b.x0; x++) {
        if (!core[y * W + x]) continue;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const pad = Math.max(3, Math.round(bh * 0.3));
    // Paint with the colour just left of the area (the card background).
    const sx = Math.max(0, x0 - pad - 2);
    const sy = Math.min(H - 1, Math.round((y0 + y1) / 2));
    const sp = (sy * W + sx) * 4;
    const light = d[sp] + d[sp + 1] + d[sp + 2] > 600;
    ctx.fillStyle = light ? `rgb(${d[sp]},${d[sp + 1]},${d[sp + 2]})` : "#fff";
    ctx.fillRect(x0 - pad, y0 - pad, x1 - x0 + 1 + pad * 2, y1 - y0 + 1 + pad * 2);
    changed = true;
  }
  return changed ? canvas.toDataURL("image/png") : dataUrl;
}

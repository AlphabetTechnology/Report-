"use client";

/**
 * Finds the white "cards" in an analytics screenshot (Meta Business Suite,
 * TikTok Studio, YouTube Studio all draw white cards on a tinted background).
 *
 * - A grid of cards side by side (e.g. Views / Reach / Interactions / Visits)
 *   is cut into one image per card, so each card can go to its own report section.
 * - Anything else only has plain margins trimmed; nothing with content is ever cut.
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

/**
 * The box around everything that isn't plain background (the colour along the
 * image's edges), plus a little breathing room.
 */
function contentBounds(d: Uint8ClampedArray, W: number, H: number): Rect | null {
  const edge: number[][] = [];
  for (let x = 0; x < W; x += 4) edge.push([x, 0], [x, H - 1]);
  for (let y = 0; y < H; y += 4) edge.push([0, y], [W - 1, y]);
  const counts = new Map<number, number>();
  let best = 0;
  let bg = 0;
  for (const [x, y] of edge) {
    const p = (y * W + x) * 4;
    const key = ((d[p] >> 3) << 10) | ((d[p + 1] >> 3) << 5) | (d[p + 2] >> 3);
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n > best) {
      best = n;
      bg = key;
    }
  }
  // Without a clear background colour there is no plain margin to trim.
  if (best < edge.length * 0.5) return null;
  const br = ((bg >> 10) & 31) * 8 + 4;
  const bgG = ((bg >> 5) & 31) * 8 + 4;
  const bb = (bg & 31) * 8 + 4;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      if (Math.abs(d[p] - br) + Math.abs(d[p + 1] - bgG) + Math.abs(d[p + 2] - bb) <= 18) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const pad = Math.max(2, Math.round(Math.max(W, H) * 0.006));
  const x = Math.max(0, x0 - pad);
  const y = Math.max(0, y0 - pad);
  return { x, y, w: Math.min(W, x1 + pad + 1) - x, h: Math.min(H, y1 + pad + 1) - y };
}

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
function isGrid(rects: Rect[], W: number, H: number): boolean {
  // Dashboard cards are big and of similar width side by side (2–4 across). The
  // columns of a table (rank, thumbnail, title, numbers) are not cards.
  const big = (r: Rect) => r.w >= W * 0.22 && r.h >= H * 0.1;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x;
      const similar = Math.max(a.w, b.w) / Math.min(a.w, b.w) <= 1.8;
      if (big(a) && big(b) && apart && similar && overlap > Math.min(a.h, b.h) * 0.5) return true;
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

  // A phone screenshot is never cut up: its "grid" is a grid of posts, not cards.
  const phoneShaped = img.width / img.height < 0.65;
  if (rects.length >= 2 && isGrid(rects, W, H) && !phoneShaped) {
    const cards = rects.sort((a, b) => a.y - b.y || a.x - b.x).map(back);
    return { type: "grid", cards };
  }

  // A phone screenshot is shown whole in the phone frame: never trimmed.
  if (phoneShaped) return { type: "none" };
  // Otherwise only trim plain margins: never cut anything that has content in it.
  const all = contentBounds(data, W, H);
  if (!all || all.w * all.h > W * H * 0.92) return { type: "none" };
  return { type: "trim", rect: back(all) };
}

/** Crops part of an image; keeps PNG so text stays sharp. */
/**
 * Whether the image is already a phone mockup (a screenshot inside a drawn phone
 * frame on a light background), so the report shows it as it is.
 */
export async function hasDeviceFrame(dataUrl: string): Promise<boolean> {
  const img = await loadImage(dataUrl);
  if (img.width / img.height > 0.8) return false;
  const scale = Math.min(1, 600 / Math.max(img.width, img.height));
  const W = Math.round(img.width * scale);
  const H = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const lum = (x: number, y: number) => {
    const p = (y * W + x) * 4;
    return (d[p] + d[p + 1] + d[p + 2]) / 3;
  };
  // Corners are page background (light), not screen content.
  const corners = [lum(1, 1), lum(W - 2, 1), lum(1, H - 2), lum(W - 2, H - 2)];
  if (corners.some((v) => v < 200)) return false;
  // Walking in from each side at several heights: a light margin, then the thick
  // black bezel of the drawn phone, at the same distance from both edges.
  const bezelAt = (y: number, dir: 1 | -1): number | null => {
    const at = (i: number) => (dir === 1 ? i : W - 1 - i);
    const margin = Math.max(2, Math.round(W * 0.02));
    for (let i = 0; i < margin; i++) if (lum(at(i), y) < 180) return null;
    const need = Math.max(4, Math.round(W * 0.012));
    let run = 0;
    for (let i = margin; i < W * 0.2; i++) {
      if (lum(at(i), y) < 40) {
        if (++run >= need) return i - run + 1;
      } else run = 0;
    }
    return null;
  };
  let hits = 0;
  for (const f of [0.3, 0.5, 0.7]) {
    const y = Math.round(H * f);
    const l = bezelAt(y, 1);
    const r = bezelAt(y, -1);
    if (l !== null && r !== null && Math.abs(l - r) <= W * 0.03) hits++;
  }
  return hits >= 2;
}

/** The area of a ready-made mockup that isn't its plain page background (the phone itself). */
export async function contentBox(dataUrl: string): Promise<Rect | null> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data: d, width: W, height: H } = ctx.getImageData(0, 0, img.width, img.height);
  const bg = [d[0], d[1], d[2]];
  const differs = (i: number) => Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 30;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (!differs((y * W + x) * 4)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const pad = 2;
  const r = { x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad), w: 0, h: 0 };
  r.w = Math.min(W, x1 + pad + 1) - r.x;
  r.h = Math.min(H, y1 + pad + 1) - r.y;
  // Only worth it when a real margin goes.
  return r.w * r.h < W * H * 0.92 ? r : null;
}

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
const colourDiff = (d: Uint8ClampedArray, p: number, c: number[]) =>
  Math.abs(d[p] - c[0]) + Math.abs(d[p + 1] - c[1]) + Math.abs(d[p + 2] - c[2]);

/**
 * The background colour around a box when it is plain (a flat card or screen),
 * or null when the box sits in a photo, a design or an icon.
 */
function plainSurround(
  d: Uint8ClampedArray,
  W: number,
  H: number,
  core: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number[] | null {
  // A ring of pixels 2px outside the box.
  const ring: number[] = [];
  const add = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H && !core[y * W + x]) ring.push((y * W + x) * 4);
  };
  for (let x = x0 - 2; x <= x1 + 2; x++) {
    add(x, y0 - 2);
    add(x, y1 + 2);
  }
  for (let y = y0 - 1; y <= y1 + 1; y++) {
    add(x0 - 2, y);
    add(x1 + 2, y);
  }
  if (ring.length < 12) return null;
  const median = (k: number) => ring.map((p) => d[p + k]).sort((a, b) => a - b)[ring.length >> 1];
  const bg = [median(0), median(1), median(2)];
  const ringPlain = ring.filter((p) => colourDiff(d, p, bg) <= 40).length / ring.length;
  if (ringPlain < 0.9) return null;
  // Inside, apart from the red text and its soft edges, it should be background too.
  let inside = 0;
  let plain = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (core[i]) continue;
      inside++;
      if (colourDiff(d, i * 4, bg) <= 60) plain++;
    }
  }
  if (!inside || plain / inside < 0.55) return null;
  // Meta and Instagram put these labels on white, light grey or dark grey/black.
  // A cream or coloured background means a post design, not a dashboard.
  const sat = Math.max(...bg) - Math.min(...bg);
  const lum = (bg[0] + bg[1] + bg[2]) / 3;
  if (sat > 14 || (lum < 225 && lum > 60)) return null;
  return bg;
}

/**
 * Whether plain (grey or black/white) text sits right beside the label on the
 * same line: the metric's number ("296 ↓ 99.7%") or "from August" after it.
 * A red word on a post design has no such neighbour.
 */
function hasTextBeside(
  d: Uint8ClampedArray,
  W: number,
  core: Uint8Array,
  bg: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const h = y1 - y0 + 1;
  const reach = Math.round(h * 6);
  for (const dir of [-1, 1]) {
    // Average the colour of everything that stands out from the background:
    // grey or black text averages to grey (even with ClearType's blue/orange
    // edges), a photo or design averages to a colour.
    let ink = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    const from = dir < 0 ? x0 - 1 : x1 + 1;
    for (let k = 0; k < reach; k++) {
      const x = from + dir * k;
      if (x < 0 || x >= W) break;
      for (let y = y0; y <= y1; y++) {
        const i = y * W + x;
        if (core[i]) continue;
        const p = i * 4;
        if (colourDiff(d, p, bg) <= 150) continue;
        ink++;
        r += d[p];
        g += d[p + 1];
        b += d[p + 2];
      }
    }
    if (ink < Math.max(6, h)) continue;
    const mean = [r / ink, g / ink, b / ink];
    if (Math.max(...mean) - Math.min(...mean) <= 45) return true;
  }
  return false;
}

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

  // Strong red text pixels. Only decreases are hidden; green increases stay.
  const core = new Uint8Array(W * H);
  let any = false;
  for (let i = 0, p = 0; i < core.length; i++, p += 4) {
    const r = d[p];
    const g = d[p + 1];
    const b = d[p + 2];
    if (r >= 130 && g <= 90 && b <= 100 && r - g >= 80) {
      core[i] = 1;
      any = true;
    }
  }
  if (!any) return dataUrl;

  // Group glyphs of one label: join core pixels up to `gap` px apart horizontally.
  const gap = Math.max(4, Math.round(W * 0.008));
  const seen = new Uint8Array(W * H);
  // `solid`: a filled red shape (notification badge, dot, button), never text.
  // Measured: label glyphs are at most ~60% filled, badges and dots 68–81%.
  const boxes: { x0: number; y0: number; x1: number; y1: number; n: number; solid: boolean }[] = [];
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
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    boxes.push({ x0, y0, x1, y1, n, solid: Math.min(bw, bh) >= 8 && n / (bw * bh) > 0.64 });
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
      m.solid ||= b.solid;
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
    // A logo has a patch of magenta; a few tinted edge pixels on blurry, low-res
    // text don't count.
    return n >= Math.max(3, b.n * 0.2);
  };
  // Black text drawn with ClearType has thin red edges that look like red text.
  // A real label is mostly red ink; black text with red edges is mostly black.
  const mostlyRed = (b: (typeof boxes)[number]) => {
    // Only matters on light backgrounds (dark-mode phone screens have no ClearType).
    let edge = 0;
    let edgeN = 0;
    for (let x = b.x0; x <= b.x1; x++) {
      for (const y of [Math.max(0, b.y0 - 2), Math.min(H - 1, b.y1 + 2)]) {
        const p = (y * W + x) * 4;
        edge += d[p] + d[p + 1] + d[p + 2];
        edgeN++;
      }
    }
    if (edge / edgeN < 300) return true;
    let black = 0;
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const p = (y * W + x) * 4;
        const spread = Math.max(d[p], d[p + 1], d[p + 2]) - Math.min(d[p], d[p + 1], d[p + 2]);
        if (spread < 40 && d[p] + d[p + 1] + d[p + 2] < 300) black++;
      }
    }
    return black <= b.n * 0.5;
  };
  // A label is a short, wide run of thin text strokes. Logos (e.g. Instagram's
  // gradient icon) are solid blocks of colour, so they fail the density test.
  const labels = groups.filter((b) => {
    const w = b.x1 - b.x0 + 1;
    const h = b.y1 - b.y0 + 1;
    const density = b.n / (w * h);
    return h >= 5 && h <= maxH && w >= h * 1.8 && b.n >= 8 && density < 0.55 && !nearLogoColours(b) && mostlyRed(b) && !b.solid;
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
    const bx0 = Math.max(0, x0 - pad);
    const by0 = Math.max(0, y0 - pad);
    const bx1 = Math.min(W - 1, x1 + pad);
    const by1 = Math.min(H - 1, y1 + pad);
    // Meta's labels sit on a plain card or screen background. Red inside a
    // photo, a post design or an icon has a busy surround, so leave it alone.
    const bg = plainSurround(d, W, H, core, bx0, by0, bx1, by1);
    if (!bg || !hasTextBeside(d, W, core, bg, x0, y0, x1, y1)) continue;
    ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    ctx.fillRect(bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1);
    changed = true;
  }
  return changed ? canvas.toDataURL("image/png") : dataUrl;
}

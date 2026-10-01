/* eslint-disable @next/next/no-img-element -- report pages are printed, plain <img> keeps them exact */
import type { Platform } from "@/lib/types";
import { asset } from "@/lib/asset";

export const PLATFORM_RING: Record<Platform, string> = {
  facebook: "#1471b9",
  instagram: "#f7941f",
  tiktok: "#111111",
  youtube: "#e62117",
};

/** Colour of the "Leading Locations" / "Top Countries" bars per platform. */
export const PLATFORM_BAR: Record<Platform, "blue" | "orange"> = {
  facebook: "blue",
  instagram: "orange",
  tiktok: "blue",
  youtube: "orange",
};

const TIKTOK_PATH =
  "M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-label="TikTok">
      <path
        fill="#25F4EE"
        transform="translate(-0.6 -0.5)"
        d={TIKTOK_PATH}
      />
      <path
        fill="#FE2C55"
        transform="translate(0.6 0.5)"
        d={TIKTOK_PATH}
      />
      <path
        fill="#111"
        d={TIKTOK_PATH}
      />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 28 20" aria-label="YouTube">
      <rect width="28" height="20" rx="5.5" fill="#FF0000" />
      <path d="M11.2 5.6v8.8l7.6-4.4z" fill="#fff" />
    </svg>
  );
}

/** Flat platform logo. */
export function PlatformIcon({ platform }: { platform: Platform }) {
  switch (platform) {
    case "facebook":
      return <img src={asset("/template/badges/facebook.png")} alt="Facebook" />;
    case "instagram":
      return <img src={asset("/template/badges/instagram.png")} alt="Instagram" />;
    case "tiktok":
      return <TikTokIcon />;
    case "youtube":
      return <YouTubeIcon />;
  }
}

/** Round badge that sits on top of a screenshot card or a heading bar. */
export function Badge({ platform, style3d }: { platform: Platform; style3d: boolean }) {
  const has3d = style3d && (platform === "facebook" || platform === "instagram");
  return (
    <div className={`rpt-badge${has3d ? " r-3d" : ""}`} style={{ borderColor: PLATFORM_RING[platform] }}>
      {has3d ? (
        <img src={asset(`/template/badges/${platform}-3d.png`)} alt="" />
      ) : (
        <PlatformIcon platform={platform} />
      )}
    </div>
  );
}

export function WaveTop() {
  return (
    <svg className="rpt-wave-top" viewBox="0 0 210 22" preserveAspectRatio="none" aria-hidden>
      <path d="M0,14.2 C60,7.6 95,4.2 120,4.6 C145,5 175,12 210,19.6 L210,0 L0,0 Z" fill="#f7941f" />
      <path d="M0,13.4 C60,6.8 95,2.6 120,3 C145,3.4 175,8.6 210,14 L210,0 L0,0 Z" fill="#1471b9" />
    </svg>
  );
}

export function Footer({ page, url = true }: { page?: number; url?: boolean }) {
  return (
    <div className="rpt-footer">
      <svg viewBox="0 0 210 25" preserveAspectRatio="none" aria-hidden>
        <path d="M0,5.4 C50,10 85,14 110,13.6 C140,13.1 175,7.2 210,2 L210,25 L0,25 Z" fill="#f7941f" />
        <path d="M0,6.2 C50,11.6 85,16.4 110,16.3 C140,16.1 175,12.2 210,8.2 L210,25 L0,25 Z" fill="#1471b9" />
      </svg>
      {url && <span className="rpt-footer-url">www.sws-ltd.com</span>}
      {page !== undefined && <span className="rpt-footer-num">{page}</span>}
    </div>
  );
}

export function Star({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ position: "absolute", left: `${x}mm`, top: `${y}mm`, width: `${size}mm`, height: `${size}mm` }}
      aria-hidden
    >
      <path
        fill={color}
        d="M12 1.6l3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 17.8l-6.4 3.5 1.4-7.2-5.3-5 7.2-.9z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import type { Platform, ShotKind } from "./types";

/** The team's standard: which screenshots to take for each platform, and where. */
export interface GuideItem {
  label: string;
  /** Screenshot kinds (as Claude reads them) that tick this item off. */
  kinds: ShotKind[];
}

export interface PlatformGuide {
  where: string;
  items: GuideItem[];
}

const DASHBOARD: ShotKind[] = ["reach", "views", "interactions", "visits", "follows"];

export const PLATFORM_GUIDE: Record<Platform, PlatformGuide> = {
  facebook: {
    where: "Meta Business Suite → Insights, with Facebook selected at the top",
    items: [
      { label: "Overview dashboard (views, viewers, interactions, visits, follows)", kinds: DASHBOARD },
      { label: "Content overview with top content", kinds: ["content_overview", "top_content"] },
      { label: "Audience (age, gender, cities, countries)", kinds: ["demographics", "locations"] },
      { label: "Page on the phone (full screen)", kinds: ["profile_grid"] },
    ],
  },
  instagram: {
    where: "Meta Business Suite → Insights, with Instagram selected at the top",
    items: [
      { label: "Overview dashboard (views, reach, interactions, visits, follows)", kinds: DASHBOARD },
      { label: "Content overview with top content", kinds: ["content_overview", "top_content"] },
      { label: "Audience (age, gender, cities, countries)", kinds: ["demographics", "locations"] },
      { label: "Profile grid on the phone (full screen)", kinds: ["profile_grid"] },
    ],
  },
  linkedin: {
    where: "LinkedIn page → Analytics",
    items: [
      { label: "Content (impressions, reactions)", kinds: ["reach", "views", "interactions"] },
      { label: "Visitors", kinds: ["visits"] },
      { label: "Followers", kinds: ["follows"] },
      { label: "Search appearances", kinds: ["searches"] },
      { label: "Follower or visitor demographics", kinds: ["demographics", "locations"] },
    ],
  },
  tiktok: {
    where: "TikTok Studio → Analytics",
    items: [
      { label: "Overview (views, reach, likes, profile views, followers)", kinds: DASHBOARD },
      { label: "Content (top videos)", kinds: ["content_overview", "top_content"] },
      { label: "Viewers / followers (age, gender, locations)", kinds: ["demographics", "locations"] },
      { label: "Profile on the phone (full screen)", kinds: ["profile_grid"] },
    ],
  },
  youtube: {
    where: "YouTube Studio → Analytics",
    items: [
      { label: "Overview (views, watch time, subscribers)", kinds: DASHBOARD },
      { label: "Content (top videos)", kinds: ["content_overview", "top_content"] },
      { label: "Audience (age, gender, geography)", kinds: ["demographics", "locations"] },
    ],
  },
  pinterest: {
    where: "Pinterest Analytics → Overview",
    items: [
      { label: "Overview (impressions, engagements, saves, outbound clicks)", kinds: DASHBOARD },
      { label: "Top Pins", kinds: ["content_overview", "top_content"] },
      { label: "Audience insights", kinds: ["demographics", "locations"] },
    ],
  },
  gmb: {
    where: "Google Business Profile → Performance",
    items: [
      { label: "Performance overview (interactions, calls, directions, website clicks)", kinds: DASHBOARD },
      { label: "Searches and search terms", kinds: ["searches"] },
    ],
  },
};

/** How every screenshot should be taken, whatever the platform. */
export const CAPTURE_RULES = [
  "Zoom the browser to 150% (Ctrl and +) before taking dashboard screenshots, so they are at least 1,000 px wide and print sharp.",
  "Keep the platform switcher and the date range visible, set to the report month.",
  "Save as PNG straight from your computer or phone, not a copy sent through WhatsApp.",
  "Don't crop: the tool cuts dashboards into cards and trims margins itself.",
  "Phone screenshots: full screen, nothing cropped. Don't upload ready-made mockups; the tool makes the phone panel.",
];

/** Desktop screenshots narrower than this print blurry (text is too small). */
export const MIN_DESKTOP_WIDTH = 1000;

export const PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "linkedin", "pinterest", "gmb"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  gmb: "Google Business Profile",
};

/** Report sections in the order they appear in the SWS template. */
export const SECTIONS = [
  { key: "executive", title: "Executive Summary" },
  { key: "reach", title: "Account Reach" },
  { key: "views", title: "Account Views" },
  { key: "engagement", title: "Engagement & Traffic" },
  { key: "visits", title: "Account Visits" },
  { key: "audience", title: "Audience Overview" },
  { key: "top_content", title: "Top Content" },
  { key: "activities", title: "Activities & Engagement" },
  { key: "focus", title: "Focus for the Next Month" },
  { key: "conclusion", title: "Conclusion" },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];

/** Sections that hold screenshots (focus and conclusion are text only). */
export const SHOT_SECTIONS = [
  "executive",
  "reach",
  "views",
  "engagement",
  "visits",
  "audience",
  "top_content",
  "activities",
] as const;
export type ShotSection = (typeof SHOT_SECTIONS)[number];

/** What a screenshot shows. Drives where and how it is laid out. */
export const SHOT_KINDS = [
  "content_overview",
  "reach",
  "views",
  "profile_grid",
  "interactions",
  "visits",
  "follows",
  "demographics",
  "locations",
  "top_content",
  "searches",
  "activity",
  "other",
] as const;
export type ShotKind = (typeof SHOT_KINDS)[number];

export const SHOT_KIND_LABEL: Record<ShotKind, string> = {
  content_overview: "Content overview",
  reach: "Reach / viewers",
  views: "Views",
  profile_grid: "Profile grid (phone)",
  interactions: "Interactions",
  visits: "Visits",
  follows: "Follows",
  demographics: "Age & gender",
  locations: "Cities & countries",
  top_content: "Top content",
  searches: "Searches / search terms",
  activity: "Activity (posts, replies, reviews)",
  other: "Other",
};

/** Default section for each kind of screenshot. */
export const KIND_SECTION: Record<ShotKind, ShotSection> = {
  content_overview: "executive",
  reach: "reach",
  views: "views",
  profile_grid: "views",
  interactions: "engagement",
  visits: "visits",
  follows: "visits",
  demographics: "audience",
  locations: "audience",
  top_content: "top_content",
  searches: "audience",
  activity: "activities",
  other: "executive",
};

export interface Metric {
  label: string;
  value: string;
}

export interface NamedValue {
  name: string;
  value: string;
}

export interface PostStat {
  title: string;
  date: string;
  views: string;
  likes: string;
  comments: string;
  shares: string;
}

/** Numbers Claude read off one screenshot. */
export interface Extraction {
  description: string;
  metrics: Metric[];
  gender: Metric[];
  topAgeRange: string;
  cities: NamedValue[];
  countries: NamedValue[];
  posts: PostStat[];
}

export interface Shot {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  fileName: string;
  platform: Platform | null;
  kind: ShotKind;
  section: ShotSection;
  order: number;
  status: "pending" | "analysing" | "done" | "error";
  /** Kept in the portal but left out of the report (e.g. a card showing 0). */
  hidden?: boolean;
  /** Extra context for Claude, e.g. which dashboard a cut-out card came from. */
  context?: string;
  /** Fingerprint of the uploaded file, to spot the same screenshot uploaded twice. */
  source?: string;
  /** Already a phone mockup (screenshot inside a drawn phone): shown as it is, never re-framed. */
  framed?: boolean;
  /** Version of the screenshot reading that produced `extraction` (see lib/pipeline.ts). */
  read?: number;
  error?: string;
  extraction?: Extraction;
}

export type EnglishVariant = "en-GB" | "en-US";

export interface Client {
  id: string;
  name: string;
  logoDataUrl: string;
  english: EnglishVariant;
  description: string;
  website?: string;
  createdAt: number;
  /** Last change; used to merge with Google Drive. Older clients only have createdAt. */
  updatedAt?: number;
}

export interface MetricBlock {
  section: Exclude<ShotSection, "executive" | "audience" | "top_content">;
  platform: Platform;
  metrics: Metric[];
  text: string;
}

export interface AudienceBlock {
  platform: Platform;
  metrics: Metric[];
  gender: Metric[];
  text: string;
  locations: NamedValue[];
  countries: NamedValue[];
  locationsText: string;
}

export interface TopContentBlock {
  platform: Platform;
  items: { title: string; detail: string }[];
  summary: string;
}

/** Work the agency did this month (posts, replies, reviews answered...). */
export interface Activities {
  summary: string;
  items: string[];
}

export interface FocusItem {
  title: string;
  situation: string;
  implementation: string;
}

export interface ReportText {
  executiveSummary: string;
  blocks: MetricBlock[];
  audience: AudienceBlock[];
  topContent: TopContentBlock[];
  activities?: Activities;
  focus: FocusItem[];
  conclusion: string;
}

export interface Suggestion {
  id: string;
  path: string;
  original: string;
  replacement: string;
  reason: string;
  type: "grammar" | "spelling" | "style" | "consistency" | "number";
}

export interface Report {
  id: string;
  clientId: string;
  /** ISO date yyyy-mm-dd */
  periodStart: string;
  periodEnd: string;
  preparedDate: string;
  platforms: Platform[];
  shots: Shot[];
  text: ReportText | null;
  suggestions: Suggestion[];
  /** Version of the screenshot-reading/writing steps last used (see lib/pipeline.ts). */
  pipeline?: number;
  /** Erase Meta's red/green "↓ 99.7%" change labels from screenshots (default on). */
  hideChanges?: boolean;
  /** When the last proofread ran (cleared when the text is rewritten). */
  proofreadAt?: number;
  /** Claude spend on this report so far, in US dollars (counted in the browser). */
  aiCost?: number;
  createdAt: number;
  updatedAt: number;
}

export const emptyText = (): ReportText => ({
  executiveSummary: "",
  blocks: [],
  audience: [],
  topContent: [],
  focus: [],
  conclusion: "",
});

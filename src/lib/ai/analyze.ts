import type Anthropic from "@anthropic-ai/sdk";
import * as z from "zod";
import { PLATFORMS, SHOT_KINDS } from "@/lib/types";
import { ClaudeError, structuredCall, type Model } from "./call";

const metric = z.object({ label: z.string(), value: z.string() });
const named = z.object({ name: z.string(), value: z.string() });

const AnalysisSchema = z.object({
  platform: z.enum([...PLATFORMS, "unknown"]),
  platformSure: z.boolean(),
  kind: z.enum(SHOT_KINDS),
  useful: z.boolean(),
  empty: z.boolean(),
  description: z.string(),
  metrics: z.array(metric),
  gender: z.array(metric),
  topAgeRange: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  cities: z.array(named),
  countries: z.array(named),
  posts: z.array(
    z.object({
      title: z.string(),
      date: z.string(),
      views: z.string(),
      likes: z.string(),
      comments: z.string(),
      shares: z.string(),
    }),
  ),
});

const SYSTEM = `You read screenshots of social media analytics dashboards for a monthly client report: Meta Business Suite (Facebook, Instagram), TikTok Studio, YouTube Studio, LinkedIn Page analytics, Pinterest Analytics, Google Business Profile performance ("gmb"), or the apps themselves.

For the screenshot, decide:
- platform: the platform the data belongs to (facebook, instagram, tiktok, youtube, linkedin, pinterest, gmb). Meta Business Suite shows the selected account in a switcher at the top ("Facebook ▾" or "Instagram ▾"): when it is visible it decides the platform, even if the page looks the same for both. Otherwise use the Facebook or Instagram icon next to the card title or in the breakdown. Google Business Profile ("Business Profile", "Performance", calls, directions, website clicks, "Searches", Google Maps/Search) is "gmb". A screenshot of a profile in a phone app belongs to that app. Use "unknown" only if there is really no clue.
- platformSure: true when something in the image shows the platform (the Meta switcher, a logo or icon, the app or site itself); false when you had to guess.
- kind, which decides where it goes in the report:
  - content_overview: a summary card with several headline numbers (views, reach, interactions, watch time) and usually a chart
  - reach: a single "Reach", "Viewers", "Unique viewers", "Impressions", "Unique visitors" or Google "Profile views"/"People viewed your Business Profile" card or chart
  - views: a single "Views" or "Video views" card or chart
  - profile_grid: a phone screenshot of the account's profile or photo grid / video grid
  - interactions: "Content interactions", "Link clicks", likes, comments, shares, reactions, saves, "Outbound clicks", engagement rate, or Google Business "Interactions" (calls, website clicks, directions, bookings, messages)
  - visits: "Visits", "Profile visits", "Page visits", "Page views" or "Profile views" (LinkedIn page views and unique visitors count here too)
  - follows: "Follows", "New followers", "Subscribers gained"
  - demographics: followers total with an age and gender chart
  - locations: top towns/cities and top countries
  - top_content: a list or row of top posts / videos / pins with their stats
  - searches: Google Business "Searches" breakdown or search terms people used to find the business
  - activity: proof of work done this month rather than results: posts or stories published, a content calendar, replies to comments or messages, review replies, community engagement, a Google Business post or offer
  - other: anything else
- useful: false when the image holds no report data at all, e.g. a page header or top bar, a date picker, a "Set a goal" or promotional banner, navigation tabs. Otherwise true.
- empty: true when the card's headline number is 0 and its chart shows no activity (e.g. "Link clicks 0" with a flat line). Otherwise false.
- description: one short sentence saying what the screenshot shows. For activity screenshots say what was done, with counts where visible (e.g. "Replies to 6 comments on the Ganesh Chaturthi post").
- metrics: every headline number exactly as shown, with a clear label in Title Case, e.g. {"label":"Views","value":"296"}, {"label":"Watch Time","value":"1m 26s"}. Copy numbers exactly; keep "1.5K" as "1.5K" unless the exact figure is also shown, in which case prefer the exact figure. Do not include chart axis values.
- gender: e.g. [{"label":"Women","value":"60.5%"},{"label":"Men","value":"39.5%"}] when shown, otherwise [].
- topAgeRange: the age range(s) with the largest bars, e.g. "25–44", otherwise "".
- periodStart / periodEnd: the date range the screenshot shows (date picker, "Last 30 days" with dates, "Lifetime: 2 Sep 2023 – 1 Oct 2026"), as YYYY-MM-DD. Use "" when no dates are visible; never guess them.
- cities / countries: every row shown, name shortened to the city or country (e.g. "Mumbai", not "Mumbai, Maharashtra, India"), value as shown with % sign.
- posts: for top content, each post with its caption start as title, date, and the view/like/comment/share numbers ("" when not shown).

When a card breaks a number down by platform (e.g. Meta's Instagram "Views 1.5K" with "35 views" from Facebook and "1,418 views" from Instagram), use the figure for the screenshot's own platform as the main metric (Views: 1,418) and add the total as a separate metric (e.g. "Total Views (Facebook + Instagram)": "1.5K").

Never invent numbers. Leave arrays empty and strings "" when something is not visible.`;

export type Analysis = z.infer<typeof AnalysisSchema>;

function imageBlock(dataUrl: string): Anthropic.Beta.BetaImageBlockParam {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(dataUrl ?? "");
  if (!match) throw new ClaudeError("Expected a PNG, JPEG, WebP or GIF image", 400);
  const mediaType = match[1] as "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  return { type: "image", source: { type: "base64", media_type: mediaType, data: match[2] } };
}

/** Reads one screenshot (a data URL) and returns its platform, type and numbers. */
export async function analyzeScreenshot(
  client: Anthropic,
  dataUrl: string,
  fileName?: string,
  /** Extra context, e.g. "This card was cut from a Facebook dashboard for 1–30 September". */
  hint?: string,
  model?: Model,
): Promise<Analysis> {
  return structuredCall(client, {
    schema: AnalysisSchema,
    system: SYSTEM,
    // Reading numbers off a screenshot needs little reasoning; low effort keeps it cheap.
    effort: "low",
    maxTokens: 8000,
    model,
    content: [
      imageBlock(dataUrl),
      {
        type: "text",
        text: `Analyse this screenshot${fileName ? ` (file name: ${fileName})` : ""}.${hint ? `\n\n${hint}` : ""}`,
      },
    ],
  });
}

const PlatformSchema = z.object({ platform: z.enum([...PLATFORMS, "unknown"]) });

/** Just names the platform of a whole dashboard (much cheaper than a full read). */
export async function identifyPlatform(client: Anthropic, dataUrl: string, model?: Model) {
  const { platform } = await structuredCall(client, {
    schema: PlatformSchema,
    system:
      "You identify which social media or business platform an analytics screenshot is from: facebook, instagram, tiktok, youtube, linkedin, pinterest or gmb (Google Business Profile). In Meta Business Suite the switcher at the top (\"Facebook ▾\" or \"Instagram ▾\") decides it. Otherwise use logos, icons, colours and wording. Answer unknown if you cannot tell.",
    effort: "low",
    maxTokens: 2000,
    model,
    content: [imageBlock(dataUrl), { type: "text", text: "Which platform is this?" }],
  });
  return platform;
}

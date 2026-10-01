import type Anthropic from "@anthropic-ai/sdk";
import * as z from "zod";
import { SHOT_KINDS } from "@/lib/types";
import { ClaudeError, structuredCall } from "./call";

const metric = z.object({ label: z.string(), value: z.string() });
const named = z.object({ name: z.string(), value: z.string() });

const AnalysisSchema = z.object({
  platform: z.enum(["facebook", "instagram", "tiktok", "youtube", "unknown"]),
  kind: z.enum(SHOT_KINDS),
  description: z.string(),
  metrics: z.array(metric),
  gender: z.array(metric),
  topAgeRange: z.string(),
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

const SYSTEM = `You read screenshots of social media analytics dashboards (Meta Business Suite for Facebook and Instagram, TikTok Analytics / TikTok Studio, YouTube Studio, or the apps themselves) for a monthly client report.

For the screenshot, decide:
- platform: the platform the data belongs to. Meta Business Suite shows a Facebook or Instagram icon next to the card title or in the breakdown. A screenshot of a profile in a phone app belongs to that app. Use "unknown" only if there is really no clue.
- kind, which decides where it goes in the report:
  - content_overview: a summary card with several headline numbers (views, reach, interactions, watch time) and usually a chart
  - reach: a single "Reach", "Viewers", "Unique viewers" or "Impressions" card or chart
  - views: a single "Views" or "Video views" card or chart
  - profile_grid: a phone screenshot of the account's profile or photo grid / video grid
  - interactions: "Content interactions", likes, comments, shares or engagement
  - visits: "Visits", "Profile visits", "Page visits" or "Profile views"
  - follows: "Follows", "New followers", "Subscribers gained"
  - demographics: followers total with an age and gender chart
  - locations: top towns/cities and top countries
  - top_content: a list or row of top posts / videos with their stats
  - other: anything else
- description: one short sentence saying what the screenshot shows.
- metrics: every headline number exactly as shown, with a clear label in Title Case, e.g. {"label":"Views","value":"296"}, {"label":"Watch Time","value":"1m 26s"}. Copy numbers exactly; keep "1.5K" as "1.5K" unless the exact figure is also shown, in which case prefer the exact figure. Do not include chart axis values.
- gender: e.g. [{"label":"Women","value":"60.5%"},{"label":"Men","value":"39.5%"}] when shown, otherwise [].
- topAgeRange: the age range(s) with the largest bars, e.g. "25–44", otherwise "".
- cities / countries: every row shown, name shortened to the city or country (e.g. "Mumbai", not "Mumbai, Maharashtra, India"), value as shown with % sign.
- posts: for top content, each post with its caption start as title, date, and the view/like/comment/share numbers ("" when not shown).

Never invent numbers. Leave arrays empty and strings "" when something is not visible.`;

export type Analysis = z.infer<typeof AnalysisSchema>;

/** Reads one screenshot (a data URL) and returns its platform, type and numbers. */
export async function analyzeScreenshot(client: Anthropic, dataUrl: string, fileName?: string): Promise<Analysis> {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(dataUrl ?? "");
  if (!match) throw new ClaudeError("Expected a PNG, JPEG, WebP or GIF image", 400);
  const mediaType = match[1] as "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  return structuredCall(client, {
    schema: AnalysisSchema,
    system: SYSTEM,
    effort: "medium",
    maxTokens: 8000,
    content: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: match[2] } },
      { type: "text", text: `Analyse this screenshot${fileName ? ` (file name: ${fileName})` : ""}.` },
    ],
  });
}

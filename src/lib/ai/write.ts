import type Anthropic from "@anthropic-ai/sdk";
import * as z from "zod";
import { PLATFORMS, type ReportText } from "@/lib/types";
import { structuredCall } from "./call";
import { STYLE_EXAMPLE } from "./style-guide";



const platform = z.enum(PLATFORMS);
const metric = z.object({ label: z.string(), value: z.string() });
const named = z.object({ name: z.string(), value: z.string() });

const WriteSchema = z.object({
  executiveSummary: z.string(),
  blocks: z.array(
    z.object({
      section: z.enum(["reach", "views", "engagement", "visits"]),
      platform,
      metrics: z.array(metric),
      text: z.string(),
    }),
  ),
  audience: z.array(
    z.object({
      platform,
      metrics: z.array(metric),
      gender: z.array(metric),
      text: z.string(),
      locations: z.array(named),
      countries: z.array(named),
      locationsText: z.string(),
    }),
  ),
  topContent: z.array(
    z.object({
      platform,
      items: z.array(z.object({ title: z.string(), detail: z.string() })),
      summary: z.string(),
    }),
  ),
  focus: z.array(
    z.object({ title: z.string(), situation: z.string(), implementation: z.string() }),
  ),
  conclusion: z.string(),
});

export interface WriteRequest {
  client: { name: string; description: string; website?: string; english: "en-GB" | "en-US" };
  period: string;
  month: string;
  platforms: string[];
  shots: {
    platform: string | null;
    kind: string;
    section: string;
    extraction?: unknown;
  }[];
}

function systemPrompt(english: "en-GB" | "en-US") {
  const variant =
    english === "en-GB"
      ? "British English (organisation, behaviour, localised, analyse, programme)"
      : "American English (organization, behavior, localized, analyze, program)";
  return `You write the text of monthly social media performance reports for SWS (Strategic Web Success), a digital marketing agency, for its clients.

Write in ${variant}. Write dates the ${english === "en-GB" ? "UK way: 14 September, 1 – 30 September 2026" : "US way: September 14, September 1 – 30, 2026"}. Tone: professional, positive but honest, concise, written by the agency to the client ("we will..."). No hype, no emojis, no exclamation marks. Use "–" for ranges (25–44) and "—" between a post title and its stats.

Use only the numbers provided in the screenshot data. Never invent, estimate or round numbers differently. If a number is not provided, leave it out rather than guessing. Do not compare with previous months unless the data includes previous figures.

Formatting (the report must not read as a wall of plain text):
- In EVERY paragraph (executive summary, each block text, audience texts, top content summaries, focus situation and implementation, conclusion), wrap the 1–2 most important phrases in **double asterisks** so they print in bold: the content themes that worked, the key finding, or the action. Bold short phrases (2–8 words), never whole sentences, never more than two per paragraph.
- Numbers are highlighted automatically by the template, so don't bold a number on its own; bold it only as part of a key phrase, e.g. **1,418 platform views**.
- List each figure once. When Meta shows Instagram "Views 1.5K" made of 35 Facebook views and 1,418 Instagram views, the Instagram Views metric is 1,418; don't also list the 1.5K combined total.

What to produce:
- executiveSummary: two short paragraphs separated by a blank line. First: overall picture for the month and which content themes worked. Second: headline numbers per platform. Bold the key themes and headline figures with **double asterisks**, as in the example.
- blocks: one entry per platform for each of the sections reach, views, engagement and visits that has data for that platform. metrics are the figures to list for that section (label in Title Case, value exactly as given), e.g. reach → Viewers or Reach; views → Views, 3-Second Video Views, Watch Time; engagement → Content Interactions, Likes, Comments, Shares; visits → Page Visits or Profile Visits, New Follows. text is one or two sentences (about 20–35 words) interpreting the numbers. Skip a platform/section with no data.
- audience: one entry per platform with demographic or location data. metrics such as Lifetime Followers; gender as given; text one or two sentences on age and gender (mention the strongest age range); locations = the top 5 cities, countries = the top 5 countries, exactly as given; locationsText one or two sentences on where the audience is.
- topContent: one entry per platform with top posts. items: up to 5 posts, title in Title Case, quoted when it is a caption (e.g. "Communication Starts Before First Words") or a descriptive name for festival/occasion posts (e.g. Ganesh Chaturthi Content); detail like "193 views and 5 likes." summary: one sentence on the themes that worked, with the key themes in **bold**.
- focus: 5 or 6 recommendations for next month, grounded in the data. title: 2–5 words, Title Case, starting with a verb (e.g. "Expand Parent Education"). situation: one sentence on what the data shows. implementation: one sentence starting with "We will".
- conclusion: two short paragraphs separated by a blank line.

Use the client's name naturally. Keep platform names capitalised correctly (Facebook, Instagram, TikTok, YouTube, Reels, Shorts).

Here is an approved report written in the house style. Match its tone and length, not its content:

<example>
${STYLE_EXAMPLE}
</example>`;
}

/** Writes all the report text from the numbers read off the screenshots. */
export async function writeReport(client: Anthropic, body: WriteRequest): Promise<ReportText> {
  const data = {
    client: body.client.name,
    aboutClient: body.client.description || "(no description given)",
    website: body.client.website || undefined,
    reportingPeriod: body.period,
    month: body.month,
    platforms: body.platforms,
    screenshots: body.shots
      .filter((s) => s.extraction)
      .map((s) => ({ platform: s.platform, kind: s.kind, section: s.section, data: s.extraction })),
  };
  return structuredCall(client, {
    schema: WriteSchema,
    system: systemPrompt(body.client.english),
    effort: "medium",
    maxTokens: 16000,
    content: `Write the report text from this data.\n\n<report_data>\n${JSON.stringify(data, null, 1)}\n</report_data>`,
  });
}

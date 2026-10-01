import * as z from "zod";
import { requireAuth } from "@/lib/server/auth";
import { errorResponse, structuredCall } from "@/lib/server/claude";
import { STYLE_EXAMPLE } from "@/lib/server/style-guide";
import { PLATFORMS } from "@/lib/types";

export const maxDuration = 300;

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

interface WriteRequest {
  client: { name: string; description: string; english: "en-GB" | "en-US" };
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

What to produce:
- executiveSummary: two short paragraphs separated by a blank line. First: overall picture for the month and which content themes worked. Second: headline numbers per platform. Wrap the key numbers and key themes in **double asterisks** for bold, as in the example.
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

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const body = (await req.json()) as WriteRequest;
    const data = {
      client: body.client.name,
      aboutClient: body.client.description || "(no description given)",
      reportingPeriod: body.period,
      month: body.month,
      platforms: body.platforms,
      screenshots: body.shots
        .filter((s) => s.extraction)
        .map((s) => ({
          platform: s.platform,
          kind: s.kind,
          section: s.section,
          data: s.extraction,
        })),
    };
    const result = await structuredCall({
      schema: WriteSchema,
      system: systemPrompt(body.client.english),
      effort: "medium",
      maxTokens: 16000,
      content: `Write the report text from this data.\n\n<report_data>\n${JSON.stringify(data, null, 1)}\n</report_data>`,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

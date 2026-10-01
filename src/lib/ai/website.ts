import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod";
import type { EnglishVariant } from "@/lib/types";
import { ClaudeError, MODEL } from "./call";

const WebsiteSchema = z.object({
  businessName: z.string(),
  description: z.string(),
});

export type WebsiteSummary = z.infer<typeof WebsiteSchema>;

export interface WebsiteRequest {
  url: string;
  english: EnglishVariant;
}

function normaliseUrl(input: string): URL {
  try {
    return new URL(/^https?:\/\//i.test(input) ? input : `https://${input.trim()}`);
  } catch {
    throw new ClaudeError("That doesn't look like a website address.", 400);
  }
}

/**
 * Claude visits the client's website (home page plus a few About/Services pages
 * on the same site) and writes the short client description used for reports.
 */
export async function describeWebsite(client: Anthropic, req: WebsiteRequest): Promise<WebsiteSummary> {
  const url = normaliseUrl(req.url);
  const domain = url.hostname.replace(/^www\./, "");
  const english = req.english === "en-US" ? "American English" : "British English";

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `Read this client's website: ${url.href}

Look at the home page and, if useful, up to three more pages on the same site (About, Services, Contact).
Then return:
- businessName: the brand name as the business writes it.
- description: 2–3 sentences in ${english} for a social media agency's notes: what the business does, its main services or products, where it is based or serves, and who its customers are. Plain and factual, no marketing language. If the site doesn't say something, leave it out rather than guessing.`,
    },
  ];

  try {
    // Web fetching runs on Anthropic's side; long fetches may pause and need a nudge to continue.
    for (let turn = 0; turn < 4; turn++) {
      const res = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(WebsiteSchema) },
        tools: [{ type: "web_fetch_20260209", name: "web_fetch", max_uses: 4, allowed_domains: [domain] }],
        messages,
      });
      if (res.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
        continue;
      }
      if (res.stop_reason === "refusal") throw new ClaudeError("Claude declined to read this website.", 422);
      if (!res.parsed_output) throw new ClaudeError("Claude couldn't read that website. Check the address.", 502);
      return res.parsed_output;
    }
    throw new ClaudeError("Reading the website took too long. Try again.", 504);
  } catch (err) {
    if (err instanceof ClaudeError) throw err;
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ClaudeError("The Anthropic API key is missing or invalid.", 401);
    }
    if (err instanceof Anthropic.APIError) {
      throw new ClaudeError(`Anthropic API error ${err.status}: ${err.message}`, 502);
    }
    throw err;
  }
}

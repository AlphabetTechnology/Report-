import type Anthropic from "@anthropic-ai/sdk";
import * as z from "zod";
import { structuredCall } from "./call";



const ProofreadSchema = z.object({
  suggestions: z.array(
    z.object({
      fieldId: z.string(),
      original: z.string(),
      replacement: z.string(),
      reason: z.string(),
      type: z.enum(["grammar", "spelling", "style", "consistency", "number"]),
    }),
  ),
});

export interface ProofreadRequest {
  english: "en-GB" | "en-US";
  clientName: string;
  fields: { id: string; label: string; text: string }[];
  facts: unknown;
}

function systemPrompt(english: "en-GB" | "en-US", clientName: string) {
  const variant =
    english === "en-GB"
      ? "British English (-ise, -our, -yse, \"programme\", \"organisation\")"
      : "American English (-ize, -or, -yze, \"program\", \"organization\")";
  return `You are the final proofreader for a client-facing social media report written by a digital marketing agency. The report must be in ${variant}.

Check every field for:
- grammar: errors, agreement, tense, articles, punctuation, run-on sentences
- spelling: typos and spellings that do not match ${english === "en-GB" ? "British" : "American"} English
- style: awkward, repetitive or unclear wording, wrong capitalisation of platform names (Facebook, Instagram, TikTok, YouTube, Reels), inconsistent dashes (use – for ranges, — between a post and its stats)
- consistency: the same metric labelled differently across the report, or the client's name spelled differently (correct name: "${clientName}")
- tone: phrases that sound machine-written rather than written by a person, e.g. "continued to", "maintained", "showcasing", "highlighting", "reinforcing", "fostering", "leveraging", "valuable", "notably", "significant", "resonate", "it's worth noting", "furthermore", "not only … but also", sentences ending in "-ing" commentary ("…, indicating strong interest"). Suggest a plainer, specific rewording; use type "style".
- dates: written the ${english === "en-GB" ? "UK way (14 September 2026, 1 – 30 September)" : "US way (September 14, 2026, September 1 – 30)"}
- number: a number in the text that does not match the screenshot data provided

Rules:
- "original" must be an exact substring of that field's text (copy it character for character, including **bold markers**), short but long enough to be unique in that field.
- "replacement" is the corrected version of exactly that substring.
- Keep **bold markers** intact: never remove them, and keep them around the same phrase.
- Keep the agency's meaning and tone; do not rewrite sentences that are already correct. Only suggest a style change when it is a clear improvement.
- "reason" is a short explanation for the team, e.g. "US spelling; this client uses UK English".
- Return an empty list if the text is already correct.`;
}

export type RawSuggestion = z.infer<typeof ProofreadSchema>["suggestions"][number];

/** Proofreads every field; only returns suggestions that can be applied as-is. */
export async function proofreadReport(client: Anthropic, body: ProofreadRequest): Promise<{ suggestions: RawSuggestion[] }> {
  const fields = body.fields.filter((f) => f.text.trim());
  if (!fields.length) return { suggestions: [] };
  const result = await structuredCall(client, {
    schema: ProofreadSchema,
    system: systemPrompt(body.english, body.clientName),
    effort: "medium",
    maxTokens: 16000,
    content: `<fields>\n${JSON.stringify(fields, null, 1)}\n</fields>\n\n<screenshot_data>\n${JSON.stringify(body.facts)}\n</screenshot_data>\n\nProofread every field.`,
  });
  const byId = new Map(fields.map((f) => [f.id, f.text]));
  return {
    suggestions: result.suggestions.filter(
      (s) => s.original !== s.replacement && byId.get(s.fieldId)?.includes(s.original),
    ),
  };
}

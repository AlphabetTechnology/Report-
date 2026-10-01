import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod";

export const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export class ClaudeError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

type Content = Anthropic.Beta.BetaContentBlockParam[] | string;

/**
 * One Claude call that returns JSON matching `schema`.
 * Refusals fall back to Anthropic's recommended model automatically.
 */
export async function structuredCall<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: Content;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new ClaudeError("ANTHROPIC_API_KEY is not set on the server. Add it to .env.local or your Vercel project.");
  }
  try {
    const res = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: opts.effort,
        format: betaZodOutputFormat(opts.schema),
      },
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
    });
    if (res.stop_reason === "refusal") {
      throw new ClaudeError("Claude declined this request.", 422);
    }
    if (res.stop_reason === "max_tokens") {
      throw new ClaudeError("The response was cut off. Try again.", 502);
    }
    if (!res.parsed_output) {
      throw new ClaudeError("Claude returned an unexpected response.", 502);
    }
    return res.parsed_output as z.infer<S>;
  } catch (err) {
    if (err instanceof ClaudeError) throw err;
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ClaudeError("The Anthropic API key is missing or invalid.", 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new ClaudeError("Rate limited by Anthropic. Wait a moment and retry.", 429);
    }
    if (err instanceof Anthropic.BadRequestError) {
      throw new ClaudeError(`Bad request: ${err.message}`, 400);
    }
    if (err instanceof Anthropic.APIError) {
      throw new ClaudeError(`Anthropic API error ${err.status}: ${err.message}`, 502);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new ClaudeError("Could not reach the Anthropic API.", 503);
    }
    throw err;
  }
}

export function errorResponse(err: unknown): Response {
  const status = err instanceof ClaudeError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unknown error";
  console.error(err);
  return Response.json({ error: message }, { status });
}

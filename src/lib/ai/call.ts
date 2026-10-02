import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod";

export const MODEL = "claude-opus-5-5";
/** Half the price of Opus; used for reading screenshots when the team picks "Economy". */
export const ECONOMY_MODEL = "claude-sonnet-5-5";
export const MODELS = [MODEL, ECONOMY_MODEL] as const;
export type Model = (typeof MODELS)[number];
export const isModel = (m: unknown): m is Model => MODELS.includes(m as Model);

/** Token counts from one call, reported so the app can show what it spent. */
export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}
let usageListener: ((u: Usage) => void) | null = null;
export function onUsage(fn: ((u: Usage) => void) | null) {
  usageListener = fn;
}
export function reportUsage(model: string, u: Omit<Usage, "model"> | undefined) {
  if (u) usageListener?.({ ...u, model });
}


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
export async function structuredCall<S extends z.ZodType>(
  client: Anthropic,
  opts: {
  schema: S;
  system: string;
  content: Content;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
  model?: Model;
  },
): Promise<z.infer<S>> {
  try {
    const res = await client.beta.messages.parse({
      model: opts.model ?? MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: opts.effort,
        format: betaZodOutputFormat(opts.schema),
      },
      // The instructions are the same on every call of a kind, so they are cached
      // (later calls pay a tenth of the price for them).
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: opts.content }],
    });
    reportUsage(res.model, res.usage);
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
      throw new ClaudeError("The Anthropic API key is missing or invalid.", 401);
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

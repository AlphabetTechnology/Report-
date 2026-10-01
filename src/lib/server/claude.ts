import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ClaudeError } from "@/lib/ai/call";

let client: Anthropic | null = null;

/** Server-side client; reads ANTHROPIC_API_KEY from the environment. */
export function serverClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new ClaudeError("ANTHROPIC_API_KEY is not set on the server. Add it to .env.local or your Vercel project.");
  }
  return (client ??= new Anthropic());
}

export function errorResponse(err: unknown): Response {
  const status = err instanceof ClaudeError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unknown error";
  console.error(err);
  return Response.json({ error: message }, { status });
}

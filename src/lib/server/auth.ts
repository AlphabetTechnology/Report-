import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "sws_auth";

export const tokenFor = (password: string) =>
  createHash("sha256").update(`sws-report:${password}`).digest("hex");

/**
 * When APP_PASSWORD is set, the AI routes need the team password cookie.
 * Returns a 401 response when the caller is not signed in, otherwise null.
 */
export async function requireAuth(): Promise<Response | null> {
  const password = process.env.APP_PASSWORD;
  if (!password) return null;
  const jar = await cookies();
  if (jar.get(AUTH_COOKIE)?.value === tokenFor(password)) return null;
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

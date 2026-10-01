import { cookies } from "next/headers";
import { AUTH_COOKIE, tokenFor } from "@/lib/server/auth";

export async function GET() {
  // Lets the app know whether a password is needed and whether it is signed in.
  const password = process.env.APP_PASSWORD;
  if (!password) return Response.json({ required: false, signedIn: true });
  const jar = await cookies();
  return Response.json({
    required: true,
    signedIn: jar.get(AUTH_COOKIE)?.value === tokenFor(password),
  });
}

export async function POST(req: Request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return Response.json({ ok: true });
  const body = (await req.json()) as { password?: string };
  if (body.password !== password) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  const jar = await cookies();
  jar.set(AUTH_COOKIE, tokenFor(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return Response.json({ ok: true });
}

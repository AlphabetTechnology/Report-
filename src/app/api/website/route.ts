import { describeWebsite, type WebsiteRequest } from "@/lib/ai/website";
import { requireAuth } from "@/lib/server/auth";
import { errorResponse, serverClient } from "@/lib/server/claude";

export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const body = (await req.json()) as WebsiteRequest;
    return Response.json(await describeWebsite(serverClient(), body));
  } catch (err) {
    return errorResponse(err);
  }
}

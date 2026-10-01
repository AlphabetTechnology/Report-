import { analyzeScreenshot } from "@/lib/ai/analyze";
import { requireAuth } from "@/lib/server/auth";
import { errorResponse, serverClient } from "@/lib/server/claude";

export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const { dataUrl, fileName } = (await req.json()) as { dataUrl: string; fileName?: string };
    return Response.json(await analyzeScreenshot(serverClient(), dataUrl, fileName));
  } catch (err) {
    return errorResponse(err);
  }
}

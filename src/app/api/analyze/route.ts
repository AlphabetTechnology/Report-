import { analyzeScreenshot, identifyPlatform } from "@/lib/ai/analyze";
import { isModel } from "@/lib/ai/call";
import { requireAuth } from "@/lib/server/auth";
import { errorResponse, serverClient } from "@/lib/server/claude";

export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const { dataUrl, fileName, hint, model, mode } = (await req.json()) as {
      dataUrl: string;
      fileName?: string;
      hint?: string;
      model?: string;
      mode?: "platform";
    };
    const m = isModel(model) ? model : undefined;
    if (mode === "platform") return Response.json({ platform: await identifyPlatform(serverClient(), dataUrl, m) });
    return Response.json(await analyzeScreenshot(serverClient(), dataUrl, fileName, hint, m));
  } catch (err) {
    return errorResponse(err);
  }
}

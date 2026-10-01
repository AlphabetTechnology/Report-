import { proofreadReport, type ProofreadRequest } from "@/lib/ai/proofread";
import { requireAuth } from "@/lib/server/auth";
import { errorResponse, serverClient } from "@/lib/server/claude";

export const maxDuration = 300;

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const body = (await req.json()) as ProofreadRequest;
    return Response.json(await proofreadReport(serverClient(), body));
  } catch (err) {
    return errorResponse(err);
  }
}

import { z } from "zod";
import { bodyJson, failure, ok } from "@/lib/api";
import { enforceMutationOrigin, requireAuth } from "@/lib/auth/request";
import { parseFinancialMessage } from "@/domain/import-parser";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request); enforceMutationOrigin(request, auth.via);
    const input = z.object({ message: z.string().min(1).max(1000), source: z.string().min(1).max(255), timestamp: z.string().datetime({ offset: true }).optional() }).strict().parse(await bodyJson(request));
    return ok(parseFinancialMessage(input.message, input.timestamp ? new Date(input.timestamp) : new Date(), input.source));
  } catch (error) { return failure(error); }
}


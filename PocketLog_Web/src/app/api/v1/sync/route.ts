import { ObjectId } from "mongodb";
import { z } from "zod";
import { createEnvelopeSchema, isResourceName, updateEnvelopeSchema } from "@/contracts/resources";
import { ApiError, bodyJson, failure, ok } from "@/lib/api";
import { enforceMutationOrigin, requireAuth } from "@/lib/auth/request";
import { database } from "@/lib/db";
import { createResource, updateResource } from "@/lib/resources";

const operation = z.discriminatedUnion("method", [
  z.object({ method: z.literal("POST"), resource: z.string(), body: createEnvelopeSchema }),
  z.object({ method: z.literal("PATCH"), resource: z.string(), id: z.string(), body: updateEnvelopeSchema }),
]);

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const params = new URL(request.url).searchParams;
    const limit = z.coerce.number().int().min(1).max(500).catch(200).parse(params.get("limit") ?? 200);
    const cursor = params.get("cursor");
    if (cursor && !ObjectId.isValid(cursor)) throw new ApiError(400, "BAD_REQUEST", "Invalid sync cursor");
    const filter: Record<string, unknown> = { ownerId: auth.ownerId };
    if (cursor) filter._id = { $gt: new ObjectId(cursor) };
    const changes = await (await database()).collection("sync_changes").find(filter).sort({ _id: 1 }).limit(limit + 1).toArray();
    const hasMore = changes.length > limit;
    const page = hasMore ? changes.slice(0, limit) : changes;
    return ok({
      changes: page.map((item) => { const change = { ...item }; delete change.ownerId; delete change.changeKey; return change; }),
      nextCursor: page.at(-1)?._id.toHexString() ?? cursor ?? null,
      hasMore,
    });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request); enforceMutationOrigin(request, auth.via);
    const input = z.object({ operations: z.array(operation).min(1).max(25) }).strict().parse(await bodyJson(request));
    const results = [];
    for (const op of input.operations) {
      if (!isResourceName(op.resource)) { results.push({ ok: false, error: "Unknown resource" }); continue; }
      try {
        const value = op.method === "POST"
          ? await createResource(op.resource, auth.ownerId, op.body.data, op.body.idempotencyKey, op.body.clientId)
          : await updateResource(op.resource, auth.ownerId, op.id, op.body.version, op.body.data);
        results.push({ ok: true, value });
      } catch (error) { results.push({ ok: false, error: error instanceof Error ? error.message : "Operation failed" }); }
    }
    return ok({ results });
  } catch (error) { return failure(error); }
}

import { z } from "zod";
import { bodyJson, failure, ok, ApiError } from "@/lib/api";
import { enforceMutationOrigin, requireAuth } from "@/lib/auth/request";
import { isResourceName, updateEnvelopeSchema } from "@/contracts/resources";
import { deleteResource, getResource, updateResource } from "@/lib/resources";

type Context = { params: Promise<{ resource: string; id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const auth = await requireAuth(request); const { resource, id } = await context.params;
    if (!isResourceName(resource)) throw new ApiError(404, "NOT_FOUND", "Unknown resource");
    return ok(await getResource(resource, auth.ownerId, id));
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const auth = await requireAuth(request); enforceMutationOrigin(request, auth.via);
    const { resource, id } = await context.params;
    if (!isResourceName(resource)) throw new ApiError(404, "NOT_FOUND", "Unknown resource");
    const input = updateEnvelopeSchema.parse(await bodyJson(request));
    return ok(await updateResource(resource, auth.ownerId, id, input.version, input.data));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const auth = await requireAuth(request); enforceMutationOrigin(request, auth.via);
    const { resource, id } = await context.params;
    if (!isResourceName(resource)) throw new ApiError(404, "NOT_FOUND", "Unknown resource");
    const version = z.coerce.number().int().positive().parse(new URL(request.url).searchParams.get("version"));
    return ok(await deleteResource(resource, auth.ownerId, id, version));
  } catch (error) { return failure(error); }
}


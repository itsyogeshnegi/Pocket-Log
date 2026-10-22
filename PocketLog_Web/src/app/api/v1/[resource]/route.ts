import { bodyJson, failure, ok, ApiError } from "@/lib/api";
import { enforceMutationOrigin, requireAuth } from "@/lib/auth/request";
import { createEnvelopeSchema, isResourceName } from "@/contracts/resources";
import { createResource, listResources } from "@/lib/resources";

type Context = { params: Promise<{ resource: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const auth = await requireAuth(request);
    const { resource } = await context.params;
    if (!isResourceName(resource)) throw new ApiError(404, "NOT_FOUND", "Unknown resource");
    return ok(await listResources(resource, auth.ownerId, new URL(request.url).searchParams));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const auth = await requireAuth(request); enforceMutationOrigin(request, auth.via);
    const { resource } = await context.params;
    if (!isResourceName(resource)) throw new ApiError(404, "NOT_FOUND", "Unknown resource");
    const input = createEnvelopeSchema.parse(await bodyJson(request));
    return ok(await createResource(resource, auth.ownerId, input.data, input.idempotencyKey, input.clientId), { status: 201 });
  } catch (error) { return failure(error); }
}


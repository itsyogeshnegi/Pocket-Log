import { ObjectId } from "mongodb";
import { z } from "zod";
import { bodyJson, failure, ok } from "@/lib/api";
import { enforceMutationOrigin, requireAuth } from "@/lib/auth/request";
import { cloudinaryClient } from "@/lib/cloudinary";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request); enforceMutationOrigin(request, auth.via);
    const input = z.object({ resourceType: z.enum(["image", "raw"]), documentId: z.string().refine(ObjectId.isValid) }).strict().parse(await bodyJson(request));
    const timestamp = Math.floor(Date.now() / 1000); const publicId = `pocketlog/${auth.ownerId.toHexString()}/${input.documentId}/${new ObjectId().toHexString()}`;
    const params = { public_id: publicId, timestamp, type: "authenticated", overwrite: false, invalidate: true } as const;
    const signature = cloudinaryClient().utils.api_sign_request(params, env().CLOUDINARY_API_SECRET!);
    return ok({ ...params, signature, cloudName: env().CLOUDINARY_CLOUD_NAME, apiKey: env().CLOUDINARY_API_KEY, resourceType: input.resourceType });
  } catch (error) { return failure(error); }
}


import { ObjectId } from "mongodb";
import { z } from "zod";
import { bodyJson, failure, ok, ApiError } from "@/lib/api";
import { enforceMutationOrigin, requireAuth } from "@/lib/auth/request";
import { cloudinaryClient } from "@/lib/cloudinary";
import { database } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request); enforceMutationOrigin(request, auth.via);
    const input = z.object({ documentId: z.string().refine(ObjectId.isValid), publicId: z.string().min(1).max(255), resourceType: z.enum(["image", "raw"]) }).strict().parse(await bodyJson(request));
    const expectedPrefix = `pocketlog/${auth.ownerId.toHexString()}/${input.documentId}/`;
    if (!input.publicId.startsWith(expectedPrefix)) throw new ApiError(403, "FORBIDDEN", "Upload does not belong to this document");
    const cloud = await cloudinaryClient().api.resource(input.publicId, { resource_type: input.resourceType, type: "authenticated" });
    const result = await (await database()).collection("documents").findOneAndUpdate(
      { _id: new ObjectId(input.documentId), ownerId: auth.ownerId, deletedAt: { $exists: false } },
      { $set: { cloudinaryPublicId: input.publicId, cloudinaryAssetId: cloud.asset_id, resourceType: input.resourceType, byteSize: cloud.bytes, storageState: "synced", updatedAt: new Date() }, $inc: { version: 1 } }, { returnDocument: "after" },
    );
    if (!result) throw new ApiError(404, "NOT_FOUND", "Document metadata not found");
    return ok(result);
  } catch (error) { return failure(error); }
}


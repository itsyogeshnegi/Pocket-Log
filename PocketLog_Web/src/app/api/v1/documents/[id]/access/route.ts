import { ObjectId } from "mongodb";
import { failure, ok, ApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
import { cloudinaryClient } from "@/lib/cloudinary";
import { database } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request); const { id } = await params;
    if (!ObjectId.isValid(id)) throw new ApiError(400, "BAD_REQUEST", "Invalid document ID");
    const document = await (await database()).collection("documents").findOne({ _id: new ObjectId(id), ownerId: auth.ownerId, deletedAt: { $exists: false } });
    if (!document?.cloudinaryPublicId || !document.resourceType) throw new ApiError(404, "NOT_FOUND", "Cloud document not found");
    const format = String(document.fileType).split("/").at(-1) || "bin";
    const url = cloudinaryClient().utils.private_download_url(document.cloudinaryPublicId, format, { resource_type: document.resourceType, type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 300, attachment: new URL(request.url).searchParams.get("download") === "1" });
    return ok({ url, expiresAt: new Date(Date.now() + 300_000).toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}


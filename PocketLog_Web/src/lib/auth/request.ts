import { cookies, headers } from "next/headers";
import { ObjectId } from "mongodb";
import { ApiError } from "@/lib/api";
import { allowedOrigins } from "@/lib/env";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { database } from "@/lib/db";

export type AuthContext = { ownerId: ObjectId; sessionId: ObjectId; via: "bearer" | "cookie" };

export async function requireAuth(request?: Request): Promise<AuthContext> {
  const headerStore = await headers();
  const authorization = request?.headers.get("authorization") ?? headerStore.get("authorization");
  const cookieStore = await cookies();
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : cookieStore.get("pocketlog_access")?.value;
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  try {
    const claims = await verifyAccessToken(token);
    if (!ObjectId.isValid(claims.userId) || !ObjectId.isValid(claims.sessionId)) throw new Error("Malformed claims");
    const ownerId=new ObjectId(claims.userId);const sessionId=new ObjectId(claims.sessionId);
    const session=await(await database()).collection("sessions").findOne({_id:sessionId,ownerId,revokedAt:{$exists:false},expiresAt:{$gt:new Date()}},{projection:{_id:1}});
    if(!session)throw new Error("Revoked session");
    return { ownerId, sessionId, via: authorization ? "bearer" : "cookie" };
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Session expired or invalid");
  }
}

export function enforceMutationOrigin(request: Request, via: AuthContext["via"]) {
  if (via === "bearer") return;
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) throw new ApiError(403, "FORBIDDEN", "Request origin is not allowed");
}


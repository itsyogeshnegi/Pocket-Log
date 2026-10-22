import { ObjectId } from "mongodb";
import { database } from "@/lib/db";
import { createAccessToken, hashRefreshToken, newRefreshToken, type SessionDocument } from "@/lib/auth/tokens";
import { ApiError } from "@/lib/api";

const REFRESH_DAYS = 30;

export async function startSession(ownerId: ObjectId, userAgent?: string) {
  const db = await database();
  const refreshToken = newRefreshToken();
  const now = new Date();
  const document: SessionDocument = {
    _id: new ObjectId(), ownerId, tokenHash: hashRefreshToken(refreshToken), userAgent: userAgent?.slice(0, 300),
    expiresAt: new Date(now.getTime() + REFRESH_DAYS * 86400_000), createdAt: now, updatedAt: now,
  };
  await db.collection<SessionDocument>("sessions").insertOne(document);
  return { accessToken: await createAccessToken(ownerId.toHexString(), document._id.toHexString()), refreshToken, sessionId: document._id.toHexString(), expiresInSeconds: 600 };
}

export async function rotateSession(refreshToken: string) {
  const db = await database();
  const hash = hashRefreshToken(refreshToken);
  const session = await db.collection<SessionDocument>("sessions").findOne({ $or: [{ tokenHash: hash }, { previousTokenHash: hash }] });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new ApiError(401, "UNAUTHORIZED", "Refresh session is invalid or expired");
  if (session.previousTokenHash === hash) {
    await db.collection<SessionDocument>("sessions").updateOne({ _id: session._id }, { $set: { revokedAt: new Date(), updatedAt: new Date() } });
    throw new ApiError(401, "UNAUTHORIZED", "Refresh token reuse detected; session revoked");
  }
  const nextRefresh = newRefreshToken();
  const rotated=await db.collection<SessionDocument>("sessions").updateOne({ _id: session._id, tokenHash: hash, revokedAt: { $exists: false } }, {
    $set: { tokenHash: hashRefreshToken(nextRefresh), previousTokenHash: hash, updatedAt: new Date(), expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400_000) },
  });
  if(rotated.modifiedCount!==1){await db.collection<SessionDocument>("sessions").updateOne({_id:session._id},{$set:{revokedAt:new Date(),updatedAt:new Date()}});throw new ApiError(401,"UNAUTHORIZED","Concurrent refresh detected; session revoked")}
  return { accessToken: await createAccessToken(session.ownerId.toHexString(), session._id.toHexString()), refreshToken: nextRefresh, sessionId: session._id.toHexString(), expiresInSeconds: 600 };
}

export async function revokeSession(sessionId: ObjectId) {
  await (await database()).collection("sessions").updateOne({ _id: sessionId }, { $set: { revokedAt: new Date(), updatedAt: new Date() } });
}


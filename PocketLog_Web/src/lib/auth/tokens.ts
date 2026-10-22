import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";

const encoder = new TextEncoder();
const accessKey = () => encoder.encode(env().AUTH_SECRET);

export async function createAccessToken(userId: string, sessionId: string) {
  return new SignJWT({ sid: sessionId, type: "access" }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime("10m").sign(accessKey());
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, accessKey(), { algorithms: ["HS256"] });
  if (payload.type !== "access" || !payload.sub || typeof payload.sid !== "string") throw new Error("Invalid access token");
  return { userId: payload.sub, sessionId: payload.sid };
}

export function newRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).update(env().REFRESH_TOKEN_PEPPER).digest("hex");
}

export type SessionDocument = {
  _id: ObjectId; ownerId: ObjectId; tokenHash: string; previousTokenHash?: string;
  userAgent?: string; expiresAt: Date; revokedAt?: Date; createdAt: Date; updatedAt: Date;
};


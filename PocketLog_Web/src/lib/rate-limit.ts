import { createHash } from "node:crypto";
import { database } from "@/lib/db";
import { ApiError } from "@/lib/api";

export async function rateLimit(key: string, limit = 10, windowSeconds = 60) {
  const db = await database();
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const id = createHash("sha256").update(`${key}:${bucket}`).digest("hex");
  const now = new Date();
  const result = await db.collection<{ count: number }>("rate_limits").findOneAndUpdate(
    { _id: id } as never,
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + windowSeconds * 2000) } },
    { upsert: true, returnDocument: "after" },
  );
  if ((result?.count ?? 0) > limit) throw new ApiError(429, "RATE_LIMITED", "Too many requests");
}


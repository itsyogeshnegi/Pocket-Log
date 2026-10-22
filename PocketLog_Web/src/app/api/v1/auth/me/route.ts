import { failure, ok, ApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
import { database } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { ownerId } = await requireAuth(request);
    const user = await (await database()).collection("users").findOne({ _id: ownerId }, { projection: { email: 1, name: 1, timezone: 1, locale: 1 } });
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Account no longer exists");
    return ok(user);
  } catch (error) { return failure(error); }
}


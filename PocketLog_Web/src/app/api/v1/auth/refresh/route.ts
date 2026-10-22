import { cookies } from "next/headers";
import { z } from "zod";
import { bodyJson, failure, ok, ApiError } from "@/lib/api";
import { rotateSession } from "@/lib/auth/session-service";
import { setSessionCookies } from "@/lib/auth/cookies";

export async function POST(request: Request) {
  try {
    const isMobile = request.headers.get("x-client-platform") === "mobile";
    let token = (await cookies()).get("pocketlog_refresh")?.value;
    if (isMobile) token = z.object({ refreshToken: z.string().min(20) }).parse(await bodyJson(request)).refreshToken;
    if (!token) throw new ApiError(401, "UNAUTHORIZED", "Refresh token required");
    const next = await rotateSession(token);
    if (!isMobile) await setSessionCookies(next);
    return ok({ accessToken: isMobile ? next.accessToken : undefined, refreshToken: isMobile ? next.refreshToken : undefined, expiresInSeconds: next.expiresInSeconds });
  } catch (error) { return failure(error); }
}


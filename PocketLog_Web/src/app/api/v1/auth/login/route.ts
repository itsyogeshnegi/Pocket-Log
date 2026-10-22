import { z } from "zod";
import { database } from "@/lib/db";
import { bodyJson, failure, ok, ApiError } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session-service";
import { setSessionCookies } from "@/lib/auth/cookies";
import { rateLimit } from "@/lib/rate-limit";

const inputSchema = z.object({ email: z.string().email().transform((v) => v.toLowerCase()), password: z.string().min(1), client: z.enum(["web", "mobile"]).default("web") }).strict();

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    await rateLimit(`login:${ip}`, 8, 300);
    const input = inputSchema.parse(await bodyJson(request));
    const user = await (await database()).collection<{ passwordHash: string; email: string; name: string }>("users").findOne({ email: input.email, disabledAt: { $exists: false } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw new ApiError(401, "UNAUTHORIZED", "Invalid email or password");
    const tokens = await startSession(user._id, request.headers.get("user-agent") ?? undefined);
    if (input.client === "web") await setSessionCookies(tokens);
    return ok({ user: { id: user._id.toHexString(), email: user.email, name: user.name }, accessToken: input.client === "mobile" ? tokens.accessToken : undefined, refreshToken: input.client === "mobile" ? tokens.refreshToken : undefined, expiresInSeconds: tokens.expiresInSeconds });
  } catch (error) { return failure(error); }
}


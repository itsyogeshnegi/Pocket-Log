import { failure, ok } from "@/lib/api";
import { clearSessionCookies } from "@/lib/auth/cookies";
import { enforceMutationOrigin, requireAuth } from "@/lib/auth/request";
import { revokeSession } from "@/lib/auth/session-service";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request); enforceMutationOrigin(request, auth.via);
    await revokeSession(auth.sessionId); await clearSessionCookies();
    return ok({ loggedOut: true });
  } catch (error) { return failure(error); }
}


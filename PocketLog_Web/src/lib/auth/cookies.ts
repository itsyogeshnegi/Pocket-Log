import { cookies } from "next/headers";

const secure = process.env.NODE_ENV === "production";

export async function setSessionCookies(tokens: { accessToken: string; refreshToken: string }) {
  const store = await cookies();
  store.set("pocketlog_access", tokens.accessToken, { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 600 });
  store.set("pocketlog_refresh", tokens.refreshToken, { httpOnly: true, secure, sameSite: "strict", path: "/api/v1/auth", maxAge: 30 * 86400 });
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.set("pocketlog_access", "", { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 0 });
  store.set("pocketlog_refresh", "", { httpOnly: true, secure, sameSite: "strict", path: "/api/v1/auth", maxAge: 0 });
}


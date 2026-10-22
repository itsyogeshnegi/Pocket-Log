import { redirect } from "next/navigation";
import { requireAuth, type AuthContext } from "@/lib/auth/request";

export async function requirePageAuth(): Promise<AuthContext> {
  let auth: AuthContext | undefined;
  try { auth = await requireAuth(); } catch { /* redirect below, outside catch */ }
  if (!auth) redirect("/login");
  return auth;
}

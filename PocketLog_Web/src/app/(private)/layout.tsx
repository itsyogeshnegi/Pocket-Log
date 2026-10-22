import { AppShell } from "@/components/app-shell";
import { requirePageAuth } from "@/lib/auth/page";
export default async function PrivateLayout({children}:{children:React.ReactNode}){await requirePageAuth();return <AppShell>{children}</AppShell>}


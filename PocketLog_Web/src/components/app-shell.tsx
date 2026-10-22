import Link from "next/link";
import { BookOpen, Car, CreditCard, FileLock2, Gauge, HeartPulse, WalletCards } from "lucide-react";
const links=[["/dashboard","Dashboard",Gauge],["/ledger","Ledger",BookOpen],["/budgets","Budgets",WalletCards],["/habits","Habits",HeartPulse],["/vehicles","Vehicles",Car],["/documents","Documents",FileLock2],["/cards","Cards",CreditCard]] as const;
export function AppShell({children}:{children:React.ReactNode}){return <div className="shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">P</span>PocketLog</div><nav className="nav">{links.map(([href,label,Icon])=><Link key={href} href={href}><Icon size={17} style={{display:"inline",marginRight:9,verticalAlign:-3}}/>{label}</Link>)}</nav></aside><main className="content">{children}</main></div>}


import { notFound } from "next/navigation";
import { TransactionForm } from "@/components/transaction-form";
import { requirePageAuth } from "@/lib/auth/page";
import { database } from "@/lib/db";

const sections = {
  ledger: { collection: "transactions", title: "Smart ledger", description: "Income, expenses, refunds and transfers without double counting." },
  budgets: { collection: "budgets", title: "Budgets", description: "Monthly and category limits with threshold tracking." },
  habits: { collection: "habits", title: "Habits & tasks", description: "Small routines, honest streaks and guilt-free rest days." },
  vehicles: { collection: "vehicles", title: "Vehicles", description: "Fuel, mileage, maintenance and renewal records." },
  documents: { collection: "documents", title: "Document vault", description: "Private document metadata and protected cloud copies." },
  cards: { collection: "cards", title: "Card vault", description: "Minimal card metadata; full numbers remain device-only." },
} as const;

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  const config = sections[section as keyof typeof sections];
  const { ownerId } = await requirePageAuth();
  const items = await (await database()).collection(config.collection).find({ ownerId, deletedAt: { $exists: false } }).sort({ _id: -1 }).limit(50).toArray();
  return <>
    <p className="eyebrow">PocketLog</p><h1>{config.title}</h1><p className="lede">{config.description}</p>
    {section === "ledger" && <TransactionForm />}
    <section className="grid" style={{ marginTop: 20 }}><article className="card full"><h2>{items.length} saved record{items.length === 1 ? "" : "s"}</h2><div className="list">{items.length ? items.map((item) => <div className="row" key={String(item._id)}><div><strong>{String(item.name ?? item.title ?? item.merchant ?? item.nickname ?? item.kind ?? "Record")}</strong><div className="muted">Updated {new Date(item.updatedAt as Date).toLocaleDateString("en-IN")}</div></div><span className="muted">v{String(item.version)}</span></div>) : <p className="muted">Nothing here yet. Use the available action to add your first real record.</p>}</div></article></section>
  </>;
}

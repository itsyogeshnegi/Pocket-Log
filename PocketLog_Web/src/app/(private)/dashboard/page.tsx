import { summarizeTransactions } from "@/domain/finance";
import { requirePageAuth } from "@/lib/auth/page";
import { database } from "@/lib/db";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function Dashboard() {
  const { ownerId } = await requirePageAuth();
  const db = await database();
  const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
  const [transactions, pending, reminders] = await Promise.all([
    db.collection("transactions").find({ ownerId, occurredAt: { $gte: month.toISOString() }, deletedAt: { $exists: false } }).sort({ occurredAt: -1 }).limit(1000).toArray(),
    db.collection("imports").countDocuments({ ownerId, status: "pending", deletedAt: { $exists: false } }),
    db.collection("reminders").find({ ownerId, status: { $in: ["scheduled", "delivered"] }, deletedAt: { $exists: false } }).sort({ dueAt: 1 }).limit(5).toArray(),
  ]);
  const summary = summarizeTransactions(transactions as never);
  return <>
    <p className="eyebrow">This month · India</p><h1>Your life, in view.</h1>
    <p className="lede">A private overview based on your saved records—never demo balances.</p>
    <section className="grid">
      <article className="card"><span className="muted">Income</span><div className="metric positive">{money.format(summary.incomePaise / 100)}</div></article>
      <article className="card"><span className="muted">Expenses</span><div className="metric negative">{money.format(summary.expensePaise / 100)}</div></article>
      <article className="card"><span className="muted">Savings</span><div className="metric">{money.format(summary.savingsPaise / 100)}</div></article>
      <article className="card wide"><h2>Recent activity</h2><div className="list">{transactions.length ? transactions.slice(0, 6).map((item) => <div className="row" key={String(item._id)}><div><strong>{String(item.merchant || item.type)}</strong><div className="muted">{new Date(String(item.occurredAt)).toLocaleDateString("en-IN")}</div></div><strong>{money.format(Number(item.amountPaise) / 100)}</strong></div>) : <p className="muted">Add your first transaction to begin.</p>}</div></article>
      <article className="card"><h2>Needs attention</h2><div className="metric">{pending}</div><p className="muted">Imported transactions awaiting review</p><div className="list">{reminders.map((reminder) => <div className="row" key={String(reminder._id)}>{String(reminder.title)}</div>)}</div></article>
    </section>
  </>;
}

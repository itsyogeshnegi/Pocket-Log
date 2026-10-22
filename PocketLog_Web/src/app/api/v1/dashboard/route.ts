import { startOfMonth } from "date-fns";
import { failure, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth/request";
import { database } from "@/lib/db";
import { summarizeTransactions } from "@/domain/finance";

export async function GET(request: Request) {
  try {
    const { ownerId } = await requireAuth(request); const db = await database();
    const monthStart = startOfMonth(new Date());
    const [transactions, pendingImports, reminders, habits, vehicles, documents] = await Promise.all([
      db.collection("transactions").find({ ownerId, occurredAt: { $gte: monthStart.toISOString() }, deletedAt: { $exists: false } }, { projection: { type: 1, amountPaise: 1, source: 1, merchant: 1, occurredAt: 1 } }).sort({ occurredAt: -1 }).limit(2000).toArray(),
      db.collection("imports").countDocuments({ ownerId, status: "pending", deletedAt: { $exists: false } }),
      db.collection("reminders").find({ ownerId, status: { $in: ["scheduled", "delivered"] }, deletedAt: { $exists: false } }).sort({ dueAt: 1 }).limit(8).toArray(),
      db.collection("habits").countDocuments({ ownerId, status: "active", deletedAt: { $exists: false } }),
      db.collection("vehicles").find({ ownerId, deletedAt: { $exists: false } }).limit(5).toArray(),
      db.collection("documents").find({ ownerId, expiryDate: { $exists: true }, deletedAt: { $exists: false } }).sort({ expiryDate: 1 }).limit(5).toArray(),
    ]);
    return ok({ summary: summarizeTransactions(transactions as never), pendingImports, activeHabits: habits, upcomingReminders: reminders, vehicles, expiringDocuments: documents, recentTransactions: transactions.slice(0, 8), generatedAt: new Date().toISOString() });
  } catch (error) { return failure(error); }
}


import type { EntityKind } from "@/data/entities";

export const kindToResource: Record<EntityKind | "transactions", string> = {
  transactions: "transactions", habit: "habits", task: "tasks", vehicle: "vehicles", fuel: "fuel",
  maintenance: "maintenance", document: "documents", card: "cards", budget: "budgets", reminder: "reminders",
  import: "imports", category: "categories", merchantRule: "merchant-rules", creditAccount: "credit-accounts",
  payment: "payments", completion: "completions",
};

export const resourceToKind = Object.fromEntries(Object.entries(kindToResource).map(([kind, resource]) => [resource, kind])) as Record<string, EntityKind | "transactions">;

const metadata = new Set(["_id", "ownerId", "version", "createdAt", "updatedAt", "deletedAt"]);
export function remoteEntityFields(resource: string, snapshot: Record<string, unknown>) {
  const kind = resourceToKind[resource];
  if (!kind || kind === "transactions") return null;
  const title = String(snapshot.name ?? snapshot.nickname ?? snapshot.title ?? snapshot.issuer ?? `${resource} record`);
  const payload = Object.fromEntries(Object.entries(snapshot).filter(([key]) => !metadata.has(key)));
  return { kind, title, payload };
}

import type { SQLiteDatabase } from "expo-sqlite";
import { entityApiPayload, type EntityKind } from "@/data/entities";
import { createOperationId } from "@/data/ids";
import { remoteEntityFields, resourceToKind } from "@/data/sync-model";
import { apiRequest } from "@/services/api";

type RemoteChange = { _id: string; resource: string; recordId: string; version: number; deleted: boolean; snapshot: Record<string, unknown> };
type SyncPage = { changes: RemoteChange[]; nextCursor: string | null; hasMore: boolean };

async function preserveConflict(db: SQLiteDatabase, change: RemoteChange, localPayload: string) {
  await db.runAsync(
    "INSERT OR REPLACE INTO conflicts(id,entity_kind,entity_id,local_payload,server_payload,created_at) VALUES(?,?,?,?,?,?)",
    change._id, resourceToKind[change.resource] ?? change.resource, change.recordId, localPayload,
    JSON.stringify(change.snapshot), new Date().toISOString(),
  );
}

export async function applyRemoteChange(db: SQLiteDatabase, change: RemoteChange, force = false) {
  if (change.resource === "transactions") {
    const current = await db.getFirstAsync<{ sync_state: string; version: number }>("SELECT sync_state,version FROM transactions WHERE id=?", change.recordId);
    if (!force && current && ["pending", "failed", "conflict"].includes(current.sync_state) && change.version > current.version) {
      await preserveConflict(db, change, JSON.stringify(await db.getFirstAsync("SELECT * FROM transactions WHERE id=?", change.recordId)));
      await db.runAsync("UPDATE transactions SET sync_state='conflict' WHERE id=?", change.recordId);
      return "conflict" as const;
    }
    const s = change.snapshot;
    if (change.deleted) {
      await db.runAsync("UPDATE transactions SET deleted_at=?,sync_state='synced',version=? WHERE id=?", String(s.deletedAt ?? new Date().toISOString()), change.version, change.recordId);
      return "applied" as const;
    }
    await db.runAsync(
      `INSERT INTO transactions(id,type,amount_paise,merchant,category_id,occurred_at,notes,source,transfer_group_id,linked_record_id,sync_state,version,created_at,updated_at,deleted_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)
       ON CONFLICT(id) DO UPDATE SET type=excluded.type,amount_paise=excluded.amount_paise,merchant=excluded.merchant,category_id=excluded.category_id,occurred_at=excluded.occurred_at,notes=excluded.notes,source=excluded.source,transfer_group_id=excluded.transfer_group_id,linked_record_id=excluded.linked_record_id,sync_state='synced',version=excluded.version,updated_at=excluded.updated_at,deleted_at=NULL`,
      change.recordId, String(s.type), Number(s.amountPaise), String(s.merchant ?? ""), s.categoryId ? String(s.categoryId) : null,
      String(s.occurredAt), String(s.notes ?? ""), String(s.source ?? "manual"), s.transferGroupId ? String(s.transferGroupId) : null,
      s.linkedRecordId ? String(s.linkedRecordId) : null, "synced", change.version, String(s.createdAt ?? new Date().toISOString()), String(s.updatedAt ?? new Date().toISOString()),
    );
    return "applied" as const;
  }

  const fields = remoteEntityFields(change.resource, change.snapshot);
  if (!fields) return "ignored" as const;
  const current = await db.getFirstAsync<{ sync_state: string; version: number; payload: string }>("SELECT sync_state,version,payload FROM entities WHERE id=?", change.recordId);
  if (!force && current && ["pending", "failed", "conflict"].includes(current.sync_state) && change.version > current.version) {
    await preserveConflict(db, change, current.payload);
    await db.runAsync("UPDATE entities SET sync_state='conflict' WHERE id=?", change.recordId);
    return "conflict" as const;
  }
  const s = change.snapshot;
  if (change.deleted) {
    await db.runAsync("UPDATE entities SET deleted_at=?,sync_state='synced',version=? WHERE id=?", String(s.deletedAt ?? new Date().toISOString()), change.version, change.recordId);
    return "applied" as const;
  }
  await db.runAsync(
    `INSERT INTO entities(id,kind,title,payload,sync_state,version,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,NULL)
     ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,payload=excluded.payload,sync_state='synced',version=excluded.version,updated_at=excluded.updated_at,deleted_at=NULL`,
    change.recordId, fields.kind, fields.title, JSON.stringify(fields.payload), "synced", change.version,
    String(s.createdAt ?? new Date().toISOString()), String(s.updatedAt ?? new Date().toISOString()),
  );
  return "applied" as const;
}

export async function pullRemoteChanges(db: SQLiteDatabase) {
  let cursor = (await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_meta WHERE key='change_cursor'"))?.value ?? null;
  let applied = 0; let conflicts = 0;
  for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
    const page = await apiRequest(`/sync?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`) as SyncPage;
    await db.withTransactionAsync(async () => {
      for (const change of page.changes) {
        const result = await applyRemoteChange(db, change);
        if (result === "applied") applied++;
        if (result === "conflict") conflicts++;
      }
      if (page.nextCursor) await db.runAsync("INSERT INTO sync_meta(key,value) VALUES('change_cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", page.nextCursor);
    });
    cursor = page.nextCursor;
    if (!page.hasMore) break;
  }
  return { applied, conflicts };
}

export type ConflictRow = { id: string; entity_kind: EntityKind | "transactions"; entity_id: string; local_payload: string; server_payload: string; created_at: string };
export async function listConflicts(db: SQLiteDatabase) {
  return db.getAllAsync<ConflictRow>("SELECT id,entity_kind,entity_id,local_payload,server_payload,created_at FROM conflicts WHERE resolved_at IS NULL ORDER BY created_at DESC");
}

function resourceForKind(kind: EntityKind | "transactions") {
  if (kind === "transactions") return "transactions";
  return Object.entries(resourceToKind).find(([, candidate]) => candidate === kind)?.[0] ?? String(kind);
}

export async function resolveConflict(db: SQLiteDatabase, conflict: ConflictRow, choice: "local" | "server") {
  const server = JSON.parse(conflict.server_payload) as Record<string, unknown>;
  const version = Number(server.version ?? 1);
  if (choice === "server") {
    await applyRemoteChange(db, { _id: conflict.id, resource: resourceForKind(conflict.entity_kind), recordId: conflict.entity_id, version, deleted: Boolean(server.deletedAt), snapshot: server }, true);
    await db.runAsync("UPDATE conflicts SET resolved_at=? WHERE id=?", new Date().toISOString(), conflict.id);
    return;
  }

  let data: Record<string, unknown>;
  if (conflict.entity_kind === "transactions") {
    const row = await db.getFirstAsync<Record<string, unknown>>("SELECT type,amount_paise,merchant,category_id,occurred_at,notes,source,transfer_group_id,linked_record_id FROM transactions WHERE id=?", conflict.entity_id);
    if (!row) throw new Error("Local transaction is missing");
    data = { type: row.type, amountPaise: row.amount_paise, merchant: row.merchant, categoryId: row.category_id ?? undefined, occurredAt: row.occurred_at, notes: row.notes, source: row.source, transferGroupId: row.transfer_group_id ?? undefined, linkedRecordId: row.linked_record_id ?? undefined, currency: "INR" };
  } else {
    const row = await db.getFirstAsync<{ title: string; payload: string }>("SELECT title,payload FROM entities WHERE id=?", conflict.entity_id);
    if (!row) throw new Error("Local record is missing");
    data = entityApiPayload(conflict.entity_kind, row.title, JSON.parse(row.payload));
  }
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync("INSERT INTO sync_queue(operation_id,entity_kind,entity_id,method,payload,next_attempt_at,created_at) VALUES(?,?,?,?,?,?,?)", createOperationId(), conflict.entity_kind, conflict.entity_id, "PATCH", JSON.stringify({ ...data, version }), now, now);
    if (conflict.entity_kind === "transactions") await db.runAsync("UPDATE transactions SET version=?,sync_state='pending',updated_at=? WHERE id=?", version, now, conflict.entity_id);
    else await db.runAsync("UPDATE entities SET version=?,sync_state='pending',updated_at=? WHERE id=?", version, now, conflict.entity_id);
    await db.runAsync("UPDATE conflicts SET resolved_at=? WHERE id=?", now, conflict.id);
  });
}

import NetInfo from "@react-native-community/netinfo";
import type { SQLiteDatabase } from "expo-sqlite";
import { pullRemoteChanges } from "@/data/reconciliation";
import { kindToResource } from "@/data/sync-model";
import { ApiClientError, apiRequest } from "@/services/api";

type QueueRow = { operation_id: string; entity_kind: string; entity_id: string; method: string; payload: string; attempts: number };

export async function flushSyncQueue(db: SQLiteDatabase) {
  const network = await NetInfo.fetch();
  if (!network.isConnected) return { processed: 0, offline: true };
  const rows = await db.getAllAsync<QueueRow>(
    "SELECT operation_id,entity_kind,entity_id,method,payload,attempts FROM sync_queue WHERE next_attempt_at<=? ORDER BY created_at LIMIT 25",
    new Date().toISOString(),
  );
  let processed = 0;
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      const resource = kindToResource[row.entity_kind as keyof typeof kindToResource];
      if (!resource) throw new Error("Unsupported sync resource");
      const version = typeof payload.version === "number" ? payload.version : 1;
      const data = { ...payload }; delete data.version;
      const path = row.method === "POST" ? `/${resource}` : `/${resource}/${row.entity_id}${row.method === "DELETE" ? `?version=${version}` : ""}`;
      const body = row.method === "DELETE" ? undefined : JSON.stringify(row.method === "POST"
        ? { clientId: row.entity_id, idempotencyKey: row.operation_id, data }
        : { version, idempotencyKey: row.operation_id, data });
      await apiRequest(path, { method: row.method, body });
      await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM sync_queue WHERE operation_id=?", row.operation_id);
        if (row.entity_kind === "transactions") await db.runAsync("UPDATE transactions SET sync_state='synced' WHERE id=?", row.entity_id);
        else await db.runAsync("UPDATE entities SET sync_state='synced' WHERE id=?", row.entity_id);
      });
      processed++;
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409 && error.details?.current) {
        const now = new Date().toISOString();
        await db.withTransactionAsync(async () => {
          await db.runAsync("INSERT OR REPLACE INTO conflicts(id,entity_kind,entity_id,local_payload,server_payload,created_at) VALUES(?,?,?,?,?,?)", row.operation_id, row.entity_kind, row.entity_id, row.payload, JSON.stringify(error.details?.current), now);
          await db.runAsync("DELETE FROM sync_queue WHERE operation_id=?", row.operation_id);
          if (row.entity_kind === "transactions") await db.runAsync("UPDATE transactions SET sync_state='conflict' WHERE id=?", row.entity_id);
          else await db.runAsync("UPDATE entities SET sync_state='conflict' WHERE id=?", row.entity_id);
        });
        continue;
      }
      const attempts = row.attempts + 1;
      const delay = Math.min(3600, Math.pow(2, attempts) * 5);
      await db.runAsync("UPDATE sync_queue SET attempts=?,next_attempt_at=?,last_error=? WHERE operation_id=?", attempts, new Date(Date.now() + delay * 1000).toISOString(), error instanceof Error ? error.message.slice(0, 300) : "Sync failed", row.operation_id);
    }
  }
  return { processed, offline: false };
}

export async function synchronize(db: SQLiteDatabase) {
  const pushed = await flushSyncQueue(db);
  if (pushed.offline) return { ...pushed, pulled: 0, conflicts: 0 };
  const pulled = await pullRemoteChanges(db);
  return { ...pushed, pulled: pulled.applied, conflicts: pulled.conflicts };
}

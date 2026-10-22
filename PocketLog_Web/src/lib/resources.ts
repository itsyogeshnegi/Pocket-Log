import { ObjectId, type Document, type Filter } from "mongodb";
import { ApiError } from "@/lib/api";
import { database } from "@/lib/db";
import { resourceSchemas, type ResourceName } from "@/contracts/resources";

export type OwnedDocument = Document & { _id: ObjectId; ownerId: ObjectId; version: number; createdAt: Date; updatedAt: Date; deletedAt?: Date };

async function recordSyncChange(resource: ResourceName, ownerId: ObjectId, document: Document) {
  const snapshot = { ...document }; delete snapshot.ownerId;
  const recordId = document._id instanceof ObjectId ? document._id.toHexString() : String(document._id);
  const version = Number(document.version ?? 1);
  const changeKey = `${resource}:${recordId}:${version}`;
  await (await database()).collection("sync_changes").updateOne(
    { ownerId, changeKey },
    { $setOnInsert: { _id: new ObjectId(), ownerId, changeKey, resource, recordId, version, deleted: Boolean(document.deletedAt), snapshot, createdAt: new Date() } },
    { upsert: true },
  );
}

export async function listResources(resource: ResourceName, ownerId: ObjectId, params: URLSearchParams) {
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 30), 1), 100);
  const cursor = params.get("cursor");
  const filter: Filter<OwnedDocument> = { ownerId, deletedAt: { $exists: false } };
  if (cursor) {
    if (!ObjectId.isValid(cursor)) throw new ApiError(400, "BAD_REQUEST", "Invalid cursor");
    filter._id = { $lt: new ObjectId(cursor) };
  }
  const status = params.get("status");
  if (status) filter.status = status;
  const docs = await (await database()).collection<OwnedDocument>(resource).find(filter).sort({ _id: -1 }).limit(limit + 1).toArray();
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  return { items, nextCursor: hasMore ? items.at(-1)?._id.toHexString() : null };
}

async function priorIdempotent(ownerId: ObjectId, key: string) {
  return (await database()).collection("idempotency").findOne({ ownerId, key });
}

export async function createResource(resource: ResourceName, ownerId: ObjectId, data: unknown, key: string, clientId?: string) {
  const prior = await priorIdempotent(ownerId, key);
  if (prior?.resultId && ObjectId.isValid(String(prior.resultId))) {
    const existing = await (await database()).collection(resource).findOne({ _id: new ObjectId(String(prior.resultId)), ownerId });
    if (existing) { await recordSyncChange(resource, ownerId, existing); return existing; }
  }
  const parsed = resourceSchemas[resource].parse(data);
  const now = new Date();
  const _id = clientId && ObjectId.isValid(clientId) ? new ObjectId(clientId) : new ObjectId();
  const document = { _id, ...parsed, ownerId, version: 1, createdAt: now, updatedAt: now };
  const db = await database();
  try {
    await db.collection(resource).insertOne(document as never);
    await db.collection("idempotency").updateOne({ ownerId, key }, { $setOnInsert: { ownerId, key, resultId: _id, createdAt: now, expiresAt: new Date(now.getTime() + 7 * 86400_000) } }, { upsert: true });
    await recordSyncChange(resource, ownerId, document);
  } catch (error) {
    if (String(error).includes("E11000")) throw new ApiError(409, "CONFLICT", "This record already exists");
    throw error;
  }
  return document;
}

export async function getResource(resource: ResourceName, ownerId: ObjectId, id: string) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, "BAD_REQUEST", "Invalid record ID");
  const item = await (await database()).collection(resource).findOne({ _id: new ObjectId(id), ownerId, deletedAt: { $exists: false } });
  if (!item) throw new ApiError(404, "NOT_FOUND", "Record not found");
  return item;
}

export async function updateResource(resource: ResourceName, ownerId: ObjectId, id: string, version: number, data: unknown) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, "BAD_REQUEST", "Invalid record ID");
  const partial = resourceSchemas[resource].partial().parse(data);
  const result = await (await database()).collection(resource).findOneAndUpdate(
    { _id: new ObjectId(id), ownerId, version, deletedAt: { $exists: false } },
    { $set: { ...partial, updatedAt: new Date() }, $inc: { version: 1 } }, { returnDocument: "after" },
  );
  if (!result) {
    const current = await (await database()).collection(resource).findOne({ _id: new ObjectId(id), ownerId });
    if (current) throw new ApiError(409, "CONFLICT", "Record changed on another device", { current });
    throw new ApiError(404, "NOT_FOUND", "Record not found");
  }
  await recordSyncChange(resource, ownerId, result);
  return result;
}

export async function deleteResource(resource: ResourceName, ownerId: ObjectId, id: string, version: number) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, "BAD_REQUEST", "Invalid record ID");
  const result = await (await database()).collection(resource).findOneAndUpdate(
    { _id: new ObjectId(id), ownerId, version, deletedAt: { $exists: false } },
    { $set: { deletedAt: new Date(), updatedAt: new Date() }, $inc: { version: 1 } }, { returnDocument: "after" },
  );
  if (!result) throw new ApiError(409, "CONFLICT", "Delete rejected because the record changed or no longer exists");
  await recordSyncChange(resource, ownerId, result);
  return { id, version: result.version, deletedAt: result.deletedAt };
}


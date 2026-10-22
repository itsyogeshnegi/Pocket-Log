import "server-only";
import { Db, MongoClient } from "mongodb";
import { env } from "@/lib/env";

type MongoCache = { client?: MongoClient; promise?: Promise<MongoClient> };
const globalMongo = globalThis as typeof globalThis & { __pocketLogMongo?: MongoCache };
const cache = globalMongo.__pocketLogMongo ??= {};

export async function database(): Promise<Db> {
  if (!cache.promise) {
    cache.client = new MongoClient(env().MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8_000,
    });
    cache.promise = cache.client.connect().catch((error) => {
      cache.promise = undefined;
      throw error;
    });
  }
  const client = await cache.promise;
  return client.db();
}


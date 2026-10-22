import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { hashPassword } from "../src/lib/auth/password";

const root = process.cwd();
const localRoot = path.join(root, ".local-data");
const envPath = path.join(root, ".env.local");
const demoEmail = "demo@pocketlog.local";
const demoPassword = "PocketLog-Local-2026!";

function secret() { return randomBytes(48).toString("base64url"); }

async function mongoResponds(uri: string) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 700 });
  try { await client.db("admin").command({ ping: 1 }); return true; } catch { return false; } finally { await client.close().catch(() => undefined); }
}

async function dataPathHeldByLiveProcess(dbPath: string) {
  try {
    const pid = Number((await readFile(path.join(dbPath, "mongod.lock"), "utf8")).trim());
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
  } catch { return false; }
}

async function pocketLogAlreadyRunning() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:3000/login", { signal: AbortSignal.timeout(1500) });
      if (response.ok) return true;
    } catch { /* server is not ready */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function startOrReuseMongo() {
  for (let slot = 0; slot < 4; slot++) {
    const port = 27018 + slot;
    const dbPath = path.join(localRoot, slot === 0 ? "mongodb" : `mongodb-${slot}`);
    const uri = `mongodb://127.0.0.1:${port}/pocketlog`;
    if (await mongoResponds(uri)) return { uri, mongo: undefined as MongoMemoryServer | undefined, reused: true };
    await mkdir(dbPath, { recursive: true });
    if (await dataPathHeldByLiveProcess(dbPath)) {
      process.stdout.write(`Local MongoDB slot ${slot + 1} is locked by an unresponsive process; trying the next recovery slot.\n`);
      continue;
    }
    try {
      const mongo = await MongoMemoryServer.create({ instance: { port, portGeneration: false, dbName: "pocketlog", dbPath, storageEngine: "wiredTiger" } });
      return { uri: mongo.getUri("pocketlog"), mongo, reused: false };
    } catch (error) {
      if (slot === 3) throw error;
      process.stdout.write(`Local MongoDB slot ${slot + 1} could not start; trying the next recovery slot.\n`);
    }
  }
  throw new Error("No local MongoDB slot could be started");
}

async function ensureLocalEnv() {
  let existing = "";
  try { existing = await readFile(envPath, "utf8"); } catch { /* first local run */ }
  if (!existing && process.env.MONGODB_URI) return false;
  const embedded = existing.includes("POCKETLOG_EMBEDDED_MONGO=true") || !existing.match(/^MONGODB_URI=/m);
  if (!embedded) return false;
  const values = new Map<string, string>();
  for (const line of existing.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values.set(match[1], match[2]);
  }
  values.set("POCKETLOG_EMBEDDED_MONGO", "true");
  values.set("MONGODB_URI", "mongodb://127.0.0.1:27018/pocketlog");
  values.set("AUTH_SECRET", values.get("AUTH_SECRET") ?? secret());
  values.set("REFRESH_TOKEN_PEPPER", values.get("REFRESH_TOKEN_PEPPER") ?? secret());
  values.set("NEXT_PUBLIC_APP_ORIGIN", "http://localhost:3000");
  values.set("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000");
  values.set("POCKETLOG_LOCAL_EMAIL", demoEmail);
  values.set("POCKETLOG_LOCAL_PASSWORD", demoPassword);
  await writeFile(envPath, `${[...values].map(([key, value]) => `${key}=${value}`).join("\n")}\n`, "utf8");
  for (const [key, value] of values) process.env[key] = value;
  return true;
}

async function provisionLocalAccount(uri: string) {
  const client = new MongoClient(uri); await client.connect();
  try {
    const db = client.db(); const now = new Date();
    await db.collection("users").updateOne(
      { singletonKey: "primary" },
      { $set: { email: demoEmail, name: "PocketLog Demo", passwordHash: await hashPassword(demoPassword), timezone: "Asia/Kolkata", locale: "en-IN", updatedAt: now }, $setOnInsert: { singletonKey: "primary", createdAt: now }, $unset: { disabledAt: "", pendingDeletionAt: "" } },
      { upsert: true },
    );
    const user = await db.collection("users").findOne({ singletonKey: "primary" });
    if (!user) throw new Error("Local account provisioning failed");
    const names = ["Food", "Groceries", "Rent", "Bills", "Shopping", "Fuel", "Transport", "Healthcare", "Entertainment", "EMI", "Credit Card Payment", "SIP/Investments", "Savings", "Salary", "Refund", "Other"];
    await db.collection("categories").bulkWrite(names.map((name, order) => ({ updateOne: { filter: { ownerId: user._id, name }, update: { $setOnInsert: { ownerId: user._id, name, kind: ["Salary", "Refund"].includes(name) ? "income" : "expense", color: "#176B4A", order, active: true, version: 1, createdAt: now, updatedAt: now } }, upsert: true } })));
    await Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("rate_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("idempotency").createIndex({ ownerId: 1, key: 1 }, { unique: true }),
      db.collection("idempotency").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("sync_changes").createIndex({ ownerId: 1, changeKey: 1 }, { unique: true }),
      db.collection("transactions").createIndex({ ownerId: 1, occurredAt: -1 }),
      db.collection("imports").createIndex({ ownerId: 1, fingerprint: 1 }, { unique: true }),
      db.collection("reminders").createIndex({ ownerId: 1, dedupeKey: 1 }, { unique: true }),
    ]);
  } finally { await client.close(); }
}

async function runNext(onExit?: () => Promise<void>) {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev"], { cwd: root, env: process.env, stdio: "inherit" });
  let closing = false;
  const close = async () => {
    if (closing) return; closing = true;
    if (child.exitCode === null && !child.killed) child.kill("SIGINT");
    await onExit?.();
  };
  process.once("SIGINT", () => void close()); process.once("SIGTERM", () => void close());
  const code = await new Promise<number>((resolve) => child.once("exit", (value) => resolve(value ?? 0)));
  await close(); process.exitCode = code;
}

async function main() {
  loadEnvConfig(root, true);
  const embedded = await ensureLocalEnv();
  if (!embedded) { await runNext(); return; }
  if (await pocketLogAlreadyRunning()) {
    process.stdout.write(`PocketLog is already running at http://localhost:3000\n  Email: ${demoEmail}\n  Password: ${demoPassword}\n`);
    return;
  }
  await mkdir(localRoot, { recursive: true });
  process.env.MONGOMS_DOWNLOAD_DIR = path.join(localRoot, "mongodb-binaries");
  process.stdout.write("Starting PocketLog's persistent local MongoDB (the first run may download MongoDB)...\n");
  const { uri, mongo, reused } = await startOrReuseMongo(); process.env.MONGODB_URI = uri;
  await provisionLocalAccount(uri);
  process.stdout.write(`${reused ? "Reusing" : "Started"} PocketLog's local MongoDB at ${new URL(uri).host}\nLocal PocketLog account ready\n  Email: ${demoEmail}\n  Password: ${demoPassword}\n`);
  await runNext(async () => { if (mongo) await mongo.stop({ doCleanup: false, force: false }); });
}

main().catch((error) => { console.error("PocketLog local startup failed:", error); process.exitCode = 1; });

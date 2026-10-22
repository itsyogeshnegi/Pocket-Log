import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { MongoClient } from "mongodb";
import { z } from "zod";
import { hashPassword } from "../src/lib/auth/password";

const config = z.object({ MONGODB_URI: z.string().min(1) }).parse(process.env);
const prompt = createInterface({ input: stdin, output: stdout });

try {
  const email = (await prompt.question("Account email: ")).trim().toLowerCase();
  const name = (await prompt.question("Display name: ")).trim();
  const password = await prompt.question("Password (12+ characters; input is visible): ");
  z.string().email().parse(email); z.string().min(1).max(120).parse(name);
  const client = new MongoClient(config.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const now = new Date();
  await db.collection("users").updateOne({ singletonKey: "primary" }, { $set: { email, name, passwordHash: await hashPassword(password), timezone: "Asia/Kolkata", locale: "en-IN", updatedAt: now }, $setOnInsert: { singletonKey: "primary", createdAt: now } }, { upsert: true });
  const user = await db.collection("users").findOne({ singletonKey: "primary" });
  if (!user) throw new Error("Account provisioning failed");
  const categoryNames = ["Food","Groceries","Rent","Bills","Shopping","Fuel","Transport","Healthcare","Entertainment","EMI","Credit Card Payment","SIP/Investments","Savings","Salary","Refund","Other"];
  await db.collection("categories").bulkWrite(categoryNames.map((categoryName, order) => ({ updateOne: { filter: { ownerId: user._id, name: categoryName }, update: { $setOnInsert: { ownerId: user._id, name: categoryName, kind: ["Salary","Refund"].includes(categoryName) ? "income" : "expense", color: "#176B4A", order, active: true, version: 1, createdAt: now, updatedAt: now } }, upsert: true } })));
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("rate_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("idempotency").createIndex({ ownerId: 1, key: 1 }, { unique: true });
  await db.collection("idempotency").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("sync_changes").createIndex({ ownerId: 1, _id: 1 });
  await db.collection("sync_changes").createIndex({ ownerId: 1, changeKey: 1 }, { unique: true });
  await db.collection("transactions").createIndex({ ownerId: 1, occurredAt: -1 });
  await db.collection("transactions").createIndex({ ownerId: 1, categoryId: 1, occurredAt: -1 });
  await db.collection("budgets").createIndex({ ownerId: 1, startsOn: -1 });
  await db.collection("habits").createIndex({ ownerId: 1, status: 1, updatedAt: -1 });
  await db.collection("completions").createIndex({ ownerId: 1, habitId: 1, localDate: -1 }, { unique: true });
  await db.collection("fuel").createIndex({ ownerId: 1, vehicleId: 1, filledAt: -1 });
  await db.collection("maintenance").createIndex({ ownerId: 1, vehicleId: 1, nextDueDate: 1 });
  await db.collection("documents").createIndex({ ownerId: 1, expiryDate: 1 });
  await db.collection("imports").createIndex({ ownerId: 1, fingerprint: 1 }, { unique: true });
  await db.collection("reminders").createIndex({ ownerId: 1, dedupeKey: 1 }, { unique: true });
  await db.collection("reminders").createIndex({ ownerId: 1, dueAt: 1, status: 1 });
  await client.close();
  stdout.write("PocketLog account is ready. Existing sessions were not changed.\n");
} finally { prompt.close(); }


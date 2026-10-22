import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

const id = z.string().min(1).max(128);
const isoDateTime = z.string().datetime({ offset: true });
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().int().nonnegative().max(100_000_000_000);
const text = (max: number) => z.string().trim().max(max);

export const transactionSchema = z.object({
  type: z.enum(["expense", "income", "refund", "transfer"]),
  amountPaise: money.positive(), currency: z.literal("INR").default("INR"),
  merchant: text(160).default(""), categoryId: id.optional(), subcategoryId: id.optional(),
  occurredAt: isoDateTime, notes: text(2000).default(""), accountId: id.optional(),
  paymentMethod: text(80).optional(), receiptDocumentId: id.optional(),
  source: z.enum(["manual", "imported", "recurring", "fuel", "maintenance", "card_payment"]).default("manual"),
  transferGroupId: id.optional(), linkedRecordId: id.optional(), fingerprint: text(128).optional(),
});

export const resourceSchemas = {
  transactions: transactionSchema,
  categories: z.object({ name: text(80).min(1), parentId: id.optional(), kind: z.enum(["expense", "income", "both"]), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), icon: text(40).optional(), order: z.number().int().nonnegative(), active: z.boolean() }),
  "merchant-rules": z.object({ pattern: text(160).min(1), categoryId: id, confidence: z.number().min(0).max(1), active: z.boolean() }),
  budgets: z.object({ name: text(100).min(1), categoryId: id.optional(), amountPaise: money.positive(), period: z.enum(["monthly", "custom"]), startsOn: localDate, endsOn: localDate.optional(), rollover: z.boolean(), alertThresholds: z.array(z.number().int().min(1).max(100)).max(10) }),
  "credit-accounts": z.object({ issuer: text(120).min(1), nickname: text(80).min(1), network: text(40).optional(), classification: z.enum(["credit", "debit"]), lastFour: z.string().regex(/^\d{4}$/), statementDay: z.number().int().min(1).max(31).optional(), dueDay: z.number().int().min(1).max(31).optional(), outstandingPaise: money.optional(), minimumDuePaise: money.optional(), totalDuePaise: money.optional(), statementStatus: z.enum(["unknown", "open", "paid", "overdue"]).default("unknown"), paymentUrl: z.string().url().optional(), notes: text(2000).default("") }),
  payments: z.object({ creditAccountId: id, amountPaise: money.positive(), paidAt: isoDateTime, transactionId: id.optional(), notes: text(1000).default("") }),
  habits: z.object({ name: text(100).min(1), schedule: z.object({ frequency: z.enum(["daily", "weekly", "selected_days", "custom"]), daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(), interval: z.number().int().positive().max(365).optional() }), targetValue: z.number().positive().optional(), unit: text(32).optional(), status: z.enum(["active", "paused", "archived"]), group: text(80).optional(), icon: text(40).optional(), reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional() }),
  completions: z.object({ habitId: id, localDate, state: z.enum(["completed", "rest", "skipped", "missed"]), value: z.number().nonnegative().optional(), notes: text(1000).default("") }),
  tasks: z.object({ title: text(160).min(1), localDate, completed: z.boolean(), notes: text(1000).default("") }),
  vehicles: z.object({ nickname: text(80).min(1), manufacturer: text(100).optional(), model: text(100).optional(), registrationIdentifier: text(32).optional(), fuelType: z.enum(["petrol", "diesel", "electric", "hybrid", "other"]), purchaseDate: localDate.optional(), currentOdometerKm: z.number().nonnegative(), insuranceExpiry: localDate.optional(), pucExpiry: localDate.optional() }),
  fuel: z.object({ vehicleId: id, filledAt: isoDateTime, odometerKm: z.number().nonnegative(), litres: z.number().positive(), totalAmountPaise: money.positive(), station: text(160).optional(), fullTank: z.boolean(), notes: text(1000).default(""), transactionId: id.optional() }),
  maintenance: z.object({ vehicleId: id, kind: z.enum(["service", "oil", "tyre", "repair", "battery", "brake", "insurance", "puc", "custom"]), title: text(120).min(1), performedAt: isoDateTime.optional(), odometerKm: z.number().nonnegative().optional(), costPaise: money.optional(), nextDueDate: localDate.optional(), nextDueOdometerKm: z.number().nonnegative().optional(), transactionId: id.optional(), notes: text(1000).default("") }),
  documents: z.object({ title: text(160).min(1), category: z.enum(["identity", "personal", "vehicle", "insurance", "financial", "receipt_warranty", "other"]), tags: z.array(text(40)).max(20), issueDate: localDate.optional(), expiryDate: localDate.optional(), notes: text(2000).default(""), localOnly: z.boolean(), storageState: z.enum(["local", "pending_upload", "uploaded_unverified", "synced", "pending_delete", "failed"]), cloudinaryPublicId: text(255).optional(), cloudinaryAssetId: text(255).optional(), resourceType: z.enum(["image", "raw"]).optional(), fileType: text(120), byteSize: z.number().int().nonnegative() }),
  cards: z.object({ nickname: text(80).min(1), issuer: text(120).min(1), classification: z.enum(["credit", "debit"]), network: text(40).optional(), cardholderName: text(120).optional(), lastFour: z.string().regex(/^\d{4}$/), expiryMonth: z.number().int().min(1).max(12).optional(), expiryYear: z.number().int().min(2020).max(2200).optional(), creditAccountId: id.optional(), hasLocalPan: z.boolean().default(false) }),
  imports: z.object({ sourcePackage: text(255).optional(), sourceIdentifier: text(255).optional(), fingerprint: text(128), confidence: z.number().min(0).max(1), evidenceCodes: z.array(text(80)).max(20), parsed: transactionSchema.partial(), status: z.enum(["pending", "confirmed", "rejected", "duplicate", "unsupported"]), unsupportedReason: text(255).optional() }),
  reminders: z.object({ kind: z.enum(["budget", "payment", "habit", "maintenance", "document", "import"]), title: text(160).min(1), dueAt: isoDateTime, readAt: isoDateTime.optional(), destination: text(255), dedupeKey: text(255), status: z.enum(["scheduled", "delivered", "dismissed", "completed"]), relatedId: id.optional() }),
} as const;

export type ResourceName = keyof typeof resourceSchemas;
export const resourceNames = Object.keys(resourceSchemas) as ResourceName[];
export function isResourceName(value: string): value is ResourceName { return resourceNames.includes(value as ResourceName); }

export const createEnvelopeSchema = z.object({ clientId: id.optional(), idempotencyKey: z.string().min(8).max(128), data: z.record(z.string(), z.unknown()) }).strict();
export const updateEnvelopeSchema = z.object({ version: z.number().int().positive(), data: z.record(z.string(), z.unknown()), idempotencyKey: z.string().min(8).max(128) }).strict();


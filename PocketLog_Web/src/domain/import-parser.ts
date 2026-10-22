import { createHash } from "node:crypto";

export type ParsedImport = { amountPaise?: number; type?: "expense" | "income"; merchant?: string; occurredAt?: string; confidence: number; evidenceCodes: string[]; fingerprint: string; unsupportedReason?: string };

const amountPattern = /(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
const debitPattern = /\b(debited|spent|paid|purchase|withdrawn)\b/i;
const creditPattern = /\b(credited|received|refund)\b/i;

export function parseFinancialMessage(message: string, timestamp: Date, source: string): ParsedImport {
  const normalized = message.replace(/\s+/g, " ").trim().slice(0, 1000);
  const amountMatch = normalized.match(amountPattern);
  const numberValue = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : NaN;
  const amountPaise = Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue * 100) : undefined;
  const expense = debitPattern.test(normalized); const income = creditPattern.test(normalized);
  const type = expense !== income ? (expense ? "expense" : "income") : undefined;
  const party = "([a-z0-9][a-z0-9 .&_-]{1,60}?)(?:\\s+(?:on|ref|avl|bal)|[.,]|$)";
  const merchantMatch = normalized.match(new RegExp(`\\bat\\s+${party}`, "i"))
    ?? normalized.match(new RegExp(`\\b${income ? "from" : "to"}\\s+${party}`, "i"));
  const evidenceCodes = [amountPaise ? "amount" : "missing_amount", type ? "direction" : "ambiguous_direction", merchantMatch ? "merchant" : "missing_merchant"];
  const confidence = Math.min(1, (amountPaise ? 0.55 : 0) + (type ? 0.25 : 0) + (merchantMatch ? 0.2 : 0));
  const bucket = timestamp.toISOString().slice(0, 16);
  const fingerprint = createHash("sha256").update(`${source}|${amountPaise ?? "?"}|${type ?? "?"}|${merchantMatch?.[1]?.toLowerCase() ?? "?"}|${bucket}`).digest("hex");
  return { amountPaise, type, merchant: merchantMatch?.[1]?.trim(), occurredAt: timestamp.toISOString(), confidence, evidenceCodes, fingerprint, unsupportedReason: amountPaise ? undefined : "Notification did not expose a reliable amount" };
}


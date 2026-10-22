import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode = "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL";

export class ApiError extends Error {
  constructor(public status: number, public code: ApiErrorCode, message: string, public details?: unknown) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function failure(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Request validation failed", details: error.flatten() } }, { status: 400 });
  }
  console.error("PocketLog request failed", error instanceof Error ? { name: error.name, message: error.message } : { type: typeof error });
  return NextResponse.json({ error: { code: "INTERNAL", message: "The request could not be completed" } }, { status: 500 });
}

export async function bodyJson(request: Request): Promise<unknown> {
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > 1_000_000) throw new ApiError(413, "BAD_REQUEST", "Request body is too large");
  try { return await request.json(); } catch { throw new ApiError(400, "BAD_REQUEST", "Expected a JSON body"); }
}


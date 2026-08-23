import { NextResponse } from "next/server";
import { HttpError } from "@/lib/domains";

export function jsonError(error: unknown, fallback = 500) {
  const status =
    typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : error instanceof HttpError
        ? error.status
        : fallback;
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { logError, logWarn } from "@/lib/logging";
import { apiFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

const clientErrorReportSchema = z.object({
  type: z.enum(["error", "unhandledrejection"]),
  message: z.string().trim().min(1).max(1_000),
  stack: z.string().max(4_000).optional(),
  source: z.string().max(1_000).optional(),
  lineno: z.number().int().nonnegative().optional(),
  colno: z.number().int().nonnegative().optional(),
  url: z.string().max(1_000).optional(),
  userAgent: z.string().max(1_000).optional(),
}).strict();

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    logWarn("web.client.error_report_rejected", {
      reason: "invalid_json",
      route: "/api/client-errors",
    });

    return Response.json({ ok: false }, { status: 400 });
  }

  const parsed = clientErrorReportSchema.safeParse(body);

  if (!parsed.success) {
    logWarn("web.client.error_report_rejected", {
      reason: "validation_failed",
      route: "/api/client-errors",
      issues: parsed.error.issues,
    });

    return Response.json({ ok: false }, { status: 400 });
  }

  logError("web.client.error_reported", {
    route: "/api/client-errors",
    reportType: parsed.data.type,
    message: parsed.data.message,
    stack: parsed.data.stack,
    source: parsed.data.source,
    lineno: parsed.data.lineno,
    colno: parsed.data.colno,
    browserUrl: parsed.data.url,
    browserUserAgent: parsed.data.userAgent ?? request.headers.get("user-agent") ?? undefined,
  });

  let sourcePath: string | null = null;
  if (parsed.data.url) {
    try { sourcePath = new URL(parsed.data.url).pathname.slice(0, 500) || "/"; } catch { sourcePath = null; }
  }
  try {
    await apiFetch("/telemetry/client-error", randomUUID(), {
      method: "POST",
      body: JSON.stringify({ type: parsed.data.type, message: parsed.data.message.slice(0, 500), sourcePath }),
    });
  } catch (error) {
    logWarn("web.client.error_persistence_failed", { errorName: error instanceof Error ? error.name : typeof error });
  }

  return Response.json({ ok: true });
}

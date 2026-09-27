import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ReportScope } from "@housepoints/contracts";

const cursorPayloadSchema = z.object({
  version: z.literal(1),
  organizationId: z.string().min(1),
  scope: z.string(),
  revision: z.string().regex(/^(0|[1-9]\d*)$/),
  createdAt: z.string().datetime(),
  id: z.string().min(1),
}).strict();

type CursorPayload = z.infer<typeof cursorPayloadSchema>;

export class ReportReadError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function parseReportCursorSecret(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length < 32) throw new Error("REPORT_CURSOR_SECRET must be at least 32 characters");
  return value;
}

export function reportScopeKey(scope: ReportScope): string {
  return JSON.stringify({
    seasonId: scope.seasonId,
    houseId: scope.houseId,
    memberId: scope.memberId,
    categoryId: scope.categoryId,
    giverId: scope.giverId,
    type: scope.type,
  });
}

function sign(encoded: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encoded).digest();
}

export function encodeReportCursor(
  input: Omit<CursorPayload, "version" | "scope"> & { scope: ReportScope },
  secret: string,
): string {
  const payload: CursorPayload = {
    version: 1,
    organizationId: input.organizationId,
    scope: reportScopeKey(input.scope),
    revision: input.revision,
    createdAt: input.createdAt,
    id: input.id,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret).toString("base64url")}`;
}

export function decodeReportCursor(
  cursor: string,
  organizationId: string,
  scope: ReportScope,
  secret: string,
): CursorPayload {
  const [encoded, signature, extra] = cursor.split(".");
  if (!encoded || !signature || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(signature)) {
    throw new ReportReadError(400, "INVALID_REPORT_CURSOR", "Report cursor is invalid.");
  }
  const expected = sign(encoded, secret);
  const actual = Buffer.from(signature, "base64url");
  if (actual.toString("base64url") !== signature || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new ReportReadError(400, "INVALID_REPORT_CURSOR", "Report cursor is invalid.");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new ReportReadError(400, "INVALID_REPORT_CURSOR", "Report cursor is invalid.");
  }
  const parsed = cursorPayloadSchema.safeParse(decoded);
  if (!parsed.success || parsed.data.organizationId !== organizationId || parsed.data.scope !== reportScopeKey(scope)) {
    throw new ReportReadError(400, "INVALID_REPORT_CURSOR", "Report cursor is invalid for this report.");
  }
  return parsed.data;
}

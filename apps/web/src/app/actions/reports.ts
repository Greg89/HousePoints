"use server";

import {
  reportPageResponseSchema,
  type ReportPageRequest,
  type ReportPageResponse,
} from "@housepoints/contracts";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";

export type ReportPageErrorCode =
  | "REPORT_REFRESH_REQUIRED"
  | "REPORT_ACCESS_REVOKED"
  | "INVALID_REPORT_CURSOR"
  | "REPORTS_NOT_CONFIGURED"
  | "REPORT_UNAVAILABLE";

export type ReadReportPageResult =
  | { ok: true; page: ReportPageResponse }
  | { ok: false; code: ReportPageErrorCode; message: string };

const EXPECTED_ERROR_CODES: Record<string, ReportPageErrorCode> = {
  REPORT_REFRESH_REQUIRED: "REPORT_REFRESH_REQUIRED",
  REPORT_ACCESS_REVOKED: "REPORT_ACCESS_REVOKED",
  INVALID_REPORT_CURSOR: "INVALID_REPORT_CURSOR",
  REPORTS_NOT_CONFIGURED: "REPORTS_NOT_CONFIGURED",
};

const EXPECTED_STATUS_FALLBACK: Record<number, ReportPageErrorCode> = {
  403: "REPORT_ACCESS_REVOKED",
  409: "REPORT_REFRESH_REQUIRED",
  400: "INVALID_REPORT_CURSOR",
  503: "REPORTS_NOT_CONFIGURED",
};

export async function readReportPage(
  request: ReportPageRequest,
): Promise<ReadReportPageResult> {
  return runServerAction("readReportPage", async (context) => {
    const { requestId } = context;
    await getCurrentUserForRequest(requestId);

    const response = await apiFetch("/reports/query", requestId, {
      method: "POST",
      body: JSON.stringify(request),
    });

    try {
      const page = await parseApiResponse(
        response,
        reportPageResponseSchema,
        "Report data could not be loaded. Please try again.",
      );
      return { ok: true, page } as const;
    } catch (error) {
      if (error instanceof ApiResponseError) {
        const mapped =
          EXPECTED_ERROR_CODES[error.code] ?? EXPECTED_STATUS_FALLBACK[error.statusCode];

        if (mapped) {
          logServerActionFailed(context, error, {
            seasonId: request.seasonId,
            code: error.code,
          });
          return {
            ok: false,
            code: mapped,
            message: friendlyMessage(mapped, error.message),
          } as const;
        }

        if (error.statusCode >= 400 && error.statusCode < 500) {
          logServerActionFailed(context, error, {
            seasonId: request.seasonId,
            code: error.code,
          });
          return {
            ok: false,
            code: "REPORT_UNAVAILABLE",
            message: error.message,
          } as const;
        }
      }

      throw error;
    }
  });
}

function friendlyMessage(code: ReportPageErrorCode, fallback: string): string {
  switch (code) {
    case "REPORT_REFRESH_REQUIRED":
      return "Scores changed while loading. Refresh to see the current report.";
    case "REPORT_ACCESS_REVOKED":
      return "You no longer have access to this report.";
    case "INVALID_REPORT_CURSOR":
      return "This report link is out of date. Refresh to start over.";
    case "REPORTS_NOT_CONFIGURED":
      return "Reports are temporarily unavailable.";
    case "REPORT_UNAVAILABLE":
      return fallback;
  }
}

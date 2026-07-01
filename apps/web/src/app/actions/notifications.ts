"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  notificationMutationResponseSchema,
  pagedNotificationsSchema,
} from "@housepoints/contracts";
import {
  ApiResponseError,
  apiFetch,
  parseApiResponse,
} from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import type { NotificationMutationResult } from "@/lib/action-results";

export async function readNotifications(requestId: string = randomUUID()) {
  await getCurrentUserForRequest(requestId);
  const response = await apiFetch("/notifications/list", requestId, {
    method: "POST",
    body: JSON.stringify({ limit: 10 }),
  });

  return parseApiResponse(
    response,
    pagedNotificationsSchema,
    "Notifications could not be loaded. Please try again.",
  );
}

export async function markNotificationRead(notificationId: string): Promise<NotificationMutationResult> {
  return runServerAction("markNotificationRead", async (context) => {
    const trimmedNotificationId = notificationId.trim();

    if (!trimmedNotificationId) {
      return {
        ok: false,
        code: "NOTIFICATION_REQUIRED",
        message: "A notification is required.",
      };
    }

    const response = await apiFetch("/notifications/mark-read", context.requestId, {
      method: "POST",
      body: JSON.stringify({ notificationIds: [trimmedNotificationId] }),
    });

    try {
      const result = await parseApiResponse(
        response,
        notificationMutationResponseSchema,
        "The notification could not be marked read. Please try again.",
      );

      revalidatePath("/");

      return { ok: true, updatedCount: result.updatedCount };
    } catch (error) {
      if (!isExpectedNotificationMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error, {
        notificationId: trimmedNotificationId,
      });

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }
  });
}

export async function markAllNotificationsRead(): Promise<NotificationMutationResult> {
  return runServerAction("markAllNotificationsRead", async (context) => {
    const response = await apiFetch("/notifications/mark-all-read", context.requestId, {
      method: "POST",
      body: JSON.stringify({}),
    });

    try {
      const result = await parseApiResponse(
        response,
        notificationMutationResponseSchema,
        "Notifications could not be marked read. Please try again.",
      );

      revalidatePath("/");

      return { ok: true, updatedCount: result.updatedCount };
    } catch (error) {
      if (!isExpectedNotificationMutationFailure(error)) {
        throw error;
      }

      logServerActionFailed(context, error);

      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }
  });
}

function isExpectedNotificationMutationFailure(error: unknown): error is ApiResponseError {
  return error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500;
}

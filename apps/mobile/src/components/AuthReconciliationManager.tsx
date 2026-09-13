import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useAppAuth } from "@/context/auth-provider";
import { shouldReconcileAuthOnAppState } from "@/lib/auth-reconciliation";
import { logger, serializeError } from "@/lib/logger";

export function AuthReconciliationManager() {
  const { status, user, refreshBootstrap } = useAppAuth();
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextStatus) => {
      const now = Date.now();
      if (nextStatus !== "active") {
        backgroundedAt.current ??= now;
        return;
      }

      const shouldRefresh = shouldReconcileAuthOnAppState({
        nextStatus,
        status,
        hasUser: user !== null,
        backgroundedAt: backgroundedAt.current,
        now,
      });
      backgroundedAt.current = null;
      if (!shouldRefresh) return;

      logger.info("mobile.auth.foreground_reconciliation.started");
      void refreshBootstrap().catch((error) => {
        logger.warn(
          "mobile.auth.foreground_reconciliation.failed",
          serializeError(error),
        );
      });
    });
    return () => subscription.remove();
  }, [refreshBootstrap, status, user]);

  return null;
}

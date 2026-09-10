import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { refreshStaleActiveQueries } from "@/lib/focus-refresh";
import { logger, serializeError } from "@/lib/logger";

export function useRefreshQueriesOnFocus(queryKeys: readonly QueryKey[]) {
  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      logger.debug("mobile.queries.screen_focused", {
        queryGroups: queryKeys.map((key) => String(key[0] ?? "unknown")),
      });
      void refreshStaleActiveQueries(queryClient, queryKeys).catch((error) => {
        logger.warn("mobile.queries.focus_refresh_failed", serializeError(error));
      });
    }, [queryClient, queryKeys]),
  );
}

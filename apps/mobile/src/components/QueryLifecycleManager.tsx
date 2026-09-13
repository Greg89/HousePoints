import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { distinctBooleanListener, isNetworkOnline, subscribeToAppFocus } from "@/lib/query-lifecycle";
import { logger } from "@/lib/logger";

export function QueryLifecycleManager() {
  useEffect(() => {
    focusManager.setEventListener((setFocused) =>
      subscribeToAppFocus(AppState, distinctBooleanListener((focused) => {
        logger.debug("mobile.queries.app_focus_changed", { focused });
        setFocused(focused);
      })),
    );
    onlineManager.setEventListener((setOnline) => {
      const onOnlineChanged = distinctBooleanListener((online) => {
        logger.debug("mobile.queries.network_changed", { online });
        setOnline(online);
      });
      return NetInfo.addEventListener((state) =>
        onOnlineChanged(isNetworkOnline(state)),
      );
    });

    return () => {
      focusManager.setEventListener(() => undefined);
      onlineManager.setEventListener(() => undefined);
    };
  }, []);

  return null;
}

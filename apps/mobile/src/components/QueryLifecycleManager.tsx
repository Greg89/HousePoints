import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { isNetworkOnline, subscribeToAppFocus } from "@/lib/query-lifecycle";

export function QueryLifecycleManager() {
  useEffect(() => {
    focusManager.setEventListener((setFocused) =>
      subscribeToAppFocus(AppState, setFocused),
    );
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => setOnline(isNetworkOnline(state))),
    );

    return () => {
      focusManager.setEventListener(() => undefined);
      onlineManager.setEventListener(() => undefined);
    };
  }, []);

  return null;
}

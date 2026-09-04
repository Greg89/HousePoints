import type { AppStateStatus } from "react-native";

type AppStateSource = {
  currentState: AppStateStatus;
  addEventListener: (
    event: "change",
    listener: (status: AppStateStatus) => void,
  ) => { remove: () => void };
};

type NetworkState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

export function isAppFocused(status: AppStateStatus): boolean {
  return status === "active";
}

export function isNetworkOnline(state: NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export function subscribeToAppFocus(
  appState: AppStateSource,
  setFocused: (focused: boolean) => void,
): () => void {
  setFocused(isAppFocused(appState.currentState));
  const subscription = appState.addEventListener("change", (status) => {
    setFocused(isAppFocused(status));
  });
  return () => subscription.remove();
}

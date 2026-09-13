import { describe, expect, it, vi } from "vitest";

import { distinctBooleanListener, isAppFocused, isNetworkOnline, subscribeToAppFocus } from "./query-lifecycle";

describe("query lifecycle", () => {
  it("treats only an active app as focused", () => {
    expect(isAppFocused("active")).toBe(true);
    expect(isAppFocused("inactive")).toBe(false);
    expect(isAppFocused("background")).toBe(false);
  });

  it("requires a connection that is not known to be unreachable", () => {
    expect(isNetworkOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isNetworkOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isNetworkOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
    expect(isNetworkOnline({ isConnected: false, isInternetReachable: false })).toBe(false);
  });

  it("publishes initial and changed focus and removes its listener", () => {
    let listener: ((status: "active" | "background") => void) | undefined;
    const remove = vi.fn();
    const setFocused = vi.fn();
    const unsubscribe = subscribeToAppFocus({
      currentState: "background",
      addEventListener: (_event, nextListener) => {
        listener = nextListener;
        return { remove };
      },
    }, setFocused);

    expect(setFocused).toHaveBeenLastCalledWith(false);
    listener?.("active");
    expect(setFocused).toHaveBeenLastCalledWith(true);
    unsubscribe();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("suppresses repeated lifecycle values", () => {
    const listener = vi.fn();
    const distinct = distinctBooleanListener(listener);
    distinct(true);
    distinct(true);
    distinct(false);
    distinct(false);
    expect(listener.mock.calls).toEqual([[true], [false]]);
  });
});

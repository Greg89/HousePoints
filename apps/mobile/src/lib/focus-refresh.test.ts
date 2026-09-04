import { describe, expect, it, vi } from "vitest";

import { refreshStaleActiveQueries } from "./focus-refresh";

describe("refreshStaleActiveQueries", () => {
  it("requests only stale active queries without cancelling in-flight work", async () => {
    const refetchQueries = vi.fn().mockResolvedValue(undefined);
    await refreshStaleActiveQueries({ refetchQueries }, [["dashboard"], ["houses"]]);

    expect(refetchQueries).toHaveBeenCalledTimes(2);
    expect(refetchQueries).toHaveBeenNthCalledWith(1,
      { queryKey: ["dashboard"], type: "active", stale: true },
      { cancelRefetch: false },
    );
    expect(refetchQueries).toHaveBeenNthCalledWith(2,
      { queryKey: ["houses"], type: "active", stale: true },
      { cancelRefetch: false },
    );
  });

  it("does nothing when a screen owns no query keys", async () => {
    const refetchQueries = vi.fn().mockResolvedValue(undefined);
    await refreshStaleActiveQueries({ refetchQueries }, []);
    expect(refetchQueries).not.toHaveBeenCalled();
  });
});

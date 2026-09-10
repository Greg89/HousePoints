import { describe, expect, it } from "vitest";

import { MOBILE_QUERY_STALE_MS, mobileQueryDefaultOptions } from "./query-policy";

describe("mobile query policy", () => {
  it("keeps collaborative views fresh without polling", () => {
    const options = mobileQueryDefaultOptions();
    expect(options.staleTime).toBe(30_000);
    expect(options.refetchOnWindowFocus).toBe(true);
    expect(options.refetchOnReconnect).toBe(true);
    expect(options).not.toHaveProperty("refetchInterval");
  });

  it("uses a quieter window for member and admin reference data", () => {
    expect(MOBILE_QUERY_STALE_MS.members).toBe(60_000);
    expect(MOBILE_QUERY_STALE_MS.adminContext).toBe(60_000);
  });
});

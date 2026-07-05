import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  isValidOrganizationSlug,
  readActiveOrganizationSlug,
} from "./active-organization";
import { cookies } from "next/headers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const cookiesMock = vi.mocked(cookies);

describe("active organization selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts normalized organization slugs", () => {
    expect(isValidOrganizationSlug("acme")).toBe(true);
    expect(isValidOrganizationSlug("acme-corp-1")).toBe(true);
    expect(isValidOrganizationSlug("a")).toBe(true);
  });

  it("rejects malformed organization slugs", () => {
    expect(isValidOrganizationSlug("Acme")).toBe(false);
    expect(isValidOrganizationSlug("-acme")).toBe(false);
    expect(isValidOrganizationSlug("acme-")).toBe(false);
    expect(isValidOrganizationSlug("acme corp")).toBe(false);
  });

  it("reads the selected organization slug from the cookie", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn((name: string) => (
        name === ACTIVE_ORGANIZATION_COOKIE
          ? { name, value: "beta" }
          : undefined
      )),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    await expect(readActiveOrganizationSlug()).resolves.toBe("beta");
  });

  it("ignores invalid selected organization cookie values", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ name: ACTIVE_ORGANIZATION_COOKIE, value: "Beta Org" })),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    await expect(readActiveOrganizationSlug()).resolves.toBeNull();
  });
});

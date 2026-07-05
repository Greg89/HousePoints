import { describe, expect, it } from "vitest";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/active-organization";
import { GET } from "./route";

describe("switch organization route", () => {
  it("sets the active organization cookie and redirects to the canonical org dashboard", async () => {
    const response = await GET(
      new Request("https://app.example.com/o/beta/switch"),
      { params: Promise.resolve({ slug: "beta" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.com/o/beta");
    expect(response.headers.get("set-cookie")).toContain(`${ACTIVE_ORGANIZATION_COOKIE}=beta`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("uses forwarded host headers when the platform request URL is internal", async () => {
    const response = await GET(
      new Request("https://localhost:3000/o/beta/switch", {
        headers: {
          "x-forwarded-host": "housepointsweb-beta.up.railway.app",
          "x-forwarded-proto": "https",
        },
      }),
      { params: Promise.resolve({ slug: "beta" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://housepointsweb-beta.up.railway.app/o/beta",
    );
    expect(response.headers.get("set-cookie")).toContain(`${ACTIVE_ORGANIZATION_COOKIE}=beta`);
  });

  it("redirects without setting a cookie for invalid slugs", async () => {
    const response = await GET(
      new Request("https://app.example.com/o/Beta%20Org/switch"),
      { params: Promise.resolve({ slug: "Beta Org" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.com/o/Beta%20Org");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

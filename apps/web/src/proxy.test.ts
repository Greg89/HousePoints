import { afterEach, describe, expect, it, vi } from "vitest";

const auth0Middleware = vi.fn();

vi.mock("@/lib/auth0", () => ({
  getAuth0Client: () => ({ middleware: auth0Middleware }),
}));

import { proxy } from "./proxy";

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalLegacyHosts = process.env.APP_LEGACY_HOSTS;

afterEach(() => {
  auth0Middleware.mockReset();

  if (originalAppBaseUrl === undefined) {
    delete process.env.APP_BASE_URL;
  } else {
    process.env.APP_BASE_URL = originalAppBaseUrl;
  }

  if (originalLegacyHosts === undefined) {
    delete process.env.APP_LEGACY_HOSTS;
  } else {
    process.env.APP_LEGACY_HOSTS = originalLegacyHosts;
  }
});

describe("proxy canonical host redirect", () => {
  it("permanently redirects a legacy host while preserving path and query", async () => {
    process.env.APP_BASE_URL = "https://beta.housepoints-ds.com";
    process.env.APP_LEGACY_HOSTS = "housepointsweb-beta.up.railway.app";

    const response = await proxy(
      new Request(
        "https://housepointsweb-beta.up.railway.app/about?source=legacy",
      ),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://beta.housepoints-ds.com/about?source=legacy",
    );
    expect(auth0Middleware).not.toHaveBeenCalled();
  });

  it("uses the forwarded host supplied by Railway", async () => {
    process.env.APP_BASE_URL = "https://beta.housepoints-ds.com";
    process.env.APP_LEGACY_HOSTS = "housepointsweb-beta.up.railway.app";

    const response = await proxy(
      new Request("http://web-service.internal/privacy", {
        headers: {
          "x-forwarded-host": "housepointsweb-beta.up.railway.app",
        },
      }),
    );

    expect(response.headers.get("location")).toBe(
      "https://beta.housepoints-ds.com/privacy",
    );
  });

  it("continues through Auth0 for the canonical host", async () => {
    process.env.APP_BASE_URL = "https://beta.housepoints-ds.com";
    process.env.APP_LEGACY_HOSTS = "housepointsweb-beta.up.railway.app";
    const authResponse = new Response(null, { status: 204 });
    auth0Middleware.mockResolvedValue(authResponse);
    const request = new Request("https://beta.housepoints-ds.com/dashboard");

    const response = await proxy(request);

    expect(response).toBe(authResponse);
    expect(auth0Middleware).toHaveBeenCalledWith(request);
  });
});

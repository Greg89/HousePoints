import { beforeEach, describe, expect, it, vi } from "vitest";

const Auth0Client = vi.fn();

vi.mock("@auth0/nextjs-auth0/server", () => ({
	Auth0Client,
}));

describe("getAuth0Client", () => {
	beforeEach(() => {
		vi.resetModules();
		Auth0Client.mockClear();
		process.env.AUTH0_DOMAIN = "example.auth0.com";
		process.env.AUTH0_CLIENT_ID = "client-id";
		process.env.AUTH0_CLIENT_SECRET = "client-secret";
		process.env.AUTH0_SECRET = "auth-secret";
		process.env.AUTH0_AUDIENCE = "https://api.example.com";
	});

	it("requests API access plus profile and email claims", async () => {
		const { getAuth0Client } = await import("@/lib/auth0");

		getAuth0Client();

		expect(Auth0Client).toHaveBeenCalledWith({
			authorizationParameters: {
				audience: "https://api.example.com",
				scope: "openid profile email",
			},
		});
	});
});

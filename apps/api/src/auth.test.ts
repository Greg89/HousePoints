import { beforeEach, describe, expect, it, vi } from "vitest";

const jose = vi.hoisted(() => ({
  createRemoteJWKSet: vi.fn(() => "jwks"),
  jwtVerify: vi.fn(),
}));

vi.mock("jose", () => jose);

import {
  createAuth0AccessTokenVerifier,
  createAuth0AccessTokenVerifierFromEnv,
  createAuth0IdTokenVerifier,
  createOptionalAuth0IdTokenVerifierFromEnv,
  readBearerToken,
} from "./auth";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
});

describe("createAuth0AccessTokenVerifier", () => {
  it("normalizes Auth0 settings and verifies RS256 access tokens", async () => {
    jose.jwtVerify.mockResolvedValue({
      payload: {
        sub: "auth0|user",
        scope: "read:housepoints",
      },
    });

    const verifyAccessToken = createAuth0AccessTokenVerifier({
      domain: "example.auth0.com/",
      audience: " https://api.housepoints.example ",
    });

    await expect(verifyAccessToken("access-token")).resolves.toEqual({
      subject: "auth0|user",
      claims: {
        sub: "auth0|user",
        scope: "read:housepoints",
      },
    });

    expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(
      new URL("https://example.auth0.com/.well-known/jwks.json"),
    );
    expect(jose.jwtVerify).toHaveBeenCalledWith("access-token", "jwks", {
      issuer: "https://example.auth0.com/",
      audience: "https://api.housepoints.example",
      algorithms: ["RS256"],
    });
  });

  it("preserves explicit https Auth0 domains", async () => {
    jose.jwtVerify.mockResolvedValue({
      payload: {
        sub: "auth0|user",
      },
    });

    const verifyAccessToken = createAuth0AccessTokenVerifier({
      domain: "https://tenant.example.com",
      audience: "api",
    });

    await verifyAccessToken("access-token");

    expect(jose.createRemoteJWKSet).toHaveBeenCalledWith(
      new URL("https://tenant.example.com/.well-known/jwks.json"),
    );
    expect(jose.jwtVerify).toHaveBeenCalledWith(
      "access-token",
      "jwks",
      expect.objectContaining({
        issuer: "https://tenant.example.com/",
      }),
    );
  });

  it("rejects missing Auth0 audience configuration", () => {
    expect(() =>
      createAuth0AccessTokenVerifier({
        domain: "example.auth0.com",
        audience: " ",
      }),
    ).toThrow("AUTH0_AUDIENCE must be configured");
  });

  it("rejects tokens without a subject claim", async () => {
    jose.jwtVerify.mockResolvedValue({
      payload: {},
    });

    const verifyAccessToken = createAuth0AccessTokenVerifier({
      domain: "example.auth0.com",
      audience: "api",
    });

    await expect(verifyAccessToken("access-token")).rejects.toThrow(
      'Access token is missing required "sub" claim',
    );
  });
});

describe("createAuth0IdTokenVerifier", () => {
  it("verifies ID tokens for the Auth0 web application audience", async () => {
    jose.jwtVerify.mockResolvedValue({
      payload: {
        sub: "github|user",
        email: "alice@example.com",
        email_verified: true,
      },
    });

    const verifyIdToken = createAuth0IdTokenVerifier({
      domain: "example.auth0.com",
      clientId: "web-client-id",
    });

    await expect(verifyIdToken("id-token")).resolves.toEqual({
      subject: "github|user",
      claims: {
        sub: "github|user",
        email: "alice@example.com",
        email_verified: true,
      },
    });

    expect(jose.jwtVerify).toHaveBeenCalledWith("id-token", "jwks", {
      issuer: "https://example.auth0.com/",
      audience: "web-client-id",
      algorithms: ["RS256"],
    });
  });

  it("rejects missing Auth0 client ID configuration", () => {
    expect(() =>
      createAuth0IdTokenVerifier({
        domain: "example.auth0.com",
        clientId: " ",
      }),
    ).toThrow("AUTH0_CLIENT_ID must be configured");
  });
});

describe("createAuth0AccessTokenVerifierFromEnv", () => {
  it("creates a verifier from environment configuration", async () => {
    process.env.AUTH0_DOMAIN = "example.auth0.com";
    process.env.AUTH0_AUDIENCE = "api";
    jose.jwtVerify.mockResolvedValue({
      payload: {
        sub: "auth0|user",
      },
    });

    const verifyAccessToken = createAuth0AccessTokenVerifierFromEnv();

    await expect(verifyAccessToken("access-token")).resolves.toMatchObject({
      subject: "auth0|user",
    });
  });

  it("rejects missing Auth0 environment configuration", () => {
    delete process.env.AUTH0_DOMAIN;
    process.env.AUTH0_AUDIENCE = "api";

    expect(() => createAuth0AccessTokenVerifierFromEnv()).toThrow(
      "AUTH0_DOMAIN must be configured",
    );

    process.env.AUTH0_DOMAIN = "example.auth0.com";
    process.env.AUTH0_AUDIENCE = " ";

    expect(() => createAuth0AccessTokenVerifierFromEnv()).toThrow(
      "AUTH0_AUDIENCE must be configured",
    );
  });
});

describe("createOptionalAuth0IdTokenVerifierFromEnv", () => {
  it("returns null when ID token verification is not configured", () => {
    delete process.env.AUTH0_CLIENT_ID;
    process.env.AUTH0_DOMAIN = "example.auth0.com";

    expect(createOptionalAuth0IdTokenVerifierFromEnv()).toBeNull();
  });

  it("creates a verifier when Auth0 domain and client ID are configured", async () => {
    process.env.AUTH0_DOMAIN = "example.auth0.com";
    process.env.AUTH0_CLIENT_ID = "web-client-id";
    jose.jwtVerify.mockResolvedValue({
      payload: {
        sub: "auth0|user",
      },
    });

    const verifyIdToken = createOptionalAuth0IdTokenVerifierFromEnv();

    await expect(verifyIdToken?.("id-token")).resolves.toMatchObject({
      subject: "auth0|user",
    });
  });
});

describe("readBearerToken", () => {
  it("reads a case-insensitive bearer token", () => {
    expect(readBearerToken("bearer token-value")).toBe("token-value");
  });

  it("rejects missing and non-bearer authorization values", () => {
    expect(readBearerToken(undefined)).toBeNull();
    expect(readBearerToken("Basic credentials")).toBeNull();
    expect(readBearerToken("Bearer   ")).toBeNull();
  });
});

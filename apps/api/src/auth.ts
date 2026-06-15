import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "jose";

export type AuthPrincipal = {
  subject: string;
  claims: JWTPayload;
};

export type VerifyAccessToken = (token: string) => Promise<AuthPrincipal>;

function normalizeIssuer(domain: string): string {
  const value = domain.trim().replace(/\/+$/, "");
  return value.startsWith("https://") ? `${value}/` : `https://${value}/`;
}

export function createAuth0AccessTokenVerifier(input: {
  domain: string;
  audience: string;
}): VerifyAccessToken {
  const issuer = normalizeIssuer(input.domain);
  const audience = input.audience.trim();

  if (!audience) {
    throw new Error("AUTH0_AUDIENCE must be configured");
  }

  const jwks = createRemoteJWKSet(new URL(".well-known/jwks.json", issuer));

  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      algorithms: ["RS256"],
    });

    if (!payload.sub) {
      throw new Error('Access token is missing required "sub" claim');
    }

    return {
      subject: payload.sub,
      claims: payload,
    };
  };
}

export function createAuth0AccessTokenVerifierFromEnv(): VerifyAccessToken {
  const domain = process.env.AUTH0_DOMAIN?.trim();
  const audience = process.env.AUTH0_AUDIENCE?.trim();

  if (!domain) {
    throw new Error("AUTH0_DOMAIN must be configured");
  }

  if (!audience) {
    throw new Error("AUTH0_AUDIENCE must be configured");
  }

  return createAuth0AccessTokenVerifier({ domain, audience });
}

export function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || null;
}

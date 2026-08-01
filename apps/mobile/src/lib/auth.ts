import { useAuth0, Auth0Provider } from "react-native-auth0";
import { env } from "./env";

export { Auth0Provider, useAuth0 };

/** Auth0 client identifiers required by the native `Auth0Provider`. */
export function auth0Config(): { domain: string; clientId: string } {
  return {
    domain: env.auth0Domain,
    clientId: env.auth0ClientId,
  };
}

/** Access-token audience the API validates against (matches `AUTH0_AUDIENCE` on the API service). */
export const AUTH0_AUDIENCE = env.auth0Audience;

/** OIDC scopes requested during PKCE authorisation. `offline_access` enables refresh-token rotation. */
export const AUTH0_SCOPE = "openid profile email offline_access";

/**
 * Parameters passed to `authorize()` from `react-native-auth0`. Kept as a
 * helper so screens do not have to import the raw env values, and so any
 * future scope/audience adjustment lives in one place.
 */
export function auth0AuthorizeParams() {
  return {
    audience: AUTH0_AUDIENCE,
    scope: AUTH0_SCOPE,
  };
}

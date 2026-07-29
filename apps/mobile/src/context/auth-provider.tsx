import type { AppUser } from "@housepoints/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth0 } from "react-native-auth0";

import { ApiResponseError, callApi } from "@/lib/api-client";
import { AUTH0_SCOPE, auth0AuthorizeParams } from "@/lib/auth";
import { logger, serializeError } from "@/lib/logger";

/**
 * Auth lifecycle for the mobile app.
 *
 * Wraps `react-native-auth0`'s `useAuth0()` hook and layers the HousePoints
 * bootstrap on top: when Auth0 reports a signed-in user, we call
 * `/users/bootstrap` to fetch (or create) the corresponding `AppUser` and its
 * `organizationContexts`. Callers use `getAccessToken()` to obtain a valid
 * access token (auto-refreshed via the native credentials manager).
 */

export type AuthStatus =
  | "initializing"
  | "signedOut"
  | "bootstrapping"
  | "ready"
  | "error";

type AuthContextValue = {
  status: AuthStatus;
  user: AppUser | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  getAccessToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Minimum access-token TTL when calling `getCredentials()` — forces a refresh
 * if the current token would expire within this window. */
const MIN_TOKEN_TTL_SECONDS = 60;

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth0 = useAuth0();
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useCallback(async (): Promise<string> => {
    const credentials = await auth0.getCredentials(
      AUTH0_SCOPE,
      MIN_TOKEN_TTL_SECONDS,
    );
    if (!credentials?.accessToken) {
      throw new Error("No access token available");
    }
    return credentials.accessToken;
  }, [auth0]);

  const runBootstrap = useCallback(async (): Promise<void> => {
    setError(null);
    setStatus("bootstrapping");
    try {
      const auth0User = auth0.user;
      if (!auth0User) {
        throw new Error("Auth0 user missing after sign-in");
      }
      const displayName =
        (typeof auth0User.name === "string" && auth0User.name.trim()) ||
        (typeof auth0User.nickname === "string" && auth0User.nickname.trim()) ||
        (typeof auth0User.email === "string" && auth0User.email.trim()) ||
        "New Member";
      const email =
        typeof auth0User.email === "string" && auth0User.email.length > 0
          ? auth0User.email
          : undefined;

      const accessToken = await getAccessToken();
      const fetched = await callApi(
        "/users/bootstrap",
        email !== undefined ? { displayName, email } : { displayName },
        { accessToken },
      );

      setAppUser(fetched);
      setStatus("ready");
      logger.info("mobile.auth.bootstrap.success", {
        appUserId: fetched.id,
        membershipCount: fetched.organizationContexts.length,
      });
    } catch (err) {
      logger.error("mobile.auth.bootstrap.failed", serializeError(err));
      const message =
        err instanceof ApiResponseError
          ? err.message
          : "We could not load your account. Please try signing in again.";
      setError(message);
      setStatus("error");
    }
  }, [auth0.user, getAccessToken]);

  // React to Auth0's own lifecycle.
  useEffect(() => {
    if (auth0.isLoading) {
      setStatus((current) => (current === "initializing" ? current : "initializing"));
      return;
    }
    if (!auth0.user) {
      setAppUser((current) => {
        if (current !== null) {
          logger.info("mobile.auth.signed_out", {});
        }
        return null;
      });
      setStatus("signedOut");
      return;
    }
    // Auth0 says we have a user. If we don't yet have an AppUser, bootstrap.
    if (!appUser && status !== "bootstrapping") {
      void runBootstrap();
    }
  }, [auth0.isLoading, auth0.user, appUser, status, runBootstrap]);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await auth0.authorize(auth0AuthorizeParams());
    } catch (err) {
      logger.error("mobile.auth.sign_in.failed", serializeError(err));
      setError("Sign in was cancelled or failed. Please try again.");
      throw err;
    }
  }, [auth0]);

  const signOut = useCallback(async () => {
    try {
      await auth0.clearSession();
    } catch (err) {
      logger.warn("mobile.auth.sign_out.failed", serializeError(err));
    } finally {
      setAppUser(null);
      setStatus("signedOut");
    }
  }, [auth0]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: appUser,
      error,
      signIn,
      signOut,
      refreshBootstrap: runBootstrap,
      getAccessToken,
    }),
    [status, appUser, error, signIn, signOut, runBootstrap, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAppAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAppAuth must be used within an AuthProvider");
  }
  return value;
}

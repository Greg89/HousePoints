export type AuthBootstrapStatus =
  | "initializing"
  | "signedOut"
  | "bootstrapping"
  | "ready"
  | "error";

/**
 * Bootstrap automatically after Auth0 establishes a session, but stop after a
 * failed attempt. Error recovery is explicit through refreshBootstrap/sign-in
 * so a persistent authentication or API failure cannot create a retry loop.
 */
export function shouldStartAuthBootstrap(input: {
  hasAuth0User: boolean;
  hasAppUser: boolean;
  status: AuthBootstrapStatus;
}): boolean {
  return (
    input.hasAuth0User &&
    !input.hasAppUser &&
    input.status !== "bootstrapping" &&
    input.status !== "error"
  );
}

/** Keep an established session usable when only a background refresh fails. */
export function statusAfterBootstrapFailure(
  hasExistingAppUser: boolean,
): AuthBootstrapStatus {
  return hasExistingAppUser ? "ready" : "error";
}

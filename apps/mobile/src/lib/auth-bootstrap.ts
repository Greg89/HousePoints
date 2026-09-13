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

export function runSingleFlight<T>(
  reference: { current: Promise<T> | null },
  operation: () => Promise<T>,
): Promise<T> {
  if (reference.current) return reference.current;

  const task = operation();
  reference.current = task;
  const clear = () => {
    if (reference.current === task) reference.current = null;
  };
  void task.then(clear, clear);
  return task;
}

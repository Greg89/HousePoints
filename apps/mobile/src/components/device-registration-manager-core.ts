export type RegistrationAttemptState = {
  attemptedKey: string | null;
  shouldRegister: boolean;
};

export function updateRegistrationAttempt(
  attemptedKey: string | null,
  activeRegistrationKey: string | null,
): RegistrationAttemptState {
  if (!activeRegistrationKey) {
    return { attemptedKey: null, shouldRegister: false };
  }

  if (attemptedKey === activeRegistrationKey) {
    return { attemptedKey, shouldRegister: false };
  }

  return { attemptedKey: activeRegistrationKey, shouldRegister: true };
}

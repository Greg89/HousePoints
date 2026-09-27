/** Keeps uncertain submissions retryable for the lifetime of a form. */
export function createPointSubmissionKeys(generateKey: () => string) {
  const pending = new Map<string, string>();
  return {
    keyFor(payload: unknown): string {
      const fingerprint = JSON.stringify(payload);
      let key = pending.get(fingerprint);
      if (!key) {
        key = generateKey();
        pending.set(fingerprint, key);
      }
      return key;
    },
    complete(key: string): void {
      for (const [fingerprint, value] of pending) {
        if (value === key) pending.delete(fingerprint);
      }
    },
  };
}

/**
 * Generates a UUID v4 string suitable for use as a request-correlation id.
 * Not cryptographically strong — correlation ids are non-secret identifiers,
 * so this trades the extra `expo-crypto` native dependency for zero setup.
 */
export function generateRequestId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

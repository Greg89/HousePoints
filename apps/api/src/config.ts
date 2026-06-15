export function parseCorsAllowedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    throw new Error("CORS_ALLOWED_ORIGINS must be configured");
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      let url: URL;

      try {
        url = new URL(origin);
      } catch {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }

      if (
        (url.protocol !== "http:" && url.protocol !== "https:") ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }

      return url.origin;
    });

  if (origins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS must contain at least one origin");
  }

  return [...new Set(origins)];
}

export function readCorsAllowedOriginsFromEnv(): string[] {
  return parseCorsAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
}

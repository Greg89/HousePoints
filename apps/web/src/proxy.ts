import { NextResponse } from "next/server";
import { getAuth0Client } from "@/lib/auth0";

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

function getRequestHost(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0];
  const host = forwardedHost ?? request.headers.get("host");

  return normalizeHost(host ?? new URL(request.url).host);
}

function getCanonicalRedirect(request: Request): URL | null {
  const legacyHosts = process.env.APP_LEGACY_HOSTS
    ?.split(",")
    .map(normalizeHost)
    .filter(Boolean);

  if (!legacyHosts?.includes(getRequestHost(request))) {
    return null;
  }

  const canonicalBaseUrl = process.env.APP_BASE_URL;
  if (!canonicalBaseUrl) {
    return null;
  }

  const requestUrl = new URL(request.url);
  const redirectUrl = new URL(canonicalBaseUrl);
  redirectUrl.pathname = requestUrl.pathname;
  redirectUrl.search = requestUrl.search;

  return redirectUrl;
}

export async function proxy(request: Request) {
  const canonicalRedirect = getCanonicalRedirect(request);
  if (canonicalRedirect) {
    return NextResponse.redirect(canonicalRedirect, 308);
  }

  const auth0 = getAuth0Client();

  if (!auth0) {
    return NextResponse.next();
  }

  return auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};

import type { Page, Response } from "@playwright/test";

import { readE2EStartPath } from "./config";

const pageDiagnostics = new WeakMap<Page, string[]>();

export async function gotoE2EStart(page: Page) {
  attachE2EDiagnostics(page);

  let response: Response | null = null;
  try {
    response = await page.goto(readE2EStartPath(), { waitUntil: "domcontentloaded" });
  } catch (error) {
    throw new Error(buildNavigationFailureMessage(page, response, error));
  }

  if (page.url().startsWith("chrome-error://")) {
    throw new Error(buildNavigationFailureMessage(page, response));
  }

  return response;
}

export function getE2EDiagnostics(page: Page) {
  return [...(pageDiagnostics.get(page) ?? [])];
}

export function recordE2EDiagnostic(page: Page, message: string) {
  const events = pageDiagnostics.get(page) ?? [];
  events.push(message);
  pageDiagnostics.set(page, events.slice(-25));
}

function attachE2EDiagnostics(page: Page) {
  if (pageDiagnostics.has(page)) {
    return;
  }

  pageDiagnostics.set(page, []);

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      recordE2EDiagnostic(page, `main frame navigated: ${sanitizeUrl(frame.url())}`);
    }
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure();
    recordE2EDiagnostic(
      page,
      `${request.method()} ${sanitizeUrl(request.url())} failed: ${failure?.errorText ?? "unknown error"}`,
    );
  });

  page.on("response", (response) => {
    const request = response.request();
    if (!request.isNavigationRequest() && response.status() < 400) {
      return;
    }

    recordE2EDiagnostic(page, `${response.status()} ${sanitizeUrl(response.url())}`);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      recordE2EDiagnostic(page, `console error: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    recordE2EDiagnostic(page, `page error: ${error.message}`);
  });
}

function buildNavigationFailureMessage(page: Page, response: Response | null, error?: unknown) {
  const lines = [
    "E2E initial navigation failed before the login flow could start.",
    `Current URL: ${page.url()}`,
    `Initial response: ${response ? `${response.status()} ${sanitizeUrl(response.url())}` : "none"}`,
  ];

  if (error) {
    lines.push(`Navigation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const diagnostics = getE2EDiagnostics(page);
  if (diagnostics.length > 0) {
    lines.push("Navigation diagnostics:");
    lines.push(...diagnostics.slice(-10));
  }

  return lines.join("\n");
}

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = url.search
      ? `?${[...url.searchParams.keys()].map((key) => `${key}=...`).join("&")}`
      : "";
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

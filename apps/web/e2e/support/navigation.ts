import type { Page, Response } from "@playwright/test";

import { readE2EStartPath } from "./config";

export async function gotoE2EStart(page: Page) {
  const failedRequests: string[] = [];
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    failedRequests.push(`${request.method()} ${request.url()} failed: ${failure?.errorText ?? "unknown error"}`);
  });

  let response: Response | null = null;
  try {
    response = await page.goto(readE2EStartPath(), { waitUntil: "domcontentloaded" });
  } catch (error) {
    throw new Error(buildNavigationFailureMessage(page, response, failedRequests, error));
  }

  if (page.url().startsWith("chrome-error://")) {
    throw new Error(buildNavigationFailureMessage(page, response, failedRequests));
  }

  return response;
}

function buildNavigationFailureMessage(
  page: Page,
  response: Response | null,
  failedRequests: string[],
  error?: unknown,
) {
  const lines = [
    "E2E initial navigation failed before the login flow could start.",
    `Current URL: ${page.url()}`,
    `Initial response: ${response ? `${response.status()} ${response.url()}` : "none"}`,
  ];

  if (error) {
    lines.push(`Navigation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (failedRequests.length > 0) {
    lines.push("Failed requests:");
    lines.push(...failedRequests.slice(-5));
  }

  return lines.join("\n");
}

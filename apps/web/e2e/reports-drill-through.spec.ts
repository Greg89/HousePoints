import { expect, test } from "@playwright/test";

import { signInIfNeeded } from "./support/auth";
import { missingRequiredEnv, requiredDashboardSmokeEnv } from "./support/config";
import { expectDashboardReady } from "./support/dashboard";
import { gotoE2EStart } from "./support/navigation";

const missingEnv = missingRequiredEnv(requiredDashboardSmokeEnv);

// Opt-in: staging must set E2E_REPORTS_DRILL_THROUGH=true and have the
// REPORTS_DRILL_THROUGH_WEB_ENABLED flag on in the deployed web app.
test.skip(
  process.env.E2E_REPORTS_DRILL_THROUGH !== "true" || missingEnv.length > 0,
  `Reports drill-through E2E is opt-in and needs staging configuration: ${missingEnv.join(", ")}`,
);

test.describe("Reports drill-through", () => {
  test("dashboard house tile links into the report and back", async ({ page }) => {
    await gotoE2EStart(page);
    await signInIfNeeded(page);
    await expectDashboardReady(page);

    const fullReportLink = page.getByRole("link", { name: /full report/i }).first();
    if ((await fullReportLink.count()) === 0) {
      test.skip(true, "Dashboard is not exposing the Full report link; check REPORTS_DRILL_THROUGH_WEB_ENABLED on the deployed web app.");
    }

    await fullReportLink.click();
    await page.waitForURL(/\/reports(\?|$)/, { timeout: 30_000 });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: /recipients/i })).toBeVisible();

    await page.getByRole("link", { name: /back to dashboard/i }).click();
    await page.waitForURL(/\/o\/[^/?#]+\/?$/, { timeout: 30_000 });
    await expectDashboardReady(page);
  });

  test("award/deduction toolbar reflects the type query parameter", async ({ page }) => {
    await gotoE2EStart(page);
    await signInIfNeeded(page);
    await expectDashboardReady(page);

    const orgSlug = readOrgSlugFromUrl(page.url());
    if (!orgSlug) {
      test.skip(true, "Could not derive the organization slug from the dashboard URL.");
    }

    const response = await page.goto(`/o/${encodeURIComponent(orgSlug!)}/reports?type=AWARD`, {
      waitUntil: "domcontentloaded",
    });
    if (response && response.status() === 404) {
      test.skip(true, "Reports route returned 404; REPORTS_DRILL_THROUGH_WEB_ENABLED is likely off on the deployed web app.");
    }

    const toolbar = page.getByRole("group", { name: /award\/deduction filter/i });
    await expect(toolbar).toBeVisible();
    const awardsOption = toolbar.getByRole("link", { name: "Awards only" });
    await expect(awardsOption).toHaveAttribute("aria-pressed", "true");

    // The type chip should also appear because the filter is active.
    await expect(page.getByRole("link", { name: /remove type filter/i })).toBeVisible();

    await toolbar.getByRole("link", { name: "All" }).click();
    await page.waitForURL((url) => !url.searchParams.has("type"), { timeout: 15_000 });
    await expect(toolbar.getByRole("link", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  });

  test("mobile-width layout keeps the drill-through usable", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await gotoE2EStart(page);
    await signInIfNeeded(page);
    await expectDashboardReady(page);

    const orgSlug = readOrgSlugFromUrl(page.url());
    if (!orgSlug) {
      test.skip(true, "Could not derive the organization slug from the dashboard URL.");
    }

    const response = await page.goto(`/o/${encodeURIComponent(orgSlug!)}/reports`, {
      waitUntil: "domcontentloaded",
    });
    if (response && response.status() === 404) {
      test.skip(true, "Reports route returned 404; REPORTS_DRILL_THROUGH_WEB_ENABLED is likely off on the deployed web app.");
    }

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("group", { name: /award\/deduction filter/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /back to dashboard/i })).toBeVisible();

    // The main content column must fit inside the viewport without horizontal scroll.
    const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });
});

function readOrgSlugFromUrl(url: string): string | null {
  const match = url.match(/\/o\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return match[1]!;
  }
}

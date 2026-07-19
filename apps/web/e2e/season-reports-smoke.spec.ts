import { expect, test } from "@playwright/test";

import { signInIfNeeded } from "./support/auth";
import { missingRequiredEnv, requiredDashboardSmokeEnv } from "./support/config";
import { expectDashboardReady } from "./support/dashboard";
import { gotoE2EStart } from "./support/navigation";

const missingEnv = missingRequiredEnv(requiredDashboardSmokeEnv);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

test("historical season selection updates overview reports and leaderboard", async ({ page }) => {
  await gotoE2EStart(page);
  await signInIfNeeded(page);
  await expectDashboardReady(page);

  const reportingSeason = page.getByLabel(/reporting season:/i);
  await expect(reportingSeason).toBeVisible();

  const seasonSelector = page.getByRole("button", { name: /reporting season:/i });
  test.skip(
    await seasonSelector.count() === 0,
    "Historical season coverage requires an optional completed-season staging fixture.",
  );

  await seasonSelector.click();

  const seasonOptions = page.getByRole("listbox", { name: "Reporting season" })
    .getByRole("option");
  const historicalOptions = seasonOptions.filter({ hasNotText: /\(current\)/i });
  await expect(
    historicalOptions,
    "The staging E2E organization needs at least one completed historical season.",
  ).not.toHaveCount(0);

  const historicalSeasonName = (await historicalOptions.first().innerText()).trim();
  await historicalOptions.first().click();

  await expect(page.getByText("Loading season reports...")).toHaveCount(0);
  await expect(page.getByText("Historical season view", { exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Season recap" })).toBeVisible();
  await expect(page.getByText(
    `A quick read on recognition during ${historicalSeasonName}.`,
    { exact: true },
  )).toBeVisible();

  await page.getByRole("tab", { name: "Leaderboard" }).click();
  const leaderboard = page.getByRole("tabpanel");
  await expect(leaderboard.getByText(
    `Points received during ${historicalSeasonName}.`,
    { exact: true },
  )).toBeVisible();
  await expect(leaderboard.getByText("Historical view", { exact: true })).toBeVisible();
});

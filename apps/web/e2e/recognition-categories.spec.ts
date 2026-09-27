import { expect, test } from "@playwright/test";
import { readE2EOwnerCredentials, readTargetMemberName, requiredManageEnv, missingRequiredEnv } from "./support/config";
import { selectMemberFromCombobox } from "./support/member-picker";
import { openManage } from "./support/manage";

const missingEnv = missingRequiredEnv(requiredManageEnv);
test.skip(
  process.env.E2E_RECOGNITION_ROLLOUT !== "true" || missingEnv.length > 0,
  `Category rehearsal is opt-in and needs owner credentials and staging configuration: ${missingEnv.join(", ")}`,
);

test("owner can add, award, archive, and reuse a custom category name", async ({ page }) => {
  const name = `E2E Recognition ${Date.now()}`;
  const reason = `Playwright category rehearsal ${Date.now()}`;
  const credentials = readE2EOwnerCredentials()!;

  await openManage(page, credentials);
  await page.getByRole("navigation", { name: "Manage sections" }).getByRole("tab", { name: "Recognition" }).click();
  const active = page.getByRole("region", { name: "Active categories" });
  const archived = page.getByRole("region", { name: "Archived categories" });
  const addForm = page.getByRole("heading", { name: "Add category" }).locator("xpath=ancestor::form[1]");

  await addForm.getByRole("textbox", { name: "Name" }).fill(name);
  await addForm.getByRole("button", { name: "Add category" }).click();
  await expect(active.getByText(name, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /award points/i }).first().click();
  const award = page.getByRole("dialog", { name: /award points/i });
  await selectMemberFromCombobox(page, award, /recipient/i, readTargetMemberName());
  await award.getByRole("button", { name: "+5", exact: true }).click();
  await award.getByRole("combobox").filter({ hasText: /select a category/i }).click();
  await page.getByRole("option", { name, exact: true }).click();
  await award.getByPlaceholder(/describe what they did well/i).fill(reason);
  await award.getByRole("button", { name: /^award points$/i }).click();
  await expect(page.getByText(/points awarded/i)).toBeVisible();

  await page.getByRole("tab", { name: /activity/i }).click();
  const card = page.getByTestId("activity-card").filter({ hasText: reason });
  await expect(card.getByText(name, { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /manage/i }).click();
  await page.getByRole("navigation", { name: "Manage sections" }).getByRole("tab", { name: "Recognition" }).click();
  await archiveNamedCategory(name);
  await expect(archived.getByText(name)).toBeVisible();

  await addForm.getByRole("textbox", { name: "Name" }).fill(name);
  await addForm.getByRole("button", { name: "Add category" }).click();
  await expect(active.getByText(name, { exact: true })).toBeVisible();
  await expect(archived.getByText(name)).toBeVisible();

  await page.getByRole("tab", { name: /activity/i }).click();
  await expect(page.getByTestId("activity-card").filter({ hasText: reason }).getByText(name, { exact: true })).toBeVisible();

  async function archiveNamedCategory(categoryName: string) {
    const row = active.locator(":scope > div").filter({ has: page.getByText(categoryName, { exact: true }) });
    await row.getByRole("button", { name: "Archive", exact: true }).click();
    await row.getByRole("button", { name: "Confirm archive" }).click();
    await expect(row).toHaveCount(0);
  }
});

import type { Locator, Page } from "@playwright/test";

export async function selectAwardRecognition(page: Page, dialog: Locator) {
  await dialog.getByRole("combobox").filter({ hasText: /select a (trait|category)/i }).click();
  const name = process.env.E2E_RECOGNITION_CATEGORY_NAME?.trim() || "Collaboration";
  await page.getByRole("option", { name, exact: true }).click();
}

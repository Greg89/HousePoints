import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  missingRequiredEnv,
  readE2EReactionActorCredentials,
  readE2EReactionRecipientCredentials,
  requiredStagingEnv,
} from "./support/config";
import { signInIfNeeded } from "./support/auth";
import { expectDashboardReady } from "./support/dashboard";
import { gotoE2EStart } from "./support/navigation";
import { selectMemberFromCombobox } from "./support/member-picker";

const missingEnv = missingRequiredEnv(requiredStagingEnv);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

test("reaction notification reaches the point recipient", async ({ browser }) => {
  const reactionActorCredentials = readE2EReactionActorCredentials();
  const reactionRecipientCredentials = readE2EReactionRecipientCredentials();
  test.skip(
    !reactionActorCredentials || !reactionRecipientCredentials,
    "Missing optional E2E_REACTION_ACTOR_* or E2E_REACTION_RECIPIENT_* credentials.",
  );

  const note = `Playwright reaction notification ${Date.now()}`;

  const reactionRecipientName = await readE2EUserDisplayName(browser, reactionRecipientCredentials!);
  await createAward(browser, reactionRecipientName, note);
  const reactionActorName = await reactToAward(browser, reactionActorCredentials!, note);
  await expectRecipientNotification(browser, reactionRecipientCredentials!, reactionActorName);
});

async function createAward(browser: Browser, targetMember: string, note: string) {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await gotoE2EStart(page);
    await signInIfNeeded(page);
    await expectDashboardReady(page);

    await page.getByRole("button", { name: /award points/i }).first().click();
    const dialog = page.getByRole("dialog", { name: /award points/i });

    await selectMemberFromCombobox(page, dialog, /recipient/i, targetMember);
    await dialog.getByRole("button", { name: "+5", exact: true }).click();
    await dialog.getByText(/select a trait/i).click();
    await page.getByRole("option", { name: /collaboration/i }).click();
    await dialog.getByPlaceholder(/describe what they did well/i).fill(note);
    await dialog.getByRole("button", { name: /^award points$/i }).click();

    await expect(page.getByText(/points awarded/i)).toBeVisible();
  } finally {
    await context.close();
  }
}

async function reactToAward(
  browser: Browser,
  credentials: { email: string; password: string },
  note: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await gotoE2EStart(page);
    await signInIfNeeded(page, credentials);
    await expectDashboardReady(page);

    const reactionActorName = await readDashboardUserName(page);

    await page.getByRole("tab", { name: /activity/i }).click();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    const card = getActivityCard(page, note);
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: /open reactions for/i }).click();
    await card.getByRole("button", { name: /react with love it/i }).click();
    await expect(card.getByRole("button", { name: /remove love it reaction/i })).toHaveCount(0);
    await card.getByRole("button", { name: /open reactions for/i }).click();
    await expect(card.getByRole("button", { name: /remove love it reaction/i })).toHaveAttribute("aria-pressed", "true");

    return reactionActorName;
  } finally {
    await context.close();
  }
}

async function readE2EUserDisplayName(
  browser: Browser,
  credentials: { email: string; password: string },
) {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await gotoE2EStart(page);
    await signInIfNeeded(page, credentials);
    await expectDashboardReady(page);

    return await readDashboardUserName(page);
  } finally {
    await context.close();
  }
}

async function expectRecipientNotification(
  browser: Browser,
  credentials: { email: string; password: string },
  reactionActorName: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await gotoE2EStart(page);
    await signInIfNeeded(page, credentials);
    await expectDashboardReady(page);

    await page.getByRole("button", { name: /notifications menu/i }).click();
    const notificationsDialog = page.getByRole("dialog", { name: /notifications/i });
    await expect(notificationsDialog).toBeVisible();

    const reactionNotification = notificationsDialog
      .getByRole("article")
      .filter({ hasText: /someone reacted to your recognition/i })
      .filter({ hasText: new RegExp(`${escapeRegExp(reactionActorName)} reacted with Love it\\.`, "i") })
      .first();

    await expect(reactionNotification).toBeVisible();
    await expect(reactionNotification.getByRole("heading", { name: /someone reacted to your recognition/i })).toBeVisible();
  } finally {
    await context.close();
  }
}

function getActivityCard(page: Page, note: string) {
  return page.getByText(note, { exact: true }).locator(
    "xpath=ancestor::*[@data-testid='activity-card' or (contains(concat(' ', normalize-space(@class), ' '), ' rounded-xl ') and .//button[contains(@aria-label, 'Open reactions for')])][1]",
  );
}

async function readDashboardUserName(page: Page) {
  await page.getByRole("button", { name: /account menu/i }).click();

  const accountMenu = page.getByRole("dialog", { name: /^account$/i });
  await expect(accountMenu).toBeVisible();

  const userName = (await accountMenu.getByTestId("account-menu-user-name").innerText()).trim();
  if (!userName) {
    throw new Error("Could not read the reaction actor display name from the account menu.");
  }

  return userName;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

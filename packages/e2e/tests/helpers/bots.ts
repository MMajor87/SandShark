import { expect, type Page } from '@playwright/test';
import { TestId } from '@sandshark/shared';

// creates a bot from server settings and returns the token it shows once. the page is left
// on the bots settings page, so the caller can check the new row before leaving
const createBotThroughUi = async (page: Page, name: string) => {
  await page.getByTestId(TestId.SERVER_MENU_TRIGGER).click();
  await page.getByTestId(TestId.SERVER_MENU_SERVER_SETTINGS).click();
  await page
    .getByTestId(TestId.SETTINGS_SIDEBAR_ENTRY)
    .filter({ hasText: 'Bots' })
    .click();

  await page.getByTestId(TestId.BOT_CREATE).click();

  // the name prompt is an alert dialog, which has its own role
  await page.getByRole('alertdialog').getByRole('textbox').fill(name);
  await page.keyboard.press('Enter');

  const tokenField = page.getByTestId(TestId.BOT_TOKEN_VALUE);

  await expect(tokenField).toBeVisible();

  const token = await tokenField.inputValue();

  await page.getByRole('button', { name: "I've copied it" }).click();
  await expect(tokenField).toHaveCount(0);

  return token;
};

export { createBotThroughUi };

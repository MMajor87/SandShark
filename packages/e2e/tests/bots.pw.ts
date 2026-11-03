import { TestId } from '@sandshark/shared';
import { expect, loginAs, test } from './fixtures';

const RUN_ID = Date.now().toString().slice(-6);

// user names cap at 24 characters, so the run marker is kept short
const BOT_NAME = `Helper ${RUN_ID}`;

test('an owner creates a bot, sees its token once, and the bot is listed as a bot member', async ({
  page
}) => {
  await loginAs(page, 'testowner', 'password123');

  await page.getByTestId(TestId.SERVER_MENU_TRIGGER).click();
  await page.getByTestId(TestId.SERVER_MENU_SERVER_SETTINGS).click();
  await page
    .getByTestId(TestId.SETTINGS_SIDEBAR_ENTRY)
    .filter({ hasText: 'Bots' })
    .click();

  await page.getByTestId(TestId.BOT_CREATE).click();

  const nameDialog = page.getByRole('dialog');

  await nameDialog.getByRole('textbox').fill(BOT_NAME);
  await page.keyboard.press('Enter');

  const token = page.getByTestId(TestId.BOT_TOKEN_VALUE);

  await expect(token).toBeVisible();
  await expect(token).toHaveValue(/^\d+\.[A-Za-z0-9_-]{43}$/);

  await page.getByRole('button', { name: "I've copied it" }).click();
  await expect(token).toHaveCount(0);

  await expect(
    page.getByTestId(TestId.BOT_ROW).filter({ hasText: BOT_NAME })
  ).toBeVisible();

  await page.keyboard.press('Escape');

  const member = page
    .getByTestId(TestId.MEMBER_ITEM)
    .filter({ hasText: BOT_NAME });

  await expect(member.getByTestId(TestId.BOT_BADGE)).toBeVisible();
});

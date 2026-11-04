import { TestId } from '@sandshark/shared';
import { expect, loginAs, test } from './fixtures';
import { createBotThroughUi } from './helpers/bots';

const RUN_ID = Date.now().toString().slice(-6);

// user names cap at 24 characters, so the run marker is kept short
const BOT_NAME = `Helper ${RUN_ID}`;

test('an owner creates a bot, sees its token once, and the bot is listed as a bot member', async ({
  page
}) => {
  await loginAs(page, 'testowner', 'password123');

  const token = await createBotThroughUi(page, BOT_NAME);

  expect(token).toMatch(/^\d+\.[A-Za-z0-9_-]{43}$/);

  await expect(
    page.getByTestId(TestId.BOT_ROW).filter({ hasText: BOT_NAME })
  ).toBeVisible();

  await page.keyboard.press('Escape');

  const member = page
    .getByTestId(TestId.MEMBER_ITEM)
    .filter({ hasText: BOT_NAME });

  await expect(member.getByTestId(TestId.BOT_BADGE)).toBeVisible();
});

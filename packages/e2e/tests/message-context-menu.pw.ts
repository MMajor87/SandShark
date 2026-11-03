import type { Page } from '@playwright/test';
import { TestId } from '@sandshark/shared';
import { expect, test } from './fixtures';
import { LIVE_MESSAGES_CHANNEL, openChannel } from './helpers/channels';
import { withClients } from './helpers/clients';
import { confirmDialog } from './helpers/dialogs';
import { messageByText, sendMessage } from './helpers/messages';

const RUN_ID = Date.now().toString().slice(-8);

const openMessageMenu = async (page: Page, text: string) => {
  await messageByText(page, text).click({ button: 'right' });

  const menu = page.getByTestId(TestId.MESSAGE_CONTEXT_MENU);

  await expect(menu).toBeVisible();

  return menu;
};

test('copy text puts the rendered message on the clipboard', async ({
  browser
}) => {
  const messageText = `copy me ${RUN_ID}`;

  await withClients(browser, ['userc'], async ([page]) => {
    await page!
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
    await openChannel(page!, LIVE_MESSAGES_CHANNEL);
    await sendMessage(page!, messageText);

    const menu = await openMessageMenu(page!, messageText);

    await menu.getByRole('menuitem', { name: 'Copy Text' }).click();

    await expect
      .poll(() => page!.evaluate(() => navigator.clipboard.readText()))
      .toBe(messageText);
  });
});

test('the author can delete their message from the context menu', async ({
  browser
}) => {
  const messageText = `menu delete ${RUN_ID}`;

  await withClients(browser, ['userc'], async ([page]) => {
    await openChannel(page!, LIVE_MESSAGES_CHANNEL);
    await sendMessage(page!, messageText);

    await openMessageMenu(page!, messageText);
    await page!.getByTestId(TestId.MESSAGE_MENU_DELETE).click();
    await confirmDialog(page!);

    await expect(messageByText(page!, messageText)).toHaveCount(0);
  });
});

// a member who did not write the message and lacks manage messages must not be offered
// the destructive actions, matching the hover toolbar
test('another member gets no delete or edit on a message they did not write', async ({
  browser
}) => {
  const messageText = `not yours ${RUN_ID}`;

  await withClients(browser, ['userd', 'usere'], async ([author, other]) => {
    await openChannel(author!, LIVE_MESSAGES_CHANNEL);
    await openChannel(other!, LIVE_MESSAGES_CHANNEL);
    await sendMessage(author!, messageText);

    await expect(messageByText(other!, messageText)).toHaveCount(1, {
      timeout: 15_000
    });

    const menu = await openMessageMenu(other!, messageText);

    await expect(
      menu.getByRole('menuitem', { name: 'Copy Text' })
    ).toBeVisible();
    await expect(other!.getByTestId(TestId.MESSAGE_MENU_DELETE)).toHaveCount(0);
    await expect(
      menu.getByRole('menuitem', { name: 'Edit Message' })
    ).toHaveCount(0);
  });
});

import type { Page } from '@playwright/test';
import { TestId } from '@sandshark/shared';
import { expect, loginAs, test } from './fixtures';
import { withClients } from './helpers/clients';
import { dmItem } from './helpers/dms';

const memberItem = (page: Page, name: string) =>
  page.getByTestId(TestId.MEMBER_ITEM).filter({ hasText: name });

test('direct message from the member list context menu opens the conversation', async ({
  browser
}) => {
  await withClients(browser, ['userc'], async ([page]) => {
    await memberItem(page!, 'User E').click({ button: 'right' });
    await expect(page!.getByTestId(TestId.USER_CONTEXT_MENU)).toBeVisible();
    await expect(page!.getByTestId(TestId.USER_MENU_MODERATE)).toHaveCount(0);

    await page!.getByTestId(TestId.USER_MENU_DM).click();

    await expect(
      page!.getByTestId(TestId.MESSAGE_COMPOSE_EDITOR)
    ).toBeVisible();
    await expect(dmItem(page!, 'User E')).toBeVisible();
  });
});

// a member right clicking their own entry can neither message nor moderate themselves,
// so the menu stays out of the way rather than opening empty
test('a member gets no menu on their own entry', async ({ browser }) => {
  await withClients(browser, ['userc'], async ([page]) => {
    await memberItem(page!, 'User C').click({ button: 'right' });

    await expect(page!.getByTestId(TestId.USER_CONTEXT_MENU)).toHaveCount(0);
  });
});

test('a user manager can open the moderation view from the context menu', async ({
  page
}) => {
  await loginAs(page, 'testowner', 'password123');

  await memberItem(page, 'User C').click({ button: 'right' });
  await page.getByTestId(TestId.USER_MENU_MODERATE).click();

  await expect(page.getByTestId(TestId.MOD_VIEW_KICK)).toBeVisible();
});

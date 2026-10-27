import { TestId } from '@sharkord/shared';
import { expect, loginAs, test } from './fixtures';

test('calendar loads bounded pages without replacing earlier events', async ({
  page
}) => {
  await loginAs(page, 'testowner', 'password123');
  await page.getByTestId(TestId.SERVER_MENU_TRIGGER).click();
  await page.getByRole('menuitem', { name: 'Calendar', exact: true }).click();
  await expect(
    page.getByText('Calendar page event 01', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText('Calendar page event 50', { exact: true })
  ).toHaveCount(1);
  await expect(
    page.getByText('Calendar page event 51', { exact: true })
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(
    page.getByText('Calendar page event 51', { exact: true })
  ).toHaveCount(1);
  await expect(
    page.getByText('Calendar page event 01', { exact: true })
  ).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Load more', exact: true })
  ).toHaveCount(0);
});

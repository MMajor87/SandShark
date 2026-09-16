import type { Page } from '@playwright/test';

// click the confirmation action explicitly; dialog focus settles after it becomes visible.
const confirmDialog = async (page: Page) => {
  await page.getByRole('alertdialog').getByRole('button').last().click();
};

export { confirmDialog };

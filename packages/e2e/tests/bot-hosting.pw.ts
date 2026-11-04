import { TestId } from '@sandshark/shared';
import { expect, loginAs, test } from './fixtures';
import { createBotThroughUi } from './helpers/bots';

const RUN_ID = Date.now().toString().slice(-6);

// user names cap at 24 characters, so the run marker is kept short
const BOT_NAME = `Hosted ${RUN_ID}`;

test('an owner turns hosting on and manages a bot from its hosting panel', async ({
  page
}) => {
  await loginAs(page, 'testowner', 'password123');
  await createBotThroughUi(page, BOT_NAME);

  const toggle = page.getByTestId(TestId.BOT_HOSTING_TOGGLE);

  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByText('Hosted code is trusted code')).toBeVisible();

  try {
    const row = page.getByTestId(TestId.BOT_ROW).filter({ hasText: BOT_NAME });

    await row.getByTestId(TestId.BOT_HOSTING_OPEN).click();

    const panel = page.getByTestId(TestId.HOSTED_BOT_PANEL);

    await expect(panel).toContainText('Stopped');
    await expect(panel).toContainText('No code yet.');

    // a variable's value goes to the server and only its name comes back
    await panel.getByLabel('Name', { exact: true }).fill('API_KEY');
    await panel.getByLabel('Value', { exact: true }).fill(`secret-${RUN_ID}`);
    await panel.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(panel.getByText('API_KEY', { exact: true })).toBeVisible();
    await expect(panel).not.toContainText(`secret-${RUN_ID}`);

    // the server refuses to start a bot with nothing to run, and says so
    await panel.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(
      page.getByText('This bot has no code to run yet.')
    ).toBeVisible();
    await expect(panel).toContainText('Stopped');
  } finally {
    // the e2e server is shared by every spec, so hosting is left as it was found
    await toggle.click();
    await expect(toggle).not.toBeChecked();
  }
});

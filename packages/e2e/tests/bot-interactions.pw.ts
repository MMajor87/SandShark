import type { Page } from '@playwright/test';
import { TestId } from '@sandshark/shared';
import { expect, loginAs, test } from './fixtures';
import { createBotThroughUi } from './helpers/bots';
import { LIVE_MESSAGES_CHANNEL, openChannel } from './helpers/channels';
import { withSecondClient } from './helpers/clients';
import { composeEditor, messageByText } from './helpers/messages';
import { TestBot } from './helpers/test-bot';

const RUN_ID = Date.now().toString().slice(-6);

// user names cap at 24 characters, so the run marker is kept short
const BOT_NAME = `Slash ${RUN_ID}`;

// discord's interaction and callback types
const COMMAND = 2;
const COMPONENT = 3;
const AUTOCOMPLETE = 4;
const MODAL_SUBMIT = 5;

const MESSAGE = 4;
const UPDATE_MESSAGE = 7;
const AUTOCOMPLETE_RESULT = 8;
const MODAL = 9;

let bot: TestBot;

// one bot for the file, created through the ui the way an owner would and then run by a
// small client that speaks the discord api
test.beforeAll(async ({ browser }) => {
  let token = '';

  await withSecondClient(browser, 'testowner', 'password123', async (page) => {
    token = await createBotThroughUi(page, BOT_NAME);
  });

  bot = await TestBot.connect(token);
  await bot.registerCommands([
    { name: 'ping', description: 'Replies with a score' },
    { name: 'secret', description: 'Whispers' },
    { name: 'form', description: 'Asks for feedback' },
    {
      name: 'city',
      description: 'Picks a city',
      options: [
        {
          type: 3,
          name: 'name',
          description: 'The city',
          autocomplete: true
        }
      ]
    }
  ]);
});

test.afterAll(() => {
  bot?.close();
});

// picks the command from the composer's slash menu, which inserts its chip
const pickCommand = async (page: Page, name: string) => {
  const editor = composeEditor(page);

  await editor.click();
  await editor.pressSequentially(`/${name}`);
  await page
    .getByRole('option')
    .filter({ hasText: `/${name}` })
    .filter({ hasText: BOT_NAME })
    .first()
    .click();
};

const runCommand = async (page: Page, name: string) => {
  await pickCommand(page, name);
  await composeEditor(page).press('Enter');
};

test('a slash command answered with an embed and a button, which updates the message', async ({
  page
}) => {
  const answer = `pong ${RUN_ID}`;

  await loginAs(page, 'testowner', 'password123');
  await openChannel(page, LIVE_MESSAGES_CHANNEL);
  await runCommand(page, 'ping');

  const command = await bot.nextInteraction(COMMAND);

  expect(command.data.name).toBe('ping');

  await bot.respond(command, {
    type: MESSAGE,
    data: {
      content: answer,
      embeds: [{ title: `Score ${RUN_ID}`, description: '**10** points' }],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 1, label: 'Again', custom_id: 'again' }
          ]
        }
      ]
    }
  });

  const message = messageByText(page, answer);

  await expect(message).toBeVisible();
  await expect(message).toContainText('Test Owner used /ping');
  await expect(message).toContainText(`Score ${RUN_ID}`);

  await message.getByRole('button', { name: 'Again' }).click();

  const press = await bot.nextInteraction(COMPONENT);

  expect(press.data.custom_id).toBe('again');

  await bot.respond(press, {
    type: UPDATE_MESSAGE,
    data: { content: `pressed ${RUN_ID}`, components: [] }
  });

  const updated = messageByText(page, `pressed ${RUN_ID}`);

  await expect(updated).toBeVisible();
  await expect(updated.getByRole('button', { name: 'Again' })).toHaveCount(0);
});

test('an ephemeral answer shows for the member alone until dismissed', async ({
  page
}) => {
  await loginAs(page, 'testowner', 'password123');
  await openChannel(page, LIVE_MESSAGES_CHANNEL);
  await runCommand(page, 'secret');

  const command = await bot.nextInteraction(COMMAND);

  await bot.respond(command, {
    type: MESSAGE,
    data: { content: `just you ${RUN_ID}`, flags: 64 }
  });

  const ephemeral = page.getByTestId(TestId.BOT_EPHEMERAL_MESSAGE);

  await expect(ephemeral).toContainText(`just you ${RUN_ID}`);
  await expect(ephemeral).toContainText('Only you can see this');

  await ephemeral.getByRole('button', { name: 'Dismiss' }).click();
  await expect(ephemeral).toHaveCount(0);
});

test('a modal opens as a form, and its submission reaches the bot', async ({
  page
}) => {
  await loginAs(page, 'testowner', 'password123');
  await openChannel(page, LIVE_MESSAGES_CHANNEL);
  await runCommand(page, 'form');

  const command = await bot.nextInteraction(COMMAND);

  await bot.respond(command, {
    type: MODAL,
    data: {
      custom_id: 'feedback',
      title: 'Feedback',
      components: [
        {
          type: 18,
          label: 'Name',
          component: { type: 4, custom_id: 'name', style: 1 }
        }
      ]
    }
  });

  const dialog = page.getByRole('dialog');

  await expect(dialog).toContainText('Feedback');
  await dialog.getByRole('textbox').fill(`Alice ${RUN_ID}`);
  await dialog.getByRole('button', { name: 'Submit' }).click();
  await expect(dialog).toHaveCount(0);

  const submit = await bot.nextInteraction(MODAL_SUBMIT);
  const [label] = submit.data.components as {
    component: { value: string };
  }[];

  expect(label!.component.value).toBe(`Alice ${RUN_ID}`);

  await bot.respond(submit, {
    type: MESSAGE,
    data: { content: `thanks ${label!.component.value}` }
  });

  await expect(messageByText(page, `thanks Alice ${RUN_ID}`)).toBeVisible();
});

test('an option the bot completes offers its suggestions while typing', async ({
  page
}) => {
  await loginAs(page, 'testowner', 'password123');
  await openChannel(page, LIVE_MESSAGES_CHANNEL);
  await pickCommand(page, 'city');

  // the chip focuses its first field, the one the bot completes. it asks once on its own
  // with nothing typed, and that answer is dropped once the member types on
  await page.keyboard.type('lis');

  const autocomplete = await bot.nextInteraction(
    AUTOCOMPLETE,
    (interaction) => {
      const [option] = interaction.data.options as { value: string }[];

      return option?.value === 'lis';
    }
  );

  await bot.respond(autocomplete, {
    type: AUTOCOMPLETE_RESULT,
    data: {
      choices: [
        { name: 'Lisbon', value: 'lisbon' },
        { name: 'Lismore', value: 'lismore' }
      ]
    }
  });

  await expect(page.locator('datalist option[value="lisbon"]')).toHaveCount(1);
  await expect(page.locator('datalist option[value="lismore"]')).toHaveCount(1);
});

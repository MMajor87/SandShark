import { TestId } from '@sharkord/shared';
import { expect, test } from './fixtures';
import { LIVE_MESSAGES_CHANNEL, openChannel } from './helpers/channels';
import { withClients } from './helpers/clients';
import { messageByText, sendMessage } from './helpers/messages';

test('pasted Persian text with Latin words keeps its direction in the editor and message', async ({
  browser
}) => {
  const text = `سلام Google دنیا ${Date.now()}`;

  await withClients(browser, ['testuser'], async ([page]) => {
    await openChannel(page!, LIVE_MESSAGES_CHANNEL);
    await page!
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
    await page!.evaluate(
      (content) => navigator.clipboard.writeText(content),
      text
    );

    const editor = page!.getByTestId(TestId.MESSAGE_COMPOSE_EDITOR).first();
    await editor.click();
    await editor.press('ControlOrMeta+V');
    await expect(editor).toContainText(text);
    const paragraph = editor.locator('p').first();
    await expect(paragraph).toHaveAttribute('dir', 'auto');
    await expect(paragraph).toHaveCSS('direction', 'rtl');

    await editor.press('ArrowLeft');
    expect(
      await editor.evaluate((element) =>
        element.contains(window.getSelection()?.anchorNode ?? null)
      )
    ).toBe(true);

    await editor.press('Enter');
    const message = messageByText(page!, text);
    await expect(message).toBeVisible();
    const renderedParagraph = message.locator('.msg-content > p').first();
    await expect(renderedParagraph).toHaveAttribute('dir', 'auto');
    await expect(renderedParagraph).toHaveCSS('direction', 'rtl');

    await message.hover();
    await message.getByTitle('Edit Message').click();
    const editEditor = message.getByTestId(TestId.MESSAGE_COMPOSE_EDITOR);
    await expect(editEditor.locator('p')).toHaveAttribute('dir', 'auto');
    await expect(editEditor.locator('p')).toHaveCSS('direction', 'rtl');
    await editEditor.press('ArrowLeft');
    expect(
      await editEditor.evaluate((element) =>
        element.contains(window.getSelection()?.anchorNode ?? null)
      )
    ).toBe(true);
    await editEditor.press('Escape');

    const englishFirst = `English first, ثم العربية ${Date.now()}`;
    await sendMessage(page!, englishFirst);
    const englishParagraph = messageByText(page!, englishFirst)
      .locator('.msg-content > p')
      .first();
    await expect(englishParagraph).toHaveCSS('direction', 'ltr');
  });
});

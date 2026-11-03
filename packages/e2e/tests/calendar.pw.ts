import type { Page } from '@playwright/test';
import { TestId } from '@sandshark/shared';
import { expect, loginAs, test } from './fixtures';
import { withClients } from './helpers/clients';

const RUN_ID = Date.now().toString().slice(-8);

const calendarToggle = (page: Page) => page.getByTestId(TestId.CALENDAR_TOGGLE);

const eventCard = (page: Page, title: string) =>
  page.getByTestId(TestId.CALENDAR_EVENT_CARD).filter({ hasText: title });

const openFullCalendar = async (page: Page) => {
  await calendarToggle(page).click();
  await page.getByTestId(TestId.CALENDAR_OPEN_FULL).click();
};

// the form starts an hour from now, so a created event is always upcoming
const createEvent = async (page: Page, title: string, invitee: string) => {
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('switch', { name: invitee, exact: true }).click();
  await page.getByTestId(TestId.CALENDAR_FORM_SUBMIT).click();
  await expect(eventCard(page, title)).toBeVisible();
};

// the seeded pagination events start in 1970, so they only show with past events included
test('calendar loads bounded pages without replacing earlier events', async ({
  page
}) => {
  await loginAs(page, 'testowner', 'password123');
  await page.getByTestId(TestId.SERVER_MENU_TRIGGER).click();
  await page.getByRole('menuitem', { name: 'Calendar', exact: true }).click();
  await expect(
    page.getByText('Calendar page event 01', { exact: true })
  ).toHaveCount(0);
  await page.getByTestId(TestId.CALENDAR_SHOW_PAST).click();
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
});

// userc is invited by nobody else in the suite, so the pending badge is this spec's alone
test('an invitee sees the invitation in the sidebar and answering clears the badge', async ({
  browser
}) => {
  const title = `Game night ${RUN_ID}`;

  await withClients(browser, ['testowner'], async ([owner]) => {
    await openFullCalendar(owner!);
    await createEvent(owner!, title, 'User C');
  });

  await withClients(browser, ['userc'], async ([invitee]) => {
    await expect(
      calendarToggle(invitee!).getByTestId(TestId.UNREAD_COUNT)
    ).toHaveText('1');

    await calendarToggle(invitee!).click();
    await expect(
      invitee!
        .getByTestId(TestId.CALENDAR_UPCOMING_ITEM)
        .filter({ hasText: title })
    ).toContainText('Awaiting your response');

    await invitee!.getByTestId(TestId.CALENDAR_OPEN_FULL).click();

    const card = eventCard(invitee!, title);

    await expect(card).toContainText('Test Owner');
    await card.locator(`[data-status="going"]`).click();

    await expect(card.locator(`[data-status="going"]`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(card).toContainText('1 going, 0 maybe, 0 can');
    await expect(
      calendarToggle(invitee!).getByTestId(TestId.UNREAD_COUNT)
    ).toHaveCount(0);
  });
});

test('the organizer can edit an event and invitees cannot', async ({
  browser
}) => {
  const title = `Planning ${RUN_ID}`;
  const renamed = `Planning moved ${RUN_ID}`;

  await withClients(browser, ['testowner', 'userd'], async ([owner, other]) => {
    await openFullCalendar(owner!);
    await createEvent(owner!, title, 'User D');

    await eventCard(owner!, title)
      .getByTestId(TestId.CALENDAR_EVENT_EDIT)
      .click();
    await owner!.getByLabel('Title', { exact: true }).fill(renamed);
    await owner!.getByTestId(TestId.CALENDAR_FORM_SUBMIT).click();

    await expect(eventCard(owner!, renamed)).toBeVisible();
    await expect(eventCard(owner!, title)).toHaveCount(0);

    await openFullCalendar(other!);

    const card = eventCard(other!, renamed);

    await expect(card).toBeVisible();
    await expect(card.getByTestId(TestId.CALENDAR_EVENT_EDIT)).toHaveCount(0);
  });
});

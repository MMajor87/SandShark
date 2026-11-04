import type { Page } from '@playwright/test';

// the media the e2e seed points at lives on this reserved domain and is served here, so the
// media specs measure the client and not how fast a third party host answers
const E2E_MEDIA = 'https://e2e-media.test/**';

const svg = (width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#4a7"/></svg>`;

// each image answers after its own fixed delay, so content still grows after the channel
// opens, the way real media does, but the same way on every run
const IMAGES: Record<
  string,
  { width: number; height: number; delayMs: number }
> = {
  'big.svg': { width: 1200, height: 800, delayMs: 600 },
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [
      `image-${index}.svg`,
      { width: 400, height: 200 + index * 30, delayMs: 100 + index * 80 }
    ])
  )
};

const routeE2eMedia = async (page: Page) => {
  await page.route(E2E_MEDIA, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);
    const image = IMAGES[name];

    // no real video is shipped with the tests, and a refused one settles at once
    if (!image) {
      await route.fulfill({ status: 404 });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, image.delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: svg(image.width, image.height)
    });
  });
};

export { routeE2eMedia };

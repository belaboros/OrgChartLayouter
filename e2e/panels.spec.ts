import { expect, test, type Page } from '@playwright/test';

const width = async (page: Page, testId: string) => (await page.getByTestId(testId).boundingBox())!.width;

async function drag(page: Page, testId: string, dx: number) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y);
  await page.mouse.move(x + dx, y);
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('chart').locator('g.node')).toHaveCount(15);
});

test('dragging the left divider resizes the editor and the chart', async ({ page }) => {
  const [editor, chart] = [await width(page, 'editor-col'), await width(page, 'chart')];
  await drag(page, 'divider-editor', 100);
  await expect.poll(() => width(page, 'editor-col')).toBeCloseTo(editor + 100, 0);
  expect(await width(page, 'chart')).toBeCloseTo(chart - 100, 0);
});

test('dragging the right divider resizes the sidebar and the chart', async ({ page }) => {
  const [sidebar, chart] = [await width(page, 'sidebar'), await width(page, 'chart')];
  await drag(page, 'divider-sidebar', -100);
  await expect.poll(() => width(page, 'sidebar')).toBeCloseTo(sidebar + 100, 0);
  expect(await width(page, 'chart')).toBeCloseTo(chart - 100, 0);
});

test('arrow keys move a focused divider by 10px', async ({ page }) => {
  const editor = await width(page, 'editor-col');
  await page.getByTestId('divider-editor').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => width(page, 'editor-col')).toBeCloseTo(editor + 10, 0);
});

test('the chart never gets narrower than its minimum', async ({ page }) => {
  await drag(page, 'divider-editor', 2000);
  await expect.poll(() => width(page, 'chart')).toBeCloseTo(200, 0);
});

import { expect, test, type Page } from '@playwright/test';

const CONTAINMENT = ['nested-rects', 'nested-circles'];
const nodes = (page: Page) => page.getByTestId('chart').locator('g.node');
const zoomGroup = (page: Page) => page.getByTestId('chart').locator('svg > g').first();

async function append(page: Page, text: string) {
  await page.getByTestId('editor').locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
}

async function optionValues(page: Page, testId: string): Promise<string[]> {
  return page.getByTestId(testId).locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(nodes(page)).toHaveCount(15);
});

test('sample: medium renders 50 nodes', async ({ page }) => {
  await page.getByTestId('btn-samples').click();
  await page.getByTestId('sample-medium').click();
  await expect(nodes(page)).toHaveCount(50);
});

test('live edit: a new team appears', async ({ page }) => {
  await append(page, '\nNewTeam:');
  await expect(nodes(page).locator('title', { hasText: /^NewTeam$/ })).toHaveCount(1, { timeout: 1000 });
});

test('broken YAML: error bar, stale badge, nodes unchanged', async ({ page }) => {
  await append(page, '\nBroken: [');
  await expect(page.getByTestId('error-bar')).toBeVisible();
  await expect(page.getByTestId('error-bar')).toContainText('Line');
  await expect(page.getByTestId('stale-badge')).toBeVisible();
  await expect(nodes(page)).toHaveCount(15);
});

test('every axis: each plugin option renders without error', async ({ page }) => {
  const check = async () => {
    await expect(page.getByTestId('error-bar')).toBeHidden();
    expect(await nodes(page).count()).toBeGreaterThan(0);
  };
  for (const id of await optionValues(page, 'select-layout')) {
    await page.getByTestId('select-layout').selectOption(id);
    await check();
    if (CONTAINMENT.includes(id)) {
      await expect(page.getByTestId('section-anchors')).toHaveAttribute('aria-disabled', 'true');
    }
  }
  await page.getByTestId('select-layout').selectOption('top-down');
  for (const id of await optionValues(page, 'select-anchor')) {
    await page.getByTestId('select-anchor').selectOption(id);
    await check();
  }
  await page.getByTestId('select-anchor').selectOption('auto');
  for (const id of await optionValues(page, 'select-router')) {
    await page.getByTestId('select-router').selectOption(id);
    await check();
  }
});

test('depth: max depth 1 leaves the top-level teams with badges', async ({ page }) => {
  await page.getByTestId('select-max-depth').selectOption('1');
  await expect(nodes(page)).toHaveCount(3);
  // small sample: Engineering, Sales and Operations all have children
  await expect(nodes(page).locator('.badge')).toHaveCount(3);
});

test('export: downloads an SVG', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('btn-export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^orgchart\..+\.svg$/);
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  expect(readFileSync(path, 'utf8').startsWith('<svg xmlns')).toBe(true);
});

test('view stays still while typing', async ({ page }) => {
  const before = await zoomGroup(page).getAttribute('transform');
  expect(before).toBeTruthy();
  await append(page, '\nExtraTeam:');
  await expect(nodes(page)).toHaveCount(16);
  expect(await zoomGroup(page).getAttribute('transform')).toBe(before);
  await page.getByTestId('btn-fit').click();
  const after = await zoomGroup(page).getAttribute('transform');
  expect(after).toMatch(/^translate\(.+\) scale\(.+\)$/);
  expect(after).not.toContain('NaN');
});

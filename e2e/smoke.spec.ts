import { readFileSync } from 'node:fs';
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
  await expect(nodes(page).locator('title', { hasText: /^NewTeam$/ })).toHaveCount(1);
});

test('broken YAML: error bar, stale badge, nodes unchanged', async ({ page }) => {
  await append(page, '\nBroken: [');
  await expect(page.getByTestId('error-bar')).toBeVisible();
  await expect(page.getByTestId('error-bar')).toContainText('Line');
  await expect(page.getByTestId('stale-badge')).toBeVisible();
  await expect(nodes(page)).toHaveCount(15);
});

test('every axis: each plugin option renders without error', async ({ page }) => {
  const chart = page.getByTestId('chart');
  const select = async (axis: 'layout' | 'anchor' | 'router', id: string) => {
    await page.getByTestId(`select-${axis}`).selectOption(id);
    await expect(chart).toHaveAttribute(`data-${axis}`, id);
    await expect(nodes(page).first()).toBeVisible();
    await expect(page.getByTestId('error-bar')).toBeHidden();
  };
  for (const id of await optionValues(page, 'select-layout')) {
    await select('layout', id);
    if (CONTAINMENT.includes(id)) {
      await expect(page.getByTestId('section-anchors')).toHaveAttribute('aria-disabled', 'true');
    }
  }
  await select('layout', 'top-down');
  for (const id of await optionValues(page, 'select-anchor')) await select('anchor', id);
  await select('anchor', 'auto');
  for (const id of await optionValues(page, 'select-router')) await select('router', id);
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
  expect(readFileSync(path, 'utf8').startsWith('<svg xmlns')).toBe(true);
});

test('view stays still while typing', async ({ page }) => {
  let before = '';
  await expect
    .poll(async () => {
      const a = (await zoomGroup(page).getAttribute('transform')) ?? '';
      await page.waitForTimeout(150);
      const b = (await zoomGroup(page).getAttribute('transform')) ?? '';
      before = b;
      return a === b && b !== '' && !b.includes('translate(0 0) scale(1)');
    })
    .toBe(true);
  await append(page, '\nExtraTeam:');
  await expect(nodes(page)).toHaveCount(16);
  expect(await zoomGroup(page).getAttribute('transform')).toBe(before);
  await page.getByTestId('btn-fit').click();
  const after = await zoomGroup(page).getAttribute('transform');
  expect(after).toMatch(/^translate\(.+\) scale\(.+\)$/);
  expect(after).not.toContain('NaN');
});

test('drop a file on the editor: loads it once, no duplicated text', async ({ page }) => {
  const content = 'Alpha:\nBeta:\n';
  // CodeMirror reads dropped files with FileReader; the window drop handler uses File.text(). Delay
  // FileReader so a CodeMirror insert, if one happens, lands after the window handler has loaded the file.
  await page.evaluate(() => {
    const read = FileReader.prototype.readAsText;
    FileReader.prototype.readAsText = function (this: FileReader, blob: Blob, enc?: string) {
      setTimeout(() => read.call(this, blob, enc), 300);
    };
  });
  await page.getByTestId('editor').locator('.cm-content').evaluate((el, text) => {
    const dt = new DataTransfer();
    dt.items.add(new File([text], 'dropped.teams.yaml', { type: 'application/yaml' }));
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5 }));
  }, content);
  await expect(nodes(page)).toHaveCount(2);
  // past the FileReader delay plus the 200 ms redraw debounce, so a late insert would show
  await page.waitForTimeout(800);
  const lines = await page.getByTestId('editor').locator('.cm-line').allTextContents();
  expect(lines.join('\n')).toBe(content);
  await expect(nodes(page)).toHaveCount(2);
  await expect(page).toHaveTitle(/^dropped\.teams\.yaml/);
});

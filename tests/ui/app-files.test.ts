// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/measure/canvas', () => ({
  createCanvasMeasure: () => (text: string) => ({ width: text.length * 6, height: 12 }),
}));
const files = vi.hoisted(() => ({
  openTeamsFile: vi.fn(),
  saveTeamsFile: vi.fn(),
  downloadText: vi.fn(),
}));
vi.mock('../../src/ui/files', async (orig) => ({ ...(await orig<any>()), ...files }));

import { app } from '../../src/ui/app-state.svelte';

beforeEach(() => {
  vi.stubGlobal('confirm', vi.fn(() => true));
  app.loadText('A:\n  B:\n', 'one.teams.yaml', null);
  app.fileMessage = null;
  Object.values(files).forEach((f) => f.mockReset());
});
afterEach(() => vi.unstubAllGlobals());

describe('app file actions', () => {
  it('open loads text, name and handle, clears dirty', async () => {
    const handle = {} as any;
    files.openTeamsFile.mockResolvedValue({ name: 'x.teams.yaml', text: 'X:\n', handle });
    app.setText('dirty');
    await app.open();
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect([app.text, app.fileName, app.fileHandle, app.dirty, app.fileMessage]).toEqual(['X:\n', 'x.teams.yaml', handle, false, null]);
  });

  it('open warns for a non-.teams.yaml name but still loads', async () => {
    files.openTeamsFile.mockResolvedValue({ name: 'x.yaml', text: 'X:\n', handle: null });
    await app.open();
    expect(app.text).toBe('X:\n');
    expect(app.fileMessage).toBe('"x.yaml" is not a .teams.yaml file — loaded anyway');
  });

  it('open does nothing when declined or cancelled', async () => {
    app.setText('dirty');
    (confirm as any).mockReturnValue(false);
    await app.open();
    expect(files.openTeamsFile).not.toHaveBeenCalled();
    (confirm as any).mockReturnValue(true);
    files.openTeamsFile.mockResolvedValue(null);
    await app.open();
    expect(app.text).toBe('dirty');
    expect(app.fileMessage).toBeNull();
  });

  it('open does not confirm when clean; read failure sets a File error and keeps text', async () => {
    files.openTeamsFile.mockRejectedValue(new Error('nope'));
    await app.open();
    expect(confirm).not.toHaveBeenCalled();
    expect(app.text).toBe('A:\n  B:\n');
    expect(app.fileMessage).toBe('File error: nope');
  });

  it('save writes with the current handle, updates name/handle, clears dirty and message', async () => {
    const h1 = {} as any, h2 = {} as any;
    app.loadText('A:\n', 'one.teams.yaml', h1);
    app.setText('A:\nB:\n');
    app.fileMessage = 'old';
    files.saveTeamsFile.mockResolvedValue({ name: 'two.teams.yaml', handle: h2 });
    await app.save();
    expect(files.saveTeamsFile).toHaveBeenCalledWith('A:\nB:\n', h1, 'one.teams.yaml', false);
    expect([app.fileName, app.fileHandle, app.dirty, app.fileMessage]).toEqual(['two.teams.yaml', h2, false, null]);
  });

  it('save uses "untitled.teams.yaml" as suggested name; saveAs forces the picker', async () => {
    app.loadText('A:\n', null, null);
    files.saveTeamsFile.mockResolvedValue({ name: 'untitled.teams.yaml', handle: null });
    await app.save();
    expect(files.saveTeamsFile).toHaveBeenLastCalledWith('A:\n', null, 'untitled.teams.yaml', false);
    await app.saveAs();
    expect(files.saveTeamsFile).toHaveBeenLastCalledWith('A:\n', null, 'untitled.teams.yaml', true);
  });

  it('save: cancel changes nothing silently, failure sets File error and stays dirty', async () => {
    app.setText('Z:\n');
    files.saveTeamsFile.mockRejectedValue(new DOMException('c', 'AbortError'));
    await app.save();
    expect(app.dirty).toBe(true);
    expect(app.fileMessage).toBeNull();
    files.saveTeamsFile.mockRejectedValue(new Error('disk full'));
    await app.save();
    expect(app.dirty).toBe(true);
    expect(app.fileMessage).toBe('File error: disk full');
  });

  it('newFile empties the editor; confirm gating applies', () => {
    app.setText('dirty');
    (confirm as any).mockReturnValue(false);
    app.newFile();
    expect(app.text).toBe('dirty');
    (confirm as any).mockReturnValue(true);
    app.fileMessage = 'x';
    app.newFile();
    expect([app.text, app.fileName, app.fileHandle, app.dirty, app.fileMessage]).toEqual(['', null, null, false, null]);
  });

  it('sampleWithConfirm loads a sample only when confirmed and clears the message', () => {
    app.setText('dirty');
    (confirm as any).mockReturnValue(false);
    app.openSample('medium');
    expect(app.text).toBe('dirty');
    (confirm as any).mockReturnValue(true);
    app.fileMessage = 'x';
    app.openSample('medium');
    expect(app.text).not.toBe('dirty');
    expect(app.dirty).toBe(false);
    expect(app.fileMessage).toBeNull();
  });

  it('openDropped reads the file with handle null, confirm-gated', async () => {
    await app.openDropped(new File(['D:\n'], 'd.teams.yaml'));
    expect([app.text, app.fileName, app.fileHandle]).toEqual(['D:\n', 'd.teams.yaml', null]);
    app.setText('dirty');
    (confirm as any).mockReturnValue(false);
    await app.openDropped(new File(['E:\n'], 'e.teams.yaml'));
    expect(app.text).toBe('dirty');
  });

  it('exportSvg downloads the scene under the export filename; no-op without scene', () => {
    app.loadText('Alpha:\n  Beta:\n', 'acme.teams.yaml', null);
    app.exportSvg();
    const [name, content, mime] = files.downloadText.mock.calls[0];
    expect(name).toBe(`acme.${app.settings.layoutId}-${app.settings.routerId}-${app.settings.anchorId}.svg`);
    expect(content.startsWith('<svg xmlns')).toBe(true);
    expect(mime).toBe('image/svg+xml');
    app.loadText('', null, null);
    files.downloadText.mockClear();
    app.exportSvg();
    expect(files.downloadText).not.toHaveBeenCalled();
  });
});

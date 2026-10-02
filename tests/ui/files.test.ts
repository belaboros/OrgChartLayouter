// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadText, openTeamsFile, saveTeamsFile } from '../../src/ui/files';

const w = window as any;
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  delete w.showSaveFilePicker;
  delete w.showOpenFilePicker;
  vi.restoreAllMocks();
});

const abort = () => new DOMException('cancelled', 'AbortError');

describe('saveTeamsFile', () => {
  it('falls back to download without the File System Access API', async () => {
    let download = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
    });
    const r = await saveTeamsFile('A:\n', null, 'acme.teams.yaml', false);
    expect(r).toEqual({ name: 'acme.teams.yaml', handle: null });
    expect(click).toHaveBeenCalledTimes(1);
    expect(download).toBe('acme.teams.yaml');
  });

  it('writes through an existing handle without opening a picker', async () => {
    const write = vi.fn(), close = vi.fn();
    const picker = (w.showSaveFilePicker = vi.fn());
    const handle = { name: 'x.teams.yaml', createWritable: async () => ({ write, close }) } as any;
    expect(await saveTeamsFile('A:\n', handle, 'ignored', false)).toEqual({ name: 'x.teams.yaml', handle });
    expect(write).toHaveBeenCalledWith('A:\n');
    expect(close).toHaveBeenCalled();
    expect(picker).not.toHaveBeenCalled();
  });

  it('forcePicker uses the picker even with a handle, and returns the new handle', async () => {
    const oldWrite = vi.fn(), write = vi.fn(), close = vi.fn();
    const old = { name: 'old.teams.yaml', createWritable: async () => ({ write: oldWrite, close: vi.fn() }) } as any;
    const picked = { name: 'new.teams.yaml', createWritable: async () => ({ write, close }) } as any;
    const picker = (w.showSaveFilePicker = vi.fn(async () => picked));
    const r = await saveTeamsFile('B:\n', old, 'suggest.teams.yaml', true);
    expect(r).toEqual({ name: 'new.teams.yaml', handle: picked });
    expect(picker).toHaveBeenCalledWith({
      suggestedName: 'suggest.teams.yaml',
      types: [{ description: 'Team files', accept: { 'text/yaml': ['.yaml'] } }],
    });
    expect(write).toHaveBeenCalledWith('B:\n');
    expect(oldWrite).not.toHaveBeenCalled();
  });

  it('uses the picker when there is no handle', async () => {
    const write = vi.fn();
    const picked = { name: 'p.teams.yaml', createWritable: async () => ({ write, close: vi.fn() }) } as any;
    w.showSaveFilePicker = vi.fn(async () => picked);
    expect((await saveTeamsFile('C:\n', null, 's', false)).handle).toBe(picked);
    expect(write).toHaveBeenCalledWith('C:\n');
  });

  it('propagates a cancelled picker as AbortError and writes errors', async () => {
    w.showSaveFilePicker = vi.fn(async () => { throw abort(); });
    await expect(saveTeamsFile('x', null, 's', false)).rejects.toMatchObject({ name: 'AbortError' });
    const handle = { name: 'h', createWritable: async () => { throw new Error('denied'); } } as any;
    await expect(saveTeamsFile('x', handle, 's', false)).rejects.toThrow('denied');
  });
});

describe('downloadText', () => {
  it('sets the file name, mime type and revokes the URL', () => {
    let name = '', href = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
      href = this.href;
    });
    downloadText('chart.svg', '<svg/>', 'image/svg+xml');
    expect(name).toBe('chart.svg');
    expect(href).toBe('blob:x');
    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('image/svg+xml');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a')).toBeNull();
  });
});

describe('openTeamsFile', () => {
  it('returns name, text and handle from the picker, with the yaml filter', async () => {
    const handle = { getFile: async () => new File(['A:\n'], 'a.teams.yaml') } as any;
    const picker = (w.showOpenFilePicker = vi.fn(async () => [handle]));
    expect(await openTeamsFile()).toEqual({ name: 'a.teams.yaml', text: 'A:\n', handle });
    expect(picker).toHaveBeenCalledWith({ types: [{ description: 'Team files', accept: { 'text/yaml': ['.yaml'] } }] });
  });

  it('returns null on AbortError and rethrows other errors', async () => {
    w.showOpenFilePicker = vi.fn(async () => { throw abort(); });
    expect(await openTeamsFile()).toBeNull();
    w.showOpenFilePicker = vi.fn(async () => { throw new Error('boom'); });
    await expect(openTeamsFile()).rejects.toThrow('boom');
  });

  it('falls back to a hidden file input accepting .yaml', async () => {
    let accept = '';
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      accept = this.accept;
      Object.defineProperty(this, 'files', { value: [new File(['B:\n'], 'b.teams.yaml')] });
      this.dispatchEvent(new Event('change'));
    });
    expect(await openTeamsFile()).toEqual({ name: 'b.teams.yaml', text: 'B:\n', handle: null });
    expect(accept).toBe('.yaml');
  });

  it('fallback input cancel resolves null', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      this.dispatchEvent(new Event('cancel'));
    });
    expect(await openTeamsFile()).toBeNull();
  });
});

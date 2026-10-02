const TYPES = [{ description: 'Team files', accept: { 'text/yaml': ['.yaml'] } }];

export interface OpenedFile {
  name: string;
  text: string;
  handle: FileSystemFileHandle | null;
}

export const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

export const isTeamsFile = (name: string): boolean => /\.teams\.yaml$/i.test(name);

function pickViaInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml';
    input.hidden = true;
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/** Resolves null when the user cancels. Throws on read errors. */
export async function openTeamsFile(): Promise<OpenedFile | null> {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({ types: TYPES });
      const file = await handle.getFile();
      return { name: file.name, text: await file.text(), handle };
    } catch (e) {
      if (isAbort(e)) return null;
      throw e;
    }
  }
  const file = await pickViaInput();
  return file ? { name: file.name, text: await file.text(), handle: null } : null;
}

async function writeHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/** Throws AbortError DOMException when the user cancels the save picker. */
export async function saveTeamsFile(
  text: string,
  handle: FileSystemFileHandle | null,
  suggestedName: string,
  forcePicker: boolean,
): Promise<{ name: string; handle: FileSystemFileHandle | null }> {
  if (handle && !forcePicker) {
    await writeHandle(handle, text);
    return { name: handle.name, handle };
  }
  if (window.showSaveFilePicker) {
    const picked = await window.showSaveFilePicker({ suggestedName, types: TYPES });
    await writeHandle(picked, text);
    return { name: picked.name, handle: picked };
  }
  downloadText(suggestedName, text, 'text/yaml');
  return { name: suggestedName, handle: null };
}

export function downloadText(fileName: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

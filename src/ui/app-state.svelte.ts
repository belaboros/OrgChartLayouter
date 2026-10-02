import { computeView, type View } from '../app/controller';
import { createCanvasMeasure } from '../measure/canvas';
import { defaultSettings, loadSettings, saveSettings, type Settings } from '../settings/settings';
import { renderSvgDocument } from '../render/svg';
import { exportFilename } from '../render/export-name';
import { downloadText, isAbort, isTeamsFile, openTeamsFile, saveTeamsFile } from './files';
import small from '../samples/small.teams.yaml?raw';
import medium from '../samples/medium.teams.yaml?raw';
import large from '../samples/large.teams.yaml?raw';

const SAMPLES = { small, medium, large };
const DEBOUNCE_MS = 200;

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class AppState {
  text = $state('');
  fileName = $state<string | null>(null);
  fileHandle = $state<FileSystemFileHandle | null>(null);
  dirty = $state(false);
  settings = $state.raw<Settings>(defaultSettings());
  view = $state.raw<View>({ scene: null, stale: false, empty: true, parseErrors: [], pluginError: null, treeDepth: 0 });
  fitToken = $state(0);
  fileMessage = $state<string | null>(null);

  private measure = createCanvasMeasure();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by every loadText, so an in-flight save can tell the file was replaced under it. */
  private loadGen = 0;

  constructor() {
    this.settings = loadSettings(safeLocalStorage());
  }

  private recompute(): void {
    this.view = computeView(this.text, this.settings, this.measure, this.view);
  }

  setText(t: string): void {
    this.text = t;
    this.dirty = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.recompute();
    }, DEBOUNCE_MS);
  }

  setSettings(patch: Partial<Settings>): void {
    const prev = this.settings;
    this.settings = { ...prev, ...patch };
    this.recompute();
    saveSettings(safeLocalStorage(), this.settings);
    if (this.settings.layoutId !== prev.layoutId || this.settings.maxDepth !== prev.maxDepth) this.fitToken++;
  }

  loadText(text: string, name: string | null, handle: FileSystemFileHandle | null): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.loadGen++;
    this.text = text;
    this.fileName = name;
    this.fileHandle = handle;
    // No previous view: a broken new file must not show (or export) the previous file's chart.
    this.view = computeView(text, this.settings, this.measure, null);
    this.dirty = false;
    this.fitToken++;
  }

  requestFit(): void {
    this.fitToken++;
  }

  loadSample(size: 'small' | 'medium' | 'large'): void {
    this.loadText(SAMPLES[size], null, null);
  }

  private confirmDiscard(): boolean {
    return !this.dirty || confirm('Discard unsaved changes?');
  }

  private fileError(e: unknown): void {
    this.fileMessage = `File error: ${e instanceof Error ? e.message : String(e)}`;
  }

  private loadFile(name: string, text: string, handle: FileSystemFileHandle | null): void {
    this.loadText(text, name, handle);
    this.fileMessage = isTeamsFile(name) ? null : `"${name}" is not a .teams.yaml file — loaded anyway`;
  }

  newFile(): void {
    if (!this.confirmDiscard()) return;
    this.loadText('', null, null);
    this.fileMessage = null;
  }

  openSample(size: 'small' | 'medium' | 'large'): void {
    if (!this.confirmDiscard()) return;
    this.loadSample(size);
    this.fileMessage = null;
  }

  async open(): Promise<void> {
    if (!this.confirmDiscard()) return;
    try {
      const f = await openTeamsFile();
      if (f) this.loadFile(f.name, f.text, f.handle);
    } catch (e) {
      this.fileError(e);
    }
  }

  async openDropped(file: File): Promise<void> {
    if (!this.confirmDiscard()) return;
    try {
      this.loadFile(file.name, await file.text(), null);
    } catch (e) {
      this.fileError(e);
    }
  }

  private async persist(forcePicker: boolean): Promise<void> {
    const saved = this.text;
    const gen = this.loadGen;
    try {
      const r = await saveTeamsFile(saved, this.fileHandle, this.fileName ?? 'untitled.teams.yaml', forcePicker);
      if (gen !== this.loadGen) return; // another file was loaded while saving
      this.fileName = r.name;
      this.fileHandle = r.handle;
      this.dirty = this.text !== saved;
      this.fileMessage = null;
    } catch (e) {
      if (!isAbort(e)) this.fileError(e);
    }
  }

  save(): Promise<void> {
    return this.persist(false);
  }

  saveAs(): Promise<void> {
    return this.persist(true);
  }

  exportSvg(): void {
    const scene = this.view.scene;
    if (!scene) return;
    downloadText(exportFilename(this.fileName, this.settings), renderSvgDocument(scene), 'image/svg+xml');
  }
}

export const app = new AppState();
app.loadText(small, null, null);

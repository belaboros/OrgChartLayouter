import { computeView, type View } from '../app/controller';
import { createCanvasMeasure } from '../measure/canvas';
import { defaultSettings, loadSettings, saveSettings, type Settings } from '../settings/settings';
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

  private measure = createCanvasMeasure();
  private timer: ReturnType<typeof setTimeout> | null = null;

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
    this.text = text;
    this.fileName = name;
    this.fileHandle = handle;
    this.recompute();
    this.dirty = false;
    this.fitToken++;
  }

  requestFit(): void {
    this.fitToken++;
  }

  loadSample(size: 'small' | 'medium' | 'large'): void {
    this.loadText(SAMPLES[size], null, null);
  }
}

export const app = new AppState();
app.loadText(small, null, null);

// Minimal File System Access API declarations (not in the TS DOM lib).
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}
interface FilePickerOptions {
  types?: FilePickerAcceptType[];
  suggestedName?: string;
}
interface Window {
  showOpenFilePicker?: (options?: FilePickerOptions & { multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle>;
}

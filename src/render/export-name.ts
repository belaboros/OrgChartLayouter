import type { Settings } from '../settings/settings';

function baseName(fileName: string | null): string {
  if (!fileName) return 'orgchart';
  let base = fileName;
  if (/\.teams\.yaml$/i.test(base)) base = base.replace(/\.teams\.yaml$/i, '');
  else base = base.replace(/\.(yaml|yml)$/i, '');
  return base === '' ? 'orgchart' : base;
}

export function exportFilename(fileName: string | null, settings: Settings): string {
  const depth = settings.maxDepth === null ? '' : `-depth${settings.maxDepth}`;
  return `${baseName(fileName)}.${settings.layoutId}-${settings.routerId}-${settings.anchorId}${depth}.svg`;
}

import type { PlacedNode, RoutedPath, Scene } from '../plugins/types';
import { shapeRect } from '../geometry/rect';
import { num } from '../routers/path';

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
export const escapeXml = (s: string): string => s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);

const BADGE_HEIGHT = 14;
const MARGIN = 20;

function renderEdge(e: RoutedPath, lineWidth: number): string {
  return `<path class="edge" d="${escapeXml(e.d)}" fill="none" stroke-width="${num(lineWidth)}"/>`;
}

function renderShape(n: PlacedNode, fill: string): string {
  const s = n.shape;
  const f = escapeXml(fill);
  if (s.kind === 'rect') {
    return `<rect x="${num(s.x)}" y="${num(s.y)}" width="${num(s.w)}" height="${num(s.h)}" rx="4" fill="${f}"/>`;
  }
  return `<circle cx="${num(s.cx)}" cy="${num(s.cy)}" r="${num(s.r)}" fill="${f}"/>`;
}

function renderLabel(n: PlacedNode): string {
  const { text, x, y, anchor, rotate } = n.label;
  const tf = rotate !== 0 ? ` transform="rotate(${num(rotate)} ${num(x)} ${num(y)})"` : '';
  return `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}"${tf}>${escapeXml(text)}</text>`;
}

function renderBadge(n: PlacedNode, fontSize: number): string {
  const r = shapeRect(n.shape);
  const cx = r.x + r.w;
  const cy = r.y;
  const label = `+${n.hiddenDescendants}`;
  const w = 0.6 * fontSize * label.length + 8;
  return `<g class="badge"><rect x="${num(cx - w / 2)}" y="${num(cy - BADGE_HEIGHT / 2)}" width="${num(w)}" height="${BADGE_HEIGHT}" rx="3"/>`
    + `<text x="${num(cx)}" y="${num(cy)}" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text></g>`;
}

function renderNode(n: PlacedNode, scene: Scene): string {
  const { palette, fontSize } = scene.style;
  const title = n.hiddenDescendants > 0 ? `${n.name} (+${n.hiddenDescendants} hidden teams)` : n.name;
  return `<g class="node" data-id="${escapeXml(n.id)}">${renderShape(n, palette[(n.depth - 1) % palette.length])}`
    + `<title>${escapeXml(title)}</title>${renderLabel(n)}`
    + (n.hiddenDescendants > 0 ? renderBadge(n, fontSize) : '')
    + '</g>';
}

export function renderSceneMarkup(scene: Scene): string {
  const edges = `<g class="edges">${scene.edges.map((e) => renderEdge(e, scene.style.lineWidth)).join('')}</g>`;
  const nodes = [...scene.nodes].sort((a, b) => a.depth - b.depth).map((n) => renderNode(n, scene));
  return edges + nodes.join('');
}

export function renderSvgDocument(scene: Scene): string {
  const b = scene.bounds;
  const w = num(b.w + 2 * MARGIN);
  const h = num(b.h + 2 * MARGIN);
  const style = `.node text{font-family:system-ui, sans-serif;font-size:${num(scene.style.fontSize)}px;fill:#1f2937}`
    + '.edge{stroke:#6b7280;fill:none}.badge rect{fill:#374151}.badge text{fill:#fff;font-size:10px}'
    + '.node rect,.node circle{stroke:#9ca3af;stroke-width:1}';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(b.x - MARGIN)} ${num(b.y - MARGIN)} ${w} ${h}" width="${w}" height="${h}">`
    + `<style>${style}</style>${renderSceneMarkup(scene)}</svg>`;
}

import type { PlacedNode, Rect, RoutedPath, Scene } from '../plugins/types';
import { shapeRect, unionRects } from '../geometry/rect';
import { num } from '../routers/path';

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
export const escapeXml = (s: string): string => s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);

const BADGE_HEIGHT = 14;
const BADGE_FONT_SIZE = 10;
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

/** The badge rect, centred on the top-right corner of the node's shape box and sized to its 10 px text. */
function badgeRect(n: PlacedNode): Rect {
  const r = shapeRect(n.shape);
  const w = 0.6 * BADGE_FONT_SIZE * `+${n.hiddenDescendants}`.length + 8;
  return { x: r.x + r.w - w / 2, y: r.y - BADGE_HEIGHT / 2, w, h: BADGE_HEIGHT };
}

function renderBadge(n: PlacedNode): string {
  const b = badgeRect(n);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const label = `+${n.hiddenDescendants}`;
  return `<g class="badge"><rect x="${num(b.x)}" y="${num(b.y)}" width="${num(b.w)}" height="${BADGE_HEIGHT}" rx="3"/>`
    + `<text x="${num(cx)}" y="${num(cy)}" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text></g>`;
}

function renderNode(n: PlacedNode, scene: Scene): string {
  const { palette } = scene.style;
  const title = n.hiddenDescendants > 0 ? `${n.name} (+${n.hiddenDescendants} hidden teams)` : n.name;
  return `<g class="node" data-id="${escapeXml(n.id)}">${renderShape(n, palette[(n.depth - 1) % palette.length])}`
    + `<title>${escapeXml(title)}</title>${renderLabel(n)}`
    + (n.hiddenDescendants > 0 ? renderBadge(n) : '')
    + '</g>';
}

export function renderSceneMarkup(scene: Scene): string {
  const edges = `<g class="edges">${scene.edges.map((e) => renderEdge(e, scene.style.lineWidth)).join('')}</g>`;
  const nodes = [...scene.nodes].sort((a, b) => a.depth - b.depth).map((n) => renderNode(n, scene));
  return edges + nodes.join('');
}

export function sceneCss(fontSize: number): string {
  return `.node text{font-family:system-ui, sans-serif;font-size:${num(fontSize)}px;fill:#1f2937}`
    + `.edge{stroke:#6b7280;fill:none}.badge rect{fill:#374151}.badge text{fill:#fff;font-size:${BADGE_FONT_SIZE}px}`
    + '.node rect,.node circle{stroke:#9ca3af;stroke-width:1}';
}

export function renderSvgDocument(scene: Scene): string {
  const badges = scene.nodes.filter((n) => n.hiddenDescendants > 0).map(badgeRect);
  const b = unionRects([scene.bounds, ...badges]);
  const w = num(b.w + 2 * MARGIN);
  const h = num(b.h + 2 * MARGIN);
  const style = sceneCss(scene.style.fontSize);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(b.x - MARGIN)} ${num(b.y - MARGIN)} ${w} ${h}" width="${w}" height="${h}">`
    + `<style>${style}</style>${renderSceneMarkup(scene)}</svg>`;
}

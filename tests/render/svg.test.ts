import { describe, it, expect } from 'vitest';
import { renderSceneMarkup, renderSvgDocument } from '../../src/render/svg';
import type { PlacedNode, RoutedPath, Scene } from '../../src/plugins/types';

const node = (o: Partial<PlacedNode>): PlacedNode => ({ id: 'a', name: 'A', depth: 1, parentId: null, hiddenDescendants: 0, stacked: false,
  shape: { kind: 'rect', x: 0, y: 0, w: 40, h: 20 }, label: { text: 'A', x: 20, y: 10, anchor: 'middle', rotate: 0 }, ...o });
const scene = (nodes: PlacedNode[], edges: RoutedPath[] = []): Scene =>
  ({ nodes, edges, bounds: { x: 0, y: 0, w: 100, h: 100 }, hasEdges: true, style: { fontSize: 14, lineWidth: 1.5, palette: ['#111', '#222'] } });

describe('renderSceneMarkup', () => {
  it('escapes markup characters in names, ids, labels and path data', () => {
    const m = renderSceneMarkup(scene(
      [node({ id: 'x"<&\'>', name: 'R&D <Ops>', label: { text: 'R&D <Ops>', x: 0, y: 0, anchor: 'middle', rotate: 0 } })],
      [{ fromId: 'a', toId: 'b', d: 'M0 0 "<&' }],
    ));
    expect(m).toContain('R&amp;D &lt;Ops&gt;');
    expect(m).not.toContain('R&D <Ops>');
    expect(m).toContain('data-id="x&quot;&lt;&amp;&apos;&gt;"');
    expect(m).toContain('d="M0 0 &quot;&lt;&amp;"');
  });
  it('badge and tooltip for hidden descendants', () => {
    const m = renderSceneMarkup(scene([node({ hiddenDescendants: 3 })]));
    expect(m).toContain('>+3</text>');
    expect(m).toContain('<title>A (+3 hidden teams)</title>');
    expect(m).toContain('class="badge"');
  });
  it('no badge or tooltip suffix when nothing is hidden', () => {
    const m = renderSceneMarkup(scene([node({})]));
    expect(m).not.toContain('badge');
    expect(m).toContain('<title>A</title>');
  });
  it('badge is centred on the top-right corner and sized to the text', () => {
    // rect 0,0,40x20 -> corner (40,0); "+12" = 3 chars at fontSize 14 -> w = 0.6*14*3+8 = 33.2, h = 14
    const m = renderSceneMarkup(scene([node({ hiddenDescendants: 12 })]));
    expect(m).toContain('<rect x="23.4" y="-7" width="33.2" height="14" rx="3"/>');
    expect(m).toContain('<text x="40" y="0" text-anchor="middle" dominant-baseline="central">+12</text>');
  });
  it('badge uses the corner of a circle shape box', () => {
    const m = renderSceneMarkup(scene([node({ hiddenDescendants: 1, shape: { kind: 'circle', cx: 10, cy: 10, r: 5 } })]));
    expect(m).toContain('<text x="15" y="5" text-anchor="middle" dominant-baseline="central">+1</text>');
  });
  it('parents render before children', () => {
    const m = renderSceneMarkup(scene([node({ id: 'c', depth: 2 }), node({ id: 'p', depth: 1 })]));
    expect(m.indexOf('data-id="p"')).toBeLessThan(m.indexOf('data-id="c"'));
  });
  it('edges come first, with stroke width and fill none', () => {
    const m = renderSceneMarkup(scene([node({})], [{ fromId: 'a', toId: 'b', d: 'M0 0 L10 10' }]));
    expect(m.startsWith('<g class="edges">')).toBe(true);
    expect(m).toContain('<path class="edge" d="M0 0 L10 10" fill="none" stroke-width="1.5"/>');
    expect(m.indexOf('class="edges"')).toBeLessThan(m.indexOf('class="node"'));
  });
  it('rect shape has rx and palette fill by depth, wrapping around', () => {
    const m = renderSceneMarkup(scene([node({ id: 'a', depth: 1 }), node({ id: 'b', depth: 2 }), node({ id: 'c', depth: 3 })]));
    expect(m).toContain('<rect x="0" y="0" width="40" height="20" rx="4" fill="#111"/>');
    expect(m).toContain('fill="#222"');
    expect(m.match(/fill="#111"/g)).toHaveLength(2);
  });
  it('circles and dots render as <circle>', () => {
    const m = renderSceneMarkup(scene([
      node({ id: 'c', shape: { kind: 'circle', cx: 5, cy: 6, r: 7 } }),
      node({ id: 'd', shape: { kind: 'dot', cx: 1, cy: 2, r: 3 } }),
    ]));
    expect(m).toContain('<circle cx="5" cy="6" r="7" fill="#111"/>');
    expect(m).toContain('<circle cx="1" cy="2" r="3" fill="#111"/>');
    expect(m).not.toContain('<rect');
  });
  it('label text attributes and rotation only when non-zero', () => {
    const plain = renderSceneMarkup(scene([node({})]));
    expect(plain).toContain('<text x="20" y="10" text-anchor="middle">A</text>');
    expect(plain).not.toContain('rotate');
    const rot = renderSceneMarkup(scene([node({ label: { text: 'A', x: 3.14159, y: -0, anchor: 'start', rotate: -90 } })]));
    expect(rot).toContain('<text x="3.142" y="0" text-anchor="start" transform="rotate(-90 3.142 0)">A</text>');
  });
});

describe('renderSvgDocument', () => {
  it('document has xmlns, viewBox with a 20 px margin, size and style', () => {
    const d = renderSvgDocument(scene([node({})]));
    expect(d.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(d).toContain('viewBox="-20 -20 140 140"');
    expect(d).toContain('width="140" height="140"');
    expect(d).toContain('<style>');
    expect(d).toContain('font-family:system-ui, sans-serif;font-size:14px');
    expect(d.endsWith('</svg>')).toBe(true);
    expect(d).toContain(renderSceneMarkup(scene([node({})])));
  });
  it('offsets viewBox by bounds origin', () => {
    const s = { ...scene([node({})]), bounds: { x: 10, y: -5, w: 30, h: 50 } };
    const d = renderSvgDocument(s);
    expect(d).toContain('viewBox="-10 -25 70 90"');
    expect(d).toContain('width="70" height="90"');
  });
});

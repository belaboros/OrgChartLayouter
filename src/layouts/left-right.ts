import type { TeamTree } from '../model/types';
import type { NodeLayoutPlugin, NodeLayoutResult, Rect } from '../plugins/types';
import { getNumber } from '../plugins/options';
import { unionRects } from '../geometry/rect';
import { flexLayout } from './flex-tree';

export const leftRight: NodeLayoutPlugin = {
  id: 'left-right',
  name: 'Left-to-right',
  optionsSchema: [
    { key: 'siblingGap', label: 'Sibling gap', type: 'number', min: 0, max: 80, step: 1, default: 16 },
    { key: 'levelGap', label: 'Level gap', type: 'number', min: 10, max: 150, step: 1, default: 40 },
  ],
  run(tree: TeamTree, options, ctx): NodeLayoutResult {
    const nodes = flexLayout(tree, ctx, getNumber(options, 'siblingGap'), getNumber(options, 'levelGap'), true);
    const bounds: Rect = unionRects(nodes.map((n) => n.shape as Rect));
    return { nodes, bounds, direction: 'right', hasEdges: true, origin: null };
  },
};

import type { RouterPlugin } from '../plugins/types';
import { polylinePath } from './path';

export const straight: RouterPlugin = {
  id: 'straight',
  name: 'Straight',
  optionsSchema: [],
  run({ group }) {
    return group.edges.map((e) => ({ fromId: group.parent.id, toId: e.child.id, d: polylinePath([e.from, e.to], 0) }));
  },
};

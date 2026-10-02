import type { NodeLayoutPlugin } from '../plugins/types';
import { topDown } from './top-down';
import { leftRight } from './left-right';
import { compact } from './compact';
import { radial } from './radial';

export const layouts: NodeLayoutPlugin[] = [topDown, leftRight, compact, radial];

export function findPlugin<P extends { id: string }>(list: P[], id: string): P | undefined {
  return list.find((p) => p.id === id);
}

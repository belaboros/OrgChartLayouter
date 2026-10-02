import type { NodeLayoutPlugin } from '../plugins/types';
import { topDown } from './top-down';
import { leftRight } from './left-right';
import { compact } from './compact';
import { radial } from './radial';
import { nestedRects } from './nested-rects';
import { nestedCircles } from './nested-circles';

export const layouts: NodeLayoutPlugin[] = [topDown, leftRight, compact, radial, nestedRects, nestedCircles];

export function findPlugin<P extends { id: string }>(list: P[], id: string): P | undefined {
  return list.find((p) => p.id === id);
}

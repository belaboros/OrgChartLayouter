import type { NodeLayoutPlugin } from '../plugins/types';
import { topDown } from './top-down';
import { leftRight } from './left-right';

export const layouts: NodeLayoutPlugin[] = [topDown, leftRight];

export function findPlugin<P extends { id: string }>(list: P[], id: string): P | undefined {
  return list.find((p) => p.id === id);
}

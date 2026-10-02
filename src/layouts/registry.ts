import type { NodeLayoutPlugin } from '../plugins/types';
import { topDown } from './top-down';

export const layouts: NodeLayoutPlugin[] = [topDown];

export function findPlugin<P extends { id: string }>(list: P[], id: string): P | undefined {
  return list.find((p) => p.id === id);
}

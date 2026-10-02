import type { Options } from '../plugins/types';

export type Axis = 'layout' | 'anchor' | 'router';

export interface Settings {
  maxDepth: number | null;
  fontSize: number;
  lineWidth: number;
  layoutId: string;
  anchorId: string;
  routerId: string;
  /** Key is `${axis}/${id}`. */
  pluginOptions: Record<string, Options>;
}

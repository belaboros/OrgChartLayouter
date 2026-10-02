import type { AnchorPlugin } from '../plugins/types';
import { auto } from './auto';
import { center } from './center';
import { fixedSides } from './fixed-sides';
import { nearestSides } from './nearest-sides';
import { boundary } from './boundary';

export const anchors: AnchorPlugin[] = [auto, center, fixedSides, nearestSides, boundary];

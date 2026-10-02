import type { RouterPlugin } from '../plugins/types';
import { straight } from './straight';
import { orthogonalElbow } from './orthogonal-elbow';
import { orthogonalBus } from './orthogonal-bus';
import { curved } from './curved';
import { radialArc } from './radial-arc';

export const routers: RouterPlugin[] = [straight, orthogonalElbow, orthogonalBus, curved, radialArc];

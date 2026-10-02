import type { RouterPlugin } from '../plugins/types';
import { straight } from './straight';
import { orthogonalElbow } from './orthogonal-elbow';
import { orthogonalBus } from './orthogonal-bus';

export const routers: RouterPlugin[] = [straight, orthogonalElbow, orthogonalBus];

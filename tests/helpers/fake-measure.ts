import type { Ctx, Measure } from '../../src/plugins/types';

export const fakeMeasure: Measure = (t, fs) => ({ width: t.length * fs * 0.6, height: fs * 1.2 });
export const fakeCtx: Ctx = { measure: fakeMeasure, fontSize: 10 };

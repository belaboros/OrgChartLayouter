import { describe, test, type BenchResult } from 'vitest';
import { runPipeline, defaultRegistries } from '../src/pipeline/run';
import { defaultSettings } from '../src/settings/settings';
import { fakeMeasure } from '../tests/helpers/fake-measure';
import { loadTree } from '../tests/helpers/trees';
import { generateTree } from '../tests/helpers/generate';

const CONTAINMENT = ['nested-rects', 'nested-circles'];
const large = loadTree('src/samples/large.teams.yaml');

const report = (r: BenchResult) => console.log(`BENCH ${r.name}: mean ${r.latency.mean.toFixed(2)} ms`);

describe('large (150 teams)', () => {
  for (const l of defaultRegistries.layouts.map((p) => p.id)) {
    const containment = CONTAINMENT.includes(l);
    const anchors = containment ? [defaultSettings().anchorId] : defaultRegistries.anchors.map((p) => p.id);
    const routers = containment ? [defaultSettings().routerId] : defaultRegistries.routers.map((p) => p.id);
    for (const a of anchors) {
      for (const r of routers) {
        const S = { ...defaultSettings(), layoutId: l, anchorId: a, routerId: r };
        test(`${l}/${a}/${r} large`, async ({ bench }) => {
          report(await bench(`${l}/${a}/${r} large`, () => { runPipeline(large, S, fakeMeasure); }).run());
        });
      }
    }
  }
});

describe('generated (1000 teams)', () => {
  const tree = generateTree(1000, 6);
  const S = defaultSettings();
  test('default 1000', async ({ bench }) => {
    report(await bench('default 1000', () => { runPipeline(tree, S, fakeMeasure); }).run());
  });
});

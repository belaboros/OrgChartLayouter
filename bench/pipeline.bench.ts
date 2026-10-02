import { describe, test } from 'vitest';
import { runPipeline, defaultRegistries } from '../src/pipeline/run';
import { defaultSettings } from '../src/settings/settings';
import { fakeMeasure } from '../tests/helpers/fake-measure';
import { loadTree } from '../tests/helpers/trees';
import { generateTree } from '../tests/helpers/generate';

const CONTAINMENT = ['nested-rects', 'nested-circles'];
const TARGET_MS = 50;
// Small time budget: the pipeline takes ~1 ms, so 100 ms is plenty of samples per combination.
const RUN = { time: 100, warmupTime: 20 };
const large = loadTree('src/samples/large.teams.yaml');

describe('large (150 teams)', () => {
  test('layout x anchor x router', async ({ bench }) => {
    const names: string[] = [];
    const regs = [];
    for (const l of defaultRegistries.layouts.map((p) => p.id)) {
      const containment = CONTAINMENT.includes(l);
      const anchors = containment ? [defaultSettings().anchorId] : defaultRegistries.anchors.map((p) => p.id);
      const routers = containment ? [defaultSettings().routerId] : defaultRegistries.routers.map((p) => p.id);
      for (const a of anchors) {
        for (const r of routers) {
          const S = { ...defaultSettings(), layoutId: l, anchorId: a, routerId: r };
          const name = `${l}/${a}/${r} large`;
          names.push(name);
          regs.push(bench(name, () => { runPipeline(large, S, fakeMeasure); }));
        }
      }
    }
    const results = await bench.compare(...regs, RUN);
    const means = names.map((n) => ({ n, mean: results.get(n).latency.mean }));
    const worst = means.reduce((a, b) => (b.mean > a.mean ? b : a));
    console.log(`WORST 150-team: ${worst.n} ${worst.mean.toFixed(2)} ms (target < ${TARGET_MS} ms: ${worst.mean < TARGET_MS ? 'OK' : 'EXCEEDED'})`);
  });
});

describe('generated (1000 teams)', () => {
  const tree = generateTree(1000, 6);
  const S = defaultSettings();
  test('default combination', async ({ bench }) => {
    await bench('default 1000', () => { runPipeline(tree, S, fakeMeasure); }).run(RUN);
  });
});

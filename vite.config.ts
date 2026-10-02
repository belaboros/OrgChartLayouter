import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: './',
  plugins: [svelte()],
  test: { include: ['tests/**/*.test.ts'], benchmark: { include: ['bench/**/*.bench.ts'] } },
});

import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/base.ts', 'src/plugin.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});

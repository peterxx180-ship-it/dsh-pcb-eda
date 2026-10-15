import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: './src/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'lib',
  fixedExtension: false,
  dts: true,
  clean: true,
  deps: { neverBundle: [/^@deepseek-ai\//] },
  tsconfig: 'tsconfig.build.json',
})

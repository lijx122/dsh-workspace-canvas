import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/client.tsx'],
  format: ['esm'],
  clean: true,
  dts: false,
  platform: 'neutral',
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    /^@deepseek-ai\//
  ]
})

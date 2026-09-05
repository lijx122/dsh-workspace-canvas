import * as esbuild from 'esbuild'

async function build() {
  console.log('Building dsh-workspace-canvas...')
  
  // 1. Build Host index.js (Node / ESM)
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    outfile: 'lib/index.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    external: [
      '@deepseek-ai/*',
      'node:*'
    ]
  })

  // 2. Build Client client.js (Browser / ESM)
  await esbuild.build({
    entryPoints: ['src/client.tsx'],
    outfile: 'lib/client.js',
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    jsx: 'automatic',
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@deepseek-ai/*'
    ]
  })

  console.log('Build completed successfully!')
}

build().catch(err => {
  console.error(err)
  process.exit(1)
})

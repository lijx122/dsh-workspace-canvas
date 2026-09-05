import * as esbuild from 'esbuild'
import { writeFile } from 'node:fs/promises'

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

  // 2. Build Client client.js (Browser / CommonJS wrapped with window.__ModuleLoader__.load)
  const clientResult = await esbuild.build({
    entryPoints: ['src/client.tsx'],
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    target: 'es2022',
    jsx: 'automatic',
    write: false,
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@deepseek-ai/*'
    ]
  })

  const rawClientCode = clientResult.outputFiles[0].text
  const wrappedCode = `window.__ModuleLoader__.load({
  id: "dsh-workspace-canvas",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${rawClientCode}
    return module.exports;
  }
});
`

  await writeFile('lib/client.js', wrappedCode, 'utf8')
  console.log('Build completed successfully with window.__ModuleLoader__.load format!')
}

build().catch(err => {
  console.error(err)
  process.exit(1)
})

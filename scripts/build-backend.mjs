import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
await mkdir('dist/lambda', { recursive: true })
for (const name of ['api', 'extraction-complete', 'reminders']) {
  await build({ entryPoints: [`backend/lambda/${name}.ts`], outfile: `dist/lambda/${name}/index.cjs`, bundle: true, platform: 'node', target: 'node22', format: 'cjs', sourcemap: true })
  await writeFile(`dist/lambda/${name}/package.json`, JSON.stringify({ type: 'commonjs' }))
}
console.log('Built three Lambda bundles in dist/lambda. No AWS resources were changed.')

import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = process.cwd();
const testRoot = path.join(root, 'src');
const outDir = path.join(root, '.tmp-tests');

async function findTests(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findTests(fullPath));
    } else if (entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

try {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const tests = await findTests(testRoot);
  if (tests.length === 0) {
    console.log('[test] no tests found');
  } else {
    for (const testFile of tests) {
      const outfile = path.join(outDir, `${path.basename(testFile, '.ts')}.cjs`);
      await build({
        entryPoints: [testFile],
        outfile,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node20',
        logLevel: 'silent',
      });
      require(outfile);
      console.log(`[test] passed ${path.relative(root, testFile)}`);
    }

    console.log(`[test] ${tests.length} test file(s) passed`);
  }
} finally {
  await rm(outDir, { recursive: true, force: true });
}

import esbuild from 'esbuild';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

const outputPath = join(import.meta.dirname, 'dist', 'validator-bundled.js');
const hashPath = join(import.meta.dirname, 'dist', 'validator-bundled.js.sha256');

// Build the bundle
await esbuild.build({
  entryPoints: [join(import.meta.dirname, 'src', 'wrapper.ts')],
  outfile: outputPath,
  format: 'cjs',
  bundle: true,
  platform: 'node',
  target: 'node18',
  sourcemap: false,
  minify: false,
});

// Compute SHA-256 hash
const bundleContent = readFileSync(outputPath);
const hash = createHash('sha256').update(bundleContent).digest('hex');

// Write hash file
import { writeFileSync } from 'fs';
writeFileSync(hashPath, hash, 'utf8');

// Report
const sizeKb = (bundleContent.length / 1024).toFixed(2);
console.log(`✓ Bundle created: ${sizeKb}KB`);
console.log(`✓ SHA-256: ${hash}`);

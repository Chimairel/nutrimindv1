import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoots = [resolve(root, 'backend/src'), resolve(root, 'frontend/src')];
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const maximumLines = 900;

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return sourceExtensions.has(extname(entry.name)) && statSync(path).isFile() ? [path] : [];
  });
}

const violations = sourceRoots
  .flatMap(collectFiles)
  .map((path) => ({ path, lines: readFileSync(path, 'utf8').split(/\r?\n/).length }))
  .filter(({ lines }) => lines > maximumLines)
  .sort((left, right) => right.lines - left.lines);

if (violations.length > 0) {
  console.error(`Source architecture check failed: handwritten modules must stay at or below ${maximumLines} lines.`);
  for (const violation of violations) {
    console.error(`- ${relative(root, violation.path)}: ${violation.lines} lines`);
  }
  console.error('Split state, transport, policy, presentation, or fixtures by responsibility before adding more code.');
  process.exitCode = 1;
} else {
  console.log(`Source architecture check passed: every handwritten source module is <= ${maximumLines} lines.`);
}

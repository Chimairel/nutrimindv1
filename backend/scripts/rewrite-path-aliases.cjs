const fs = require('node:fs');
const path = require('node:path');

const distRoot = path.resolve(__dirname, '..', 'dist');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function relativeModuleSpecifier(fromFile, aliasTarget) {
  const target = path.join(distRoot, aliasTarget);
  let relativePath = path.relative(path.dirname(fromFile), target).replaceAll('\\', '/');
  if (!relativePath.startsWith('.')) relativePath = `./${relativePath}`;
  return relativePath;
}

if (!fs.existsSync(distRoot)) {
  throw new Error(`Compiled output directory does not exist: ${distRoot}`);
}

let rewrittenFileCount = 0;
for (const filePath of walk(distRoot).filter((file) => file.endsWith('.js'))) {
  const original = fs.readFileSync(filePath, 'utf8');
  const rewritten = original.replace(
    /(["'])@\/([^"']+)\1/g,
    (_match, quote, aliasTarget) => `${quote}${relativeModuleSpecifier(filePath, aliasTarget)}${quote}`,
  );

  if (rewritten !== original) {
    fs.writeFileSync(filePath, rewritten, 'utf8');
    rewrittenFileCount += 1;
  }
}

const unresolvedAliases = walk(distRoot)
  .filter((file) => file.endsWith('.js'))
  .filter((file) => fs.readFileSync(file, 'utf8').includes('@/'));

if (unresolvedAliases.length > 0) {
  throw new Error(`Unresolved @/ aliases remain in: ${unresolvedAliases.join(', ')}`);
}

console.log(`[Build] Rewrote path aliases in ${rewrittenFileCount} compiled files.`);

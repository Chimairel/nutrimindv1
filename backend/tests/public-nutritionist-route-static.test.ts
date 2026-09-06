import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const frontendRoot = path.resolve(process.cwd(), '../frontend');
const readFrontend = (relativePath: string) => readFileSync(path.join(frontendRoot, relativePath), 'utf8');

test('[TEST-151][DEF-037] public nutritionist application routes cannot trigger stale-session refresh redirects', () => {
  const axiosSource = readFrontend('src/lib/axios.ts');
  assert.match(axiosSource, /authPages[\s\S]*['"]\/nutritionist-apply['"]/);
  assert.match(axiosSource, /authPages[\s\S]*['"]\/nutritionist-invitation['"]/);
});

test('[TEST-151][DEF-037] public nutritionist routes are exempt from protected nutritionist role enforcement', () => {
  const guardSource = readFrontend('src/components/shared/RouteGuard.tsx');
  assert.match(
    guardSource,
    /!isPublicRoute\s*&&\s*isNutritionistRoute\s*&&\s*user\.role\s*!==\s*['"]NUTRITIONIST['"]/
  );
});

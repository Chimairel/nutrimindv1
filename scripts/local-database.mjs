/** Owns only the persistent loopback development database; never operates on DATABASE_URL. */
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { setTimeout as pause } from 'node:timers/promises';
import process from 'node:process';
import console from 'node:console';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');
const privateRoot = join(backend, '.local/local-development');
const credentials = join(privateRoot, 'postgres.env');
const backups = join(backend, '.local/backups');
const backendEnv = join(backend, '.env');
const composeFile = join(root, 'compose.local-db.yaml');
const container = 'kainara-local-postgres';
const database = 'kainara_local_development';
const target = `${database}@127.0.0.1:55432`;
const require = createRequire(join(backend, 'package.json'));
const { parse } = require('dotenv');
const arg = (key) => process.argv.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const action = process.argv[2];
const fail = (message) => {
  throw new Error(message);
};
const docker = (args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
function readCredentials() {
  if (!existsSync(credentials)) fail('Run npm run local-db:up to initialize the local database credentials.');
  const password = parse(readFileSync(credentials)).LOCAL_POSTGRES_PASSWORD;
  if (!/^[a-f0-9]{64}$/.test(password ?? ''))
    fail('Invalid local credential file. Restore its saved copy; do not overwrite it.');
  return {
    password,
    url: `postgresql://postgres:${password}@127.0.0.1:55432/${database}?schema=public&connection_limit=5&pool_timeout=30`,
  };
}
function assertConfirmed() {
  if (arg('confirm-target') !== target) fail(`Confirm this local target with --confirm-target=${target}`);
}
function assertOwned() {
  const inspected = JSON.parse(docker(['inspect', container]))[0];
  if (
    inspected.Config.Labels?.['com.docker.compose.project'] !== 'kainara-local-development' ||
    inspected.Config.Labels?.['com.docker.compose.service'] !== 'postgres'
  )
    fail('The container is not owned by the local development Compose project.');
  const binding = inspected.HostConfig.PortBindings?.['5432/tcp'];
  if (binding?.length !== 1 || binding[0].HostIp !== '127.0.0.1' || binding[0].HostPort !== '55432')
    fail('The database must use the expected loopback-only port.');
}
const sql = (query) =>
  docker([
    'exec',
    container,
    'psql',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    database,
    '-Atc',
    query,
  ]).trim();
function archivePath(input) {
  if (!input) fail('Provide --archive=PATH and --manifest=PATH from backend/.local/backups.');
  const file = realpathSync(resolve(root, input));
  const rel = relative(realpathSync(backups), file);
  if (!rel || rel.startsWith('..') || isAbsolute(rel))
    fail('Archives and manifests must remain inside backend/.local/backups.');
  return file;
}
function compose(args) {
  const { password } = readCredentials();
  return execFileSync('docker', ['compose', '--file', composeFile, '--env-file', credentials, ...args], {
    env: { ...process.env, LOCAL_POSTGRES_PASSWORD: password },
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}
async function up() {
  mkdirSync(privateRoot, { recursive: true });
  if (!existsSync(credentials)) {
    let existingVolume = false;
    try {
      docker(['volume', 'inspect', 'kainara-local-development_postgres-data']);
      existingVolume = true;
    } catch {
      /* New volume is expected on the first run. */
    }
    if (existingVolume) fail('The local volume exists but its credentials are missing. Restore postgres.env first.');
    writeFileSync(credentials, `LOCAL_POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  }
  compose(['up', '-d', 'postgres']);
  assertOwned();
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      sql('SELECT 1');
      console.log(`Local PostgreSQL ready: ${target}`);
      return;
    } catch {
      await pause(1000);
    }
  }
  fail('Local PostgreSQL did not become ready. Check Docker Desktop and the local container health.');
}
function migrate() {
  assertConfirmed();
  assertOwned();
  const { url } = readCredentials();
  const output = execFileSync(
    process.execPath,
    [join(backend, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    {
      cwd: backend,
      env: { ...process.env, DATABASE_URL: url },
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }
  );
  writeFileSync(join(privateRoot, 'migrations.log'), output);
  console.log(`Existing migrations applied to ${target}. Log: backend/.local/local-development/migrations.log`);
}
function restore() {
  assertConfirmed();
  assertOwned();
  const archive = archivePath(arg('archive'));
  const manifestPath = archivePath(arg('manifest'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (digest(archive) !== manifest.sha256) fail('Archive checksum does not match its backup manifest.');
  if (Number(sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'")) !== 0)
    fail(
      'Restore requires an empty public schema. Existing data is preserved; create another explicitly named target if needed.'
    );
  const temporary = `/tmp/kainara-local-restore-${Date.now()}.dump`;
  docker(['cp', archive, `${container}:${temporary}`]);
  docker([
    'exec',
    container,
    'pg_restore',
    '--exit-on-error',
    '--single-transaction',
    '--no-owner',
    '--no-privileges',
    '-U',
    'postgres',
    '-d',
    database,
    temporary,
  ]);
  docker(['exec', container, 'rm', '-f', temporary]);
  writeFileSync(
    join(privateRoot, 'restore.json'),
    JSON.stringify(
      {
        target,
        restoredAt: new Date().toISOString(),
        archiveCreatedAt: manifest.createdAt ?? null,
        archiveSha256: digest(archive),
        tables: Number(sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'")),
      },
      null,
      2
    ) + '\n'
  );
  console.log(`Verified archive restored into ${target}. Migrate this local copy before switching the API.`);
}
function useLocal() {
  assertConfirmed();
  assertOwned();
  if (!existsSync(backendEnv)) fail('Create backend/.env before switching its database target.');
  const expectedMigrations = readdirSync(join(backend, 'prisma/migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const applied = new Set(
    sql(
      'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
    ).split('\n')
  );
  if (applied.size !== expectedMigrations.length || expectedMigrations.some((name) => !applied.has(name)))
    fail('The local migration set is not current. Run local-db:migrate before switching.');
  const original = readFileSync(backendEnv, 'utf8');
  const previousTarget = parse(original).DATABASE_URL;
  const { url } = readCredentials();
  const rollback = join(privateRoot, 'backend-before-local.env');
  if (previousTarget !== url && existsSync(rollback))
    fail('A saved previous environment already exists. Review it before replacing another target.');
  if (previousTarget !== url) copyFileSync(backendEnv, rollback);
  const next =
    original
      .split(/\r?\n/)
      .filter((line) => !/^\s*(?:export\s+)?DATABASE_URL\s*=/.test(line))
      .join('\n')
      .trimEnd() + `\nDATABASE_URL="${url}"\n`;
  writeFileSync(backendEnv, next, { mode: 0o600 });
  console.log(
    `Local API database configured: ${target}. Restart the local API. The previous environment is kept privately for rollback.`
  );
}
function backup() {
  assertOwned();
  mkdirSync(backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archive = join(backups, `local-development-${stamp}.dump`);
  const temporary = `/tmp/kainara-local-backup-${Date.now()}.dump`;
  docker([
    'exec',
    container,
    'pg_dump',
    '-Fc',
    '--no-owner',
    '--no-privileges',
    '-U',
    'postgres',
    '-d',
    database,
    '-f',
    temporary,
  ]);
  docker(['cp', `${container}:${temporary}`, archive]);
  docker(['exec', container, 'rm', '-f', temporary]);
  const manifest = {
    database,
    target,
    createdAt: new Date().toISOString(),
    sha256: digest(archive),
    bytes: readFileSync(archive).length,
  };
  writeFileSync(archive + '.manifest.json', JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  console.log(`Local backup saved: ${relative(root, archive)}. Keep its manifest beside it and rehearse a restore.`);
}
try {
  switch (action) {
    case 'up':
      await up();
      break;
    case 'stop':
      assertOwned();
      compose(['stop', 'postgres']);
      console.log('Local database stopped; its persistent volume is preserved.');
      break;
    case 'status':
      assertOwned();
      console.log(
        JSON.stringify({
          target,
          ready: sql('SELECT 1') === '1',
          tables: Number(sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'")),
        })
      );
      break;
    case 'restore':
      restore();
      break;
    case 'migrate':
      migrate();
      break;
    case 'use':
      useLocal();
      break;
    case 'backup':
      backup();
      break;
    default:
      fail('Use up, stop, status, restore, migrate, use or backup. No hosted target is supported by this tool.');
  }
} catch (error) {
  console.error(String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[redacted database URL]'));
  process.exitCode = 1;
}

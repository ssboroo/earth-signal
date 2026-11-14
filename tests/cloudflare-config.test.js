import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Wrangler config binds static assets, D1, R2 and six-hour scheduled monitoring', () => {
  const config = JSON.parse(read('../wrangler.jsonc'));
  assert.equal(config.main, 'worker/index.js');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.ok(config.assets.run_worker_first.includes('/api/*'));
  assert.equal(config.d1_databases[0].binding, 'DB');
  assert.equal(config.d1_databases[0].migrations_dir, 'migrations');
  assert.equal(config.r2_buckets[0].binding, 'REPORTS');
  assert.deepEqual(config.triggers.crons, ['0 */6 * * *']);
});

test('D1 migration creates shared zones, scene candidates and run history with fair scan rotation', () => {
  const sql = read('../migrations/0001_init.sql');
  for (const table of ['monitoring_zones', 'scene_observations', 'monitoring_runs']) {
    assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.ok(sql.includes('last_checked_at TEXT'));
  assert.ok(sql.includes('UNIQUE(zone_id, scene_id)'));
});

test('static asset ignore file excludes server and repository-only files', () => {
  const ignored = read('../.assetsignore');
  for (const entry of ['worker/', 'tests/', 'migrations/', 'wrangler.jsonc']) {
    assert.ok(ignored.includes(entry));
  }
});

test('GitHub deploy workflow gates deployment on all required secrets', () => {
  const workflow = read('../.github/workflows/cloudflare-deploy.yml');
  for (const secret of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'EARTH_SIGNAL_API_TOKEN']) {
    assert.ok(workflow.includes(`secrets.${secret}`));
  }
  assert.ok(workflow.includes('d1 migrations apply DB --remote'));
  assert.ok(workflow.includes('wrangler@latest deploy'));
});

test('deployment provisions D1 and R2 resources automatically before deploy', () => {
  const workflow = read('../.github/workflows/cloudflare-deploy.yml');
  assert.ok(workflow.includes('/d1/database'));
  assert.ok(workflow.includes('/r2/buckets'));
  assert.ok(workflow.includes('REPLACE_WITH_D1_DATABASE_ID'));
  assert.ok(workflow.includes('earth-signal-reports'));
  assert.ok(workflow.includes('d1 migrations apply earth-signal-db --remote'));
});

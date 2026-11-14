import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('browser module script is syntactically valid JavaScript', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const opening = '<script type="module">';
  const start = html.indexOf(opening);
  const end = html.indexOf('</script>', start);
  assert.notEqual(start, -1, 'module script should exist');
  assert.notEqual(end, -1, 'module script should close');
  assert.equal(html.indexOf(opening, start + opening.length), -1, 'expected one module script');
  const script = html.slice(start + opening.length, end);
  const result = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: script,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('Sentinel footprints are layered above the satellite raster', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes("id:'sentinel-scenes-fill'"));
  assert.ok(html.includes("id:'sentinel-scenes-outline'"));
  assert.ok(html.includes("},'sentinel-scenes-fill');"));
});

test('monitoring zones expose a session-scoped authenticated Cloudflare sync control', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="zone-cloud-token"'));
  assert.ok(html.includes('id="zone-sync"'));
  assert.ok(html.includes("fetch('/api/zones'"));
  assert.ok(!html.includes('sessionStorage.setItem'));
  assert.ok(!html.includes('localStorage.setItem(\'earth-signal-admin-token\''));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('browser module script is syntactically valid JavaScript', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script type="module">([\\s\\S]*?)<\\/script>/g)];
  assert.equal(scripts.length, 1, 'expected exactly one browser module script');
  const result = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: scripts[0][1],
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('satellite scene polygons remain visible above imagery layers', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /sentinel-scenes-fill/);
  assert.match(html, /sentinel-scenes-outline/);
  assert.match(html, /'sentinel-scenes-fill'\);/);
});

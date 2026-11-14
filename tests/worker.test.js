import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

function env(overrides = {}) {
  return {
    DB: {
      prepare() { return { bind() { return this; }, async first() { return { count: 0 }; }, async all() { return { results: [] }; }, async run() { return { success: true }; } }; }
    },
    API_TOKEN: 'test-secret',
    ...overrides
  };
}

test('health endpoint reports service and storage availability without secrets', async () => {
  const response = await worker.fetch(new Request('https://earth-signal.test/api/health'), env());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.service, 'earth-signal-api');
  assert.equal(body.storage, 'available');
  assert.equal(JSON.stringify(body).includes('test-secret'), false);
});

test('zone API rejects requests without bearer token', async () => {
  const response = await worker.fetch(new Request('https://earth-signal.test/api/zones'), env());
  assert.equal(response.status, 401);
});

test('zone API validates GeoJSON before writing', async () => {
  const response = await worker.fetch(new Request('https://earth-signal.test/api/zones', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'bad zone', geometry: { type: 'Point', coordinates: [0, 0] } })
  }), env());
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'A valid Polygon geometry is required');
});

test('unknown API routes return JSON 404', async () => {
  const response = await worker.fetch(new Request('https://earth-signal.test/api/missing'), env());
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('content-type').includes('application/json'), true);
});

test('zone API stores a valid polygon and returns its measured area', async () => {
  const ring = [[104,47],[104.01,47],[104.01,47.01],[104,47.01],[104,47]];
  const response = await worker.fetch(new Request('https://earth-signal.test/api/zones', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Mongolia test area', geometry: { type: 'Polygon', coordinates: [ring] } })
  }), env());
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.zone.name, 'Mongolia test area');
  assert.ok(body.zone.areaHa > 0);
  assert.equal(body.zone.geometry.type, 'Polygon');
});

test('zone API rejects polygons with holes until hole-aware area measurement is supported', async () => {
  const outer = [[104,47],[104.02,47],[104.02,47.02],[104,47.02],[104,47]];
  const hole = [[104.005,47.005],[104.01,47.005],[104.01,47.01],[104.005,47.01],[104.005,47.005]];
  const response = await worker.fetch(new Request('https://earth-signal.test/api/zones', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'zone with hole', geometry: { type: 'Polygon', coordinates: [outer, hole] } })
  }), env());
  assert.equal(response.status, 400);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchPayload, normalizeFeature, formatDateRange } from '../src/stac.js';

test('buildSearchPayload uses a valid bbox, date window, collection and cloud filter', () => {
  const payload = buildSearchPayload({
    bbox: [98, 45, 110, 52],
    days: 30,
    now: new Date('2026-11-14T12:00:00Z'),
    limit: 10
  });
  assert.deepEqual(payload.bbox, [98, 45, 110, 52]);
  assert.deepEqual(payload.collections, ['sentinel-2-l2a']);
  assert.equal(payload.datetime, '2026-10-15T12:00:00.000Z/2026-11-14T12:00:00.000Z');
  assert.equal(payload.limit, 10);
  assert.equal(payload.query['eo:cloud_cover'].lt, 40);
});

test('buildSearchPayload rejects invalid bounding boxes', () => {
  assert.throws(() => buildSearchPayload({ bbox: [10, 20, 5, 30] }), /Invalid bounding box/);
  assert.throws(() => buildSearchPayload({ bbox: [10, 20, 181, 30] }), /Invalid bounding box/);
});

test('normalizeFeature returns safe scene metadata and skips incomplete features', () => {
  const feature = {
    id: 'S2A_TEST',
    properties: {
      datetime: '2026-11-10T03:00:00Z',
      'eo:cloud_cover': 12.5,
      platform: 'sentinel-2a'
    },
    geometry: { type: 'Point', coordinates: [105, 47] },
    assets: { thumbnail: { href: 'https://example.test/thumb.jpg' } }
  };
  assert.deepEqual(normalizeFeature(feature), {
    id: 'S2A_TEST',
    date: '2026-11-10T03:00:00Z',
    cloudCover: 12.5,
    platform: 'sentinel-2a',
    coordinates: [105, 47],
    geometry: { type: 'Point', coordinates: [105, 47] },
    thumbnail: 'https://example.test/thumb.jpg'
  });
  assert.equal(normalizeFeature({ id: 'missing' }), null);
  const withBands = normalizeFeature({ ...feature, assets: { red:{href:'https://data.test/red.tif'}, nir:{href:'https://data.test/nir.tif'}, swir22:{href:'http://invalid.test/swir.tif'} } });
  assert.deepEqual(withBands.assets, { red:{href:'https://data.test/red.tif'}, nir:{href:'https://data.test/nir.tif'} });
});

test('formatDateRange creates an ISO UTC interval', () => {
  assert.equal(
    formatDateRange(7, new Date('2026-11-14T00:00:00Z')),
    '2026-11-07T00:00:00.000Z/2026-11-14T00:00:00.000Z'
  );
});

test('normalizeFeature preserves polygon footprints and does not treat missing cloud cover as zero', () => {
  const polygon = {
    id: 'S2B_POLYGON',
    properties: { datetime: '2026-11-11T02:00:00Z', 'eo:cloud_cover': null },
    bbox: [100, 40, 101, 41],
    geometry: { type: 'Polygon', coordinates: [[[100,40],[101,40],[101,41],[100,41],[100,40]]] },
    assets: {}
  };
  const scene = normalizeFeature(polygon);
  assert.deepEqual(scene.coordinates, [100.5, 40.5]);
  assert.equal(scene.cloudCover, null);
  assert.deepEqual(scene.geometry, polygon.geometry);
});

test('searchSentinelScenes posts the map query and reports HTTP errors', async () => {
  let request;
  const scenes = await (await import('../src/stac.js')).searchSentinelScenes({
    bbox: [98, 45, 110, 52],
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ features: [] }) };
    }
  });
  assert.deepEqual(scenes, []);
  assert.match(request.url, /earth-search\.aws\.element84\.com/);
  assert.equal(request.options.method, 'POST');
  await assert.rejects(
    (await import('../src/stac.js')).searchSentinelScenes({
      bbox: [98, 45, 110, 52],
      fetchImpl: async () => ({ ok: false, status: 503 })
    }),
    /request failed \(503\)/
  );
});

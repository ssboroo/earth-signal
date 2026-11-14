import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedDifference, calculateIndices, classifyIndex, compareIndex, polygonAreaHectares } from '../src/analytics.js';

test('normalizedDifference calculates a bounded spectral index', () => {
  assert.ok(Math.abs(normalizedDifference(0.8, 0.2) - 0.6) < 1e-12);
  assert.equal(normalizedDifference(0, 0), null);
  assert.equal(normalizedDifference(-1, 1), null);
  assert.equal(normalizedDifference(2, 1), 1 / 3);
});

test('calculateIndices derives NDVI, NDWI and NBR from Sentinel-2 reflectance', () => {
  const result = calculateIndices({ red: 0.2, nir: 0.8, green: 0.5, swir16: 0.4, swir22: 0.3 });
  assert.ok(Math.abs(result.ndvi - 0.6) < 1e-12);
  assert.ok(Math.abs(result.ndwi - (-0.23076923076923078)) < 1e-12);
  assert.ok(Math.abs(result.nbr - 0.45454545454545453) < 1e-12);
});

test('classifyIndex handles vegetation and water thresholds without inventing values', () => {
  assert.equal(classifyIndex('ndvi', 0.72), 'dense-vegetation');
  assert.equal(classifyIndex('ndvi', 0.25), 'sparse-vegetation');
  assert.equal(classifyIndex('ndwi', 0.35), 'water-likely');
  assert.equal(classifyIndex('ndwi', null), 'no-data');
});

test('compareIndex flags only changes beyond the configured threshold', () => {
  assert.deepEqual(compareIndex(0.72, 0.2, { threshold: 0.25 }), {
    before: 0.72, after: 0.2, delta: -0.52, changed: true
  });
  assert.equal(compareIndex(0.5, 0.45, { threshold: 0.1 }).changed, false);
  assert.equal(compareIndex(null, 0.4).changed, null);
});

test('polygonAreaHectares estimates geodesic area and rejects invalid rings', () => {
  const ring = [[0,0],[0.01,0],[0.01,0.01],[0,0.01],[0,0]];
  const area = polygonAreaHectares(ring);
  assert.ok(area > 120 && area < 130);
  assert.equal(polygonAreaHectares([[0,0],[1,1]]), null);
});

test('zero-valued index pixels remain valid measurements', async () => {
  const { summarizeIndexPixels } = await import('../src/analytics.js');
  const result = summarizeIndexPixels('ndvi', new Float32Array([0, -0.1, 0.4]));
  assert.equal(result.validPixels, 3);
  assert.ok(Math.abs(result.mean - 0.1) < 1e-6);
});

test('SCL no-data, saturated, shadow, cloud, cirrus and snow pixels are masked', async () => {
  const { summarizeIndexPixels } = await import('../src/analytics.js');
  const result = summarizeIndexPixels('ndvi', new Float32Array([0.2,0.2,0.2,0.2,0.2,0.2,0.2]), {
    scl: new Uint8Array([0,1,3,8,9,10,11])
  });
  assert.equal(result.validPixels, 0);
  assert.equal(result.maskedPixels, 7);
});

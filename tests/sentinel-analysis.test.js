import test from 'node:test';
import assert from 'node:assert/strict';
import { getSentinelBandUrls, requiredBandsForIndex, computeIndexFromBands } from '../src/sentinel-analysis.js';

test('resolves Sentinel-2 COG bands only from safe HTTPS assets', () => {
  const scene = { assets: { red:{href:'https://data.test/red.tif'}, nir:{href:'https://data.test/nir.tif'}, swir22:{href:'http://bad.test/swir.tif'} } };
  assert.deepEqual(getSentinelBandUrls(scene), { red:'https://data.test/red.tif', nir:'https://data.test/nir.tif' });
});

test('selects only the required spectral bands for each index', () => {
  assert.deepEqual(requiredBandsForIndex('ndvi'), ['nir','red']);
  assert.deepEqual(requiredBandsForIndex('ndwi'), ['green','nir']);
  assert.deepEqual(requiredBandsForIndex('nbr'), ['nir','swir22']);
  assert.equal(requiredBandsForIndex('invalid'), null);
});

test('computes a pixel index from matching band arrays and masks invalid samples', () => {
  const result = computeIndexFromBands('ndvi', {
    nir: new Float32Array([8000, 2000, 0]),
    red: new Float32Array([2000, 8000, 0]),
    scl: new Uint8Array([4, 9, 4])
  });
  assert.ok(Math.abs(result.mean - 0.6) < 1e-6);
  assert.equal(result.validPixels, 1);
  assert.equal(result.maskedPixels, 1);
  assert.equal(result.totalPixels, 3);
});

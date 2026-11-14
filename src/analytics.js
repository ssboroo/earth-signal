const INDEX_DEFINITIONS = Object.freeze({
  ndvi: { numerator: 'nir', denominator: 'red', label: 'Vegetation (NDVI)', description: 'Vegetation greenness and density' },
  ndwi: { numerator: 'green', denominator: 'nir', label: 'Water (NDWI)', description: 'Open-water signal' },
  nbr: { numerator: 'nir', denominator: 'swir22', label: 'Burn severity (NBR)', description: 'Vegetation and burn-scar signal' }
});

export function normalizedDifference(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return null;
  const denominator = a + b;
  if (denominator <= 0) return null;
  const value = (a - b) / denominator;
  return Number.isFinite(value) && value >= -1 && value <= 1 ? value : null;
}

export function calculateIndices({ red, nir, green, swir16, swir22 } = {}) {
  return {
    ndvi: normalizedDifference(nir, red),
    ndwi: normalizedDifference(green, nir),
    nbr: normalizedDifference(nir, swir22),
    ndmi: normalizedDifference(nir, swir16)
  };
}

export function classifyIndex(index, value) {
  if (!Number.isFinite(value)) return 'no-data';
  if (index === 'ndvi') {
    if (value >= 0.6) return 'dense-vegetation';
    if (value >= 0.2) return 'sparse-vegetation';
    if (value >= 0) return 'bare-or-low-vegetation';
    return 'water-or-non-vegetated';
  }
  if (index === 'ndwi') return value >= 0.3 ? 'water-likely' : value >= 0 ? 'moisture-signal' : 'low-water-signal';
  if (index === 'nbr') return value < -0.1 ? 'possible-burn-scar' : value > 0.3 ? 'healthy-vegetation-signal' : 'mixed-or-low-signal';
  return 'unclassified';
}

export function compareIndex(before, after, { threshold = 0.15 } = {}) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return { before: Number.isFinite(before) ? before : null, after: Number.isFinite(after) ? after : null, delta: null, changed: null };
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 2) throw new RangeError('Threshold must be between 0 and 2');
  const delta = after - before;
  return { before, after, delta, changed: Math.abs(delta) >= threshold };
}

const EARTH_RADIUS_METRES = 6371008.8;

export function polygonAreaHectares(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return null;
  if (!ring.every(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)) return null;
  const first = ring[0], last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return null;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i].map(v => v * Math.PI / 180);
    const [lon2, lat2] = ring[i + 1].map(v => v * Math.PI / 180);
    sum += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  const squareMetres = Math.abs(sum * EARTH_RADIUS_METRES * EARTH_RADIUS_METRES / 2);
  return squareMetres / 10000;
}

export function summarizeIndexPixels(index, pixels, { scl = null, nodata = null } = {}) {
  if (!Array.isArray(pixels) && !ArrayBuffer.isView(pixels)) throw new TypeError('Pixels must be an array or typed array');
  if (scl && scl.length !== pixels.length) throw new RangeError('SCL and spectral band dimensions must match');
  let sum = 0, valid = 0, masked = 0;
  const bins = Object.create(null);
  for (let i = 0; i < pixels.length; i++) {
    const value = pixels[i];
    const sceneClass = scl?.[i];
    if (scl && [0, 1, 3, 8, 9, 10, 11].includes(sceneClass)) { masked++; continue; }
    if (!Number.isFinite(value) || (nodata !== null && value === nodata) || value < -1 || value > 1) continue;
    sum += value;
    valid++;
    const bucket = classifyIndex(index, value);
    bins[bucket] = (bins[bucket] || 0) + 1;
  }
  return {
    index,
    mean: valid ? sum / valid : null,
    validPixels: valid,
    maskedPixels: masked,
    totalPixels: pixels.length,
    validPercent: pixels.length ? valid / pixels.length * 100 : 0,
    classes: bins
  };
}

export function getIndexDefinition(index) {
  return INDEX_DEFINITIONS[index] || null;
}

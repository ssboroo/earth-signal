import { normalizedDifference, summarizeIndexPixels, getIndexDefinition } from './analytics.js';

const BAND_KEYS = ['blue','green','red','nir','swir16','swir22','scl'];

export function getSentinelBandUrls(scene) {
  const result = {};
  for (const key of BAND_KEYS) {
    const href = scene?.assets?.[key]?.href;
    if (typeof href !== 'string') continue;
    try {
      const url = new URL(href);
      if (url.protocol === 'https:') result[key] = url.href;
    } catch { /* Ignore malformed catalogue asset URLs. */ }
  }
  return result;
}

export function requiredBandsForIndex(index) {
  const definition = getIndexDefinition(index);
  return definition ? [definition.numerator, definition.denominator] : null;
}

export function computeIndexFromBands(index, bands) {
  const required = requiredBandsForIndex(index);
  if (!required) throw new TypeError('Unsupported spectral index');
  const first = bands?.[required[0]], second = bands?.[required[1]];
  if (!first || !second || first.length !== second.length) throw new TypeError('Required spectral bands are missing or have different dimensions');
  if (bands.scl && bands.scl.length !== first.length) throw new TypeError('SCL and spectral band dimensions must match');
  const pixels = new Float32Array(first.length);
  for (let i = 0; i < first.length; i++) {
    const a = Number(first[i]), b = Number(second[i]);
    // Sentinel-2 L2A reflectance is commonly stored as integer-scaled reflectance.
    // Normalized differences are scale invariant.
    pixels[i] = bands.scl && [3,8,9,10,11].includes(Number(bands.scl[i]))
      ? NaN
      : (normalizedDifference(a, b) ?? NaN);
  }
  return summarizeIndexPixels(index, pixels, { scl: bands.scl || null });
}

async function openCog(url, fromUrl) {
  const tiff = await fromUrl(url, { allowFullFile: false });
  return tiff.getImage();
}

async function readBand(image, width, height, nearest = false) {
  const rasters = await image.readRasters({
    samples: [0],
    width,
    height,
    interleave: false,
    resampleMethod: nearest ? 'nearest' : 'bilinear'
  });
  return rasters[0];
}

export async function analyzeSentinelScene(scene, index = 'ndvi', { signal, onProgress } = {}) {
  const urls = getSentinelBandUrls(scene);
  const required = requiredBandsForIndex(index);
  if (!required) throw new TypeError('Choose NDVI, NDWI or NBR');
  const missing = required.filter(key => !urls[key]);
  if (missing.length) throw new Error('This scene is missing required band assets: ' + missing.join(', '));
  if (signal?.aborted) throw new DOMException('Analysis cancelled', 'AbortError');
  onProgress?.('Loading open satellite raster reader…');
  const { fromUrl } = await import('https://cdn.jsdelivr.net/npm/geotiff@2.1.3/+esm');
  onProgress?.('Opening Sentinel-2 cloud-optimized GeoTIFF bands…');
  const [firstImage, secondImage, sclImage] = await Promise.all([
    openCog(urls[required[0]], fromUrl),
    openCog(urls[required[1]], fromUrl),
    urls.scl ? openCog(urls.scl, fromUrl).catch(() => null) : Promise.resolve(null)
  ]);
  if (signal?.aborted) throw new DOMException('Analysis cancelled', 'AbortError');
  const width = Math.min(256, firstImage.getWidth());
  const height = Math.max(1, Math.round(width * firstImage.getHeight() / firstImage.getWidth()));
  const secondWidth = Math.min(256, secondImage.getWidth());
  const secondHeight = Math.max(1, Math.round(secondWidth * secondImage.getHeight() / secondImage.getWidth()));
  if (Math.abs(width - secondWidth) > 1 || Math.abs(height - secondHeight) > 1) {
    throw new Error('Spectral bands have incompatible raster dimensions; scene cannot be compared safely.');
  }
  onProgress?.('Reading spectral samples and cloud mask…');
  const [first, second, scl] = await Promise.all([
    readBand(firstImage, width, height),
    readBand(secondImage, width, height),
    sclImage ? readBand(sclImage, width, height, true).catch(() => null) : Promise.resolve(null)
  ]);
  if (signal?.aborted) throw new DOMException('Analysis cancelled', 'AbortError');
  const bands = { [required[0]]: first, [required[1]]: second };
  if (scl?.length === first.length) bands.scl = scl;
  onProgress?.('Calculating spectral index…');
  const summary = computeIndexFromBands(index, bands);
  return {
    ...summary,
    sceneId: scene.id,
    acquisitionDate: scene.date,
    cloudCover: scene.cloudCover,
    resolution: '256 px scene-wide sample',
    cloudMaskApplied: Boolean(bands.scl),
    source: 'Copernicus Sentinel-2 L2A via Element 84 Earth Search'
  };
}

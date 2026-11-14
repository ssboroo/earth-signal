const STAC_ENDPOINT = 'https://earth-search.aws.element84.com/v1/search';

export function formatDateRange(days = 30, now = new Date()) {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new RangeError('Days must be an integer between 1 and 365');
  }
  const end = new Date(now);
  const start = new Date(end.getTime() - days * 86400000);
  return `${start.toISOString()}/${end.toISOString()}`;
}

export function buildSearchPayload({ bbox, days = 30, now = new Date(), limit = 12 } = {}) {
  if (!Array.isArray(bbox) || bbox.length !== 4 ||
      bbox.some(value => !Number.isFinite(value)) ||
      bbox[0] < -180 || bbox[2] > 180 || bbox[1] < -90 || bbox[3] > 90 ||
      bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) {
    throw new TypeError('Invalid bounding box');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError('Limit must be an integer between 1 and 100');
  }
  return {
    collections: ['sentinel-2-l2a'],
    bbox,
    datetime: formatDateRange(days, now),
    limit,
    sortby: [{ field: 'properties.datetime', direction: 'desc' }],
    query: { 'eo:cloud_cover': { lt: 40 } }
  };
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function centerFromGeometry(geometry, bbox) {
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }
  if (Array.isArray(bbox) && bbox.length >= 4 && bbox.every(Number.isFinite)) {
    return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  }
  return null;
}

export function normalizeFeature(feature) {
  if (!feature || typeof feature.id !== 'string' || !feature.properties?.datetime) return null;
  const cloudCover = Number(feature.properties['eo:cloud_cover']);
  const coordinates = centerFromGeometry(feature.geometry, feature.bbox);
  if (!coordinates) return null;
  const thumbnail = safeHttpsUrl(feature.assets?.thumbnail?.href);
  return {
    id: feature.id,
    date: feature.properties.datetime,
    cloudCover: Number.isFinite(cloudCover) ? cloudCover : null,
    platform: String(feature.properties.platform || 'Sentinel-2'),
    coordinates,
    thumbnail
  };
}

export async function searchSentinelScenes({ bbox, days = 30, limit = 12, signal, fetchImpl = fetch } = {}) {
  const payload = buildSearchPayload({ bbox, days, limit });
  const response = await fetchImpl(STAC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/geo+json' },
    body: JSON.stringify(payload),
    signal
  });
  if (!response.ok) {
    throw new Error(`Satellite catalog request failed (${response.status})`);
  }
  const data = await response.json();
  return (Array.isArray(data.features) ? data.features : [])
    .map(normalizeFeature)
    .filter(Boolean);
}

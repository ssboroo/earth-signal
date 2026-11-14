import { polygonAreaHectares } from '../src/analytics.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const MAX_ZONES_PER_SCAN = 20;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function authorized(request, env) {
  const expected = env.API_TOKEN;
  if (!expected || typeof expected !== 'string') return false;
  const supplied = request.headers.get('authorization') || '';
  return supplied === `Bearer ${expected}`;
}

function validatePolygon(geometry) {
  if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates) || !Array.isArray(geometry.coordinates[0])) return false;
  const ring = geometry.coordinates[0];
  return ring.length >= 4 &&
    ring.every(point => Array.isArray(point) && point.length >= 2 &&
      Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
      Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90) &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1] &&
    polygonAreaHectares(ring) > 0;
}

function zoneBounds(geometry) {
  const points = geometry.coordinates[0];
  const longitudes = points.map(point => point[0]);
  const latitudes = points.map(point => point[1]);
  return [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)];
}

async function listZones(env) {
  const result = await env.DB.prepare(
    'SELECT id, name, geometry_json, area_ha, active, created_at, updated_at FROM monitoring_zones ORDER BY created_at DESC LIMIT 500'
  ).all();
  return (result.results || []).map(row => ({
    id: row.id, name: row.name, geometry: JSON.parse(row.geometry_json),
    areaHa: row.area_ha, active: Boolean(row.active),
    createdAt: row.created_at, updatedAt: row.updated_at
  }));
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/health' && request.method === 'GET') {
    try {
      await env.DB.prepare('SELECT 1 AS ok').first();
      return json({ service: 'earth-signal-api', status: 'ok', storage: 'available', timestamp: new Date().toISOString() });
    } catch {
      return json({ service: 'earth-signal-api', status: 'degraded', storage: 'unavailable' }, 503);
    }
  }

  if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401, { 'www-authenticate': 'Bearer' });

  if (url.pathname === '/api/zones' && request.method === 'GET') {
    try {
      return json({ zones: await listZones(env) });
    } catch {
      return json({ error: 'Could not read monitoring zones' }, 503);
    }
  }

  if (url.pathname === '/api/zones' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON' }, 400); }
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
    if (!name) return json({ error: 'Zone name is required' }, 400);
    if (!validatePolygon(body?.geometry)) return json({ error: 'A valid Polygon geometry is required' }, 400);
    const id = crypto.randomUUID();
    const areaHa = polygonAreaHectares(body.geometry.coordinates[0]);
    const timestamp = new Date().toISOString();
    try {
      await env.DB.prepare(
        'INSERT INTO monitoring_zones (id, name, geometry_json, area_ha, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
      ).bind(id, name, JSON.stringify(body.geometry), areaHa, timestamp, timestamp).run();
      return json({ zone: { id, name, geometry: body.geometry, areaHa, active: true, createdAt: timestamp, updatedAt: timestamp } }, 201);
    } catch {
      return json({ error: 'Could not save monitoring zone' }, 503);
    }
  }

  const zoneMatch = url.pathname.match(/^\/api\/zones\/([a-f0-9-]{36})$/i);
  if (zoneMatch && request.method === 'DELETE') {
    try {
      const result = await env.DB.prepare('DELETE FROM monitoring_zones WHERE id = ?').bind(zoneMatch[1]).run();
      if (!result.meta?.changes) return json({ error: 'Zone not found' }, 404);
      return json({ deleted: true, id: zoneMatch[1] });
    } catch {
      return json({ error: 'Could not delete monitoring zone' }, 503);
    }
  }

  if (url.pathname === '/api/observations' && request.method === 'GET') {
    try {
      const rows = await env.DB.prepare(
        'SELECT id, zone_id, scene_id, acquired_at, cloud_cover, collection, status, created_at FROM scene_observations ORDER BY acquired_at DESC LIMIT 200'
      ).all();
      return json({ observations: rows.results || [] });
    } catch {
      return json({ error: 'Could not read observations' }, 503);
    }
  }

  if (url.pathname === '/api/exports/zones' && request.method === 'POST') {
    if (!env.REPORTS) return json({ error: 'R2 report storage is not configured' }, 503);
    try {
      const zones = await listZones(env);
      const document = { type: 'FeatureCollection', features: zones.map(zone => ({
        type: 'Feature', id: zone.id,
        properties: { name: zone.name, areaHa: zone.areaHa, active: zone.active },
        geometry: zone.geometry
      })) };
      const key = `exports/zones-${new Date().toISOString().replace(/[:.]/g, '-')}.geojson`;
      await env.REPORTS.put(key, JSON.stringify(document), { httpMetadata: { contentType: 'application/geo+json' } });
      return json({ stored: true, key, count: zones.length });
    } catch {
      return json({ error: 'Could not store GeoJSON export' }, 503);
    }
  }

  return json({ error: 'Not found' }, 404);
}

async function scanZone(zone, env, timestamp) {
  let geometry;
  try { geometry = JSON.parse(zone.geometry_json); } catch { return { scenes: 0, error: 'invalid-geometry' }; }
  const bbox = zoneBounds(geometry);
  if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) return { scenes: 0, error: 'invalid-bounds' };
  const end = new Date(timestamp);
  const start = new Date(end.getTime() - 45 * 86400000);
  const response = await fetch('https://earth-search.aws.element84.com/v1/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/geo+json' },
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'],
      bbox,
      datetime: `${start.toISOString()}/${end.toISOString()}`,
      limit: 10,
      sortby: [{ field: 'properties.datetime', direction: 'desc' }],
      query: { 'eo:cloud_cover': { lt: 40 } }
    })
  });
  if (!response.ok) throw new Error(`STAC request failed: ${response.status}`);
  const payload = await response.json();
  const features = Array.isArray(payload.features) ? payload.features : [];
  let inserted = 0;
  for (const feature of features) {
    const acquiredAt = feature.properties?.datetime;
    if (!feature.id || !acquiredAt) continue;
    const cloud = Number(feature.properties?.['eo:cloud_cover']);
    const assets = {};
    for (const key of ['red', 'green', 'blue', 'nir', 'swir16', 'swir22', 'scl']) {
      const href = feature.assets?.[key]?.href;
      if (typeof href === 'string' && href.startsWith('https://')) assets[key] = href;
    }
    const id = `${zone.id}:${feature.id}`.slice(0, 180);
    const result = await env.DB.prepare(
      'INSERT OR IGNORE INTO scene_observations (id, zone_id, scene_id, acquired_at, cloud_cover, collection, assets_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, zone.id, feature.id, acquiredAt, Number.isFinite(cloud) ? cloud : null, 'sentinel-2-l2a', JSON.stringify(assets), 'candidate', timestamp).run();
    inserted += result.meta?.changes || 0;
  }
  return { scenes: inserted };
}

async function runScheduledMonitoring(env) {
  const timestamp = new Date().toISOString();
  const zonesResult = await env.DB.prepare(
    'SELECT id, geometry_json FROM monitoring_zones WHERE active = 1 ORDER BY created_at ASC LIMIT ?'
  ).bind(MAX_ZONES_PER_SCAN).all();
  const zones = zonesResult.results || [];
  let totalScenes = 0;
  let failedZones = 0;
  for (const zone of zones) {
    try {
      const result = await scanZone(zone, env, timestamp);
      totalScenes += result.scenes;
      await env.DB.prepare(
        'INSERT INTO monitoring_runs (id, zone_id, status, scenes_added, started_at, finished_at, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), zone.id, 'completed', result.scenes, timestamp, new Date().toISOString(), JSON.stringify(result)).run();
    } catch (error) {
      failedZones++;
      await env.DB.prepare(
        'INSERT INTO monitoring_runs (id, zone_id, status, scenes_added, started_at, finished_at, details_json) VALUES (?, ?, ?, 0, ?, ?, ?)'
      ).bind(crypto.randomUUID(), zone.id, 'failed', timestamp, new Date().toISOString(), JSON.stringify({ error: error.message })).run();
    }
  }
  return { zonesChecked: zones.length, scenesAdded: totalScenes, failedZones };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('EARTH SIGNAL static assets binding is not configured.', { status: 503 });
  },
  async scheduled(_event, env, context) {
    context.waitUntil(runScheduledMonitoring(env));
  }
};

export { runScheduledMonitoring, validatePolygon };

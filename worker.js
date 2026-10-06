const NWS = 'https://api.weather.gov';
async function nws(path, ttl = 120) {
  const response = await fetch(NWS + path, {
    headers: { Accept: 'application/geo+json', 'User-Agent': 'WeatherGlass (https://weatherglass.d8bff7ph8r.workers.dev)' },
    cf: { cacheTtl: ttl, cacheEverything: true },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('NWS response ' + response.status);
  return response.json();
}
export async function locationAlerts(lat, lon) {
  const point = lat.toFixed(4) + ',' + lon.toFixed(4);
  const metadata = await nws('/points/' + point, 3600);
  const zones = [...new Set(['forecastZone', 'county'].map(key => String(metadata.properties?.[key] || '').split('/').pop()).filter(id => /^[A-Z]{2}[CZ]\d{3}$/.test(id)))];
  const collections = await Promise.all([
    nws('/alerts/active?point=' + point),
    ...zones.map(zone => nws('/alerts/active?zone=' + zone)),
  ]);
  const byId = new Map();
  for (const collection of collections) for (const feature of collection.features || []) {
    const p = feature.properties || {}, id = p.id || feature.id;
    if (!id || p.status !== 'Actual' || p.messageType === 'Cancel') continue;
    const end = p.ends || p.expires;
    if (end && Date.parse(end) <= Date.now()) continue;
    byId.set(id, { id, event: p.event, severity: p.severity, certainty: p.certainty, urgency: p.urgency, headline: p.headline, description: p.description, instruction: p.instruction, areaDesc: p.areaDesc, senderName: p.senderName, sent: p.sent, expires: p.expires, ends: p.ends, geometry: feature.geometry });
  }
  const order = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
  return { alerts: [...byId.values()].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4)), checkedAt: new Date().toISOString(), source: 'National Weather Service', zones };
}

const RADAR_TILE_PREFIX = '/api/radar/xweather/';
function radarError(message, status) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function parseRadarTile(path, now = Date.now()) {
  const match = path.match(/^\/api\/radar\/xweather\/(\d{1,2})\/(\d{1,5})\/(\d{1,5})\/(\d{13})\.png$/);
  if (!match) return null;
  const z = Number(match[1]), x = Number(match[2]), y = Number(match[3]), time = Number(match[4]);
  // Restrict this endpoint to observed radar, town-level zoom and two hours of playback.
  // Stable five-minute slots let viewers share cached tiles.
  if (z < 1 || z > 12 || x >= 2 ** z || y >= 2 ** z || time % 300000 !== 0 || time > now || time < now - 7500000) return null;
  return { z, x, y, time };
}
export async function xweatherRadar(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
  const origin = request.headers.get('Origin');
  if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return radarError('Use radar through WeatherGlass.', 403);
  if (url.pathname === '/api/radar/status') {
    return Response.json({ configured: Boolean(env.XWEATHER_CLIENT_ID && env.XWEATHER_CLIENT_SECRET), provider: 'Xweather Raster Maps' }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const tile = parseRadarTile(url.pathname);
  if (!tile || url.search) return radarError('Unsupported radar tile request.', 400);
  if (!env.XWEATHER_CLIENT_ID || !env.XWEATHER_CLIENT_SECRET) return radarError('Xweather credentials have not been configured.', 503);
  const cacheKey = new Request(url.origin + url.pathname);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const stamp = new Date(tile.time).toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const credentials = encodeURIComponent(env.XWEATHER_CLIENT_ID) + '_' + encodeURIComponent(env.XWEATHER_CLIENT_SECRET);
  try {
    const upstream = await fetch('https://maps.api.xweather.com/' + credentials + '/radar/' + tile.z + '/' + tile.x + '/' + tile.y + '/' + stamp + '.png', {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'image/png' },
    });
    // Never forward provider bodies, headers or redirect URLs: they can contain credentials.
    if (!upstream.ok) return radarError(upstream.status === 401 || upstream.status === 403 ? 'Xweather radar access was not authorized. Check your credentials and Raster Maps access.' : 'Xweather radar is temporarily unavailable.', 502);
    const data = await upstream.arrayBuffer(), bytes = new Uint8Array(data);
    if (bytes.length < 8 || ![137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return radarError('Xweather did not return a radar image.', 502);
    const response = new Response(data, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' } });
    ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
    return response;
  } catch {
    return radarError('Xweather radar is temporarily unavailable.', 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/radar/status' || url.pathname.startsWith(RADAR_TILE_PREFIX)) return xweatherRadar(request, env, ctx);
    if (url.pathname !== '/api/alerts') return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
    const latText = url.searchParams.get('lat'), lonText = url.searchParams.get('lon');
    const lat = Number(latText), lon = Number(lonText);
    if (!latText?.trim() || !lonText?.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return Response.json({ error: 'Valid latitude and longitude are required' }, { status: 400 });
    try {
      return Response.json(await locationAlerts(lat, lon), { headers: { 'Cache-Control': 'public, max-age=60' } });
    } catch {
      return Response.json({ error: 'Official alerts could not be checked. Try again shortly.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
  },
};

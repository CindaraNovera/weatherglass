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
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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

// Bridge between the scene engine (vendor card) and the React directions window,
// plus pure helpers for geocoding areas and fetching the OSRM driving route.
// Everything here is keyless: OpenStreetMap tiles, Nominatim search and the public OSRM server.

export const DIRECTIONS_EVENT = 'fb:directions'

export type DirectionsTarget = {
  key: string
  name: string
  area: string
  pickupWindow: string
  /** The NGO's area of operation, used when the device location is unavailable */
  from: string
  /** Screen point the ink reveal spreads from */
  x: number
  y: number
}

let open = false
export const directionsOpen = () => open
export const setDirectionsOpen = (v: boolean) => {
  open = v
}

export function openDirections(t: DirectionsTarget) {
  dispatchEvent(new CustomEvent<DirectionsTarget>(DIRECTIONS_EVENT, { detail: t }))
}

/** Every pickup is around Gurugram, so anchor free-text areas there for geocoding. */
export function placeQuery(area: string) {
  const a = area.trim().replace(/\s+/g, ' ')
  if (!a) return 'Gurugram, Haryana'
  if (/gurugram|gurgaon/i.test(a)) return /haryana/i.test(a) ? a : `${a}, Haryana`
  return `${a}, Gurugram, Haryana`
}

export type LatLng = { lat: number; lng: number }
export type Origin = LatLng | string

export const GURUGRAM: LatLng = { lat: 28.4595, lng: 77.0266 }

/** Demo vendor areas and common Gurugram localities, so the route draws without a network lookup. */
const KNOWN: Record<string, LatLng> = {
  'sector 29': { lat: 28.4685, lng: 77.064 },
  'dlf phase 2': { lat: 28.489, lng: 77.088 },
  'sushant lok': { lat: 28.4645, lng: 77.0755 },
  'sohna road': { lat: 28.414, lng: 77.042 },
  'udyog vihar': { lat: 28.5005, lng: 77.083 },
  'mg road': { lat: 28.4795, lng: 77.08 },
  'cyber city': { lat: 28.495, lng: 77.089 },
  'golf course road': { lat: 28.452, lng: 77.097 },
  gurugram: GURUGRAM,
  gurgaon: GURUGRAM,
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/,?\s*(gurugram|gurgaon|haryana|india)\b/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Instant lookup for known localities; undefined means a geocoder is needed. */
export function knownPlace(area: string): LatLng | undefined {
  const n = norm(area)
  return n ? KNOWN[n] : GURUGRAM
}

const cache = new Map<string, Promise<LatLng>>()

/** Resolve a free-text area to coordinates: known table, then Nominatim, then the Gurugram centre. */
export function geocode(area: string): Promise<LatLng> {
  const hit = knownPlace(area)
  if (hit) return Promise.resolve(hit)
  const q = placeQuery(area)
  let p = cache.get(q)
  if (!p) {
    const u = new URL('https://nominatim.openstreetmap.org/search')
    u.search = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'in', q }).toString()
    p = fetch(u, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { lat: string; lon: string }[]) => {
        const r = rows[0]
        return r ? { lat: +r.lat, lng: +r.lon } : GURUGRAM
      })
      .catch(() => GURUGRAM)
    cache.set(q, p)
  }
  return p
}

/** OSRM wants lng,lat pairs. */
export function osrmRouteUrl(a: LatLng, b: LatLng) {
  const f = (p: LatLng) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`
  return `https://router.project-osrm.org/route/v1/driving/${f(a)};${f(b)}?overview=full&geometries=geojson`
}

export type MapStatus = 'locating' | 'routing' | 'ok' | 'straight'

export type Route = { line: [number, number][]; km: number; min: number }

/** Turn an OSRM response into Leaflet [lat, lng] points plus distance and time. */
export function parseOsrm(json: unknown): Route | null {
  const r = (json as { code?: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] })
  const route = r?.code === 'Ok' ? r.routes?.[0] : undefined
  if (!route?.geometry?.coordinates?.length) return null
  return {
    line: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    km: Math.round(route.distance / 100) / 10,
    min: Math.max(1, Math.round(route.duration / 60)),
  }
}

const originParam = (o: Origin) => (typeof o === 'string' ? placeQuery(o) : `${o.lat.toFixed(6)},${o.lng.toFixed(6)}`)

/** Hand-off link for live turn-by-turn in the Google Maps app; without an origin it starts from the phone's GPS. */
export function navigationUrl(destination: string, origin?: Origin) {
  const q = new URLSearchParams({ api: '1', destination: placeQuery(destination), travelmode: 'driving' })
  if (origin) q.set('origin', originParam(origin))
  return `https://www.google.com/maps/dir/?${q}`
}

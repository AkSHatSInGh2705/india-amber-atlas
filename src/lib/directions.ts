// Bridge between the scene engine (vendor card) and the React directions window,
// plus pure helpers for building the Google Maps URLs.

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

/** Every pickup is around Gurugram, so anchor free-text areas there for Google to resolve. */
export function placeQuery(area: string) {
  const a = area.trim().replace(/\s+/g, ' ')
  if (!a) return 'Gurugram, Haryana'
  if (/gurugram|gurgaon/i.test(a)) return /haryana/i.test(a) ? a : `${a}, Haryana`
  return `${a}, Gurugram, Haryana`
}

export type Origin = { lat: number; lng: number } | string

const originParam = (o: Origin) => (typeof o === 'string' ? placeQuery(o) : `${o.lat.toFixed(6)},${o.lng.toFixed(6)}`)

export function embedDirectionsUrl(key: string, origin: Origin, destination: string) {
  const q = new URLSearchParams({
    key,
    origin: originParam(origin),
    destination: placeQuery(destination),
    mode: 'driving',
    region: 'in',
  })
  return `https://www.google.com/maps/embed/v1/directions?${q}`
}

/** Hand-off link for live turn-by-turn in the Google Maps app; without an origin it starts from the phone's GPS. */
export function navigationUrl(destination: string, origin?: Origin) {
  const q = new URLSearchParams({ api: '1', destination: placeQuery(destination), travelmode: 'driving' })
  if (origin) q.set('origin', originParam(origin))
  return `https://www.google.com/maps/dir/?${q}`
}

/** Dev-server hostnames carry an access key, which a map request would leak in its Referer/Origin. */
export const canEmbedOn = (hostname: string) => !/-devserver-/.test(hostname)

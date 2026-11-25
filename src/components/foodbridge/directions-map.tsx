// Browser-only: Leaflet touches `window` at import, so this module is only loaded lazily behind <ClientOnly>.
import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png?url'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png?url'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png?url'
import { geocode, osrmRouteUrl, parseOsrm, type LatLng, type MapStatus, type Route } from '@/lib/directions'

// Leaflet guesses its image folder from the CSS URL, which breaks once Vite fingerprints assets.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const pickupIcon = new L.Icon.Default({ className: 'dwpin-to' })
const startIcon = new L.Icon.Default({ className: 'dwpin-from' })

type Props = {
  /** Device coordinates, or a free-text area to geocode; null while waiting for GPS */
  origin: LatLng | string | null
  originLabel: string
  destination: string
  destinationLabel: string
  onStatus: (s: MapStatus, route?: Route) => void
}

function useResolved(q: LatLng | string | null) {
  const [p, setP] = useState<{ for: LatLng | string; at: LatLng } | null>(null)
  useEffect(() => {
    if (q === null) return
    if (typeof q !== 'string') return setP({ for: q, at: q })
    let live = true
    void geocode(q).then((at) => live && setP({ for: q, at }))
    return () => {
      live = false
    }
  }, [q])
  return p && p.for === q ? p.at : null
}

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap()
  const sig = points.map((p) => p.join(',')).join(';')
  useEffect(() => {
    if (!points.length) return
    const b = L.latLngBounds(points)
    if (points.length === 1) map.setView(b.getCenter(), 14, { animate: false })
    else map.fitBounds(b, { padding: [36, 36], maxZoom: 16, animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, sig])
  // The window's ink reveal and drag can resize the box after mount
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

export default function DirectionsMap({ origin, originLabel, destination, destinationLabel, onStatus }: Props) {
  const from = useResolved(origin)
  const to = useResolved(destination)
  const [route, setRoute] = useState<{ key: string; r: Route | null } | null>(null)
  const key = from && to ? `${from.lat},${from.lng};${to.lat},${to.lng}` : ''

  useEffect(() => {
    if (!from || !to) return
    const ac = new AbortController()
    fetch(osrmRouteUrl(from, to), { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setRoute({ key, r: parseOsrm(j) }))
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setRoute({ key, r: null })
      })
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const current = route && route.key === key ? route : null
  useEffect(() => {
    if (!from || !to) onStatus(origin === null ? 'locating' : 'routing')
    else if (!current) onStatus('routing')
    else if (current.r) onStatus('ok', current.r)
    else onStatus('straight')
  }, [from, to, current, origin, onStatus])

  const points = useMemo<[number, number][]>(() => {
    if (current?.r) return current.r.line
    return [from, to].filter((p): p is LatLng => !!p).map((p) => [p.lat, p.lng])
  }, [current, from, to])

  const center = to ?? from ?? { lat: 28.4595, lng: 77.0266 }

  return (
    <MapContainer className="dwleaf" center={[center.lat, center.lng]} zoom={13} zoomControl scrollWheelZoom attributionControl>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        subdomains={['a', 'b', 'c']}
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · routes <a href="https://project-osrm.org/">OSRM</a>'
      />
      {current?.r ? (
        <>
          <Polyline positions={current.r.line} pathOptions={{ className: 'dwroute-halo', weight: 9, opacity: 1 }} />
          <Polyline positions={current.r.line} pathOptions={{ className: 'dwroute', weight: 5, opacity: 1 }} />
        </>
      ) : from && to && current ? (
        <Polyline positions={[[from.lat, from.lng], [to.lat, to.lng]]} pathOptions={{ className: 'dwroute', weight: 3, dashArray: '6 8' }} />
      ) : null}
      {from && (
        <Marker position={[from.lat, from.lng]} icon={startIcon}>
          <Tooltip direction="top" offset={[0, -34]}>{originLabel}</Tooltip>
        </Marker>
      )}
      {to && (
        <Marker position={[to.lat, to.lng]} icon={pickupIcon}>
          <Tooltip direction="top" offset={[0, -34]} permanent>
            {destinationLabel}
          </Tooltip>
        </Marker>
      )}
      <Fit points={points} />
    </MapContainer>
  )
}

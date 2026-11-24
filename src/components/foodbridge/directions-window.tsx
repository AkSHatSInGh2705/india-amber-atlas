import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import gsap from 'gsap'
import { inkClip } from '@/lib/ink'
import {
  DIRECTIONS_EVENT,
  canEmbedOn,
  embedDirectionsUrl,
  navigationUrl,
  placeQuery,
  setDirectionsOpen,
  type DirectionsTarget,
} from '@/lib/directions'

type Geo = 'idle' | 'locating' | 'ok' | 'denied'
type LatLng = { lat: number; lng: number }

const MAPS_KEY = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'] as string | undefined

/** Floating, draggable Google Maps route from the NGO to a reserved pickup, revealed with the shared ink smear. */
export function DirectionsWindow() {
  const [t, setT] = useState<DirectionsTarget | null>(null)
  const [src, setSrc] = useState<'gps' | 'area'>('gps')
  const [gps, setGps] = useState<LatLng | null>(null)
  const [geo, setGeo] = useState<Geo>('idle')
  const [loaded, setLoaded] = useState(false)
  const [embeddable, setEmbeddable] = useState(true)
  const ref = useRef<HTMLElement>(null)
  const from = useRef<[number, number]>([0, 0])
  const wasOpen = useRef(false)
  const closing = useRef<gsap.core.Tween | null>(null)

  useEffect(() => setEmbeddable(canEmbedOn(location.hostname)), [])

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeo('denied')
      setSrc('area')
      return
    }
    setGeo('locating')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ lat: p.coords.latitude, lng: p.coords.longitude })
        setGeo('ok')
      },
      () => {
        setGeo('denied')
        setSrc('area')
      },
      { timeout: 8000, maximumAge: 300000 },
    )
  }, [])

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<DirectionsTarget>).detail
      closing.current?.kill()
      closing.current = null
      from.current = [d.x, d.y]
      setT(d)
      setSrc('gps')
      if (!gps && geo !== 'locating') locate()
    }
    addEventListener(DIRECTIONS_EVENT, on)
    return () => removeEventListener(DIRECTIONS_EVENT, on)
  }, [gps, geo, locate])

  // Ink reveal on open; reset any drag offset
  useLayoutEffect(() => {
    const el = ref.current
    const isOpen = !!t
    setDirectionsOpen(isOpen)
    if (!el || !isOpen || wasOpen.current) {
      wasOpen.current = isOpen
      return
    }
    wasOpen.current = true
    el.style.translate = ''
    const tw = inkClip(el, from.current[0], from.current[1], true)
    const kids = gsap.from(el.querySelectorAll('.dwin > *'), { y: 16, opacity: 0, duration: 0.55, stagger: 0.05, delay: 0.3, ease: 'power2.out', clearProps: 'transform,opacity' })
    return () => {
      tw.kill()
      kids.kill()
    }
  }, [t])

  const close = useCallback(() => {
    const el = ref.current
    if (!el || closing.current) return
    closing.current = inkClip(el, from.current[0], from.current[1], false, () => {
      closing.current = null
      setT(null)
    })
  }, [])

  useEffect(() => {
    if (!t) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [t, close])

  // Drag by the header on wide screens, kept inside the viewport
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)
  const onDown = (e: RPointerEvent<HTMLElement>) => {
    if (innerWidth < 760 || (e.target as HTMLElement).closest('button,a')) return
    const el = ref.current!
    const [ox = 0, oy = 0] = (el.style.translate || '0px 0px').split(' ').map((v) => parseFloat(v) || 0)
    drag.current = { px: e.clientX, py: e.clientY, ox, oy }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: RPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const el = ref.current!
    let x = d.ox + e.clientX - d.px,
      y = d.oy + e.clientY - d.py
    el.style.translate = `${x}px ${y}px`
    const r = el.getBoundingClientRect()
    const fx = r.left < 8 ? 8 - r.left : r.right > innerWidth - 8 ? innerWidth - 8 - r.right : 0
    const fy = r.top < 8 ? 8 - r.top : r.bottom > innerHeight - 8 ? innerHeight - 8 - r.bottom : 0
    if (fx || fy) el.style.translate = `${(x += fx)}px ${(y += fy)}px`
  }
  const onUp = () => {
    drag.current = null
  }

  const origin = !t ? null : src === 'gps' ? (gps ?? (geo === 'locating' ? null : t.from)) : t.from
  const url = t && origin && MAPS_KEY && embeddable ? embedDirectionsUrl(MAPS_KEY, origin, t.area) : null
  useEffect(() => setLoaded(false), [url])

  const fromLabel = !t ? '' : src === 'gps' && gps ? 'Your location' : t.from || 'Your area'

  return (
    <section
      id="dw"
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-hidden={!t}
      aria-labelledby="dwt"
      style={{ visibility: t ? 'visible' : 'hidden' }}
    >
      {t && (
        <div className="dwin">
          <header className="dwh" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <p className="kk">Directions · pickup {t.pickupWindow}</p>
            <h3 id="dwt">{t.name}</h3>
            <p className="dwr">
              <span>{fromLabel}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h15M13 6l6 6-6 6" />
              </svg>
              <span>{placeQuery(t.area).replace(/, Haryana$/, '')}</span>
            </p>
            <button className="cl" type="button" aria-label="Close directions" onClick={close}>
              ×
            </button>
          </header>

          <div className="seg dws" role="group" aria-label="Start from">
            <button
              type="button"
              aria-pressed={src === 'gps'}
              onClick={() => {
                setSrc('gps')
                if (!gps) locate()
              }}
            >
              My location
            </button>
            <button type="button" aria-pressed={src === 'area'} onClick={() => setSrc('area')} disabled={!t.from}>
              Our area
            </button>
          </div>
          {geo === 'denied' && src === 'area' && (
            <p className="dwn">Location is off, so the route starts from your area of operation.</p>
          )}

          <div className={`dwm${loaded ? ' on' : ''}`}>
            {url ? (
              <iframe
                key={url}
                title={`Route to ${t.name}`}
                src={url}
                loading="lazy"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setLoaded(true)}
              />
            ) : null}
            {!loaded && (
              <div className="dwp">
                <i aria-hidden="true" />
                <span>
                  {!MAPS_KEY || !embeddable
                    ? 'The live map shows on the published site. Use the link below meanwhile.'
                    : !origin
                      ? 'Finding where you are…'
                      : 'Drawing your route…'}
                </span>
              </div>
            )}
          </div>

          <a className="dwl" href={navigationUrl(t.area, src === 'area' ? t.from : (gps ?? undefined))} target="_blank" rel="noopener noreferrer">
            Live turn-by-turn in Google Maps
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </div>
      )}
    </section>
  )
}

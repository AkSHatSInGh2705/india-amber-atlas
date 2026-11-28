import { useEffect, useId, useRef, useState } from 'react'
import gsap from 'gsap'
import { Button } from '@/components/ui/button'
import { orbitPoint, THEME_TIMING, zipperInkPath } from '@/lib/theme-zipper'

export type Theme = 'light' | 'dark'
export const THEME_KEY = 'fb-theme'

export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* private mode */
  }
}

function Sun() {
  return (
    <svg className="cel sun" viewBox="0 0 24 24" aria-hidden="true">
      <g className="rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 1.5v2.6M12 19.9v2.6M1.5 12h2.6M19.9 12h2.6M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
      </g>
      <circle cx="12" cy="12" r="5" fill="currentColor" />
    </svg>
  )
}
function Moon() {
  return (
    <svg className="cel moon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z" />
    </svg>
  )
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [flightTheme, setFlightTheme] = useState<Theme>('light')
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const fx = useRef<HTMLDivElement>(null)
  const animation = useRef<gsap.core.Timeline | null>(null)
  const transitioning = useRef(false)
  const maskId = useId().replace(/:/g, '')

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    const sync = () => setLive(window.__fbLive === true)
    sync()
    addEventListener('fb:live', sync)
    return () => {
      removeEventListener('fb:live', sync)
      animation.current?.kill()
    }
  }, [])

  function toggle() {
    if (transitioning.current || !live || !btn.current || !fx.current) return
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      applyTheme(next)
      setTheme(next)
      return
    }
    const root = fx.current
    const w = innerWidth,
      h = innerHeight
    const r = btn.current.getBoundingClientRect()
    const bx = r.left + r.width / 2,
      by = r.top + r.height / 2
    const ex = w + 90,
      ey = h * 0.32,
      cx = w * 0.55,
      cy = h * 0.78
    const sx = -90,
      sy = h * 0.62,
      c2x = w * 0.16,
      c2y = h * 0.12
    const tear = root.querySelector<SVGPathElement>('.fx-tear')
    const outB = root.querySelector<HTMLElement>('.fx-out')
    const inB = root.querySelector<HTMLElement>('.fx-in')
    const fill = root.querySelector<SVGSVGElement>('.fx-ink')
    const icon = btn.current.querySelector<HTMLElement>('.tg-ic')
    if (!tear || !outB || !inB || !fill || !icon) return
    transitioning.current = true
    setFlightTheme(theme)
    setBusy(true)
    root.dataset['target'] = next
    fill.setAttribute('viewBox', `0 0 ${w} ${h}`)
    const outgoing = { start: { x: bx, y: by }, control: { x: cx, y: cy }, end: { x: ex, y: ey } }
    const incoming = { start: { x: sx, y: sy }, control: { x: c2x, y: c2y }, end: { x: bx, y: by } }
    const unzip = { travel: 0, expansion: 0 }
    const drawTear = () => tear.setAttribute('d', zipperInkPath(outgoing, unzip.travel, unzip.expansion, w, h))
    drawTear()
    root.style.display = 'block'
    gsap.set(fill, { opacity: 1 })
    gsap.set(outB, { x: bx, y: by, opacity: 1, scale: 1 })
    gsap.set(inB, { x: sx, y: sy, opacity: 1, scale: 1.15 })
    icon.style.opacity = '0'

    const p1 = { t: 0 },
      p2 = { t: 0 }
    animation.current = gsap
      .timeline({
        onComplete() {
          root.style.display = 'none'
          icon.style.opacity = ''
          transitioning.current = false
          setBusy(false)
        },
      })
      .to(p1, {
        t: 1,
        duration: THEME_TIMING.exit,
        ease: 'power2.in',
        onUpdate() {
          gsap.set(outB, { ...orbitPoint(outgoing, p1.t), scale: 1 + p1.t * 0.5 })
          unzip.travel = p1.t
          drawTear()
        },
      })
      .to(p2, {
        t: 1,
        duration: THEME_TIMING.arrival,
        ease: 'power3.out',
        onUpdate() {
          gsap.set(inB, { ...orbitPoint(incoming, p2.t), scale: 1.15 - p2.t * 0.15 })
        },
      }, THEME_TIMING.exit)
      .to(unzip, {
        expansion: 1,
        duration: THEME_TIMING.coverage,
        ease: 'power2.inOut',
        onUpdate: drawTear,
      }, THEME_TIMING.exit)
      .call(() => {
        applyTheme(next)
        setTheme(next)
      }, [], THEME_TIMING.swap)
      .to(fill, { opacity: 0, duration: THEME_TIMING.total - THEME_TIMING.swap, ease: 'sine.inOut' }, THEME_TIMING.swap)
  }

  return (
    <>
      {live && (
        <Button
          ref={btn}
          type="button"
          className="theme-tg"
          variant="ghost"
          size="icon"
          onClick={toggle}
          disabled={busy}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          <span className="tg-ic">{theme === 'dark' ? <Moon /> : <Sun />}</span>
        </Button>
      )}
      <div ref={fx} className="theme-fx" style={{ display: 'none' }} aria-hidden="true">
        <svg className="fx-ink" preserveAspectRatio="none">
          <defs>
            <mask id={maskId} className="fx-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
              <path className="fx-tear" />
            </mask>
          </defs>
          <rect className="fx-color" width="100%" height="100%" mask={`url(#${maskId})`} />
        </svg>
        <div className="fx-body fx-out">{flightTheme === 'dark' ? <Moon /> : <Sun />}</div>
        <div className="fx-body fx-in">{flightTheme === 'dark' ? <Sun /> : <Moon />}</div>
      </div>
    </>
  )
}

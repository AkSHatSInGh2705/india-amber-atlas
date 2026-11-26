import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

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

const NIGHT = 'radial-gradient(circle at 70% 30%,#2A1E15,#120E0B 70%)'
const DAY = 'radial-gradient(circle at 70% 30%,#FFF8EC,#EBE1CB 75%)'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const fx = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    const sync = () => setLive(window.__fbLive === true)
    sync()
    addEventListener('fb:live', sync)
    return () => removeEventListener('fb:live', sync)
  }, [])

  function toggle() {
    if (busy || !btn.current || !fx.current) return
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      applyTheme(next)
      setTheme(next)
      return
    }
    setBusy(true)
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
    const q = (t: number, a: number, b: number, c: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c

    const trail = root.querySelector<SVGPathElement>('.fx-trail')!
    const outB = root.querySelector<HTMLElement>('.fx-out')!
    const inB = root.querySelector<HTMLElement>('.fx-in')!
    const fill = root.querySelector<HTMLElement>('.fx-fill')!
    const toDark = next === 'dark'
    trail.setAttribute('d', `M${bx} ${by}Q${cx} ${cy} ${ex} ${ey}`)
    trail.setAttribute('stroke-width', String(Math.max(90, Math.min(w, h) * 0.24)))
    trail.setAttribute('stroke', toDark ? 'url(#fxNight)' : 'url(#fxDay)')
    const len = trail.getTotalLength()
    fill.style.background = toDark ? NIGHT : DAY
    const ox = w * 0.5,
      oy = h * 0.6,
      R = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy)) + 40

    root.style.display = 'block'
    gsap.set(trail, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 })
    gsap.set(fill, { opacity: 1, clipPath: `circle(0px at ${ox}px ${oy}px)` })
    gsap.set(outB, { x: bx, y: by, opacity: 1, scale: 1 })
    gsap.set(inB, { x: sx, y: sy, opacity: 1, scale: 1.15 })
    btn.current.querySelector<HTMLElement>('.tg-ic')!.style.opacity = '0'

    const p1 = { t: 0 },
      p2 = { t: 0 },
      cc = { r: 0 }
    gsap
      .timeline({
        onComplete() {
          root.style.display = 'none'
          if (btn.current) btn.current.querySelector<HTMLElement>('.tg-ic')!.style.opacity = ''
          setBusy(false)
        },
      })
      .to(p1, {
        t: 1,
        duration: 1.2,
        ease: 'power2.in',
        onUpdate() {
          gsap.set(outB, { x: q(p1.t, bx, cx, ex), y: q(p1.t, by, cy, ey), scale: 1 + p1.t * 0.5 })
          trail.style.strokeDashoffset = String(len * (1 - p1.t))
        },
      })
      .to(p2, {
        t: 1,
        duration: 1.2,
        ease: 'power3.out',
        onUpdate() {
          gsap.set(inB, { x: q(p2.t, sx, c2x, bx), y: q(p2.t, sy, c2y, by), scale: 1.15 - p2.t * 0.15 })
        },
      }, 1.2)
      .to(cc, {
        r: R,
        duration: 0.95,
        ease: 'power2.inOut',
        onUpdate() {
          fill.style.clipPath = `circle(${cc.r}px at ${ox}px ${oy}px)`
        },
      }, 1.2)
      .call(() => {
        applyTheme(next)
        setTheme(next)
        trail.style.opacity = '0'
      }, [], 2.18)
      .to(fill, { opacity: 0, duration: 0.6, ease: 'sine.inOut' }, 2.2)
  }

  return (
    <>
      {live && (
        <button
          ref={btn}
          type="button"
          className="theme-tg"
          onClick={toggle}
          disabled={busy}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          <span className="tg-ic">{theme === 'dark' ? <Moon /> : <Sun />}</span>
        </button>
      )}
      <div ref={fx} className="theme-fx" style={{ display: 'none' }} aria-hidden="true">
        <svg>
          <defs>
            <linearGradient id="fxNight" x1="0" x2="1">
              <stop offset="0" stopColor="#120E0B" />
              <stop offset="1" stopColor="#2A1E15" />
            </linearGradient>
            <linearGradient id="fxDay" x1="0" x2="1">
              <stop offset="0" stopColor="#FFF8EC" />
              <stop offset="1" stopColor="#F5E6C8" />
            </linearGradient>
            <filter id="fxBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>
          <path className="fx-trail" fill="none" strokeLinecap="round" filter="url(#fxBlur)" />
        </svg>
        <div className="fx-fill" />
        <div className="fx-body fx-out">{theme === 'dark' ? <Moon /> : <Sun />}</div>
        <div className="fx-body fx-in">{theme === 'dark' ? <Sun /> : <Moon />}</div>
      </div>
    </>
  )
}

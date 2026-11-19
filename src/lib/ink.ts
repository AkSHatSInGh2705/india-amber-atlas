import gsap from 'gsap'

// Harmonics for the wobbly "ink" reveal edge: [frequency, amplitude, phase, speed]
export const HM: [number, number, number, number][] = [
  [3, 0.16, 1.1, 0.9],
  [5, 0.12, 2.3, -1.3],
  [8, 0.09, 0.4, 1.7],
  [13, 0.06, 3.1, -2.1],
  [21, 0.035, 1.9, 2.6],
]

/**
 * Ink-smear reveal: grows (dir=true) or shrinks a wobbly blob clip-path around a
 * screen point (sx, sy), with a few trailing droplets. Shared by the scene engine
 * and the React panels so every surface opens with the same wet-ink edge.
 */
export function inkClip(el: HTMLElement, sx: number, sy: number, dir: boolean, done?: () => void, dur?: number) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const r = el.getBoundingClientRect(),
    cx = sx - r.left,
    cy = sy - r.top,
    w = r.width,
    h = r.height,
    o = { q: dir ? 0 : 1 }
  const mx = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy)) * 1.05 + 12
  const upd = () => {
    const q = o.q,
      R = q * mx,
      g = Math.min(1, q * 5) * (1 - q * q),
      tt = q * 5
    let d = ''
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * 6.2832
      let m = 1
      for (const [k, am, p0, spd] of HM) m += am * g * Math.sin(k * a + p0 + spd * tt)
      const rr = R * m
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1)
    }
    d += 'Z'
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + 0.6,
        dd = R * (1.12 + 0.04 * i),
        rd = (4 + i * 2.5) * Math.min(1, q * 3) * (1 - q)
      if (rd > 0.5)
        d += `M${(cx + Math.cos(a) * dd + rd).toFixed(1)} ${(cy + Math.sin(a) * dd).toFixed(1)}a${rd} ${rd} 0 1 0 ${-2 * rd} 0a${rd} ${rd} 0 1 0 ${2 * rd} 0Z`
    }
    el.style.clipPath = `path('${d}')`
  }
  upd()
  return gsap.to(o, {
    q: dir ? 1 : 0,
    duration: reduce ? 0.2 : (dur ?? (dir ? 1.2 : 0.7)),
    ease: dir ? 'power2.out' : 'power2.in',
    onUpdate: upd,
    onComplete() {
      if (dir) el.style.clipPath = 'none'
      else if (done) done()
    },
  })
}

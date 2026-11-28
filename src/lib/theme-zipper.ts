import { HM } from './ink'

export type Point = { x: number; y: number }
export type Orbit = { start: Point; control: Point; end: Point }
export const THEME_TIMING = { exit: 1.4, arrival: 1.2, coverage: 1.1, swap: 2.5, total: 2.8 } as const

export function orbitPoint(orbit: Orbit, t: number): Point {
  const s = 1 - t
  return {
    x: s * s * orbit.start.x + 2 * s * t * orbit.control.x + t * t * orbit.end.x,
    y: s * s * orbit.start.y + 2 * s * t * orbit.control.y + t * t * orbit.end.y,
  }
}

/** Overlapping wet-ink brush impressions, only on the already-unzipped arc. */
export function zipperStamps(orbit: Orbit, travel: number, expansion: number, width: number, height: number) {
  const progress = Math.max(0, Math.min(1, travel))
  if (progress === 0) return []
  const spread = Math.max(0, Math.min(1, expansion))
  const cover = Math.hypot(width, height) * 1.15
  const count = Math.max(1, Math.ceil(progress * 64))
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = progress * i / count
    return {
      ...orbitPoint(orbit, t),
      t,
      radius: (28 + 42 * Math.sin(Math.PI * t)) * Math.min(1, progress * 10) + cover * spread,
      wobble: 0.23 * (1 - spread),
    }
  })
}

export function zipperInkPath(orbit: Orbit, travel: number, expansion: number, width: number, height: number) {
  const stamps = zipperStamps(orbit, travel, expansion, width, height)
  const first = stamps[0], last = stamps.at(-1)
  if (!first || !last) return ''
  const tangent = (t: number) => Math.atan2(
    (1 - t) * (orbit.control.y - orbit.start.y) + t * (orbit.end.y - orbit.control.y),
    (1 - t) * (orbit.control.x - orbit.start.x) + t * (orbit.end.x - orbit.control.x),
  )
  const points: Point[] = []
  const add = (stamp: typeof first, angle: number) => {
    let edge = 1
    for (const [frequency, amplitude, phase, speed] of HM) {
      edge += amplitude * stamp.wobble * Math.sin(frequency * angle + phase + speed * (travel * 5 + stamp.t))
    }
    points.push({ x: stamp.x + Math.cos(angle) * stamp.radius * edge, y: stamp.y + Math.sin(angle) * stamp.radius * edge })
  }
  // One continuous brush outline avoids hundreds of overlapping polygon edges.
  for (const stamp of stamps) add(stamp, tangent(stamp.t) - Math.PI / 2)
  for (let i = 1; i <= 24; i++) add(last, tangent(last.t) - Math.PI / 2 + i / 24 * Math.PI)
  for (const stamp of [...stamps].reverse()) add(stamp, tangent(stamp.t) + Math.PI / 2)
  for (let i = 1; i <= 24; i++) add(first, tangent(0) + Math.PI / 2 + i / 24 * Math.PI)
  let d = points.map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join('') + 'Z'
  // The original top-left ink impression guarantees clean final corner coverage.
  if (expansion > 0) {
    const radius = first.radius
    d += `M${first.x + radius} ${first.y}a${radius} ${radius} 0 1 1 ${-2 * radius} 0a${radius} ${radius} 0 1 1 ${2 * radius} 0Z`
  }
  return d
}
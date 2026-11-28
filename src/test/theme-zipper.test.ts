import { describe, expect, it } from 'vitest'
import { orbitPoint, THEME_TIMING, zipperStamps } from '@/lib/theme-zipper'

const orbit = { start: { x: 38, y: 38 }, control: { x: 704, y: 1404 }, end: { x: 1370, y: 576 } }

describe('theme zipper rules', () => {
  it('finishes both celestial movements and full coverage within 3 seconds', () => {
    expect(THEME_TIMING.total).toBe(2.8)
    expect(THEME_TIMING.total).toBeLessThanOrEqual(3)
    expect(THEME_TIMING.exit + THEME_TIMING.arrival).toBeLessThanOrEqual(THEME_TIMING.total)
    expect(THEME_TIMING.exit + THEME_TIMING.coverage).toBe(THEME_TIMING.swap)
  })
  it('opens at the top-left origin and follows exactly the travelled curve, never a center-out circle', () => {
    expect(zipperStamps(orbit, 0, 0, 1280, 1800)).toEqual([])
    const stamps = zipperStamps(orbit, 0.4, 0, 1280, 1800)
    expect(stamps[0]).toMatchObject({ x: 38, y: 38, t: 0 })
    const tip = stamps.at(-1)
    expect(tip).toMatchObject({ ...orbitPoint(orbit, 0.4), t: 0.4 })
    for (const stamp of stamps) {
      expect(stamp.t).toBeLessThanOrEqual(0.4)
      expect({ x: stamp.x, y: stamp.y }).toEqual(orbitPoint(orbit, stamp.t))
    }
  })
  it('finishes covering every viewport corner from the original zipper origin', () => {
    for (const [width, height] of [[1280, 1800], [577, 576], [390, 844]]) {
      const origin = zipperStamps(orbit, 1, 1, width, height)[0]
      expect(origin).toBeDefined()
      if (!origin) throw new Error('Missing origin brush impression')
      for (const x of [0, width]) for (const y of [0, height]) {
        expect(origin.radius).toBeGreaterThan(Math.hypot(x - origin.x, y - origin.y))
      }
      expect(origin.wobble).toBe(0)
    }
  })
})
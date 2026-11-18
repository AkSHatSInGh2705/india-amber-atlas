/**
 * Plain-object bridge between the imperative GSAP engine and the 3D India scene.
 * The engine animates `state`; the scene reads it every frame and writes the
 * Gurugram hotspot's screen position back into `hotEl`.
 */
export type GlobeState = {
  /** true while the 3D scene owns the map (SVG hidden) */
  on: boolean
  /** 0 = flat (matches the 2D map), 1 = full relief + city lights */
  rise: number
  /** 0 = camera aligned with the 2D map view, 1 = free 3D pose */
  cam: number
  /** orbit/pan/zoom enabled */
  interact: boolean
}

export const globe = {
  state: { on: false, rise: 0, cam: 0, interact: false } as GlobeState,
  /** 2D map view the flat pose must match: screen size and px-per-map-unit */
  view: { W: 1, H: 1, k: 1 },
  hotEl: null as HTMLElement | null,
  ready: false,
  failed: false,
  /** set by the scene: freeze the current camera pose as the `cam = 1` pose */
  capture: () => {},
  /** set by the scene: make the default 3D pose the `cam = 1` pose (no animation) */
  resetFree: () => {},
  /** set by the scene: animate back to the default 3D pose */
  recenter: () => {},
  onToggle: null as null | ((on: boolean) => void),
  setOn(on: boolean) {
    this.state.on = on
    this.onToggle?.(on)
  },
  onInteract: null as null | (() => void),
  waiters: [] as ((ok: boolean) => void)[],
  whenReady(cb: (ok: boolean) => void) {
    if (this.ready || this.failed) cb(this.ready)
    else this.waiters.push(cb)
  },
  settle(ok: boolean) {
    if (this.ready || this.failed) return
    if (ok) this.ready = true
    else this.failed = true
    const w = this.waiters
    this.waiters = []
    w.forEach((f) => f(ok))
  },
  reset() {
    Object.assign(this.state, { on: false, rise: 0, cam: 0, interact: false })
    this.hotEl = null
    this.onInteract = null
    this.waiters = []
  },
}

/** Map-space (SVG units) constants shared by the scene. */
export const MAP = {
  /** metres encoded by the height texture's white */
  HMAX: 8800,
  /** map units per km (1° latitude ≈ 111 km ≈ 33.97 units) */
  UNITS_PER_KM: 33.966 / 111.0,
  /** vertical exaggeration so the relief reads at country scale */
  EXAG: 13,
  /** slab thickness below sea level, map units */
  BASE: 16,
  FOV: 32,
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // dev-only handle for scripted checks
  ;(window as unknown as { __globe: typeof globe }).__globe = globe
}

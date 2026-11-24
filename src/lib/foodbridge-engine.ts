import gsap from 'gsap'
import MAP_DATA from './map-data.json'
import { STEPS, VENDORS, type Vendor } from './foodbridge-data'
import { globe } from './india3d'
import { HM, inkClip } from './ink'
import { directionsOpen, openDirections } from './directions'
import { LISTINGS_EVENT, latestListings, type ListingsDetail, type MapListing } from './listings'

type MapData = {
  states: { n: string; d: string }[]
  dist: { d: string; g?: boolean | number }[]
  hot: [number, number]
  gb: [number, number, number, number]
  size: [number, number]
  outline: number[]
}
type Cam = { k: number; cx: number; cy: number; ox: number; oy: number }
type Phase = 'trace' | 'intro' | 'zoom' | 'live'

const NS = 'http://www.w3.org/2000/svg'
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * Imperative scroll/GSAP scene. Runs once against the static markup rendered by
 * <FoodBridgeExperience/> and returns a cleanup that restores that markup.
 */
export function initFoodBridge(root: HTMLElement): () => void {
  const D = MAP_DATA as unknown as MapData
  const V: Vendor[] = [...VENDORS]
  const ac = new AbortController()
  const signal = ac.signal
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as unknown as T
  const $$ = <T extends Element = HTMLElement>(s: string) => [...root.querySelectorAll(s)] as unknown as T[]
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  const stage = $('#stage'),
    world = $<SVGGElement>('#world'),
    dG = $<SVGGElement>('#dists'),
    hot = $('#hot'),
    hero = $('#hero'),
    ov = $<SVGSVGElement>('#ov')
  const globeEl = $('#globe'),
    hint = $('#hint')
  if (import.meta.env.DEV) (window as unknown as { __gsap: typeof gsap }).__gsap = gsap
  history.scrollRestoration = 'manual'
  scrollTo(0, 0)

  const add = (p: Element, g: { d: string }, cls?: string) => {
    const e = document.createElementNS(NS, 'path')
    e.setAttribute('d', g.d)
    if (cls) e.setAttribute('class', cls)
    p.append(e)
  }
  D.states.forEach((s) => add($('#states'), s, s.n === 'Haryana' ? 'hr' : ''))
  D.dist.forEach((s) => add(dG, s, s.g ? 'g' : ''))

  const warm = $('#warm'),
    m2 = $('#map').cloneNode(true) as SVGSVGElement
  m2.id = 'map2'
  warm.append(m2)
  const world2 = m2.querySelector('#world') as SVGGElement,
    dG2 = m2.querySelector('#dists') as SVGGElement
  let dopen = false,
    cur = -1
  const wrap = document.createElementNS(NS, 'g'),
    bgr = document.createElementNS(NS, 'rect')
  wrap.setAttribute('mask', 'url(#inkm)')
  bgr.setAttribute('width', '100%')
  bgr.setAttribute('height', '100%')
  bgr.setAttribute('fill', '#F5F0E6')
  wrap.append(bgr, world2)
  m2.append(wrap)
  m2.insertAdjacentHTML(
    'afterbegin',
    '<defs><mask id="inkm" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><path id="i3" fill="#fff" fill-opacity=".2"/><path id="i2" fill="#fff" fill-opacity=".5"/><path id="i1" fill="#fff"/><g id="ig" fill="#fff">' +
      '<circle r="0"/>'.repeat(5) +
      '</g></mask></defs>',
  )
  const INK = ['#i1', '#i2', '#i3'].map((s) => m2.querySelector(s)!)
  const DRP = [...m2.querySelectorAll('#ig circle')]

  let W = 0,
    H = 0,
    mob = false,
    A!: Cam,
    B!: Cam,
    C!: Cam,
    cam!: Cam,
    phase: Phase = 'trace',
    sp = 0,
    tsp = 0

  function ink(p: number, cx: number, cy: number) {
    const q = clamp(p / 0.72),
      R = ease(q) * (Math.hypot(W, H) + 40) * 1.02,
      g = Math.min(1, q * 5) * (1 - q * q),
      tt = p * 5
    const path = (s: number, ph: number) => {
      let d = ''
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * 6.2832
        let m = 1
        for (const [k, am, p0, spd] of HM) m += am * g * Math.sin(k * a + p0 + ph + spd * tt)
        const r = R * s * m
        d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1)
      }
      return d + 'Z'
    }
    INK[0].setAttribute('d', path(1, 0))
    INK[1].setAttribute('d', path(1.04, 0.35))
    INK[2].setAttribute('d', path(1.08, 0.7))
    DRP.forEach((c, i) => {
      const a = i * 1.27 + 0.5,
        d = R * (1.12 + 0.05 * (i % 3))
      c.setAttribute('cx', String(cx + Math.cos(a) * d))
      c.setAttribute('cy', String(cy + Math.sin(a) * d))
      c.setAttribute('r', String((5 + i * 2.5) * clamp(q * 3) * (1 - q)))
    })
  }

  const [HX, HY] = D.hot,
    GW = D.gb[2] - D.gb[0]
  function cams() {
    W = innerWidth
    H = innerHeight
    mob = W < 760
    A = { k: Math.min(W / D.size[0], H / D.size[1]) * 0.94, cx: D.size[0] / 2, cy: D.size[1] / 2, ox: W / 2, oy: H / 2 }
    const k1 = mob ? (W * 0.8) / GW : Math.min(W * 0.34, H * 0.5) / GW
    B = { k: k1, cx: HX, cy: HY, ox: mob ? W / 2 : W * 0.7, oy: mob ? H * 0.76 : H / 2 }
    C = { k: k1 * (mob ? 1.45 : 1.9), cx: HX + 0.3, cy: HY + 0.6, ox: W / 2, oy: mob ? H * 0.42 : H * 0.46 }
    globe.view = { W, H, k: A.k }
  }

  // Overlay scene in screen space, so pins and lines stay crisp at any zoom
  const mk = <T extends SVGElement = SVGElement>(t: string, a: Record<string, string | number>, p: Element = ov) => {
    const e = document.createElementNS(NS, t) as T
    for (const k in a) e.setAttribute(k, String(a[k]))
    p.append(e)
    return e
  }
  const rings = [0, 1, 2].map(() => mk('circle', { fill: 'none', stroke: '#D96B43', 'stroke-width': 2, opacity: 0 }))
  const exp = mk('circle', { r: 26, fill: 'none', stroke: '#1E3F20', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 })
  const thread = mk<SVGPathElement>('path', { fill: 'none', stroke: '#D96B43', 'stroke-width': 3.5, 'stroke-linecap': 'round', opacity: 0 })
  const RV = (
    [
      [3.4, -2.2, 'NGO'],
      [-4.6, 2.8, 'Individual'],
      [5.2, 3.6, 'NGO'],
    ] as [number, number, string][]
  ).map(([dx, dy, l]) => {
    const g = mk('g', { opacity: 0 }),
      c = mk('circle', { r: 9, fill: '#FAF6F0', stroke: '#1E3F20', 'stroke-width': 2.5 }, g),
      t = mk('text', { y: -19, 'text-anchor': 'middle' }, g)
    t.textContent = l
    return { dx, dy, l, g, c, t }
  })
  const parcel = mk('circle', { r: 7, fill: '#1E3F20', stroke: '#F5F0E6', 'stroke-width': 2.5, opacity: 0 })
  const dl = mk('text', { 'text-anchor': 'middle', opacity: 0 })
  dl.textContent = 'Donor · web app'
  const dn = mk('text', { 'text-anchor': 'middle', opacity: 0 })
  dn.textContent = 'Pickup confirmed · impact logged'

  type Proj = (x: number, y: number) => [number, number]
  function scene(s: Proj, k: number) {
    const [x0, y0] = s(HX, HY),
      a0 = clamp((sp - 0.12) / 0.05)
    dl.setAttribute('x', String(x0))
    dl.setAttribute('y', String(y0 - 40))
    dl.setAttribute('opacity', String(a0))
    const ea = clamp((sp - 0.28) / 0.04) * (1 - clamp((sp - 0.76) / 0.04))
    exp.setAttribute('cx', String(x0))
    exp.setAttribute('cy', String(y0))
    exp.setAttribute('stroke-dasharray', '163.4')
    exp.setAttribute('stroke-dashoffset', String(163.4 * 0.9 * clamp((sp - 0.28) / 0.5)))
    exp.setAttribute('opacity', String(ea))
    const t = clamp((sp - 0.44) / 0.16)
    rings.forEach((r, i) => {
      const tt = clamp(t * 1.5 - i * 0.3)
      r.setAttribute('cx', String(x0))
      r.setAttribute('cy', String(y0))
      r.setAttribute('r', String(tt * 7.4 * k))
      r.setAttribute('opacity', String(tt > 0 && tt < 1 ? 0.7 * (1 - tt) : 0))
    })
    let wx = 0,
      wy = 0
    RV.forEach((v, j) => {
      const [x, y] = s(HX + v.dx, HY + v.dy),
        a = clamp((sp - 0.44 - 0.035 * j) / 0.05),
        cl = clamp((sp - 0.6) / 0.06),
        win = j === 0 ? cl : 0
      if (j === 0) {
        wx = x
        wy = y
      }
      v.g.setAttribute('opacity', String(a * (1 - 0.6 * (j ? cl : 0))))
      v.g.setAttribute('transform', `translate(${x} ${y}) scale(${(0.4 + 0.6 * a + 0.4 * win).toFixed(3)})`)
      v.c.setAttribute('fill', win > 0.5 ? '#D96B43' : '#FAF6F0')
      const lab = j === 0 && sp > 0.6 ? 'Claimed first · locked' : v.l
      if (v.t.textContent !== lab) v.t.textContent = lab
    })
    const dx = wx - x0,
      dy = wy - y0,
      p = ease(clamp((sp - 0.76) / 0.13))
    thread.setAttribute('d', `M${x0} ${y0}Q${(x0 + wx) / 2 - dy * 0.28} ${(y0 + wy) / 2 + dx * 0.28} ${wx} ${wy}`)
    const len = thread.getTotalLength()
    thread.setAttribute('stroke-dasharray', String(len))
    thread.setAttribute('stroke-dashoffset', String(len * (1 - p)))
    thread.setAttribute('opacity', p > 0 ? '1' : '0')
    const pt = thread.getPointAtLength(len * p)
    parcel.setAttribute('cx', String(pt.x))
    parcel.setAttribute('cy', String(pt.y))
    parcel.setAttribute('opacity', p > 0 && p < 1 ? '1' : '0')
    dn.setAttribute('x', String(wx))
    dn.setAttribute('y', String(wy + 34))
    dn.setAttribute('opacity', String(clamp((sp - 0.89) / 0.03)))
  }

  const lis = $$('#seg li')
  let si = -1
  function card() {
    const i = sp < 0.11 ? -1 : clamp(Math.floor((sp - 0.12) / 0.16), 0, 4)
    if (i !== si && i >= 0) {
      si = i
      $('#sn').textContent = `0${i + 1} / 05`
      $('#st').textContent = STEPS[i][0]
      $('#sd').textContent = STEPS[i][1]
      $('#sx').textContent = STEPS[i][2]
      if (!reduce)
        gsap.fromTo(
          $$('#sn,#st,#sd,#sx'),
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.45, stagger: 0.05, ease: 'power2.out', overwrite: true },
        )
    }
    lis.forEach((li, j) => {
      li.classList.toggle('on', j === i)
      li.querySelector('i')!.style.setProperty('--f', String(clamp((sp - 0.12 - 0.16 * j) / 0.16)))
    })
    $('#steps').style.opacity = String(clamp((sp - 0.1) / 0.03) * (1 - clamp((sp - 0.93) / 0.03)))
    $('#outro').style.opacity = String(clamp((sp - 0.94) / 0.05))
    const ctaOn = sp > 0.965
    if (ctaOn !== vctaOn) {
      vctaOn = ctaOn
      vcta.style.pointerEvents = ctaOn ? 'auto' : 'none'
      vcta.tabIndex = ctaOn ? 0 : -1
    }
  }
  const vcta = $<HTMLButtonElement>('#vcta')
  let vctaOn = false

  const VP: HTMLDivElement[] = []
  function render() {
    let c = cam
    if (phase === 'live') {
      const e = ease(clamp(sp / 0.14))
      c = {} as Cam
      for (const k in B) {
        const key = k as keyof Cam
        c[key] = B[key] + (C[key] - B[key]) * e
      }
    }
    world.setAttribute('transform', `translate(${c.ox - c.cx * c.k} ${c.oy - c.cy * c.k}) scale(${c.k})`)
    world2.setAttribute('transform', world.getAttribute('transform')!)
    const s: Proj = (x, y) => [(x - c.cx) * c.k + c.ox, (y - c.cy) * c.k + c.oy],
      [hx, hy] = s(HX, HY)
    // While the 3D map is up, the scene projects the hotspot itself
    if (!globe.state.on) hot.style.transform = `translate3d(${hx}px,${hy}px,0)`
    if (phase === 'zoom') {
      warm.style.setProperty('--mx', hx + 'px')
      warm.style.setProperty('--my', hy + 'px')
    }
    if (phase !== 'intro')
      VP.forEach((w, i) => {
        const [x, y] = s(HX + V[i].dx, HY + V[i].dy)
        w.style.transform = `translate3d(${x}px,${y}px,0)`
        w.style.opacity = String(1 - clamp(sp / 0.08))
        w.style.pointerEvents = sp > 0.05 ? 'none' : 'auto'
      })
    if (phase === 'live') {
      const e = clamp(sp / 0.1)
      hero.style.transform = `translate3d(0,${-e * 150}px,0)`
      hero.style.opacity = String(dopen ? 0 : 1 - e * 1.25)
      hero.classList.toggle('off', e > 0.6 || dopen)
      $('#b1').style.transform = `translate3d(0,${-sp * 560}px,0)`
      $('#b2').style.transform = `translate3d(0,${sp * 300}px,0)`
      scene(s, c.k)
      card()
      if (dopen && sp > 0.06) closeDr()
    }
  }

  function onScroll() {
    const m = $('#scroller').offsetHeight - innerHeight
    tsp = m > 0 ? clamp(scrollY / m) : 0
  }
  function reveal() {
    revealed = true
    gsap.fromTo(
      $$('#hero>*'),
      { y: 38, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 1.1,
        stagger: 0.11,
        ease: 'power3.out',
        onComplete: () => {
          gsap.set($$('#hero>*'), { clearProps: 'transform' })
        },
      },
    )
    gsap.to($('#place'), { autoAlpha: 1, duration: 1, delay: 0.6 })
    gsap.fromTo(
      $$('.vp button'),
      { scale: 0, autoAlpha: 0 },
      {
        scale: 1,
        autoAlpha: 1,
        duration: 0.7,
        stagger: 0.12,
        delay: 1,
        ease: 'back.out(2)',
        onComplete: () => {
          gsap.set($$('.vp button'), { clearProps: 'transform' })
        },
      },
    )
  }
  function live() {
    phase = 'live'
    wrap.removeAttribute('mask')
    $('#scroller').style.height = reduce ? '420vh' : '560vh'
    document.documentElement.classList.add('free')
    window.__fbLive = true
    dispatchEvent(new Event('fb:live'))
    $('#steps').style.visibility = 'visible'
    $('#outro').style.visibility = 'visible'
    addEventListener('scroll', onScroll, { passive: true, signal })
    onScroll()
    sp = tsp
    render()
  }

  const dr = $('#dr'),
    rg = $('#rg'),
    rf = $<HTMLFormElement>('#rf')
  let rxy: [number, number] = [0, 0]
  function addPin(i: number) {
    const v = V[i],
      w = document.createElement('div')
    w.className = 'vp'
    w.style.setProperty('--d', `${-i * 0.55}s`)
    w.innerHTML = `<button aria-label="${esc(v.name)}, surplus food available"><span>${esc(v.name)}</span></button>`
    stage.append(w)
    VP.push(w)
    w.firstChild!.addEventListener('click', (e) => openDr(VP.indexOf(w), e.currentTarget as HTMLElement), { signal })
    return w
  }
  V.forEach((_, i) => addPin(i))
  const BASE = V.length
  const keyOf = (v: Vendor) => (v as MapListing).key ?? v.name
  // Reserved pickups are keyed by vendor, so re-syncing listings never shifts them
  const reserved = new Set<string>()
  const rect = (b: Element): [number, number] => {
    const r = b.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2]
  }

  let introTL: gsap.core.Timeline | undefined
  function intro() {
    const o = $('#orb'),
      st = $('#states'),
      sx = (x: number) => (x - A.cx) * A.k + A.ox,
      sy = (y: number) => (y - A.cy) * A.k + A.oy,
      P = D.outline,
      ORG = '0 0 12px 4px #F6A47F,0 0 40px 14px rgba(217,107,67,.6),0 0 90px 30px rgba(217,107,67,.3)'
    gsap.set(hot, { autoAlpha: 0 })
    st.style.opacity = '0'
    let d = ''
    for (let i = 0; i < P.length; i += 2) d += (i ? 'L' : 'M') + sx(P[i]).toFixed(1) + ' ' + sy(P[i + 1]).toFixed(1)
    d += 'Z'
    const tps = (
      [
        [1.6, 1],
        [6, 0.28],
        [14, 0.12],
      ] as [number, number][]
    ).map(([w, op]) => {
      const e = document.createElementNS(NS, 'path')
      e.setAttribute('d', d)
      e.setAttribute('fill', 'none')
      e.setAttribute('stroke', '#fff')
      e.setAttribute('stroke-width', String(w))
      e.setAttribute('stroke-opacity', String(op))
      e.setAttribute('stroke-linecap', 'round')
      e.setAttribute('stroke-linejoin', 'round')
      $('#tr').append(e)
      return e
    })
    const L = tps[0].getTotalLength()
    tps.forEach((e) => {
      e.style.strokeDasharray = String(L)
      e.style.strokeDashoffset = String(L)
    })
    const FO = [...Array(7)].map((_, i) => {
      const e = document.createElement('div'),
        z = 16 - i * 2
      e.className = 'orbi fo'
      e.style.cssText = `width:${z}px;height:${z}px;margin:${-z / 2}px 0 0 ${-z / 2}px`
      stage.append(e)
      return e
    })
    const at = (l: number) => tps[0].getPointAtLength(clamp(l, 0, L)),
      Q = [o, ...FO].map((e) => [gsap.quickSetter(e, 'x', 'px'), gsap.quickSetter(e, 'y', 'px')])
    const s0 = at(0)
    gsap.set([o, ...FO], { x: s0.x, y: s0.y })
    gsap.set(o, { scale: 0, opacity: 0 })
    gsap.set(FO, { opacity: 0 })
    const TR = { p: 0 },
      J = { p: 0 }
    let x0 = 0,
      y0 = 0,
      x1 = 0,
      y1 = 0
    const upd = (p: number) => {
      const l = p * L
      Q.forEach(([qx, qy], i) => {
        const pt = at(l - i * L * 0.0065)
        qx(pt.x)
        qy(pt.y)
      })
      tps.forEach((e) => (e.style.strokeDashoffset = String(L * (1 - p))))
    }
    const TL = (introTL = gsap.timeline({
      delay: 0.6,
      onComplete() {
        phase = 'intro'
        start3D()
      },
    }))
    TL.to(o, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(2.2)' })
      .to(FO, { opacity: (i: number) => 0.6 - i * 0.08, duration: 0.6 }, '<.2')
      .to(TR, { p: 1, duration: 5.4, ease: 'power1.inOut', onUpdate: () => upd(TR.p) }, '>-.2')
      .to(FO, { opacity: 0, scale: 0, duration: 0.4, stagger: 0.03 })
      .to(st, { opacity: 1, duration: 1.4, ease: 'power1.inOut' }, '<')
      .to(tps, { opacity: 0, duration: 1.2 }, '<.2')
      .to(o, { backgroundColor: '#D96B43', boxShadow: ORG, duration: 1, ease: 'power2.inOut' }, '<')
      .to(o, { scale: 1.9, duration: 0.45, ease: 'power2.out' }, '<')
      .to(o, { scale: 1, duration: 0.7, ease: 'elastic.out(1,.45)' })
    // Slingshot: draw back against the band, then release into Gurugram with an overshoot
    let ux = 0,
      uy = 0
    TL.call(() => {
      x0 = gsap.getProperty(o, 'x') as number
      y0 = gsap.getProperty(o, 'y') as number
      x1 = sx(HX)
      y1 = sy(HY)
      const len = Math.hypot(x1 - x0, y1 - y0) || 1
      ux = (x1 - x0) / len
      uy = (y1 - y0) / len
      gsap.set(o, { rotation: (Math.atan2(uy, ux) * 180) / Math.PI })
    })
      .to(o, {
        x: () => x0 - ux * 64,
        y: () => y0 - uy * 64,
        scaleX: 0.72,
        scaleY: 1.22,
        duration: 0.6,
        ease: 'power2.out',
      })
      .to(J, { p: 0, duration: 0.12 })
      .to(o, { x: () => x1, y: () => y1, duration: 0.62, ease: 'back.out(1.5)' })
      .to(o, { scaleX: 2.3, scaleY: 0.5, duration: 0.14, ease: 'power3.out' }, '<')
      .to(o, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'elastic.out(1,.5)' }, '<.24')
      .to(o, { rotation: 0, duration: 0.01 })
      .to(o, { scaleX: 1.45, scaleY: 0.6, duration: 0.09, ease: 'power2.in' })
      .to(o, { scale: 0.73, boxShadow: '0 0 8px 2px rgba(217,107,67,.6)', duration: 0.4, ease: 'back.out(3)' })
      .call(() => {
        gsap.set(hot, { autoAlpha: 1 })
        gsap.set(o, { autoAlpha: 0 })
        gsap.fromTo($('#tip'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' })
      })
    if (reduce) TL.timeScale(8)
    stage.addEventListener(
      'click',
      () => {
        if (phase === 'trace') TL.timeScale(4)
      },
      { signal },
    )
  }

  type ClipEl = HTMLElement & { _o?: [number, number] }

  const itemRows = (v: Vendor) =>
    v.items
      .map(
        (x) =>
          `<li><b>${esc(x.name)}</b><span>${esc(x.quantity)} · Best before ${esc(x.bestBefore)}</span><em class="${x.veg ? 'v' : 'n'}">${x.veg ? 'Veg' : 'Non-veg'}</em></li>`,
      )
      .join('')

  function openDr(i: number, b: HTMLElement) {
    cur = i
    const v = V[i]
    $('#drph').style.background = `linear-gradient(135deg,${v.tint[0]},${v.tint[1]})`
    const img = $<HTMLImageElement>('#drimg')
    img.src = v.image
    img.alt = `Surplus food from ${v.name}`
    $('#drloc').textContent = v.area + ' · Gurugram'
    $('#drn').textContent = v.name
    $('#drw').innerHTML = `Pickup window <b>${esc(v.pickupWindow)}</b>`
    $('#dri').innerHTML = itemRows(v)
    $('#drnote').textContent = i === mine ? 'Your listing · only your account can edit it' : i >= BASE ? 'Volunteer listing · live' : 'Simulated vendor · demo data'
    setReg()
    dr.style.visibility = 'visible'
    dr.setAttribute('aria-hidden', 'false')
    dr.scrollTop = 0
    dopen = true
    render()
    if (W >= 760) {
      // Centre the card in the hero's left column so it sits clear of the map instead of hugging the pins
      const cw = Math.min(430, W - 40),
        colL = Math.max(W * 0.06, 28),
        colW = Math.min(580, W * 0.46),
        mn = Math.min(...VP.map((w) => (w.firstChild as HTMLElement).getBoundingClientRect().left))
      const left = Math.min(colL + (colW - cw) / 2, mn - cw - 48)
      dr.style.left = clamp(left, 20, W - cw - 20) + 'px'
    }
    const [x, y] = rect(b)
    ;(dr as ClipEl)._o = [x, y]
    inkClip(dr, x, y, true)
    gsap.from($$('#drph,.drb>*'), { y: 18, opacity: 0, duration: 0.55, stagger: 0.05, delay: 0.4, ease: 'power2.out', clearProps: 'transform,opacity' })
  }
  function closeDr() {
    if (!dopen) return
    dopen = false
    render()
    const [x, y] = (dr as ClipEl)._o!
    inkClip(dr, x, y, false, () => {
      dr.style.visibility = 'hidden'
      dr.setAttribute('aria-hidden', 'true')
    })
  }
  $('#drx').onclick = closeDr

  // Registration + vow blob
  const vow = $('#vow'),
    sub = $('#sub'),
    base = $('#sub .base'),
    blob = $('#sub .blob'),
    sbtn = $<HTMLButtonElement>('#sbtn'),
    tk = $('#tk'),
    fl = $('#sub .fl'),
    ORB = $$('.orb')
  let on = false,
    tlV: gsap.core.Timeline | undefined
  function setVow(v: boolean, instant?: boolean) {
    on = v
    vow.setAttribute('aria-checked', String(v))
    if (tlV) tlV.kill()
    gsap.killTweensOf([blob, base, tk, sbtn, vow, fl, sub, ...ORB])
    gsap.set(sub, { scaleX: 1, scaleY: 1 })
    gsap.set(vow, { scale: 1 })
    sbtn.disabled = true
    gsap.set(blob, { opacity: 0 })
    if (!v) {
      if (instant) {
        gsap.set(ORB, { opacity: 0, scale: 0 })
        gsap.set(fl, { scale: 0 })
        gsap.set(base, { backgroundColor: '#DDD3BC' })
        gsap.set(sbtn, { color: '#8C8470' })
        gsap.set(tk, { strokeDashoffset: 22 })
        gsap.set(vow, { backgroundColor: 'transparent' })
        return
      }
      gsap.to(ORB, { opacity: 0, scale: 0, duration: 0.3, ease: 'power2.in' })
      gsap.to(vow, { backgroundColor: 'transparent', duration: 0.35, ease: 'sine.inOut' })
      gsap.to(tk, { strokeDashoffset: 22, duration: 0.3, ease: 'power2.in' })
      gsap.to(base, { backgroundColor: '#DDD3BC', duration: 0.35, ease: 'sine.inOut' })
      gsap.to(fl, { scale: 0, duration: 0.6, ease: 'power3.inOut' })
      gsap.to(sbtn, { color: '#8C8470', duration: 0.45, ease: 'sine.inOut' })
      return
    }
    const sb = sub.getBoundingClientRect(),
      vb = vow.getBoundingClientRect(),
      w = sb.width,
      h = sb.height,
      x0 = vb.left + vb.width / 2 - sb.left,
      y0 = vb.top + vb.height / 2 - sb.top,
      x1 = w / 2,
      y1 = h / 2,
      cx = (x0 + x1) / 2,
      cy = Math.min(y0, y1) - 70,
      bez = (t: number): [number, number] => {
        const u = 1 - t
        return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]
      },
      FLY = 1.1,
      T = 0.3 + FLY
    gsap.to(vow, { backgroundColor: '#1E3F20', duration: 0.35, ease: 'sine.out' })
    gsap.to(tk, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out', delay: 0.05 })
    const TL = (tlV = gsap.timeline())
    TL.fromTo(vow, { scale: 1 }, { scale: 1.16, duration: 0.22, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0)
    // Same glowing orange orb as the map intro: a lead orb plus a soft comet trail riding one bezier arc
    ORB.forEach((o, i) => {
      const lag = i * 0.055,
        pr = { t: 0 }
      TL.set(o, { x: x0, y: y0, scale: 0, opacity: i ? 0.6 - i * 0.14 : 1 }, 0)
        .to(o, { scale: [1, 0.72, 0.52, 0.36][i], duration: 0.5, ease: 'power3.out' }, 0.04 + lag)
        .to(
          pr,
          {
            t: 1,
            duration: FLY,
            ease: 'power2.inOut',
            onUpdate() {
              const [x, y] = bez(pr.t)
              gsap.set(o, { x, y })
            },
          },
          0.3 + lag,
        )
      if (i) TL.to(o, { opacity: 0, scale: 0, duration: 0.35, ease: 'power2.in' }, T - 0.2 + lag)
    })
    TL.to(ORB[0], { scale: 1.45, duration: 0.22, ease: 'sine.out' }, T)
      .to(ORB[0], { scale: 0, opacity: 0, duration: 0.6, ease: 'power3.inOut' }, T + 0.18)
      .to(fl, { scale: (Math.hypot(w, h) / 60) * 1.08, duration: 1.1, ease: 'expo.out' }, T + 0.12)
      .to(sbtn, { color: '#fff', duration: 0.5, ease: 'sine.out' }, T + 0.3)
      .set(base, { backgroundColor: '#D96B43' }, T + 1.1)
      .call(
        () => {
          if (on) sbtn.disabled = false
        },
        undefined,
        T + 0.45,
      )
  }
  vow.onclick = () => setVow(!on)

  function openRg(b: HTMLElement) {
    const v = V[cur]
    rxy = rect(b)
    rf.reset()
    rf.style.display = ''
    $('#ok').style.display = 'none'
    setVow(false, true)
    $('#rgv').textContent = v.name
    $('#rgm').textContent = `${v.area}, Gurugram · pickup ${v.pickupWindow}`
    $('#rgi').innerHTML = v.items
      .map((x) => `<li><b>${esc(x.name)}</b> · ${esc(x.quantity)} · best before ${esc(x.bestBefore)}</li>`)
      .join('')
    rg.style.clipPath = 'circle(0px)'
    rg.style.visibility = 'visible'
    rg.setAttribute('aria-hidden', 'false')
    rg.scrollTop = 0
    document.documentElement.style.overflow = 'hidden'
    inkClip(rg, rxy[0], rxy[1], true)
  }
  function closeRg() {
    inkClip(rg, rxy[0], rxy[1], false, () => {
      rg.style.visibility = 'hidden'
      rg.setAttribute('aria-hidden', 'true')
      document.documentElement.style.overflow = ''
    })
  }
  const regB = $<HTMLButtonElement>('#reg'),
    LOCK =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  const goB = $<HTMLButtonElement>('#dgo')
  // NGO's area of operation per reserved pickup: the fallback start point for directions
  const ngoFrom = new Map<string, string>()
  function setReg() {
    const locked = reserved.has(keyOf(V[cur]))
    regB.classList.toggle('locked', locked)
    regB.innerHTML = locked ? `${LOCK}Locked` : 'Register to Collect'
    regB.setAttribute('aria-disabled', String(locked))
    goB.hidden = !ngoFrom.has(keyOf(V[cur]))
  }
  function popGo(delay: number) {
    if (goB.hidden) return
    gsap.fromTo(
      goB,
      { scale: 0.4, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: reduce ? 0.2 : 1.1, ease: reduce ? 'none' : 'elastic.out(1, 0.5)', delay, clearProps: 'transform,opacity,visibility' },
    )
  }
  goB.onclick = () => {
    const v = V[cur],
      [x, y] = rect(goB)
    openDirections({ key: keyOf(v), name: v.name, area: v.area, pickupWindow: v.pickupWindow, from: ngoFrom.get(keyOf(v)) ?? '', x, y })
  }

  const toastEl = $('#toast'),
    toastBar = $('#toast i')
  let toastTL: gsap.core.Timeline | undefined
  function toast(msg: string) {
    toastTL?.kill()
    toastEl.querySelector('p')!.textContent = msg
    toastTL = gsap
      .timeline()
      .set(toastEl, { visibility: 'visible' })
      .fromTo(
        toastEl,
        { y: 60, scale: 0.86, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: reduce ? 0.2 : 1, ease: reduce ? 'none' : 'elastic.out(1, 0.62)' },
      )
      .fromTo(toastBar, { scaleX: 1 }, { scaleX: 0, duration: 5, ease: 'none' }, 0)
      .to(toastEl, { y: 30, scale: 0.94, opacity: 0, duration: 0.45, ease: 'power2.in' }, 5)
      .set(toastEl, { visibility: 'hidden' })
  }

  regB.onclick = (e) => {
    if (reserved.has(keyOf(V[cur]))) {
      if (!reduce) gsap.fromTo(regB, { x: 0 }, { keyframes: { x: [0, -7, 7, -4, 4, 0] }, duration: 0.45, ease: 'sine.inOut' })
      toast('This food is already waiting to be served to needy stomachs, please choose another volunteer')
      return
    }
    openRg(e.currentTarget as HTMLElement)
  }
  $('#rgx').onclick = closeRg

  // Volunteer listing: one demo entry, rendered as an extra vendor orb
  const vl = $('#vl')
  let vxy: [number, number] = [0, 0],
    mine = -1,
    popPending = false
  const vlOpen = () => vl.style.visibility === 'visible'
  function setCta() {
    $('#vctal').textContent = mine < 0 ? 'Volunteer · list your surplus food' : 'Manage your listing'
  }
  function openVl() {
    vxy = rect(vcta)
    vl.style.clipPath = 'circle(0px)'
    vl.style.visibility = 'visible'
    vl.setAttribute('aria-hidden', 'false')
    vl.scrollTop = 0
    document.documentElement.style.overflow = 'hidden'
    inkClip(vl, vxy[0], vxy[1], true)
    gsap.from($$('#vl .rgs>*,#vl .vview>*'), { y: 20, opacity: 0, duration: 0.6, stagger: 0.04, delay: 0.35, ease: 'power3.out', clearProps: 'transform,opacity' })
  }
  function closeVl(done?: () => void) {
    inkClip(vl, vxy[0], vxy[1], false, () => {
      vl.style.visibility = 'hidden'
      vl.setAttribute('aria-hidden', 'true')
      document.documentElement.style.overflow = ''
      done?.()
    })
  }
  vcta.addEventListener('click', openVl, { signal })
  $('#vlx').onclick = () => closeVl()
  // Saved volunteer listings (published by the React panel) become live orbs beside the demo vendors
  let revealed = false
  function syncListings({ listings, pop }: ListingsDetail) {
    const keep = new Set(listings.map((l) => l.key))
    for (let i = V.length - 1; i >= BASE; i--) {
      if (keep.has(keyOf(V[i]))) continue
      if (dopen && cur === i) closeDr()
      VP[i].remove()
      VP.splice(i, 1)
      V.splice(i, 1)
      if (cur > i) cur--
    }
    for (const l of listings) {
      const i = V.findIndex((v, j) => j >= BASE && keyOf(v) === l.key)
      if (i >= 0) {
        V[i] = l
        const b = VP[i].firstChild as HTMLElement
        b.setAttribute('aria-label', `${l.name}, surplus food available`)
        b.querySelector('span')!.textContent = l.name
        VP[i].classList.toggle('mine', l.mine)
        continue
      }
      V.push(l)
      const w = addPin(V.length - 1)
      w.classList.toggle('mine', l.mine)
      if (reserved.has(l.key)) w.classList.add('res')
      if (l.key === pop) {
        gsap.set(w.firstChild, { autoAlpha: 0 })
        popPending = true
      } else if (revealed) gsap.set(w.firstChild, { autoAlpha: 1 })
    }
    mine = V.findIndex((v) => (v as MapListing).mine)
    if (mine < 0) popPending = false
    setCta()
    render()
  }
  addEventListener(LISTINGS_EVENT, (e) => syncListings((e as CustomEvent<ListingsDetail>).detail), { signal })
  addEventListener(
    'fb:vol-show',
    () =>
      closeVl(() => {
        scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
      }),
    { signal },
  )
  function popMine() {
    popPending = false
    const b = VP[mine].firstChild as HTMLElement
    gsap.fromTo(
      b,
      { scale: 0, autoAlpha: 1 },
      { scale: 1, duration: reduce ? 0.2 : 1.3, ease: reduce ? 'none' : 'elastic.out(1, 0.42)', delay: 0.15, clearProps: 'transform' },
    )
  }

  addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        if (directionsOpen()) return
        if (rg.style.visibility === 'visible') closeRg()
        else if (vlOpen()) closeVl()
        else closeDr()
      }
    },
    { signal },
  )

  const vsel = $('#vsel'),
    vbtn = $('#vbtn'),
    vlist = $('#vlist'),
    vin = $<HTMLInputElement>('#vin'),
    vlab = $('#vlab'),
    vopts = $$('#vlist li')
  let vOpen = false,
    vTw: gsap.core.Tween | undefined
  function setList(open: boolean, focus = true) {
    if (open === vOpen) return
    vOpen = open
    vbtn.setAttribute('aria-expanded', String(open))
    vsel.classList.toggle('open', open)
    const [x, y] = rect(vbtn.querySelector('svg')!)
    vTw?.kill()
    if (open) {
      vlist.style.visibility = 'visible'
      vTw = inkClip(vlist, x, y, true, undefined, 0.75)
      if (focus) (vopts.find((o) => o.getAttribute('aria-selected') === 'true') || vopts[0]).focus()
    } else {
      vTw = inkClip(vlist, x, y, false, () => (vlist.style.visibility = 'hidden'), 0.45)
      if (focus) vbtn.focus()
    }
  }
  function pick(o: HTMLElement) {
    vopts.forEach((x) => x.setAttribute('aria-selected', String(x === o)))
    vin.value = o.dataset.v!
    vlab.textContent = o.dataset.v!
    vsel.classList.add('has')
    vsel.classList.remove('bad')
    setList(false)
  }
  vbtn.addEventListener('click', () => setList(!vOpen), { signal })
  vbtn.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setList(true)
      }
    },
    { signal },
  )
  vopts.forEach((o, i) => {
    o.addEventListener('click', () => pick(o), { signal })
    o.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          vopts[(i + (e.key === 'ArrowDown' ? 1 : vopts.length - 1)) % vopts.length].focus()
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          pick(o)
        } else if (e.key === 'Escape') {
          e.stopPropagation()
          setList(false)
        } else if (e.key === 'Tab') setList(false, false)
      },
      { signal },
    )
  })
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (vOpen && !vsel.contains(e.target as Node)) setList(false, false)
    },
    { signal },
  )
  vin.addEventListener('invalid', () => vsel.classList.add('bad'), { signal })
  rf.addEventListener(
    'reset',
    () => {
      setList(false, false)
      vopts.forEach((x) => x.setAttribute('aria-selected', 'false'))
      vlab.textContent = 'Select…'
      vsel.classList.remove('has', 'bad')
    },
    { signal },
  )

  rf.addEventListener(
    'submit',
    (e) => {
      e.preventDefault()
      if (!on || !rf.reportValidity()) return
      const v = V[cur],
        ref = 'FB-' + Math.random().toString(36).slice(2, 7).toUpperCase()
      VP[cur].classList.add('res')
      reserved.add(keyOf(v))
      ngoFrom.set(keyOf(v), (rf.elements.namedItem('area') as HTMLInputElement).value.trim())
      setReg()
      const ngo = (rf.querySelector('input') as HTMLInputElement).value
      const ok = $('#ok')
      ok.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D96B43" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg><h3>Pickup reserved</h3><p>${esc(ngo)} can collect from <b>${esc(v.name)}</b>, ${esc(v.area)}, between <b>${esc(v.pickupWindow)}</b>.</p><code>${ref}</code><p style="font-size:13px;opacity:.65;margin-bottom:22px">Prototype only: nothing was saved or sent.</p><a class="btn" href="#" id="okx">Back to the map</a>`
      rf.style.display = 'none'
      ok.style.display = 'block'
      gsap.fromTo($$('#ok>*'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: 'power3.out' })
      $('#okx').onclick = (ev) => {
        ev.preventDefault()
        // Keep the vendor card open so "Take me there" can pop in beside the lock
        closeRg()
        popGo(0.55)
      }
    },
    { signal },
  )

  gsap.set([...$$('#hero>*'), $('#place'), ...$$('.vp button')], { autoAlpha: 0 })
  cams()
  cam = A
  syncListings(latestListings())
  render()
  intro()
  addEventListener(
    'resize',
    () => {
      cams()
      if (phase === 'intro' || phase === 'trace') cam = A
      else if (phase === 'live') onScroll()
      render()
    },
    { signal },
  )
  const tick = () => {
    if (phase !== 'live') return
    const d = tsp - sp
    if (Math.abs(d) > 1e-4) {
      sp += reduce ? d : d * 0.12
      render()
    }
    if (popPending && sp < 0.03 && !vlOpen()) popMine()
  }
  gsap.ticker.add(tick)

  // 3D relief map: rises out of the flat 2D map once the intro lands, flattens back before the zoom
  let tl3d: gsap.core.Timeline | undefined
  function start3D() {
    globe.hotEl = hot
    globe.onInteract = () => gsap.to(hint.querySelectorAll('span'), { autoAlpha: 0, duration: 0.6 })
    globe.whenReady((ok) => {
      if (!ok || phase !== 'intro' || globe.state.on) return
      globe.resetFree()
      Object.assign(globe.state, { rise: 0, cam: 0, interact: false })
      globe.setOn(true)
      gsap.set(globeEl, { autoAlpha: 1 })
      gsap.to($('#map'), { opacity: 0, duration: 0.25, delay: 0.15 })
      tl3d = gsap
        .timeline()
        .to(globe.state, { cam: 1, duration: reduce ? 0.5 : 3.6, ease: 'power2.inOut' }, 0)
        .to(globe.state, { rise: 1, duration: reduce ? 0.5 : 3.2, ease: 'power2.inOut' }, reduce ? 0 : 0.35)
        .call(() => {
          globe.state.interact = true
          gsap.fromTo(hint, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' })
        })
    })
  }
  function flatten3D(done: () => void) {
    tl3d?.kill()
    globe.state.interact = false
    globe.capture()
    gsap.to(hint, { autoAlpha: 0, duration: 0.3 })
    gsap
      .timeline({
        onComplete() {
          globe.setOn(false)
          gsap.set(globeEl, { autoAlpha: 0 })
          render()
          done()
        },
      })
      .to(globe.state, { rise: 0, duration: reduce ? 0.4 : 1.5, ease: 'power2.inOut' }, 0)
      .to(globe.state, { cam: 0, duration: reduce ? 0.5 : 1.9, ease: 'power3.inOut' }, 0)
      .to($('#map'), { opacity: 1, duration: 0.3 }, '>-0.3')
  }
  $('#recenter').addEventListener('click', () => globe.recenter(), { signal })

  const hotbtn = $('#hotbtn')
  function zoomIn() {
      stage.classList.add('warm')
      document.body.classList.add('warm')
      const o = { p: 0 }
      let shown = false
      gsap.to(o, {
        p: 1,
        duration: reduce ? 0.6 : 2.6,
        ease: 'power2.inOut',
        onUpdate() {
          const p = o.p,
            k = A.k * Math.pow(B.k / A.k, p),
            w = (1 / k - 1 / A.k) / (1 / B.k - 1 / A.k)
          cam = { k, cx: A.cx + (B.cx - A.cx) * w, cy: A.cy + (B.cy - A.cy) * w, ox: A.ox + (B.ox - A.ox) * p, oy: A.oy + (B.oy - A.oy) * p }
          dG.style.opacity = dG2.style.opacity = String(clamp((p - 0.5) / 0.35))
          render()
          ink(p, (HX - cam.cx) * cam.k + cam.ox, (HY - cam.cy) * cam.k + cam.oy)
          if (!shown && p > 0.7) {
            shown = true
            reveal()
          }
        },
        onComplete: live,
      })
  }
  hotbtn.addEventListener(
    'click',
    () => {
      if (phase !== 'intro') return
      phase = 'zoom'
      hotbtn.style.pointerEvents = 'none'
      gsap.to($('#tip'), { autoAlpha: 0, y: 8, duration: 0.35 })
      if (globe.state.on) flatten3D(zoomIn)
      else zoomIn()
    },
    { signal },
  )

  $('#snext').addEventListener(
    'click',
    (e) => {
      e.preventDefault()
      scrollTo({ top: $('#scroller').offsetHeight - innerHeight, behavior: reduce ? 'auto' : 'smooth' })
    },
    { signal },
  )

  const go = $('#go')
  go.addEventListener(
    'click',
    (e) => {
      e.preventDefault()
      const m = $('#scroller').offsetHeight - innerHeight
      scrollTo({ top: m * 0.2, behavior: reduce ? 'auto' : 'smooth' })
    },
    { signal },
  )
  go.addEventListener(
    'mousemove',
    (e) => {
      const r = go.getBoundingClientRect()
      go.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.12}px,${(e.clientY - r.top - r.height / 2) * 0.22}px)`
    },
    { signal },
  )
  go.addEventListener('mouseleave', () => (go.style.transform = ''), { signal })

  return () => {
    ac.abort()
    gsap.ticker.remove(tick)
    introTL?.kill()
    tlV?.kill()
    gsap.globalTimeline.clear()
    m2.remove()
    VP.forEach((w) => w.remove())
    $$('.orbi.fo').forEach((e) => e.remove())
    ;['#states', '#dists', '#ov', '#tr', '#ok', '#dri', '#rgi'].forEach((s) => ($(s).innerHTML = ''))
    tl3d?.kill()
    globe.setOn(false)
    globe.reset()
    // The 3D canvas manages its own inline styles
    root.querySelectorAll('[style]').forEach((e) => {
      if (e.id === 'globe' || !e.closest('#globe')) e.removeAttribute('style')
    })
    stage.classList.remove('warm')
    document.body.classList.remove('warm')
    document.documentElement.classList.remove('free')
    document.documentElement.style.overflow = ''
    window.__fbLive = false
    dispatchEvent(new Event('fb:live'))
  }
}

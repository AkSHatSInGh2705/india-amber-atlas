import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { inkClip } from '@/lib/ink'

const pt = { x: -1, y: -1 }
let tracking = 0
const onDown = (e: PointerEvent) => {
  pt.x = e.clientX
  pt.y = e.clientY
}

/**
 * Re-reveals the element with the shared ink smear whenever `key` changes, spreading
 * from wherever the user last pressed (or the top centre for keyboard use).
 */
export function useInkSwap<T extends HTMLElement>(key: string, skip = false) {
  const ref = useRef<T>(null)
  const prev = useRef<string | null>(null)
  useEffect(() => {
    if (!tracking++) addEventListener('pointerdown', onDown, true)
    return () => {
      if (!--tracking) removeEventListener('pointerdown', onDown, true)
    }
  }, [])
  useLayoutEffect(() => {
    const first = prev.current === null
    prev.current = key
    const el = ref.current
    if (first || skip || !el) return
    const r = el.getBoundingClientRect()
    const inside = pt.x >= r.left - 40 && pt.x <= r.right + 40 && pt.y >= r.top - 40 && pt.y <= r.bottom + 40
    const x = inside ? pt.x : r.left + r.width / 2
    const y = inside ? pt.y : r.top + 24
    const tw = inkClip(el, x, y, true, undefined, 0.95)
    const kids = [...el.children]
    const tw2 = gsap.from(kids, { y: 14, opacity: 0, duration: 0.5, stagger: 0.04, delay: 0.12, ease: 'power3.out', clearProps: 'transform,opacity' })
    return () => {
      tw.kill()
      tw2.kill()
      el.style.clipPath = ''
      gsap.set(kids, { clearProps: 'transform,opacity' })
    }
  }, [key, skip])
  return ref
}

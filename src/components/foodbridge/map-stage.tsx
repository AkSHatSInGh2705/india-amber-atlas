import { lazy, Suspense, useEffect, useState } from 'react'
import { Hero } from './hero'
import { StepsCard } from './steps-card'

// three.js only loads in the browser, after hydration
const IndiaGlobe = lazy(() => import('./india-globe'))

function GlobeSlot() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? (
    <Suspense fallback={null}>
      <IndiaGlobe />
    </Suspense>
  ) : null
}

export function MapStage() {
  return (
    <div id="stage">
      <svg id="map" aria-hidden="true">
        <g id="world">
          <g id="states" />
          <g id="dists" />
        </g>
      </svg>
      <div id="globe" aria-label="3D map of India. Drag to rotate, scroll to zoom.">
        <GlobeSlot />
      </div>
      <div id="hint">
        <span className="hint-desk">Drag to rotate · Right-drag to pan · Scroll to zoom</span>
        <span className="hint-touch">Drag to rotate · Pinch to zoom · Two fingers to pan</span>
        <button type="button" id="recenter">
          Reset view
        </button>
      </div>
      <div id="warm" />
      <div className="blob" id="b1" />
      <div className="blob" id="b2" />
      <svg id="ov" aria-hidden="true" />
      <svg id="tr" aria-hidden="true" />
      <div className="orbi" id="orb" />
      <div id="hot">
        <button id="hotbtn" type="button" aria-label="Explore Gurugram, Haryana">
          <i />
        </button>
        <div id="tip">
          <div>
            <b>Click to enter local network</b>
            <span>Gurugram, Haryana</span>
          </div>
        </div>
        <div id="place">GURUGRAM · HARYANA</div>
      </div>
      <Hero />
      <StepsCard />
      <div id="outro">
        <p>
          The gap isn&rsquo;t food availability. It&rsquo;s a <em>fast channel</em> from surplus to need, before
          spoilage.
        </p>
        <button className="btn" id="vcta" type="button" tabIndex={-1}>
          <span id="vctal">Volunteer · list your surplus food</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      </div>
    </div>
  )
}

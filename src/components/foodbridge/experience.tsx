

import { useEffect, useRef } from 'react'
import { initFoodBridge } from '@/lib/foodbridge-engine'
import { DirectionsWindow } from './directions-window'
import { MapStage } from './map-stage'
import { RegistrationPanel } from './registration-panel'
import { VendorDrawer } from './vendor-drawer'
import { VolunteerPanel } from './volunteer-panel'

export function FoodBridgeExperience() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rootRef.current) return
    return initFoodBridge(rootRef.current)
  }, [])

  return (
    <div ref={rootRef}>
      <MapStage />
      <VendorDrawer />
      <RegistrationPanel />
      <VolunteerPanel />
      <DirectionsWindow />
      <div id="toast" role="status" aria-live="polite">
        <span className="tic" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="5" y="11" width="14" height="9" rx="2.5" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <p />
        <i />
      </div>
      <div id="scroller" />
    </div>
  )
}

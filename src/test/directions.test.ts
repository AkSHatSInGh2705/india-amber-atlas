import { describe, expect, it } from 'vitest'
import { GURUGRAM, knownPlace, navigationUrl, osrmRouteUrl, parseOsrm, placeQuery } from '@/lib/directions'

describe('directions', () => {
  it('anchors a bare area to Gurugram, Haryana', () => {
    expect(placeQuery('Sector 29')).toBe('Sector 29, Gurugram, Haryana')
  })
  it('does not double up a city the NGO already typed', () => {
    expect(placeQuery('Sectors 14–31, Gurugram')).toBe('Sectors 14–31, Gurugram, Haryana')
    expect(placeQuery('DLF Phase 2, Gurgaon, Haryana')).toBe('DLF Phase 2, Gurgaon, Haryana')
  })
  it('places demo pickup areas without a network lookup', () => {
    expect(knownPlace('Sector 29, Gurugram')).toEqual({ lat: 28.4685, lng: 77.064 })
    expect(knownPlace('')).toEqual(GURUGRAM)
    expect(knownPlace('Some new colony')).toBeUndefined()
  })
  it('asks OSRM for a driving route with lng,lat pairs and a full GeoJSON line', () => {
    const u = new URL(osrmRouteUrl({ lat: 28.4595, lng: 77.0266 }, { lat: 28.4685, lng: 77.064 }))
    expect(u.host).toBe('router.project-osrm.org')
    expect(u.pathname).toBe('/route/v1/driving/77.026600,28.459500;77.064000,28.468500')
    expect(u.searchParams.get('overview')).toBe('full')
    expect(u.searchParams.get('geometries')).toBe('geojson')
  })
  it('flips OSRM coordinates into map [lat, lng] points', () => {
    const r = parseOsrm({
      code: 'Ok',
      routes: [{ distance: 5432, duration: 610, geometry: { coordinates: [[77.02, 28.45], [77.06, 28.46]] } }],
    })
    expect(r).toEqual({ line: [[28.45, 77.02], [28.46, 77.06]], km: 5.4, min: 10 })
    expect(parseOsrm({ code: 'NoRoute', routes: [] })).toBeNull()
  })
  it('lets the phone use its own GPS for navigation when no origin is known', () => {
    expect(new URL(navigationUrl('MG Road')).searchParams.has('origin')).toBe(false)
  })
})

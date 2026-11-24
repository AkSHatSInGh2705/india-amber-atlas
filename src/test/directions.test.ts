import { describe, expect, it } from 'vitest'
import { canEmbedOn, embedDirectionsUrl, navigationUrl, placeQuery } from '@/lib/directions'

describe('directions', () => {
  it('anchors a bare area to Gurugram, Haryana', () => {
    expect(placeQuery('Sector 29')).toBe('Sector 29, Gurugram, Haryana')
  })
  it('does not double up a city the NGO already typed', () => {
    expect(placeQuery('Sectors 14–31, Gurugram')).toBe('Sectors 14–31, Gurugram, Haryana')
    expect(placeQuery('DLF Phase 2, Gurgaon, Haryana')).toBe('DLF Phase 2, Gurgaon, Haryana')
  })
  it('routes from device coordinates when available', () => {
    const u = new URL(embedDirectionsUrl('k', { lat: 28.4595, lng: 77.0266 }, 'Sohna Road'))
    expect(u.pathname).toBe('/maps/embed/v1/directions')
    expect(u.searchParams.get('origin')).toBe('28.459500,77.026600')
    expect(u.searchParams.get('destination')).toBe('Sohna Road, Gurugram, Haryana')
  })
  it('falls back to the NGO area as the start point', () => {
    const u = new URL(embedDirectionsUrl('k', 'Sector 14', 'MG Road'))
    expect(u.searchParams.get('origin')).toBe('Sector 14, Gurugram, Haryana')
  })
  it('lets the phone use its own GPS for navigation when no origin is known', () => {
    expect(new URL(navigationUrl('MG Road')).searchParams.has('origin')).toBe(false)
  })
  it('never loads the map on key-bearing dev hostnames', () => {
    expect(canEmbedOn('abc-devserver-xyz.lovableproject.com')).toBe(false)
    expect(canEmbedOn('india-amber-atlas.lovable.app')).toBe(true)
  })
})

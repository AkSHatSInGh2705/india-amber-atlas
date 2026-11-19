import { describe, expect, it } from 'vitest'
import { listingSchema, offsetFor, toMapListing } from '@/lib/listings'

const dish = { name: 'Rajma chawal', quantity: '20 servings', bestBefore: '10:30 pm', veg: true }
const base = { kitchen: 'Sharma kitchen', area: 'Sector 45', pickupWindow: '8 – 9 pm', phone: '9876543210', items: [dish] }

describe('volunteer listings', () => {
  it('allows up to 3 dishes', () => {
    expect(listingSchema.safeParse({ ...base, items: [dish, dish, dish] }).success).toBe(true)
  })
  it('rejects a 4th dish', () => {
    expect(listingSchema.safeParse({ ...base, items: [dish, dish, dish, dish] }).success).toBe(false)
  })
  it('requires at least one dish', () => {
    expect(listingSchema.safeParse({ ...base, items: [] }).success).toBe(false)
  })
  it('rejects a phone number shorter than 10 digits', () => {
    expect(listingSchema.safeParse({ ...base, phone: '12345' }).success).toBe(false)
  })
  it('marks a listing as editable only for the account that owns it', () => {
    const row = { id: 'abc', user_id: 'owner', kitchen: 'K', area: 'A', pickup_window: 'W', items: [dish] }
    expect(toMapListing(row, 'owner').mine).toBe(true)
    expect(toMapListing(row, 'someone-else').mine).toBe(false)
    expect(toMapListing(row, null).mine).toBe(false)
  })
  it('keeps a listing on the same map spot every visit', () => {
    expect(offsetFor('listing-1')).toEqual(offsetFor('listing-1'))
  })
})

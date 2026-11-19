import { z } from 'zod'
import type { FoodItem, Vendor } from './foodbridge-data'

/** A volunteer may list at most this many dishes, and holds one listing per account. */
export const MAX_DISHES = 3
export const PHONE_RE = /^[0-9+ ]{10,14}$/

const text = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be under ${max} characters`)

export const dishSchema = z.object({
  name: text(60, 'Dish name'),
  quantity: text(40, 'Quantity'),
  bestBefore: text(40, 'Best before'),
  veg: z.boolean(),
})

export const listingSchema = z.object({
  kitchen: text(80, 'Name'),
  area: text(60, 'Area'),
  pickupWindow: text(40, 'Pickup window'),
  phone: z.string().trim().regex(PHONE_RE, 'Enter a 10–14 digit phone number'),
  items: z.array(dishSchema).min(1, 'Add at least one dish').max(MAX_DISHES, `Up to ${MAX_DISHES} dishes`),
})

export type ListingInput = z.infer<typeof listingSchema>

export type ListingRow = {
  id: string
  user_id: string
  kitchen: string
  area: string
  pickup_window: string
  items: unknown
}

/** A database listing shaped like a map vendor, plus who owns it. */
export type MapListing = Vendor & { key: string; mine: boolean }

const TINTS: [string, string][] = [
  ['#F3C9A5', '#D96B43'],
  ['#F6DFA9', '#C9893A'],
  ['#CFE0B8', '#5E8A4B'],
  ['#EBC3B0', '#B3402A'],
]

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Stable spot near the Gurugram hotspot (map units) so a listing never jumps between visits. */
export function offsetFor(id: string): [number, number] {
  const h = hash(id)
  const a = ((h % 3600) / 3600) * Math.PI * 2
  const r = 1.6 + ((h >>> 12) % 1000) / 1000 * 3.4
  return [+(Math.cos(a) * r).toFixed(2), +(Math.sin(a) * r).toFixed(2)]
}

export function parseItems(raw: unknown): FoodItem[] {
  const r = z.array(dishSchema).safeParse(raw)
  return r.success ? r.data : []
}

export function toMapListing(row: ListingRow, userId: string | null): MapListing {
  const [dx, dy] = offsetFor(row.id)
  return {
    key: row.id,
    mine: userId !== null && row.user_id === userId,
    name: row.kitchen,
    area: row.area,
    pickupWindow: row.pickup_window,
    items: parseItems(row.items),
    image: '/vendors/volunteer.png',
    dx,
    dy,
    tint: TINTS[hash(row.id) % TINTS.length],
  }
}

// Bridge to the scene engine: React publishes, the engine draws the orbs.
export const LISTINGS_EVENT = 'fb:listings'
export type ListingsDetail = { listings: MapListing[]; pop?: string | undefined }
let latest: ListingsDetail = { listings: [] }
export const latestListings = () => latest
export function publishListings(detail: ListingsDetail) {
  latest = detail
  dispatchEvent(new CustomEvent<ListingsDetail>(LISTINGS_EVENT, { detail }))
}

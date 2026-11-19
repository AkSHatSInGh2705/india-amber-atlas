import { supabase } from '@/integrations/supabase/client'
import { listingSchema, type ListingInput, type ListingRow } from './listings'

const COLS = 'id, user_id, kitchen, area, pickup_window, items'

export async function fetchListings(): Promise<ListingRow[]> {
  const { data, error } = await supabase
    .from('volunteer_listings')
    .select(COLS)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return data ?? []
}

export async function fetchMine(userId: string): Promise<{ listing: ListingRow | null; phone: string }> {
  const [l, c] = await Promise.all([
    supabase.from('volunteer_listings').select(COLS).eq('user_id', userId).maybeSingle(),
    supabase.from('volunteer_contacts').select('phone').eq('user_id', userId).maybeSingle(),
  ])
  if (l.error) throw l.error
  if (c.error) throw c.error
  return { listing: l.data, phone: c.data?.phone ?? '' }
}

/** Creates or replaces the signed-in volunteer's single listing. RLS pins it to their account. */
export async function saveListing(userId: string, input: ListingInput): Promise<ListingRow> {
  const v = listingSchema.parse(input)
  const { data, error } = await supabase
    .from('volunteer_listings')
    .upsert(
      { user_id: userId, kitchen: v.kitchen, area: v.area, pickup_window: v.pickupWindow, items: v.items },
      { onConflict: 'user_id' },
    )
    .select(COLS)
    .single()
  if (error) throw error
  const c = await supabase.from('volunteer_contacts').upsert({ user_id: userId, phone: v.phone }, { onConflict: 'user_id' })
  if (c.error) throw c.error
  return data
}

export async function deleteListing(userId: string) {
  const { error } = await supabase.from('volunteer_listings').delete().eq('user_id', userId)
  if (error) throw error
  await supabase.from('volunteer_contacts').delete().eq('user_id', userId)
}

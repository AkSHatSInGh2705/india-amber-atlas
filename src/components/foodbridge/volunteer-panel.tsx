import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useSession } from '@/hooks/use-session'
import { useInkSwap } from '@/hooks/use-ink-swap'
import { MAX_DISHES, listingSchema, parseItems, publishListings, toMapListing, type ListingRow } from '@/lib/listings'
import { deleteListing, fetchListings, fetchMine, saveListing } from '@/lib/listings-api'
import { VolunteerAuth } from './volunteer-auth'

type Row = { id: number; name: string; quantity: string; bestBefore: string; veg: boolean }
type Mine = { listing: ListingRow | null; phone: string }

let uid = 0
const blankRow = (): Row => ({ id: ++uid, name: '', quantity: '', bestBefore: '', veg: true })

export function VolunteerPanel() {
  const { user, ready } = useSession()
  const userId = user?.id ?? null
  const [mine, setMine] = useState<Mine | null>(null)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')

  const refresh = useCallback(
    async (pop?: string) => {
      try {
        const rows = await fetchListings()
        publishListings({ listings: rows.map((r) => toMapListing(r, userId)), pop })
      } catch (e) {
        console.error('Could not load listings', e)
      }
    },
    [userId],
  )
  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    setMine(null)
    setEditing(false)
    setNotice('')
    if (!userId) return
    let live = true
    fetchMine(userId)
      .then((m) => live && setMine(m))
      .catch(() => live && setMine({ listing: null, phone: '' }))
    return () => {
      live = false
    }
  }, [userId])

  const view = !ready ? 'loading' : !user ? 'auth' : !mine ? 'loading' : !mine.listing || editing ? 'form' : 'done'
  const viewRef = useInkSwap<HTMLDivElement>(view, view === 'loading')

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <section id="vl" aria-hidden="true" aria-labelledby="vlt">
      <button className="cl" id="vlx" type="button" aria-label="Close">
        ×
      </button>
      <div className="rgw">
        <div className="rgs">
          <p className="kk">Volunteer listing</p>
          <h2 id="vlt">Share your surplus</h2>
          <p>
            Restaurants, caterers and home cooks can list food that would otherwise go to waste. Your listing appears
            as a live orb on the Gurugram map, ready for a nearby NGO to collect.
          </p>
          <div className="vwhy">
            <b>Why an account?</b> So only your kitchen can edit or remove your listing. NGOs don&rsquo;t need one
            &mdash; they reserve a pickup with their Darpan ID.
          </div>
        </div>

        <div>
          {user && (
            <div className="acct">
              <span className="av" aria-hidden="true">
                {(user.email ?? '?')[0].toUpperCase()}
              </span>
              <span className="ae">{user.email}</span>
              <button type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
          <div className="vview" ref={viewRef}>
            {view === 'loading' && <p className="vload">Opening your kitchen…</p>}
            {view === 'auth' && <VolunteerAuth />}
            {view === 'form' && user && mine && (
              <ListingForm
                userId={user.id}
                initial={editing ? mine : null}
                notice={notice}
                onCancel={editing ? () => setEditing(false) : undefined}
                onSaved={(listing, phone, isNew) => {
                  setMine({ listing, phone })
                  setEditing(false)
                  setNotice('')
                  refresh(isNew ? listing.id : undefined)
                }}
              />
            )}
            {view === 'done' && user && mine?.listing && (
              <ListingDone
                listing={mine.listing}
                onEdit={() => setEditing(true)}
                onDelete={async () => {
                  await deleteListing(user.id)
                  setMine({ listing: null, phone: '' })
                  setNotice('Listing deleted. You can add a new one below.')
                  refresh()
                }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function ListingDone({ listing, onEdit, onDelete }: { listing: ListingRow; onEdit: () => void; onDelete: () => Promise<void> }) {
  const [arm, setArm] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  const items = parseItems(listing.items)

  async function del() {
    if (!arm) {
      setArm(true)
      t.current = window.setTimeout(() => setArm(false), 3500)
      return
    }
    window.clearTimeout(t.current)
    setBusy(true)
    try {
      await onDelete()
    } catch {
      setBusy(false)
      setArm(false)
    }
  }

  return (
    <div id="vdone" aria-live="polite">
      <p className="kk">Your listing is live</p>
      <h3>{listing.kitchen}</h3>
      <p className="win">
        {listing.area}, Gurugram · pickup <b>{listing.pickup_window}</b>
      </p>
      <ul>
        {items.map((it, i) => (
          <li key={i}>
            <div>
              <b>{it.name}</b>
              <span>
                {it.quantity} · best before {it.bestBefore}
              </span>
            </div>
            <em className={it.veg ? 'v' : 'n'}>{it.veg ? 'Veg' : 'Non-veg'}</em>
          </li>
        ))}
      </ul>
      <div className="vact">
        <button className="btn" type="button" onClick={() => dispatchEvent(new Event('fb:vol-show'))}>
          See it on the map
        </button>
        <button className="vedit" type="button" onClick={onEdit}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
          </svg>
          Edit listing
        </button>
        <button className={`vdel${arm ? ' arm' : ''}`} type="button" onClick={del} disabled={busy}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" />
          </svg>
          {busy ? 'Deleting…' : arm ? 'Tap again to delete' : 'Delete listing'}
        </button>
      </div>
    </div>
  )
}

function ListingForm({
  userId,
  initial,
  notice,
  onSaved,
  onCancel,
}: {
  userId: string
  initial: Mine | null
  notice: string
  onSaved: (l: ListingRow, phone: string, isNew: boolean) => void
  onCancel?: (() => void) | undefined
}) {
  const editing = !!initial?.listing
  const [rows, setRows] = useState<Row[]>(() => {
    const items = initial?.listing ? parseItems(initial.listing.items) : []
    return items.length ? items.map((it) => ({ id: ++uid, ...it })) : [blankRow()]
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const update = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    if (busy || !form.reportValidity()) return
    const data = new FormData(form)
    const parsed = listingSchema.safeParse({
      kitchen: data.get('kitchen'),
      area: data.get('area'),
      pickupWindow: data.get('window'),
      phone: data.get('phone'),
      items: rows.map(({ name, quantity, bestBefore, veg }) => ({ name, quantity, bestBefore, veg })),
    })
    if (!parsed.success) return setErr(parsed.error.issues[0].message)
    setErr('')
    setBusy(true)
    try {
      const row = await saveListing(userId, parsed.data)
      onSaved(row, parsed.data.phone, !editing)
    } catch (e2) {
      console.error(e2)
      setErr('Couldn’t save your listing. Please try again.')
      setBusy(false)
    }
  }

  const l = initial?.listing
  return (
    <form id="vf" noValidate onSubmit={submit}>
      <h3>{editing ? 'Edit your listing' : 'List your food'}</h3>
      {notice && (
        <p className="vgone" role="status">
          {notice}
        </p>
      )}
      <label>
        Restaurant or volunteer name
        <input name="kitchen" required maxLength={80} autoComplete="off" placeholder="e.g. Sharma family kitchen" defaultValue={l?.kitchen} />
      </label>
      <div className="vgrid">
        <label>
          Area
          <input name="area" required maxLength={60} autoComplete="off" placeholder="e.g. Sector 45" defaultValue={l?.area} />
        </label>
        <label>
          Pickup window
          <input name="window" required maxLength={40} autoComplete="off" placeholder="e.g. 8:00 – 9:30 pm" defaultValue={l?.pickup_window} />
        </label>
      </div>
      <label>
        Phone number
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          required
          pattern="[0-9+ ]{10,14}"
          defaultValue={initial?.phone}
        />
      </label>

      <fieldset className="vitems">
        <legend>Food available</legend>
        {rows.map((r, i) => (
          <div className="vitem" key={r.id}>
            <div className="vhead">
              <span>Dish {i + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="vrm"
                  aria-label={`Remove dish ${i + 1}`}
                  onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                >
                  ×
                </button>
              )}
            </div>
            <label>
              Dish name
              <input required maxLength={60} autoComplete="off" placeholder="e.g. Rajma chawal" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
            </label>
            <div className="vgrid">
              <label>
                Quantity
                <input required maxLength={40} autoComplete="off" placeholder="e.g. 20 servings" value={r.quantity} onChange={(e) => update(r.id, { quantity: e.target.value })} />
              </label>
              <label>
                Best before
                <input required maxLength={40} autoComplete="off" placeholder="e.g. 10:30 pm" value={r.bestBefore} onChange={(e) => update(r.id, { bestBefore: e.target.value })} />
              </label>
            </div>
            <div className="seg" role="group" aria-label={`Dish ${i + 1} type`}>
              <button type="button" aria-pressed={r.veg} onClick={() => update(r.id, { veg: true })}>
                Veg
              </button>
              <button type="button" className="n" aria-pressed={!r.veg} onClick={() => update(r.id, { veg: false })}>
                Non-veg
              </button>
            </div>
          </div>
        ))}
        {rows.length < MAX_DISHES && (
          <button type="button" className="vadd" onClick={() => setRows((rs) => [...rs, blankRow()])}>
            + Add another dish
          </button>
        )}
      </fieldset>

      {err && (
        <p className="aerr" role="alert">
          {err}
        </p>
      )}
      <button type="submit" className="btn vsub" disabled={busy}>
        {busy ? 'Saving…' : editing ? 'Save changes' : 'Put it on the map'}
      </button>
      {onCancel && (
        <button type="button" className="alink vcancel" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  )
}

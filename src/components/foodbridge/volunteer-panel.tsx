

import { useRef, useState, type FormEvent } from 'react'
import type { Vendor } from '@/lib/foodbridge-data'

type Row = { id: number; name: string; quantity: string; bestBefore: string; veg: boolean }

const MAX_ITEMS = 3
let uid = 0
const blankRow = (): Row => ({ id: ++uid, name: '', quantity: '', bestBefore: '', veg: true })

export function VolunteerPanel() {
  const formRef = useRef<HTMLFormElement>(null)
  const [rows, setRows] = useState<Row[]>(() => [blankRow()])
  const [entry, setEntry] = useState<Vendor | null>(null)
  const [removed, setRemoved] = useState(false)

  const update = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    if (entry || !form.reportValidity()) return
    const data = new FormData(form)
    const vendor: Vendor = {
      name: String(data.get('kitchen')).trim(),
      area: String(data.get('area')).trim(),
      image: '/vendors/volunteer.png',
      dx: -2.4,
      dy: 0.2,
      pickupWindow: String(data.get('window')).trim(),
      items: rows.map((r) => ({
        name: r.name.trim(),
        quantity: r.quantity.trim(),
        veg: r.veg,
        bestBefore: r.bestBefore.trim(),
      })),
      tint: ['#F3C9A5', '#D96B43'],
    }
    setEntry(vendor)
    setRemoved(false)
    dispatchEvent(new CustomEvent<Vendor>('fb:vol-add', { detail: vendor }))
  }

  function remove() {
    setEntry(null)
    setRows([blankRow()])
    setRemoved(true)
    formRef.current?.reset()
    dispatchEvent(new Event('fb:vol-del'))
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
          <p className="vcap">Demo: one listing per visitor. Nothing is saved or sent.</p>
        </div>

        <div>
          {entry ? (
            <div id="vdone" aria-live="polite">
              <p className="kk">Your listing is live</p>
              <h3>{entry.name}</h3>
              <p className="win">
                {entry.area}, Gurugram · pickup <b>{entry.pickupWindow}</b>
              </p>
              <ul>
                {entry.items.map((it, i) => (
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
                <button className="vdel" type="button" onClick={remove}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" />
                  </svg>
                  Delete listing
                </button>
              </div>
            </div>
          ) : (
            <form id="vf" ref={formRef} noValidate onSubmit={submit}>
              <h3>List your food</h3>
              {removed && (
                <p className="vgone" role="status">
                  Listing deleted. You can add a new one below.
                </p>
              )}
              <label>
                Restaurant or volunteer name
                <input name="kitchen" required autoComplete="off" placeholder="e.g. Sharma family kitchen" />
              </label>
              <div className="vgrid">
                <label>
                  Area
                  <input name="area" required autoComplete="off" placeholder="e.g. Sector 45" />
                </label>
                <label>
                  Pickup window
                  <input name="window" required autoComplete="off" placeholder="e.g. 8:00 – 9:30 pm" />
                </label>
              </div>
              <label>
                Phone number
                <input name="phone" type="tel" inputMode="tel" required pattern="[0-9+ ]{10,14}" />
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
                      <input
                        required
                        autoComplete="off"
                        placeholder="e.g. Rajma chawal"
                        value={r.name}
                        onChange={(e) => update(r.id, { name: e.target.value })}
                      />
                    </label>
                    <div className="vgrid">
                      <label>
                        Quantity
                        <input
                          required
                          autoComplete="off"
                          placeholder="e.g. 20 servings"
                          value={r.quantity}
                          onChange={(e) => update(r.id, { quantity: e.target.value })}
                        />
                      </label>
                      <label>
                        Best before
                        <input
                          required
                          autoComplete="off"
                          placeholder="e.g. 10:30 pm"
                          value={r.bestBefore}
                          onChange={(e) => update(r.id, { bestBefore: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="seg" role="group" aria-label={`Dish ${i + 1} type`}>
                      <button type="button" aria-pressed={r.veg} onClick={() => update(r.id, { veg: true })}>
                        Veg
                      </button>
                      <button
                        type="button"
                        className="n"
                        aria-pressed={!r.veg}
                        onClick={() => update(r.id, { veg: false })}
                      >
                        Non-veg
                      </button>
                    </div>
                  </div>
                ))}
                {rows.length < MAX_ITEMS && (
                  <button type="button" className="vadd" onClick={() => setRows((rs) => [...rs, blankRow()])}>
                    + Add another dish
                  </button>
                )}
              </fieldset>

              <button type="submit" className="btn vsub">
                Put it on the map
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

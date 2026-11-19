const VEHICLES = [
  ['Two-wheeler', 'up to 20 kg'],
  ['Car', 'up to 60 kg'],
  ['Van', 'up to 200 kg'],
  ['Mini truck', '200 kg+'],
] as const

export function RegistrationPanel() {
  return (
    <section id="rg" aria-hidden="true" aria-labelledby="rgv">
      <button className="cl" id="rgx" type="button" aria-label="Close">
        ×
      </button>
      <div className="rgw">
        <div className="rgs">
          <p className="kk">Pickup request</p>
          <h2 id="rgv" />
          <p id="rgm" />
          <ul id="rgi" />
        </div>
        <div>
          <form id="rf" noValidate>
            <h3>Register your NGO</h3>
            <p className="rnote">No account needed. Your Darpan ID verifies your NGO.</p>
            <label>
              NGO name
              <input name="ngo" required autoComplete="off" />
            </label>
            <label>
              Registration / Darpan ID
              <input name="darpan" required autoComplete="off" placeholder="e.g. HR/2020/0000000" />
            </label>
            <label>
              Contact person
              <input name="contact" required autoComplete="off" />
            </label>
            <label>
              Phone number
              <input name="phone" type="tel" inputMode="tel" required pattern="[0-9+ ]{10,14}" />
            </label>
            <div className="fld">
              <span id="vlbl">Pickup vehicle &amp; capacity</span>
              <div className="sel" id="vsel">
                <button
                  type="button"
                  id="vbtn"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                  aria-controls="vlist"
                  aria-labelledby="vlbl vlab"
                >
                  <span id="vlab">Select…</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <ul id="vlist" role="listbox" aria-labelledby="vlbl">
                  {VEHICLES.map(([kind, cap]) => (
                    <li key={kind} role="option" aria-selected="false" tabIndex={-1} data-v={`${kind} · ${cap}`}>
                      {kind}
                      <small>{cap}</small>
                    </li>
                  ))}
                </ul>
                <input id="vin" name="vehicle" required defaultValue="" tabIndex={-1} aria-hidden="true" />
              </div>
            </div>
            <label>
              Area of operation
              <input name="area" required autoComplete="off" placeholder="e.g. Sectors 14–31, Gurugram" />
            </label>
            <div className="vow">
              <button
                type="button"
                id="vow"
                role="checkbox"
                aria-checked="false"
                aria-label="I vow to never let any food go to waste"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path id="tk" d="M5 12.5l4.5 4.5L19 7" />
                </svg>
              </button>
              <span>I vow to never let any food go to waste</span>
            </div>
            <div id="sub">
              <svg width="0" height="0" className="goo-defs" aria-hidden="true">
                <filter id="goo" x="-20%" y="-500%" width="140%" height="1100%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="9" />
                  <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
                </filter>
              </svg>
              <div className="gl">
                <i className="base">
                  <b className="fl" />
                </i>
                <i className="blob" />
              </div>
              <i className="orb" />
              <i className="orb" />
              <i className="orb" />
              <i className="orb" />
              <button type="submit" id="sbtn" disabled>
                Register Now
              </button>
            </div>
          </form>
          <div id="ok" aria-live="polite" />
        </div>
      </div>
    </section>
  )
}

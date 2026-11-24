export function VendorDrawer() {
  return (
    <aside id="dr" aria-hidden="true" aria-labelledby="drn">
      <button className="cl" id="drx" type="button" aria-label="Close">
        ×
      </button>
      <div className="ph" id="drph">
        {/* src is set by the scene engine when a vendor pin is opened */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img id="drimg" alt="" />
      </div>
      <div className="drb">
        <p className="kk" id="drloc" />
        <h3 id="drn" />
        <p className="win" id="drw" />
        <ul id="dri" />
        <p className="note" id="drnote">Simulated vendor · demo data</p>
        <div className="dra">
          <button className="btn" id="reg" type="button">
            Register to Collect
          </button>
          {/* shown by the scene engine once this NGO has reserved the pickup */}
          <button className="btn" id="dgo" type="button" hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 11l18-8-8 18-2-8-8-2z" />
            </svg>
            Take me there
          </button>
        </div>
      </div>
    </aside>
  )
}

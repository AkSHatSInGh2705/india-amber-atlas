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
        <button className="btn" id="reg" type="button">
          Register to Collect
        </button>
      </div>
    </aside>
  )
}

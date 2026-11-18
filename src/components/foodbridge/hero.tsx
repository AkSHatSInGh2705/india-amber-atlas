export function Hero() {
  return (
    <section id="hero" aria-labelledby="hero-title">
      <p className="kick">Capstone Project · B.Tech CSE · Bennett University</p>
      <h1 id="hero-title">
        Food<em>Bridge</em>
      </h1>
      <h2>Local food-surplus redistribution</h2>
      <p className="lede">
        Connecting surplus food to people who need it. A web app for donors, a mobile app for NGOs and individuals.
      </p>
      <blockquote>Good food is thrown away while people nearby go hungry.</blockquote>
      <div className="chips">
        <span>
          <b>SDG 2</b>Zero Hunger
        </span>
        <span>
          <b>SDG 12</b>Responsible Consumption &amp; Production
        </span>
      </div>
      <a className="btn" id="go" href="#how">
        See how it works{' '}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 2v12M3 9l5 5 5-5" />
        </svg>
      </a>
    </section>
  )
}

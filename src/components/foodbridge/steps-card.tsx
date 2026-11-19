import { STEPS } from '@/lib/foodbridge-data'

export function StepsCard() {
  return (
    <aside id="steps" aria-live="polite" aria-label="How FoodBridge works">
      <ol id="seg">
        {STEPS.map(([title]) => (
          <li key={title}>
            <span>{title}</span>
            <i />
          </li>
        ))}
      </ol>
      <div id="sn" />
      <h3 id="st" />
      <p id="sd" />
      <span id="sx" />
      <a id="snext" href="#vcta">
        <span className="mouse" aria-hidden="true">
          <i />
        </span>
        <span className="snt">
          <small>Scroll to do your part</small>
          <b>
            Register as a <em>donor</em>
          </b>
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </a>
    </aside>
  )
}

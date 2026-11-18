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
    </aside>
  )
}

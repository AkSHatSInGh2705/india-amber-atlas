

import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __fbPrompt?: InstallPromptEvent | null
    __fbInstalled?: boolean
    __fbLive?: boolean
  }
}

type Mode = 'hidden' | 'prompt' | 'popout'

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

async function runPrompt() {
  const evt = window.__fbPrompt
  if (!evt) return false
  window.__fbPrompt = null
  await evt.prompt()
  const { outcome } = await evt.userChoice
  if (outcome === 'accepted') window.__fbInstalled = true
  return true
}

export function InstallButton() {
  const [mode, setMode] = useState<Mode>('hidden')
  const [live, setLive] = useState(false)

  useEffect(() => {
    const syncLive = () => setLive(window.__fbLive === true)
    syncLive()
    window.addEventListener('fb:live', syncLive)
    return () => window.removeEventListener('fb:live', syncLive)
  }, [])

  useEffect(() => {
    if (isStandalone()) return
    // Browsers never fire the install prompt inside an iframe (e.g. an embedded preview),
    // so there the button opens the app in its own tab, which installs on the first click.
    const embedded = window.self !== window.top
    const sync = () => {
      if (window.__fbInstalled || isStandalone()) setMode('hidden')
      else if (window.__fbPrompt) setMode('prompt')
      else setMode(embedded ? 'popout' : 'hidden')
    }
    sync()
    window.addEventListener('fb:installable', sync)
    window.addEventListener('appinstalled', sync)

    // Opened from the pop-out: browsers only allow prompt() inside a user gesture,
    // so the native install dialog opens on the very first click or key press.
    let armed = false
    const autoInstall = async () => {
      if (!window.__fbPrompt) return
      disarm()
      await runPrompt()
      sync()
    }
    const disarm = () => {
      window.removeEventListener('pointerdown', autoInstall, true)
      window.removeEventListener('keydown', autoInstall, true)
    }
    const url = new URL(window.location.href)
    if (url.searchParams.has('install')) {
      url.searchParams.delete('install')
      history.replaceState(null, '', url.pathname + url.search + url.hash)
      if (!embedded) {
        armed = true
        window.addEventListener('pointerdown', autoInstall, true)
        window.addEventListener('keydown', autoInstall, true)
      }
    }

    return () => {
      window.removeEventListener('fb:installable', sync)
      window.removeEventListener('appinstalled', sync)
      if (armed) disarm()
    }
  }, [])

  if (mode === 'hidden' || !live) return null

  async function handleClick() {
    if (!window.__fbPrompt) {
      if (mode === 'popout') window.open(`${window.location.origin}/?install=1`, '_blank', 'noopener')
      return
    }
    await runPrompt()
    setMode(window.__fbPrompt ? 'prompt' : 'hidden')
  }

  return (
    <div className="install">
      <button type="button" className="install-btn" onClick={handleClick}>
        <span className="ic" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 2v8.5M4 7l4 4 4-4M3 14h10" />
          </svg>
        </span>
        <span className="lbl">
          Download app
          <small>Installs · works offline</small>
        </span>
      </button>
    </div>
  )
}

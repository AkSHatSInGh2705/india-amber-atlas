

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Registration fails in some sandboxed iframes; the site still works without offline support.
    })
  }, [])

  return null
}

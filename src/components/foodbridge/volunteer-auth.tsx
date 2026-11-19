import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import gsap from 'gsap'
import { z } from 'zod'
import { LovableMark } from '@lovable.dev/cloud-auth-js/react'
import { supabase } from '@/integrations/supabase/client'
import { lovable } from '@/integrations/lovable/index'
import { useInkSwap } from '@/hooks/use-ink-swap'

type Mode = 'signup' | 'signin' | 'check'

const emailField = z.string().trim().email('Enter a valid email address').max(255)

function friendly(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'That email and password don’t match an account.'
  if (m.includes('email not confirmed')) return 'Confirm your email first — the link is in your inbox.'
  if (m.includes('already registered')) return 'An account with this email already exists. Sign in instead.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.'
  if (m.includes('password')) return msg
  return 'Something went wrong. Please try again.'
}

function GoogleG() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  )
}

export function VolunteerAuth() {
  const [mode, setMode] = useState<Mode>('signup')
  const [busy, setBusy] = useState<null | 'email' | 'google' | 'lovable'>(null)
  const [err, setErr] = useState('')
  const [sentTo, setSentTo] = useState('')
  const body = useInkSwap<HTMLDivElement>(mode)
  const tabs = useRef<HTMLDivElement>(null)
  const blob = useRef<HTMLElement>(null)
  const errRef = useRef<HTMLParagraphElement>(null)
  const placed = useRef(false)

  // The active-tab pill slides like a drop of ink: stretches on the move, settles with a wobble
  useLayoutEffect(() => {
    if (mode === 'check' || !tabs.current || !blob.current) return
    const t = tabs.current.querySelector<HTMLElement>(`[data-m="${mode}"]`)
    if (!t) return
    const to = { x: t.offsetLeft - 4, width: t.offsetWidth }
    if (!placed.current) {
      placed.current = true
      gsap.set(blob.current, to)
      return
    }
    gsap
      .timeline()
      .to(blob.current, { ...to, scaleY: 0.78, duration: 0.32, ease: 'power3.inOut' })
      .to(blob.current, { scaleY: 1, duration: 0.7, ease: 'elastic.out(1,.45)' })
  }, [mode])

  useLayoutEffect(() => {
    if (err && errRef.current)
      gsap.fromTo(errRef.current, { x: 0 }, { keyframes: { x: [0, -7, 7, -4, 4, 0] }, duration: 0.45, ease: 'sine.inOut' })
  }, [err])

  function switchTo(m: Mode) {
    if (m === mode) return
    setErr('')
    setMode(m)
  }

  async function oauth(p: 'google' | 'lovable') {
    setErr('')
    setBusy(p)
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin })
    if (r.redirected) return
    setBusy(null)
    if (r.error) setErr(`Couldn’t sign in with ${p === 'google' ? 'Google' : 'Lovable'}. Please try again.`)
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    if (!form.reportValidity()) return
    const fd = new FormData(form)
    const email = emailField.safeParse(fd.get('email'))
    const password = String(fd.get('password') ?? '')
    if (!email.success) return setErr(email.error.issues[0].message)
    if (mode === 'signup' && password.length < 8) return setErr('Use at least 8 characters for your password.')
    setErr('')
    setBusy('email')
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.data,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      setBusy(null)
      if (error) return setErr(friendly(error.message))
      if (!data.session) {
        setSentTo(email.data)
        setMode('check')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.data, password })
      setBusy(null)
      if (error) setErr(friendly(error.message))
    }
  }

  return (
    <div id="va">
      {mode !== 'check' && (
        <div className="atabs" ref={tabs}>
          <i className="ablob" ref={blob} aria-hidden="true" />
          <button type="button" data-m="signup" aria-pressed={mode === 'signup'} onClick={() => switchTo('signup')}>
            Create account
          </button>
          <button type="button" data-m="signin" aria-pressed={mode === 'signin'} onClick={() => switchTo('signin')}>
            Sign in
          </button>
        </div>
      )}

      <div className="abody" ref={body}>
        {mode === 'check' ? (
          <div className="acheck" aria-live="polite">
            <span className="aic" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="M4 7l8 6 8-6" />
              </svg>
            </span>
            <h3>Check your inbox</h3>
            <p>
              We sent a confirmation link to <b>{sentTo}</b>. Open it to activate your kitchen account, then come back
              to list your food.
            </p>
            <button type="button" className="alink" onClick={() => switchTo('signin')}>
              Already confirmed? Sign in
            </button>
          </div>
        ) : (
          <>
            <h3>{mode === 'signup' ? 'Create your kitchen account' : 'Welcome back'}</h3>
            <p className="asub">
              {mode === 'signup'
                ? 'One account per restaurant or home kitchen. Only you can edit or remove what you list.'
                : 'Sign in to add, edit or remove your listing.'}
            </p>
            <div className="aoauth">
              <button type="button" className="aprov g" disabled={!!busy} onClick={() => oauth('google')}>
                <GoogleG />
                {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
              </button>
              <button type="button" className="aprov l" disabled={!!busy} onClick={() => oauth('lovable')}>
                <LovableMark className="lm" />
                {busy === 'lovable' ? 'Opening Lovable…' : 'Continue with Lovable'}
              </button>
            </div>
            <p className="aor">or with email</p>
            <form noValidate onSubmit={submit}>
              <label>
                Email
                <input name="email" type="email" required autoComplete="email" placeholder="you@kitchen.in" maxLength={255} />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  maxLength={72}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
                />
              </label>
              {err && (
                <p className="aerr" role="alert" ref={errRef}>
                  {err}
                </p>
              )}
              <button type="submit" className="btn asend" disabled={!!busy}>
                {busy === 'email'
                  ? mode === 'signup'
                    ? 'Creating account…'
                    : 'Signing in…'
                  : mode === 'signup'
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

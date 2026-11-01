import { useState, type FormEvent } from 'react'
import { sendMagicLink, verifyCode } from '../lib/auth.ts'
import { supabaseConfigured } from '../lib/supabase.ts'

type Step = 'email' | 'code'

export default function Login() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitEmail(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    const res = await sendMagicLink(email.trim())
    setBusy(false)
    if (res.error) setError(res.error)
    else setStep('code')
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault()
    const digits = code.replace(/\D/g, '')
    if (digits.length < 6) return
    setBusy(true)
    setError(null)
    const res = await verifyCode(email.trim(), digits)
    setBusy(false)
    if (res.error) setError(res.error)
    // On success the auth listener in App swaps this page for the app.
  }

  return (
    <main className="min-h-screen bg-ground text-ink flex flex-col px-5 pt-16 pb-10 max-w-md mx-auto">
      <p className="font-sans text-xs uppercase tracking-[0.18em] text-muted">Iron Master</p>
      <h1 className="font-display font-extrabold text-5xl leading-none mt-2 uppercase">Sign in</h1>

      {!supabaseConfigured && (
        <p className="mt-6 rounded-lg border border-line bg-surface p-4 font-sans text-sm text-plate-yellow">
          Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.
        </p>
      )}

      {step === 'email' ? (
        <>
          <p className="font-sans text-muted mt-3">An email brings a 6-digit code and a link. Either one signs you in.</p>
          <form onSubmit={submitEmail} className="mt-8 flex flex-col gap-3">
            <label className="font-sans text-sm text-muted" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="min-h-12 rounded-md border border-line bg-surface px-4 font-sans text-base text-ink outline-none focus:border-plate-green"
              placeholder="you@example.com"
            />
            <button
              type="submit"
              disabled={busy || !supabaseConfigured}
              className="min-h-12 rounded-md bg-plate-green text-ground font-display font-bold text-lg uppercase tracking-wide disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="font-sans text-muted mt-3">
            Sent to <span className="text-ink">{email}</span>. Type the 6-digit code, or tap the link in the email.
          </p>
          <form onSubmit={submitCode} className="mt-8 flex flex-col gap-3">
            <label className="font-sans text-sm text-muted" htmlFor="code">
              Code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="min-h-12 rounded-md border border-line bg-surface px-4 font-mono text-2xl tracking-[0.4em] text-ink outline-none focus:border-plate-green"
              placeholder="123456"
            />
            <button
              type="submit"
              disabled={busy || code.length < 6}
              className="min-h-12 rounded-md bg-plate-green text-ground font-display font-bold text-lg uppercase tracking-wide disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setCode('')
                setError(null)
              }}
              className="min-h-11 rounded-md border border-line font-sans text-sm text-muted"
            >
              Send a new code
            </button>
          </form>
        </>
      )}

      {error && <p className="mt-4 font-sans text-sm text-plate-red">{error}</p>}
    </main>
  )
}

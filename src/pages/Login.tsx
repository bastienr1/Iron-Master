import { useState, type FormEvent } from 'react'
import { sendMagicLink } from '../lib/auth.ts'
import { supabaseConfigured } from '../lib/supabase.ts'

export default function Login() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setState('sending')
    const { error } = await sendMagicLink(email.trim())
    if (error) {
      setState('error')
      setMessage(error)
    } else {
      setState('sent')
    }
  }

  return (
    <main className="min-h-screen bg-ground text-ink flex flex-col px-5 pt-16 pb-10 max-w-md mx-auto">
      <p className="font-sans text-xs uppercase tracking-[0.18em] text-muted">Iron Master</p>
      <h1 className="font-display font-extrabold text-5xl leading-none mt-2 uppercase">Sign in</h1>
      <p className="font-sans text-muted mt-3">A link lands in your inbox. Tap it on this phone.</p>

      {!supabaseConfigured && (
        <p className="mt-6 rounded-lg border border-line bg-surface p-4 font-sans text-sm text-plate-yellow">
          Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.
        </p>
      )}

      {state === 'sent' ? (
        <div className="mt-8 rounded-lg border border-line bg-surface p-5">
          <p className="font-display font-bold text-2xl text-plate-green uppercase">Link sent</p>
          <p className="font-sans text-muted mt-1">Check {email}. The link signs you in here.</p>
          <button
            type="button"
            onClick={() => setState('idle')}
            className="mt-4 min-h-11 px-4 rounded-md border border-line font-sans text-sm text-ink"
          >
            Use another address
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
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
            disabled={state === 'sending' || !supabaseConfigured}
            className="min-h-12 rounded-md bg-plate-green text-ground font-display font-bold text-lg uppercase tracking-wide disabled:opacity-50"
          >
            {state === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
          {state === 'error' && <p className="font-sans text-sm text-plate-red">{message}</p>}
        </form>
      )}
    </main>
  )
}

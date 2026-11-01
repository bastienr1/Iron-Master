/**
 * /auth/confirm?token_hash=…&type=email
 *
 * The email link points here instead of at Supabase's /verify endpoint, so a
 * mail scanner or a chat app fetching the URL for a preview gets plain HTML
 * and does not consume the token. The token is only redeemed when this page
 * runs in a real browser.
 */
import { useEffect, useState } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { verifyTokenHash } from '../lib/auth.ts'

const OTP_TYPES: readonly EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change']

export default function Confirm() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const rawType = params.get('type') ?? 'email'
    const type = (OTP_TYPES as readonly string[]).includes(rawType) ? (rawType as EmailOtpType) : 'email'
    if (!tokenHash) {
      setError('This link is missing its token. Request a new code from the sign-in page.')
      return
    }
    verifyTokenHash(tokenHash, type).then(res => {
      if (res.error) setError(res.error)
      else window.history.replaceState(null, '', '/progress')
      // On success the auth listener in App renders the app.
    })
  }, [])

  return (
    <main className="min-h-screen bg-ground text-ink flex flex-col px-5 pt-16 pb-10 max-w-md mx-auto">
      <p className="font-sans text-xs uppercase tracking-[0.18em] text-muted">Iron Master</p>
      {error ? (
        <>
          <h1 className="font-display font-extrabold text-4xl leading-none mt-2 uppercase text-plate-red">Link didn't work</h1>
          <p className="font-sans text-muted mt-3">{error}</p>
          <a
            href="/"
            className="mt-6 min-h-12 inline-flex items-center justify-center rounded-md bg-plate-green text-ground font-display font-bold text-lg uppercase tracking-wide"
          >
            Back to sign in
          </a>
        </>
      ) : (
        <>
          <h1 className="font-display font-extrabold text-4xl leading-none mt-2 uppercase">Signing you in…</h1>
          <p className="font-sans text-muted mt-3">One moment.</p>
        </>
      )}
    </main>
  )
}

import { useEffect, useState } from 'react'
import type { EmailOtpType, User } from '@supabase/supabase-js'
import { supabase } from './supabase.ts'

export function useSession() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}

/**
 * Sends the sign-in email. With the Magic Link template carrying both
 * `{{ .Token }}` and a `/auth/confirm?token_hash=…` link, the user can either
 * type the 6-digit code here or tap the link; neither is consumed by mail
 * scanners or chat link previews, which only fetch HTML.
 */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/confirm`, shouldCreateUser: false },
  })
  return { error: error?.message ?? null }
}

/** Verify the 6-digit code from the email. */
export async function verifyCode(email: string, code: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
  return { error: error?.message ?? null }
}

/** Verify a `token_hash` from the email link, on the in-app confirm page. */
export async function verifyTokenHash(tokenHash: string, type: EmailOtpType): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  return { error: error?.message ?? null }
}

export async function signOut() {
  await supabase.auth.signOut()
}

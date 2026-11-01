/**
 * Prints a one-time 6-digit sign-in code (and an in-app confirm link) for
 * IMPORT_USER_EMAIL, without sending an email. Useful when Supabase's built-in
 * mailer is rate-limited (2 emails per hour) or for testing on this PC.
 * Local use only: needs the service-role key from .env.local.
 *
 *   npx tsx scripts/dev-signin-link.ts                 # link for http://localhost:3000
 *   npx tsx scripts/dev-signin-link.ts https://iron-master-sable.vercel.app
 *
 * Type the code into the app's sign-in screen after entering the same email,
 * or open the printed link in the browser where you want the session.
 * Both are consumed on first use and expire after an hour.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const envFile = resolve(process.cwd(), '.env.local')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.IMPORT_USER_EMAIL
const site = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')
if (!url || !key || !email) {
  console.error('Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and IMPORT_USER_EMAIL in .env.local')
  process.exit(2)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin
const { data, error } = await admin.generateLink({ type: 'magiclink', email })
if (error || !data.properties) {
  console.error(error?.message ?? 'no link returned')
  process.exit(1)
}
const p = data.properties
console.log(`Email: ${email}`)
console.log(`Code:  ${p.email_otp}`)
console.log(`Link:  ${site}/auth/confirm?token_hash=${p.hashed_token}&type=magiclink`)

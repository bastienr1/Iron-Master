/**
 * Prints a one-time magic-link URL for IMPORT_USER_EMAIL so the app can be
 * tested on this PC without waiting for an email. Local use only: needs the
 * service-role key from .env.local and never runs in the browser.
 *
 *   npx tsx scripts/dev-signin-link.ts
 *
 * The link redirects to the project's Site URL (http://localhost:3000 by
 * default), so run `npm run dev -- --port 3000` first.
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
if (!url || !key || !email) {
  console.error('Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and IMPORT_USER_EMAIL in .env.local')
  process.exit(2)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin
const { data, error } = await admin.generateLink({ type: 'magiclink', email })
if (error || !data.properties?.action_link) {
  console.error(error?.message ?? 'no link returned')
  process.exit(1)
}
console.log(data.properties.action_link)

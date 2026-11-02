/**
 * Calls the parse-log Edge Function as your user, from this PC, and prints the
 * cards it returns. Signs in silently (service-role → one-time code → session);
 * no token is ever printed.
 *
 *   npx tsx scripts/test-parse-log.ts "Front squat 45 for 10, 10, 10, 10"
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { timeHm, todayIso } from '../src/lib/dates.ts'
import { EXERCISES } from '../src/lib/exercises.ts'
import { MEAL_LIBRARY } from '../supabase/seed/meals.ts'
import { validateParseResponse } from '../src/lib/logCards.ts'

const envFile = resolve(process.cwd(), '.env.local')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
}
const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.IMPORT_USER_EMAIL
const text = process.argv.slice(2).join(' ').trim()
if (!url || !anon || !service || !email) {
  console.error('Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, IMPORT_USER_EMAIL in .env.local')
  process.exit(2)
}
if (!text) {
  console.error('Usage: npx tsx scripts/test-parse-log.ts "<what you ate or lifted>"')
  process.exit(2)
}

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin
const { data: link, error: linkErr } = await admin.generateLink({ type: 'magiclink', email })
if (linkErr || !link.properties?.email_otp) {
  console.error(linkErr?.message ?? 'no code')
  process.exit(1)
}
const user = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: sess, error: otpErr } = await user.auth.verifyOtp({ email, token: link.properties.email_otp, type: 'email' })
if (otpErr || !sess.session) {
  console.error(otpErr?.message ?? 'no session')
  process.exit(1)
}

const context = {
  date: todayIso(),
  time: timeHm(),
  exercises: Object.entries(EXERCISES).map(([key, e]) => ({ key, name: e.name, loading: e.loading, aliases: e.aliases })),
  meal_library: MEAL_LIBRARY.map(m => ({ name: m.name, portion: m.portion, kcal: m.kcal, protein_g: m.protein_g, fiber_g: m.fiber_g, accuracy: m.accuracy })),
  today: null,
}

const started = Date.now()
const { data, error } = await user.functions.invoke('parse-log', { body: { text, context } })
console.log(`parse-log answered in ${Date.now() - started} ms`)
if (error) {
  console.error('error:', error.message)
  const ctx = (error as { context?: Response }).context
  if (ctx) console.error(await ctx.text().catch(() => ''))
  process.exit(1)
}
console.log(JSON.stringify(data, null, 2))
const valid = validateParseResponse(data, new Set(Object.keys(EXERCISES)))
console.log(`\nvalidated: ${valid.cards.length} card(s) · reply: ${valid.reply}`)

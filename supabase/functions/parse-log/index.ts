/**
 * parse-log — turns one sentence ("Lunch at JT's, chicken 206 g…",
 * "Front squat 45 for 10, 10, 10, 10") into structured cards the app shows
 * for confirmation. Claude parses; nothing is saved here. The Claude API key
 * lives only in this function's secrets (ANTHROPIC_API_KEY).
 *
 * POST { text, context } with the user's Supabase JWT → { cards, reply }.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import { z } from 'npm:zod'
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk/helpers/zod'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const Accuracy = z.enum(['label', 'weighed', 'estimated'])

const Card = z.object({
  kind: z.enum(['set', 'meal', 'weigh_in', 'water', 'activity', 'note']),
  // set
  exercise_key: z.string().nullable(),
  raw_name: z.string().nullable(),
  load_kg: z.number().nullable(),
  implements: z.number().nullable(),
  sets: z
    .array(z.object({ reps: z.number(), load_kg: z.number().nullable(), rest_pause: z.boolean() }))
    .nullable(),
  // meal
  name: z.string().nullable(),
  slot: z.string().nullable(),
  items: z
    .array(
      z.object({
        name: z.string(),
        grams: z.number().nullable(),
        kcal: z.number(),
        protein_g: z.number(),
        fiber_g: z.number().nullable(),
        accuracy: Accuracy,
      }),
    )
    .nullable(),
  library_match: z.string().nullable(),
  // activity
  activity: z.enum(['walk', 'run', 'cycle', 'swim', 'steps', 'other']).nullable(),
  minutes: z.number().nullable(),
  km: z.number().nullable(),
  steps: z.number().nullable(),
  // weigh_in / water / note
  kg: z.number().nullable(),
  ml: z.number().nullable(),
  text: z.string().nullable(),
  note: z.string().nullable(),
})

const ParseResult = z.object({
  cards: z.array(Card),
  reply: z.string(),
})

interface Context {
  date?: string
  time?: string
  exercises?: { key: string; name: string; loading: string; aliases?: string[] }[]
  recent_loads?: Record<string, string>
  meal_library?: { name: string; portion?: string | null; kcal: number; protein_g: number; fiber_g: number | null; accuracy: string }[]
  today?: { kcal: number; protein_g: number; fiber_g: number; water_ml: number } | null
}

function systemPrompt(ctx: Context): string {
  const exercises = (ctx.exercises ?? [])
    .map(e => `- ${e.key}: ${e.name} (${e.loading})${e.aliases?.length ? ` · aliases: ${e.aliases.join(', ')}` : ''}`)
    .join('\n')
  const loads = Object.entries(ctx.recent_loads ?? {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')
  const library = (ctx.meal_library ?? [])
    .map(m => `- "${m.name}"${m.portion ? ` (${m.portion})` : ''}: ${m.kcal} kcal, ${m.protein_g} g protein, ${m.fiber_g ?? '?'} g fiber, ${m.accuracy}`)
    .join('\n')
  return `You turn one sentence from a lifter's day into structured log cards for a lean-bulk tracking app. Reply in JSON matching the schema. Be literal: never invent numbers the sentence does not support.

Today is ${ctx.date ?? 'unknown'}${ctx.time ? ` at ${ctx.time}` : ''}.

CARDS
- set: a strength exercise with its sets. exercise_key MUST be one of the registry keys below; if the lift is not in the registry, do not emit a set card, emit a note card saying which lift could not be matched. "45 for 10, 10, 10, 10" means load 45 kg and four sets of 10. "2 × 16" or "16s" means two dumbbells of 16 kg: implements 2, load_kg 16. "7+3" is one rest-paused set of 10 (rest_pause true). "bodyweight" → load_kg null. When the user gives no load, use recent_loads for that key if present and say so in note; otherwise load_kg null.
- meal: food eaten. One card per meal. Split into items with kcal and protein per item. accuracy per item: "label" when values come from a product label the user names (whey, milk, bars, yogurt, 100PLUS), "weighed" when a gram amount is stated, "estimated" otherwise. If the sentence names a meal from MEAL LIBRARY ("the usual breakfast", "Hao Liao bowl", "post-workout shake"), copy its values exactly, set library_match to its name, and keep its items as one item unless the user changes a portion. slot: Breakfast, Lunch, Dinner, Shake, Snack, Evening, Supplements or Workout.
- weigh_in: morning body weight in kg.
- water: drinking water or workout drinks in ml (a bottle ≈ 500 ml, a can of 100PLUS 325 ml, a glass 250 ml).
- activity: a walk, run, cycle, swim or a step count ("1 hour walking of 5 km" → activity walk, minutes 60, km 5; "8,400 steps today" → activity steps, steps 8400). Convert hours to minutes and miles to km. Leave unknown fields null; never estimate a distance from a duration.
- note: anything worth keeping that is not one of the above (how a set felt, a headache, a plan), or an explanation when nothing could be parsed.

Fields that do not apply to a card's kind are null. One sentence can produce several cards (a shake and a weigh-in). A strength exercise is a set card, never an activity. reply: one short plain sentence back to the user, e.g. "Logged lunch, 800 kcal and 64 g protein; fiber is still 20 g short." Never give medical advice.

EXERCISE REGISTRY
${exercises || '(none provided)'}

RECENT LOADS (last logged, per key)
${loads || '(none)'}

MEAL LIBRARY (user's own meals; copy values when matched)
${library || '(none)'}

TODAY SO FAR
${ctx.today ? `${ctx.today.kcal} kcal, ${ctx.today.protein_g} g protein, ${ctx.today.fiber_g} g fiber, ${ctx.today.water_ml} ml water. Targets 2750 kcal, 150–165 g protein, 30 g fiber, 3 L water.` : 'nothing logged yet'}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'missing bearer token' }, 401)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(auth.slice(7))
  if (userError || !userData.user) return json({ error: 'not signed in' }, 401)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not set on this function' }, 500)

  let body: { text?: string; context?: Context }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body must be JSON' }, 400)
  }
  const text = (body.text ?? '').trim()
  if (!text) return json({ error: 'text is required' }, 400)
  if (text.length > 2000) return json({ error: 'text too long' }, 400)

  const client = new Anthropic({ apiKey })
  try {
    const response = await client.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      system: systemPrompt(body.context ?? {}),
      messages: [{ role: 'user', content: text }],
      output_config: { effort: 'low', format: zodOutputFormat(ParseResult) },
    })
    if (response.stop_reason === 'refusal') return json({ cards: [], reply: 'I could not process that one.', refused: true })
    const parsed = response.parsed_output
    if (!parsed) return json({ error: 'no structured output', stop_reason: response.stop_reason }, 502)
    return json({ cards: parsed.cards, reply: parsed.reply, usage: response.usage })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 502)
  }
})

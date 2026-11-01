# Iron Master

Phone-first training and nutrition companion for the lean-bulk program in the
Obsidian vault (`Health/Physique-Program-Lean-Bulk.md`). Sprint 1 builds the
foundation: Supabase tables, an exercise registry, the push-or-stay engine, a
vault import, and the `/progress` screen.

Specs live in the vault: `Projects/Iron Master/Implementation/`.

## Stack

Vite + React 19 + TypeScript + Tailwind 4 + Supabase. Pure libs in `src/lib`
(`exercises.ts`, `vaultParse.ts`, `progression.ts`, `progressRows.ts`) import
nothing from React, Supabase, Node or the DOM and are tested with `node --test`.

## Setup

1. Copy `.env.example` to `.env.local` and fill it in. `VITE_*` values reach the
   browser (anon key only). The service-role key, `IMPORT_USER_ID` and
   `VAULT_ROOT` are read only by the import script.
2. Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor.
3. Put your email in `IMPORT_USER_EMAIL`; the import script creates the user if
   it does not exist. The app itself never creates users.
4. Paste `supabase/templates/magic-link.html` into Authentication → Email
   Templates → Magic Link, and set the Auth Site URL to the deployed URL.

## Sign-in

The email carries a numeric code and a link to `/auth/confirm`. Either signs
you in. A plain Supabase magic link does not survive Gmail's link scanner or a
WhatsApp preview, which fetch the URL and consume its one-time token; the
confirm page redeems the token only when it runs in a real browser.
Supabase's built-in mailer allows two emails per hour. When that bites, or for
testing on this PC, `npx tsx scripts/dev-signin-link.ts <site url>` prints a
fresh code and link without sending anything (service-role key, local only).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Parser and engine tests on `fixtures/vault` |
| `npm run lint` | ESLint |
| `npm run build` | Type-check and production build |
| `npm run import:vault` | Parse the vault logs, run the engine, upsert into Supabase (idempotent). `--dry-run` parses and reports without writing. |

## Push or stay

For each logged lift, in order:

1. Only the first *n* programmed sets count. Fewer logged → **STAY**, "finish all sets".
2. Any counted set rest-paused → **STAY**, "straight sets first".
3. Target = the aim carried from the previous session of that lift, else the top of the range.
4. Every counted set at or above target → bodyweight: **PROGRESS_BW**; barbell: **PUSH** +2.5 kg; dumbbell: **PUSH** next DB jump; kettlebell: **PUSH** heavier KB.
5. Otherwise **STAY**, "get all *n* sets to *target*".

Verified against the four real sessions from 28 Oct to 1 Nov 2026: all 16
logged arrows reproduced.

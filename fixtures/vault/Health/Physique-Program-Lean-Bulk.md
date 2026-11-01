---
title: Physique Program — Lean Bulk
type: program
tags:
  - training
  - hypertrophy
  - nutrition
  - lean-bulk
  - physique
created: 2026-10-16
status: active
phase: lean-bulk
start_weight_kg: 75
height_cm: 175
age: 43
calories_target: 2750
protein_min_g: 150
protein_max_g: 165
fiber_min_g: 30
banner: Pasted Image 20261016102127_437.png
banner-x: 50
banner-y: 27
---

# Physique Program — Lean Bulk

> [!abstract] Goal
> Build the most muscular, lean version of my own frame, with emphasis on **shoulders, upper chest, back width, traps and arms**. Realistic target: **~80–82 kg, staying lean, over 2–3 years.**

## Starting Point

| Item       | Value                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| Date       | 2026-10-16                                                                |
| Height     | 175 cm                                                                    |
| Weight     | 75 kg                                                                     |
| Age        | 43                                                                        |
| Body       | Lean, wants size                                                          |
| Experience | Advanced                                                                  |
| Schedule   | 4 days/week                                                               |
| Equipment  | Home gym: rack, barbell, dumbbells, adjustable incline bench, pull-up bar |

## Contents

- [[#Dashboard]]
- [[#Pressure Management]]
- [[#Weekly Split]]
- [[#Progression Rules]]
- [[#Nutrition]]
- [[#Age-43 Adjustments]]
- [[#Decision Rules]]
- [[#Content Applications]]

---

## Dashboard

> [!tip] How logging works
> Each week, create a new note in `Health/Physique-Log` from the template [[Physique Weekly Check-in]] and fill in its properties. Everything below updates automatically.

### Status and Flags

```dataviewjs
const pages = dv.pages('"Health/Physique-Log"')
  .where(p => p.type === "physique-checkin" && typeof p.avg_weight === "number" && p.date)
  .sort(p => p.date, "asc")
  .array();

const sign = (n, d = 1) => (n >= 0 ? "+" : "") + n.toFixed(d);
const e1 = (kg, r) => (typeof kg === "number" && typeof r === "number" && r > 0) ? kg * (1 + r / 30) : null;

if (pages.length < 2) {
  dv.paragraph(`⏳ **${pages.length} check-in logged.** Trends start after the 2nd check-in. Calorie decisions need 3+ weeks of data.`);
} else {
  const last = pages[pages.length - 1];
  const ref = pages.length >= 4 ? pages[pages.length - 4] : pages[0];
  const weeks = Math.max(last.date.diff(ref.date, "days").days / 7, 0.1);
  const wPerMonth = (last.avg_weight - ref.avg_weight) / weeks * 4.33;

  const waisted = pages.filter(p => typeof p.waist === "number");
  let waistPerMonth = null;
  if (waisted.length >= 2) {
    const a = waisted[waisted.length - 2], b = waisted[waisted.length - 1];
    const wk = Math.max(b.date.diff(a.date, "days").days / 7, 0.1);
    waistPerMonth = (b.waist - a.waist) / wk * 4.33;
  }

  const lifts = [
    ["Bench", p => e1(p.bench_kg, p.bench_reps)],
    ["Squat", p => e1(p.squat_kg, p.squat_reps)],
    ["OHP", p => e1(p.ohp_kg, p.ohp_reps)],
    ["Pull-up", p => e1(typeof p.pullup_added_kg === "number" ? p.pullup_added_kg + p.avg_weight : null, p.pullup_reps)]
  ];
  let up = 0, compared = 0;
  const liftRows = [];
  for (const [name, f] of lifts) {
    const a = f(ref), b = f(last);
    if (a && b) {
      compared++;
      const pct = (b - a) / a * 100;
      if (pct > 1) up++;
      liftRows.push(`${name} ${sign(pct)}%`);
    }
  }
  const liftsUp = compared > 0 && up >= Math.min(2, compared);
  const flares = pages.slice(-4).filter(p => p.flare === true).length;

  dv.table(["Signal", "Value", "Status"], [
    ["Weight trend", `${sign(wPerMonth, 2)} kg/month (over ${weeks.toFixed(1)} wks)`,
      wPerMonth > 0.5 ? "🔺 Too fast" : wPerMonth < 0.1 ? "➖ Flat" : "✅ On target"],
    ["Waist", waistPerMonth === null ? "Need 2 measurements" : `${sign(waistPerMonth)} cm/month`,
      waistPerMonth === null ? "⏳" : waistPerMonth > 1 ? "🔺 Rising" : "✅ Stable"],
    ["Strength", compared ? liftRows.join(", ") : "Log lifts to compare",
      compared ? (liftsUp ? "✅ Progressing" : "➖ Stalling") : "⏳"],
    ["Flare-ups (last 4)", `${flares}`, flares >= 2 ? "⚠️ Review fiber and loads" : "✅"]
  ]);

  let verdict;
  if (weeks < 3) verdict = "⏳ **Keep collecting data.** Under 3 weeks of trend, no calorie change yet.";
  else if (waistPerMonth !== null && waistPerMonth > 1 && !liftsUp) verdict = "🔻 **Run a 3-week mini-cut at ~2,200 kcal.** Waist rising while lifts stall.";
  else if (wPerMonth > 0.5) verdict = "🔻 **Drop 150 kcal/day.** Gaining faster than 0.5 kg/month.";
  else if (wPerMonth < 0.1) verdict = "🔺 **Add 150 kcal/day.** Weight is flat.";
  else verdict = "✅ **Keep going.** Weight, waist and strength are on track.";
  dv.paragraph(verdict);
  if (flares >= 2) dv.paragraph("⚠️ Two or more flare-ups in the last 4 weeks: raise fiber and fluids, check breathing on heavy sets, and see a doctor if there's bleeding.");
}
```

### Weekly Log

```dataview
TABLE WITHOUT ID
  file.link AS "Check-in",
  week AS "Wk",
  avg_weight AS "Weight",
  waist AS "Waist",
  choice(bench_reps, round(default(bench_kg, 0) * (1 + default(bench_reps, 0) / 30), 1), "–") AS "Bench e1RM",
  choice(squat_reps, round(default(squat_kg, 0) * (1 + default(squat_reps, 0) / 30), 1), "–") AS "Squat e1RM",
  choice(ohp_reps, round(default(ohp_kg, 0) * (1 + default(ohp_reps, 0) / 30), 1), "–") AS "OHP e1RM",
  choice(pullup_reps, "+" + default(pullup_added_kg, 0) + " × " + pullup_reps, "–") AS "Pull-up",
  fiber_avg AS "Fiber",
  choice(flare, "⚠️", "–") AS "Flare",
  choice(deload, "Deload", "") AS "Phase"
FROM "Health/Physique-Log"
WHERE type = "physique-checkin"
SORT date DESC
```

### Measurements

```dataview
TABLE WITHOUT ID
  file.link AS "Check-in",
  avg_weight AS "Weight",
  waist AS "Waist",
  chest AS "Chest",
  arm AS "Arm",
  photo AS "Photo"
FROM "Health/Physique-Log"
WHERE type = "physique-checkin" AND (waist OR chest OR arm OR photo)
SORT date DESC
```

---

## Pressure Management

> [!important] Core principle
> Flare-ups are driven by **spikes in abdominal pressure** (breath-holding under heavy loads, grinding reps) and **straining on the toilet**. Training volume isn't the problem. This program keeps the muscle-building stimulus and removes the pressure spikes.

### Breathing Rules (every set)

- Brace your core, but **exhale steadily through the hard part** of each rep (hiss or pursed lips). No full breath-hold.
- **No belt** for heavy work. A belt raises abdominal pressure.
- **No grinders.** End a compound set when bar speed slows sharply. Keep 2 reps in reserve.
- No sets below **6 reps**. Size comes from the 6–15 rep range anyway.
- Rest 2–3 min between heavy sets so you don't start the next one out of breath.

### Exercise Swaps

| Original              | Replaced with                                         | Why                                            |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| Back squat 4 × 5–8    | Heel-elevated goblet squat or DB front squat 4 × 8–12 | Lower spinal load, easier to breathe through   |
| Deadlift 3 × 3–5      | DB Romanian deadlift 3 × 8–10                         | No maximal pull; hinge pattern kept            |
| Barbell RDL 3 × 6–10  | Single-leg DB RDL 3 × 10 per leg                      | Half the load per rep, same hamstring stimulus |
| Barbell shrug (heavy) | DB shrug 3 × 12–15                                    | Lighter load, controlled                       |
| Weighted plank        | Dead bug 3 × 10 per side                              | Builds bracing without a long hold             |
| Pendlay row           | Chest-supported DB row                                | Torso supported, less bracing                  |

### Flare-up Protocol

- During an active flare, train **upper body only**, seated or chest-supported, with moderate loads. Skip lower days or swap in walking.
- When symptoms settle, return to lower-body work at ~70% of previous loads for one week.

> [!warning] See a doctor if
> You get rectal bleeding, persistent pain, or a lump that doesn't go back in. Bleeding is usually from hemorrhoids, but at 43 it should be checked rather than assumed, especially if your bowel habits change.

---

## Weekly Split

> [!tip] Form videos
> Each exercise name links to a technique video. Use them for **form only**. If a video says to hold your breath or wear a belt, follow [[#Pressure Management]] instead.

| Day     | Session                            |
| ------- | ---------------------------------- |
| Mon     | Upper A (heavy)                    |
| Tue     | Lower A (heavy)                    |
| Wed     | Rest + walk                        |
| Thu     | Upper B (size, shoulder/arm focus) |
| Fri     | Lower B (volume)                   |
| Sat–Sun | Rest + 8–10k steps                 |

### Upper A — Heavy

| Exercise                                                                     | Sets × Reps | Notes                                                     |
| ---------------------------------------------------------------------------- | ----------- | --------------------------------------------------------- |
| [Barbell bench press](https://www.youtube.com/watch?v=vcBig73ojpE)           | 4 × 6–10    | Ramp-up sets, exhale on the press, stop 2 reps short 26kg |
| [Weighted pull-up](https://www.youtube.com/watch?v=HuuyDNGrCI8)              | 4 × 6–10    | NO                                                        |
| [Seated DB overhead press](https://www.youtube.com/watch?v=rO_iEImwHyo)      | 3 × 8–10    | YES 16kg                                                  |
| [Chest-supported DB row](https://www.youtube.com/watch?v=ro2vfHfD0DQ)        | 3 × 8–10    | YES 16kg. 8 reps.                                         |
| [DB lateral raise](https://www.youtube.com/watch?v=4hTUCDUQaNA)              | 4 × 12–20   | YES 6KG 10reps                                            |
| [Incline DB curl](https://www.youtube.com/watch?v=DCe8f6vMe9A)               | 3 × 8–12    | YES 12KG 5reps                                            |
| [Overhead DB triceps extension](https://www.youtube.com/watch?v=-Vyt2QdsR7E) | 3 × 10–15   | NO :(                                                     |

### Lower A — Heavy

| Exercise                                                                                                                                   | Sets × Reps      | Notes                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------------------- |
| [Heel-elevated goblet squat](https://www.youtube.com/watch?v=3dLIa1YljLs) or [DB front squat](https://www.youtube.com/watch?v=MJao9o7ROs0) | 4 × 8–12         | Exhale on the way up |
| [Single-leg DB RDL](https://www.youtube.com/watch?v=GoKjrvJi-Iw)                                                                           | 3 × 10 per leg   |                      |
| [Bulgarian split squat](https://www.youtube.com/watch?v=hiLF_pF3EJM)                                                                       | 3 × 8–12 per leg |                      |
| [Standing calf raise](https://www.youtube.com/watch?v=SVtg-1loH4c)                                                                         | 4 × 10–15        |                      |
| [Hanging leg raise](https://www.youtube.com/watch?v=Pr1ieGZ5atk) or [ab wheel](https://www.youtube.com/watch?v=rqiTPdK1c_I)                | 3 × 10–15        |                      |

### Upper B — Size (Shoulders and Arms)

| Exercise                                                                                                                     | Sets × Reps    | Notes                    |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------ |
| [Incline DB press](https://www.youtube.com/watch?v=0f6-uCUKqgA)                                                              | 4 × 8–12       | Bench at ~30°            |
| [Chest-supported DB row](https://www.youtube.com/watch?v=ro2vfHfD0DQ)                                                        | 4 × 10–12      |                          |
| [Arnold press](https://www.youtube.com/watch?v=ris9tKqMwgU)                                                                  | 3 × 8–12       |                          |
| [Lateral raise](https://www.youtube.com/watch?v=4hTUCDUQaNA)                                                                 | 4 × 15–25      | Drop set on the last set |
| [Rear-delt fly](https://www.youtube.com/watch?v=nlkF7_2O_Lw)                                                                 | 3 × 15–20      |                          |
| [DB shrug](https://www.youtube.com/watch?v=_t3lrPI6Ns4)                                                                      | 3 × 12–15      |                          |
| [Hammer curl](https://www.youtube.com/watch?v=Hy5L3-QJETc) + [Close-grip bench](https://www.youtube.com/watch?v=vEUyEOVn3yM) | 3 × 10–12 each | Superset                 |

### Lower B — Volume

| Exercise                                                             | Sets × Reps       | Notes                                   |
| -------------------------------------------------------------------- | ----------------- | --------------------------------------- |
| [DB Romanian deadlift](https://www.youtube.com/watch?v=hQgFixeXdZo)  | 3 × 8–10          |                                         |
| [DB front squat](https://www.youtube.com/watch?v=MJao9o7ROs0)        | 3 × 10–12         | 3-second lowering, exhale on the way up |
| [DB walking lunge](https://www.youtube.com/watch?v=Pbmj6xPo-Hw)      | 3 × 10–12 per leg |                                         |
| [Single-leg calf raise](https://www.youtube.com/watch?v=ORT4oJ_R8Qs) | 3 × 12–15         |                                         |
| [Dead bug](https://www.youtube.com/watch?v=o4GKiEoYClI)              | 3 × 10 per side   |                                         |

---

## Progression Rules

> [!tip] Double progression
> When every set hits the **top** of the rep range, add weight next session (+2.5 kg on the barbell, next jump on dumbbells).

- **Compounds:** stop with 2 reps in reserve. No grinders.
- **Isolation:** go to failure or 1 rep short of it.
- **Deload every 5th week:** half the sets, lighter loads. Tick `deload: true` in that week's check-in.
- **Log every session.** If the numbers aren't moving, growth isn't happening.

---

## Nutrition

| Target | Daily amount |
| --- | --- |
| Maintenance (estimate) | ~2,500 kcal |
| **Lean-bulk intake** | **~2,750 kcal** |
| Protein | 150–165 g (4 meals × 35–40 g) |
| Fat | 65–75 g |
| Carbs | ~340–370 g, mostly around training |
| Fiber | 30–38 g |
| Fluids | 3+ L, more in heat and on training days |

- Target gain: **0.25–0.5 kg per month**.
- High-protein bulks are often low in fiber. Get it from oats, fruit, vegetables, beans, lentils and whole grains. Psyllium husk (5–10 g/day) is an easy add-on. Fiber without water makes constipation worse.
- **Toilet habits:** don't strain, don't sit more than ~5 min, go when you feel the urge. A small footstool under your feet helps.
- Creatine monohydrate at 3–5 g/day supports strength and size. See [[creatine-cognitive-performance]].

> [!warning] Maintenance is an estimate
> It comes from a formula. The weight trend in the [[#Dashboard]] is the real calibration.

---

## Age-43 Adjustments

- [ ] Ramp-up sets before every heavy compound
- [ ] Deload every 5th week, not 6th
- [ ] Sleep 7.5–8 h
- [ ] If a joint hurts, swap the exercise rather than grinding through it
- [ ] Baseline blood test: testosterone, vitamin D, lipids, fasting glucose / HbA1c

---

## Decision Rules

The [[#Dashboard]] applies these automatically. **Only change calories when at least two signals agree.**

| Situation | Action |
| --- | --- |
| Weight flat after 3 weeks | +150 kcal |
| Gaining more than 0.5 kg/month | −150 kcal |
| Waist +1 cm/month **and** lifts stalling | 3-week mini-cut at ~2,200 kcal |
| Weight up, waist stable, lifts up | Keep going |

> [!question] Failure modes to watch
> - **Water noise:** salt, carbs or poor sleep can swing the scale 1–2 kg. Only weekly averages count.
> - **Measurement drift:** always measure at the same time, same spot, same tape tension.
> - **Fatigue masking strength:** one bad week isn't a stall. Look for a 2-week trend.
> - **Missing data:** the flags only see what you log. A check-in with no lifts filled in can't show progress.

---

## Content Applications

> [!example] Entrepreneurial angles
> - **"Building a physique at 43" series:** document the 2–3 year transformation with real data. Authenticity and measurement stand out in a space full of unrealistic promises.
> - **Busy-professional training system:** a 4-day home-gym program for people with demanding jobs and families, packaged as a digital product.
> - **Obsidian fitness tracking template:** this Dataview dashboard, check-in template and decision rules as a sellable vault template.
> - **Data-driven brand:** the same measure → adjust → verify approach as the AimMaster coaching methodology, applied to physique.

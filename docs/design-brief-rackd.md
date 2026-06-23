# Rackd — Design Brief

Rebrand of **MyFit** → **Rackd**. Paste-ready answers for the Claude Design form, plus the
follow-up domain plan. Local-first gym workout tracker, friendly + modern, full light + dark.

---

## Claude Design form — paste fields

**App name**
> Rackd

**One-liner**
> Plan, run, and track your gym workouts — local-first.

**Product summary**
> Local-first gym workout tracker. Plan routines, run a live workout session with a rest timer,
> log every set, and watch progress over time (weight trend, weekly volume, streaks). PWA web
> now, native mobile later. Privacy-first — data lives on the device, optional sync.

**Audience**
> Lifters who want a fast, no-fluff tracker — beginners to intermediate. People who train in a
> gym or home gym and log sets between rest periods.

**Brand personality / direction**
> Encouraging gym buddy, not a drill sergeant. Calm, confident, legible at arm's length mid-set.
> Friendly and modern — rounded shapes, soft depth, one energetic accent color. Avoid the clichéd
> "black + neon + carbon fiber" bro-aesthetic. Should feel as good in a bright gym at 6am (light)
> as in a dim home gym at night (dark).

**Tone**
> Friendly, calm, encouraging, modern.

**Themes**
> Both. Light = default, warm-neutral base. Dark = refined near-black (not pitch black).

**Primary accent**
> Coral-orange `#ff5a3c` — warmth + push. Same accent family across both themes so brand stays
> constant.

**Must-have screens**
> - Home dashboard (weight progress / weekly volume / history-streak cards)
> - Routine list + routine editor
> - Live workout session + rest timer
> - History

**Avoid**
> Neon-on-black bro aesthetic, cold grays, pure black, stock barbell-silhouette logos.

---

## Light theme palette

Warm-neutral base (not cold gray), green = success/effort, coral accent.

```css
--bg:          #f7f8fa;  /* soft off-white, not pure */
--surface:     #ffffff;  /* cards */
--surface-2:   #eef1f5;  /* insets, pressed */
--border:      #e2e6ec;
--text:        #11161d;
--text-muted:  #5b6776;
--accent:      #ff5a3c;  /* energetic coral-orange */
--accent-press:#e8462b;
--success:     #16a34a;  /* completed set */
--warning:     #d97706;
--danger:      #dc2626;
```

## Dark theme palette

Off pure black, softer blue→coral accent matched to light.

```css
--bg:          #0e1116;  /* near-black, slight warmth */
--surface:     #171b22;
--surface-2:   #20262f;
--border:      #2c333d;
--text:        #f3f5f8;
--text-muted:  #9aa6b4;
--accent:      #ff6b4d;  /* same coral, brighter for dark */
--accent-press:#ff8163;
--success:     #34d399;
--warning:     #fbbf24;
--danger:      #f87171;
```

Keep accent identical-family across both themes — that's what makes the rebrand feel intentional.

---

## Logo concepts (pitch to the form)

1. **Rep ring** — circular progress arc (the rest timer / set completion) that closes into a
   stylized "R". Doubles as app icon + the live progress UI. Ties brand to the core interaction.
2. **Rising bars** — 3 ascending bars (volume/progress chart) that also read as a barbell plate
   stack. Simple, scales to favicon.
3. **Monogram plate** — "R" inside a rounded-square weight-plate silhouette. Classic gym, very
   legible maskable PWA icon.
4. **Bracket "Rackd"** — wordmark where the "R" or the "d" forms a squat-rack bracket shape. Direct
   tie to the name.

Icon must work **maskable** (manifest uses `purpose: "any maskable"`) → keep mark centered with
safe padding, solid accent fill on neutral.

---

## Name research (why Rackd)

Checked IronLift, Tempo, Rackd. Real-word fitness names are saturated/trademarked:

| Name | App collision | Domains | Verdict |
|------|--------------|---------|---------|
| IronLift | IRON LIFT® brand + many "Iron" tracker apps | taken | dropped |
| Tempo | tempo.fit (funded) + "Tempo: Workout Tracker" app | taken | dropped |
| **Rackd** | none in tracker space | squatted across TLDs | **chosen** |

Rackd = clean in app-store + trademark terms (only "RackCoach" / hardware "The Rack" nearby,
different category). Follows the coined-misspelling pattern that Hevy / Liftosaur / Setgraph used
to dodge collisions.

---

## TODO — domain plan (later, not now)

All Rackd TLDs are parked/squatted: `.com .app .io .fit .co .fitness`, `getrackd.com`,
`rackdapp.com`. Options to resolve before public launch:

- [ ] Check coined-domain alternatives: `rackd.training`, `userackd.com`, `rackd.club`,
      `rackd.day`, `rackdhq.com`.
- [ ] Price-check acquiring `rackd.com` / `rackd.app` from current holder (squatter — expect markup).
- [ ] If domains stay blocked, consider a coined-spelling fallback that owns a clean `.com`
      (batch to test: `Liftd`, `Setlog`, `Reppd`, `Liftr`, `Setgrid`).
- [ ] Local-first PWA can ship on any domain meanwhile — domain not blocking the rebrand work.

---

## Rebrand touchpoints in code (later)

When implementing the rebrand, update:

- `apps/web/src/app/layout.tsx` — `title`, `description`, `appleWebApp.title`
- `apps/web/public/manifest.webmanifest` — `name`, `short_name`, `theme_color`, `background_color`,
  icons
- `packages/ui/src/tokens.css` — swap palette to the light/dark sets above (light becomes default)
- `apps/web/public/icons/` — regenerate `icon-192.png` / `icon-512.png` from new logo

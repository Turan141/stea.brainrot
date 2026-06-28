# Brainrot Heist — Game Design Revision (practical, code-aware)

> Reviews the **actual current codebase**, not an ideal. Every system is graded
> Keep / Improve / Remove / Postpone with complexity, architecture reuse, and timing.
> Goal: evolve what exists; never invalidate working code without overwhelming benefit.
> Stack unchanged: Three.js · TypeScript · Vite · Node.

---

## A. What is actually built today (snapshot)

- **Engine** (loop/renderer/scene/input/time/event-bus), **custom kinematic physics**
  (gravity, jump, double-jump, sprint, dash, stamina), third-person follow camera.
- **World:** safe ground + player base + rival-base placeholders + **central Avenue**;
  `ZoneManager` with 3 zones and **all 10 obstacle types** (moving/disappearing
  platforms, rotating beams, hammers, spikes, lasers, jump pads, bridges, wind, ice).
- **Creatures:** `CreatureLibrary` auto-loads a manifest (no hardcoded list), GLTF +
  **skeletal animation** (SkeletonUtils + AnimationMixer), palette tinting; `Creature`
  has **levels** (income scales) + "Lv" labels.
- **Generation pipeline:** Meshy/Tripo/procedural adapters, dedup/compress
  (`compress-glb`, proven 46 MB → 0.8 MB), thumbnails, manifest.
- **Systems:** `CaptureSystem` (zone catch), `ConveyorShop` (avenue market + personal
  pity), `BaseStorage` (passive income, level-up, cap 10), `EconomySystem`,
  `UpgradeSystem` (10 upgrades), versioned `SaveManager`.
- **UI:** loading screen, HUD, upgrade shop, Creaturedex, settings, interaction prompt,
  toasts; synth audio; particles.

This is a credible **single-player MVP**. The review protects it.

---

## A2. Clarified core identity (team direction)

- **Base mode = single-player.** Explore, collect, build the base, earn income, fuse.
  No other players in your hub. The relaxed, always-available core. *(Built.)*
- **PvP = you fight FOR a creature.** The stake of a PvP battle is a **creature** — you
  battle to win one. **Matchmaking ("поиск боя") is undecided** and treated as a
  separate, postponable problem (options in §G).

**The hard reconciliation:** "fight for a creature" vs "never suffer permanent loss."
Resolved with the same **clone** rule used for Heists:
- Winner receives a **reduced-income CLONE** of the opponent's wagered creature (you
  genuinely *gain a new creature* by winning — the fantasy is intact).
- Loser keeps their original (optionally a short income debuff). **No collection is
  ever destroyed.**
- Both players **opt in** and ante from a chosen wager slot — never the whole base.

This makes the PvP prize *meaningful* (a new species/copy) while removing the churn
bomb of literal theft. Cost: **Medium**. MVP suitability: **Future update** (needs the
battle/stats layer first); the *clone primitive* is shared with Heists, so building
Heists first de-risks it.

---

## B. System-by-system verdict

> **Reading the columns:** "Now" ≈ **MVP**, "Later" / "Postpone" ≈ **Future update**.
> Every proposed (not-yet-built) feature carries an explicit cost + MVP/Future tag.

| System (in repo) | Verdict | Why | Complexity to change | Arch reuse | Now / Later |
|---|---|---|---|---|---|
| Engine / physics / camera | **Keep** | solid, no reason to touch | — | — | — |
| Avenue + ConveyorShop | **Keep** | just built, on-design | — | — | — |
| Zones + 10 obstacles | **Keep** | strong skill core + reused for defense later | — | — | — |
| Creature pipeline + compress | **Keep** | genuine differentiator | — | — | — |
| Capture / carry-vulnerability | **Keep** | ties zones/heists/defense | — | — | — |
| Creature **levels** | **Keep** | always-on coin sink | — | — | — |
| Save (versioned, local) | **Keep** | good; cloud is a later add | — | — | — |
| **Passive income (linear)** | **Improve** | no soft cap → idle can dominate | **Low** (one formula in `BaseStorage`) | full reuse | **Now** |
| **Economy sinks / anti-inflation** | **Improve** | only sink is leveling; coins will inflate | **Low–Med** | reuse Economy/Upgrade | **Now** |
| Conveyor pricing/payback | **Improve** | tune so zones > avenue earnings | **Low** | reuse | Now |
| UpgradeSystem set | **Improve** | mostly platforming QoL; add 1–2 economy-shaping upgrades | **Low** | reuse | Soon |
| **Creature stats/types/abilities** | **Improve (add metadata now)** | needed for Battles; cheap to start | **Low** (manifest fields) | extend `CreatureDef` | **Now (data only)** |
| **Fusion** (planned D2) | **Keep → build** | core crafting fantasy | **Med** | reuse Library + BaseStorage + Economy | **Now (next)** |
| **NPC Heists / clone-steal** (D3) | **Keep → build, defanged** | social pillar; clone avoids loss | **Med–High** | reuse capture/carry/base | After Fusion |
| **Base defense** (D4) | **Keep → build** | huge reuse of obstacle engine | **Med** | **reuses obstacles directly** | After Heists |
| Day/Night cycle (D5) | **Postpone** | flavor, not core value yet | Low–Med | new (lighting) | Later |
| Notoriety (D6) | **Postpone** | only matters once heist loop is mature | Med | reuse event bus | Later |
| **PvP "fight for a creature"** | **Postpone (Future)** | core PvP identity; prize = clone of opponent's creature (§A2); needs stats + resolver + server | **High** | partial (reuses clone primitive + stats) | Later |
| **Real-time multiplayer / accounts** | **Postpone (1.0)** | needs backend + anti-cheat | **High** | new server tier | Later |
| Trading | **Postpone** | RMT/fraud risk; needs accounts first | Med–High | new | Later |
| Decor/props pipeline (built, unwired) | **Keep, wire Later** | scene still changing (per team) | Low | reuse | Later |
| "Base Size" expansion upgrade | **Removed already** | base hard-capped at 10 for now | — | — | done |
| Breeding | **Remove** | duplicates Fusion | — | — | — |
| Standalone Evolution system | **Remove** | fold into levels + Lv10 cosmetic | — | — | — |
| **High-Stakes creature wager** | **Remove** | permanent-loss churn; wager coins instead | — | — | — |

---

## C. The changes worth making NOW (high value, low risk)

### 1. Soft-cap passive income — *Improve, Low, full reuse, Now*
**Weak because:** `BaseStorage.baseIncomePerSec` sums creature value linearly; a big
base out-earns active play → the optimal player stops exploring (kills the game's
identity). **Change:** apply a diminishing curve past a threshold (e.g. full value for
the first ~6 creatures, then sharply reduced). One formula, no architecture change.

### 2. Economy sinks / inflation guard — *Improve, Low–Med, reuse, Now*
**Weak because:** the only meaningful sink is creature leveling; coins will pile up and
flatten progression. **Change:** Fusion consumes creatures + a coin fee; add a rotating
**Black Market** (timed high-cost offers) as a vanity/consumable sink; keep level costs
exponential. Add a dev-only "coins created vs destroyed" log to watch it.

### 3. Add creature **stats/types** metadata now — *Improve, Low, Now*
**Weak because:** creatures have only income; Battles (later) will need HP/ATK/SPD +
Type + Ability, and retro-fitting hundreds of creatures later is painful. **Change:**
extend `CreatureDef` + the generator to assign `type` (from archetype) and a small stat
block **now**, even though Battles ship later. Zero gameplay change today; saves a
costly migration. *(This is the one "do it early to avoid rework" call.)*

### 4. Build **Fusion** next (planned D2) — *Keep, Med, reuse, Now*
On-design crafting + economy sink + the "wow". Reuses `CreatureLibrary` (draw from
fixed pool), `BaseStorage` (consume two stored creatures), `EconomySystem` (fee +
catalyst). No new tech. **This is the correct next milestone.**

---

## D. Changes to POSTPONE (and why)

- **Creature Battles & real multiplayer:** highest complexity, need stats + an
  authoritative server + anti-cheat + a whole balance metagame. Postpone to **1.0**.
  Do the cheap prep now (stats metadata, §C3) so the later build is smooth.
- **Day/Night, Notoriety:** flavor/tension layers that only pay off once Heists are a
  live loop. Postpone behind D2–D4.
- **Trading:** RMT/fraud surface; requires accounts. Postpone, ship with guardrails.
- **Decor placement:** intentionally unwired — the team flagged the scene will change.
  Keep the pipeline, wire when the layout is final.

---

## E. Changes to REMOVE (cut scope)

- **Breeding** — redundant with Fusion.
- **Standalone Evolution** — fold into Levels (+ an optional Lv-10 cosmetic shift).
- **High-Stakes creature wagering** — reintroduces permanent loss; wager **coins** in
  escrow with a cap instead. (Already argued in the main GDD.)

---

## F. Revised near-term roadmap (respects current code)

1. **Now:** soft-cap income (§C1) + Fusion (§C4) + stats metadata (§C3) + first economy
   sinks (§C2). All reuse existing systems; no rewrites.
2. **Next:** NPC Heists (clone-steal, reuse capture/carry) → Base Defense (reuse
   obstacle engine).
3. **Then:** Day/Night + Notoriety polish once the heist loop is fun.
4. **1.0:** accounts + cloud save → real-player async Heists → ranked Creature Battles
   (built on the stats added in step 1) → guilds/season 1.
5. **Future:** trading, tournaments, world events, new zones/seasons, decor wiring.

**Bottom line:** the project is on the right track. The only *urgent* design debt is
**(a) soft-capping idle income** and **(b) adding creature stat/type metadata early** —
both Low-complexity, both reuse current architecture. Everything else is additive and
sequenced so no month of work gets thrown away.

---

## G. PvP matchmaking ("поиск боя" — still open)

Matchmaking is the undecided piece. It is **separable** from the battle itself: build
the battle resolver first, decide queueing later. Ranked options, cheapest → richest:

| Option | What it is | Cost | MVP / Future |
|---|---|---|---|
| **Challenge friends / link** | send a battle link/code to a friend; async resolve | **Low** | could ship early (no backend if results signed client→client is avoided — needs a tiny relay) |
| **NPC / "ghost" opponents** | fight AI teams or **snapshots of other players' teams** (async, no live opponent) | **Med** | **good first PvP** — feels social, no real-time netcode, no smurf rage |
| **MMR ranked queue** | live skill-based matching + ladder | **High** | **Future update** (needs accounts + server + anti-cheat) |
| **Tournaments / brackets** | scheduled events | **High** | Future |

**Recommendation:** when PvP lands, start with **ghost/async snapshot battles** (Med):
you "fight for a creature" against a stored snapshot of a real player's wager team,
resolved on the server. It delivers the fantasy and the social feel **without** live
matchmaking, then MMR/ranked is layered on in a later update. This also reuses the
**clone** primitive and the **stats metadata** we add now — so nothing is wasted.

### Hard dependency note
"Fight for a creature" PvP requires, in order: **(1) creature stats/types** (add now,
Low) → **(2) battle resolver** (Future, High) → **(3) wager+clone exchange** (Future,
Med, shares Heist code) → **(4) matchmaking** (Future, Med–High). Only step 1 belongs
in the current MVP; it is cheap insurance that makes steps 2–4 smooth later.

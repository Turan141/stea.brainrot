# Game Design Document — "BRAINROT HEIST" (working title)

> GDD v1 · Browser multiplayer (Three.js + TypeScript) · Author: Lead Game Design
> Status: pre-production. This document is opinionated. Where the brief was weak,
> it has been redesigned and the reasoning is stated.

---

## 0. Critical pre-amble (read first)

The brief contains three structural problems. They are solved throughout this
doc, but stated plainly here because they shape every other decision:

1. **Idle income vs "exploration & skill" pull in opposite directions.** If a base
   pays the rent while you sleep, the optimal player stops exploring. Fix:
   passive income is **soft-capped and decays toward a ceiling**; the *interesting*
   money comes from active play (zones, heists, battles). Idle is the floor, not
   the ceiling.

2. **The brief implies TWO competitive PvP systems** — base raiding/stealing AND
   late-game team battles. Shipping both at launch doubles the balance surface and
   halves the polish. **Decision:** one *social, low-stakes* async PvP (Heists, mid-game)
   and one *competitive, ranked* PvP (Creature Battles, late-game). For **MVP we ship
   Heists only**; Battles are the 1.0 headline. Reasoning in §9/§14.

3. **"Players can lose creatures" directly contradicts "don't punish players."**
   Losing a collectible you spent 10 hours on is the #1 churn event in this genre.
   **Decision: creatures are never permanently lost.** Heists steal a *reduced-income
   clone*; battles never stake creatures. Stakes are coins, ranking, and time — never
   the collection. (§6/§9)

---

## 1. High Concept

**Brainrot Heist** is a browser-based collect-explore-and-compete game where players
platform through hazardous themed zones to capture absurd hybrid creatures (a
"traffic-cone duck", a "ceiling-fan robot"), bring them home to a living base that
generates income, fuse them into rarer hybrids, and then prove their collection in
two social arenas: cheeky asynchronous **Heists** on rival bases and ranked
**Creature Battles**. It blends the dopamine of collection and idle progression with
genuine third-person platforming skill and fair, never-punishing competition.

---

## 2. Target Audience

- **Age:** 10–24 primary; 25–34 secondary (collector/optimizer crowd). Family-friendly
  art and tone to keep the 10–13 band and pass platform ratings.
- **Platforms:** Desktop & mobile web (Three.js, WebGL2). Mobile-first input
  (virtual stick + buttons) because the genre's audience is mobile-heavy; desktop is
  the "power user / streamer" surface.
- **Session length:** designed for **two shapes** — a 2–4 min "check-in" (collect
  income, one market buy, one quick zone run) and a 15–30 min "deep" session (zone
  clears, fusions, ranked battles). Retention systems must reward both.
- **Player motivations (Bartle-ish):** Collectors (gotta-catch-'em-all), Achievers
  (optimize income/rank), Explorers (new zones, rare spawns), Socializers/Killers
  (heists, battles, leaderboards). The design intentionally serves all four so a
  guild can contain every type.

---

## 3. Core Gameplay Loop

**Macro loop:** Explore/Buy → Collect → Base income → Fuse/Upgrade → Compete
(Heist/Battle) → unlock harder content → repeat with rarer creatures.

- **First 5 minutes (onboarding):** Spawn on your base. A guided capsule on the
  central Avenue gives a free starter creature → place it → watch coins tick (teach
  income). Walk into the nearest easy zone, dodge one trivial hazard, catch a creature,
  carry it home (teach carry-vulnerability). Outcome: player understands *catch → place
  → earn* in under five minutes and owns 2 creatures.
- **First hour:** Unlock the second zone, buy 3–4 creatures off the Avenue, hit the
  base soft-cap for the first time (teaches "go active"), perform the first **Fusion**
  (the "wow"), and run a tutorial Heist against an NPC base. Player ends with ~8
  creatures, a level-2 base, and a sense of the three pillars.
- **Mid game (hours 2–15):** The Heist meta opens — raid NPC and (later) real bases for
  clone-steals, manage Notoriety, build base defenses. Fusion becomes a planned economy
  (collect catalysts, chase recipes). Zones escalate (moving hazards, environmental
  modifiers). First Battle ranked placement.
- **Late game (hours 15–80):** Ranked **Creature Battles** become the primary skill
  expression — team composition, type synergies, ability timing. Seasonal ladder,
  guild play, chase mythics via fusion pity. Base is now a flex/identity space.
- **End game (80h+):** Leaderboard climbing, full Creaturedex completion, mythic
  fusion hunting, seasonal cosmetic prestige, guild wars. The loop sustains via
  *horizontal* goals (new creatures/cosmetics/seasons), never a vertical power wall.

---

## 4. Player Motivation (why they stay)

- **After 1 hour:** novelty + the collection itch ("what's the next creature?") + the
  fusion surprise. Cheap, frequent dopamine.
- **After 10 hours:** mastery of zones (skill ceiling), optimizing base income,
  climbing the first ranked tier, social friction from heists. Goals are now
  *self-set* (complete a rarity tier) and *imposed* (season ends Sunday).
- **After 50 hours:** competitive identity (rank, leaderboard, guild standing),
  long-tail collection (mythics), and **theorycrafting** battle teams. The depth must
  come from *combinations* (creatures × abilities × types), not grind.
- **After 200 hours:** social belonging (guild), seasonal prestige cosmetics, and the
  treadmill of new content drops. **Honest risk:** without a steady content cadence
  and a deep battle meta, 200h retention collapses. This is the make-or-break and is
  called out again in §15.

---

## 5. World Design

A single persistent-feeling **hub map** (instanced per player for the hub; shared
only in explicit multiplayer surfaces) so loading stays light for browser.

- **World layout:** a central **Avenue** spine. Player base at the near end; the
  Avenue conveyor delivers buyable creatures; rival/NPC bases flank it; themed
  **Adventure Zones** fan out from the far end. Readable at a glance, scales by adding
  spokes.
- **Safe areas:** your base + the Avenue are no-combat, no-hazard. Critical for the
  "check-in" session and for not punishing low-skill players.
- **Adventure Zones:** each = a bespoke obstacle course with a *signature traversal
  mechanic* and an exclusive creature pool. **Why bespoke mechanics:** they create
  *skill identity* per zone and reasons to revisit. Zones gate by progression, not
  paywall. Launch set + roadmap:
  - **Ice Cave** — slippery low-friction movement, sliding puzzles.
  - **Volcano** — rising-lava timing, jump-pad ascents.
  - **Toxic Lab** — DoT clouds you must outrun, disappearing catwalks.
  - **Ancient Temple** — collapsing floors, swinging-hammer gauntlets.
  - **Jungle** — vines/grapple swings, moving-platform canopy.
  - **Factory** — conveyor belts, rotating beams, crushers (timing).
  - **Haunted Carnival** — strobe/lights-out segments, spinning rides as hazards.
  - **Sky Islands** — wind gusts + long gaps (double-jump/dash mastery).
  - **Crystal Desert** — refracting-light lasers, mirage platforms.
  - **Underwater Laboratory** — buoyancy/low-gravity movement, current pushes.
  - **Hidden/Secret areas** inside zones (off-path platforming) gate rare spawns and
    cosmetics — rewards exploration for its own sake.
- **Market (Avenue):** **personal** market (anti-snipe), refreshes on a timer, rarer
  capsules appear less often, with a **pity timer** so a rare is guaranteed within N
  refreshes. Safe, reliable, *slower* than zones — the floor path.
- **Bases:** see §7.
- **Special locations:** a **Fusion Lab** (central, social — see others fuse), a
  **Battle Arena** portal, a **Black Market** (timed, rotating high-value offers as a
  coin sink).
- **World events:** scheduled **Rare Spawn** windows (a mythic-tier wild creature
  appears in a zone for 30 min — server-wide notification), **Double-Income hours**,
  and seasonal zone takeovers. Events create appointment play and spikes in concurrency.

---

## 6. Creature System

**Creative direction (the soul of the game):** creatures are **absurd hybrids of two
everyday things** — a microwave with chicken legs, a refrigerator with a jetpack, a
broccoli samurai, a television duck, a toaster dragon, an astronaut banana, a pizza
wizard, a fish in a walking aquarium. **Every creature should make you smile on sight.**
The collection — not combat, not idle — is the emotional core; the player's recurring
question is *"what ridiculous thing exists next?"* Naming follows the combo
(`Astronaut Banana`), reinforcing the gag. This whimsy is also our **brand moat**:
it's instantly shareable (memes, clips) and hard to clone with a straight face.

**Roster scale:** target **hundreds** of creatures at maturity, delivered in seasonal
waves (not all at launch). Feasible only because of the generation pipeline (§6b).

**Rarities:** Common, Rare, Epic, Legendary, Mythic. Weighted spawn/market rates;
rarity drives base income, battle stat budget, and visual richness (rarer = more
detailed model + aura). **Why 5 tiers:** enough granularity for a satisfying chase
without diluting the value of any single tier.

**How players obtain creatures (intentionally plural so playstyles converge):**
1. **Capture** in zones (skill, free, the rare ones) — primary.
2. **Buy** on the Avenue (coins, commons/mids) — floor.
3. **Fuse** two into a hybrid — the crafting path.
4. **Heist** a clone from a rival (social).
5. **Events** (rare wild spawns, season rewards).

**Collection:** a **Creaturedex** tracks every discovered species (thumbnails from the
generation pipeline). Completion goals per zone/rarity drive long-tail retention.

**Progression — creature levels:** each creature has a **Level** that raises its
passive income (and battle stats). Leveling costs coins → an always-on coin sink and a
reason to keep your *best* creatures rather than churn them. Visual stays identical; a
"Lv N" label communicates power. (Already prototyped.)

**Fusion (the signature crafting system):**
- Consumes **both** inputs (a sink — critical for economy health).
- Requires a **Catalyst** (earned from zones/heists/battles — gates fusion behind
  *active* play, prevents idle-farm casinos).
- Outcome weighted by input rarity; **odds are shown** (no dark-pattern gambling);
  **pity timer** guarantees a top-tier result within N fusions of high inputs.
- Cooldown to prevent spam. **Why all these guards:** without them, fusion becomes an
  infinite-money / infinite-mythic exploit (see §15).

**Mutations / Evolution / Breeding — challenged and cut for v1:**
- **Breeding** overlaps Fusion's design space and adds timers, nurseries, and
  genetics UI — heavy scope for marginal new fantasy. **Cut.** Fusion *is* our
  creation system.
- **Evolution** (a creature leveling into a new form) is just Fusion-with-one-input
  re-skinned; folded into the **Level** + occasional "evolved appearance at Lv 10"
  cosmetic milestone. Cheap, satisfying, no new system.
- **Mutations** kept as a *rare fusion modifier*: ~3% of fusions roll a "mutated"
  variant (alt palette + a stat/ability tweak) — adds collectible chase without a new
  subsystem.

**Statistics (for Battles):** HP, Attack, Speed, plus one **Ability**. Stat budget
scales with rarity × level. Kept to 3 stats + 1 ability deliberately — readable for a
10-year-old, deep enough for theorycraft via *types* (below).

**Abilities & types:** each creature has a **Type** derived from its archetype
(e.g., Food, Tech/Robot, Beast, Object, Cosmic). Types form a rock-paper-scissors+
chart granting damage multipliers, plus one active **Ability** (burst, heal, buff,
debuff, summon). Depth = team composition and type coverage, not stat inflation.

---

## 6b. Creature Generation Pipeline (a built competitive advantage)

A "roster of hundreds" is impossible to hand-author affordably. The game is built
around an **automated, modular generation pipeline** (already prototyped):

```
combo prompt (item A + item B, detail scaled by rarity)
   ↓  AI 3D provider (Meshy/Tripo adapter — or procedural fallback)
generate GLB  →  auto-compress (textures→1024/webp, dedup)  →  thumbnail
   ↓
assign metadata (rarity, income, type, abilities, scale, spawn weight)
   ↓
write manifest  →  game auto-detects & loads at runtime (no hardcoded list)
```

**Why this matters strategically:**
- **Content velocity:** new seasonal creatures cost minutes + cents, not artist-weeks.
- **No hardcoded roster:** drop a model in, it appears in spawns, market, dex, battles.
- **Provider-agnostic:** the AI backend is a swappable adapter; no lock-in.
- **Performance-safe:** the compression step (proven 46 MB → 0.8 MB) keeps the browser
  build light even with AI assets.

**Guardrails (critical — this is a cost/quality risk, see §15):**
- Generation is **batch-curated, never fully automatic** — a human approves a batch
  before it ships (quality gate + cost control). The pipeline *assists*, it doesn't
  auto-publish.
- A **fixed approved pool** feeds spawns/fusion; expanding it is a deliberate content
  drop, not a live API call per encounter.
- Animated/skinned models are **capped on-screen** (LOD/instancing) to protect perf.

This pipeline is the practical enabler of the entire "endless collection" fantasy and a
genuine differentiator versus hand-authored competitors.

---

## 7. Base System

- **Purpose:** home, income engine, identity/flex space, and the *object* of Heists.
  It is the player's "save file made visible."
- **Upgrades:** creature **slots** (hard cap — see economy), income multipliers,
  catalyst generators, defense modules. Upgrades are coin sinks with rising costs.
- **Visual progression:** base tiers visibly evolve (hut → compound → fortress) — a
  powerful, free retention signal (status you can *see* and others see during Heists).
- **Economy:** passive income from placed creatures (soft-capped, §8).
- **Defense (for Heists):** **dodgeable skill-check** modules (laser gates, turrets,
  traps) with cooldown/fuel and a **hard cap** — bases are never un-raidable. Money
  buys *variety/spice*, not invulnerability. **Why:** a wall-based defense economy is
  pay-to-win and kills the heist meta.
- **Customization:** cosmetic decor (the **primary fair monetization** surface, §13).

---

## 8. Economy

**Currencies (kept minimal to avoid confusion):**
- **Coins** — soft currency. Earned everywhere, spent on everything (buys, levels,
  base upgrades, fusion fees). The economy's bloodstream.
- **Catalyst** — fusion gate currency, earned only via *active* play. Not buyable for
  power.
- **Gems** — premium currency. **Buys cosmetics, battle pass, convenience (extra
  market refresh, loadout slots) — never power.** (§13)
- **Trophies/MMR** — ranked currency (seasonal, see §9). Not tradable.

**Passive income:** sum of placed creatures' leveled income × base multiplier, with a
**soft cap**: beyond a threshold each additional creature contributes sharply less.
**Why:** prevents idle from dominating and keeps active play the real earner. Offline
income is **capped at a few hours** of accrual — enough to reward checking in, not
enough to make playing pointless.

**Active income:** zone clears, heist successes, battle wins, events — *uncapped* and
the main driver. The design intent: an active hour should beat a day of idle.

**Upgrade costs:** exponential, tuned so each upgrade's payback time is roughly
constant (~a session) → steady sense of progress without a wall.

**Inflation prevention (the hard part):** mature collection games die of currency
inflation. Sinks, in priority order: **fusion consumes creatures + coins**, **creature
leveling** (scales forever), **base upgrades**, **Black Market** rotating high-cost
cosmetics/consumables, **market rerolls**, and **cosmetic vanity**. Faucets are tuned
against total sink capacity, monitored via a live "coins created vs destroyed" metric.
A late-game **prestige/seasonal reset of *coins only*** (never collection) is held in
reserve if inflation runs hot.

---

## 9. PvP Design

**Why PvP exists:** to convert a single-player collection grind into a *social,
self-renewing* content source (other players are infinite content) and to give the
collection a *test* — mastery needs an opponent.

Two tiers, deliberately different in stakes:

### 9a. Heists (mid-game, social, low-stakes — MVP pillar)

**Challenge first (the brief asked us to interrogate stealing):** classic creature-
*theft* — where the victim permanently loses a pet they earned — is a **retention
toxin**. It feels great for the thief and catastrophic for the victim, and the victim
is usually the one who needed protecting (newer/weaker). A naive steal mechanic would
sabotage the whole no-punishment philosophy. **We therefore reject literal theft and
keep only a defanged version**, justified because the *social friction and chase* it
creates are genuinely valuable:
- Asynchronous raid on a rival base (NPC early; real players later).
- Objective: steal **one** creature → but as a **reduced-income CLONE**. Owner keeps
  the original and takes a temporary income debuff + alarm. **Nobody loses a
  collectible.** This is the single most important anti-churn decision in the doc.
- Run flow: enter → dodge/disable defenses (skill) → grab → become slow & vulnerable
  (carry rule) → escape to your base. Caught → the clone is lost, you pay a cooldown.
- **Anti-frustration:** revenge-shield after being robbed, daily raid caps, safe-slots
  (1–2 player-chosen creatures are unstealable), recently-raided protection.
- **Anti-exploit:** matchmaking by progression bracket (no whale-stomps-newbie), entry
  stake forfeited on failure, async AI-controlled defense when owner is offline.

### 9b. Creature Battles (late-game, competitive, ranked — 1.0 headline)
- **Format:** asynchronous **tactical auto-battler**. You build a team (3–5), set
  positioning and ability priorities pre-battle, then watch it resolve with a few
  optional real-time ability triggers. **Why async + auto:** fair across latency and
  device, no smurf-rage of live twitch PvP, scales to mobile web, and the skill lives
  in *team-building and type coverage* (the deep, replayable part) rather than reaction
  speed (which excludes the mobile/young audience and invites cheating).
- **Matchmaking:** MMR-based; ranked tiers (Bronze→Mythic) with soft seasonal resets.
- **Modes:**
  - **Casual** — no rank change; experiment with teams. Always available, low pressure.
  - **Ranked** — MMR ladder, seasonal tiers/rewards. The competitive backbone.
  - **Tournament** — scheduled bracketed events (solo or guild), entry by coins/ticket,
    cosmetic + coin + catalyst prizes, spectatable. Appointment play + esports-lite
    prestige *without* gating power behind it.
  - **High Stakes** — **CHALLENGED & REDESIGNED.** The brief implies wagering something
    meaningful. If that "something" is **creatures, this mode is rejected** — it
    reintroduces the exact permanent-loss churn the whole design avoids, and it would
    become a whale/smurf predation engine. **Redesign:** High Stakes wagers **coins (and
    optionally seasonal trophies) from an escrow both players stake**, with a **cap** so
    no single loss is devastating, **bracket matchmaking** so you only risk against
    peers, and **opt-in only**. It delivers the adrenaline of "real stakes" while the
    collection stays untouchable. This is the only responsible version of the mode.
- **Seasonal progression:** ~6–8 week seasons; rank → seasonal cosmetic/title rewards;
  rank decays gently to keep ladders fresh.
- **Rewards:** coins, catalysts, cosmetics, exclusive *cosmetic* creature skins for top
  tiers. **No power-only rewards locked behind rank** (would spiral the rich-get-richer).
- **Can creatures be lost? No.** Battles never stake the collection. Stakes = trophies,
  rewards, pride.
- **Anti-pay-to-win philosophy:** all battle power is obtainable through play; gems buy
  cosmetics/convenience only; matchmaking is by MMR not spend; new players get a viable
  starter team. A whale climbs by *skill and time*, not wallet.

---

## 10. Multiplayer

- **Player interaction:** Heists, Battles, shared social spaces (Fusion Lab, Arena
  lobby), emotes.
- **Trading:** **creature trading between friends/guild**, gated by anti-fraud rules
  (level requirements, trade holds, no coins-for-creature to curb RMT). Trading
  smooths collection completion and creates social glue — but is a **fraud/RMT risk**
  (§15) so it ships *after* launch with guardrails.
- **Guilds:** shared goals, guild leaderboard, guild-vs-guild seasonal events, guild
  perks (small, non-power: extra market slot, catalyst trickle). Guilds are the #1
  long-term retention lever in this genre.
- **Friends:** friend list, spectate, friendly (no-stakes) heists/battles.
- **Leaderboards:** global + guild + friends, for rank, collection %, and richest base.
- **Events:** world rare-spawns, double-income, seasonal zone takeovers, guild wars.

---

## 11. Retention Systems

- **Daily:** login streak (cosmetic/coins, **never power that snowballs**), 3 rotating
  daily missions, a free daily market reroll.
- **Weekly:** mission set with a meaningful chase reward (catalyst bundle, cosmetic).
- **Achievements:** one-time goals across collection/skill/social.
- **Season Pass:** free + premium tracks; **cosmetics, coins, catalysts, convenience**
  — explicitly **no exclusive power**. (§13)
- **Limited events:** seasonal creatures (return next year — FOMO without permanent
  power exclusion).
- **Rare world spawns:** appointment play, social notification spikes.
- **Collection goals:** Creaturedex completion, per-zone sets, mutation hunting.

**Design rule:** retention rewards bias toward **horizontal** (cosmetic, collection)
over **vertical** (raw power), so lapsed players can always return without being
hopelessly behind.

---

## 12. Progression Summary

Beginner (catch/buy/place, learn loops) → Early (zones 1–2, first fusion, NPC heists)
→ Mid (heist meta, defenses, notoriety, catalyst economy, ranked placement) → Late
(ranked battles, guilds, mythic fusion hunt) → Endgame (leaderboards, dex completion,
seasonal prestige). Power curve is **front-loaded then flattens into horizontal
goals** — the only sustainable shape for a live game.

---

## 13. Monetization (fair only)

**Philosophy: sell identity and time, never power.**
- **Cosmetics:** base decor/themes, creature skins, trails, emotes, name flair. The
  primary revenue and a perfect fit (bases are flex spaces).
- **Season Pass:** premium cosmetic/convenience track.
- **Convenience (non-power):** extra base loadout slots, extra market refresh, offline-
  income cap extension (small), auto-collect QoL. Tuned so a free player is never
  *gated*, only slightly slower on chores.
- **Explicitly NOT sold:** creatures with exclusive power, catalysts-for-power, battle
  win-rate boosts, raid invulnerability, rank.
- **Whale ceiling:** the most a payer gains is *cosmetics + convenience + time saved*,
  capping the free-vs-paid power delta near zero. This protects the competitive
  integrity that makes PvP worth playing.

---

## 14. Technical Scope

- **Low risk:** hub/zones rendering, capture, base income, market, fusion, creature
  pipeline (already prototyped in Three.js), local save. These are largely built.
- **Medium risk:** asynchronous Heists (needs a base snapshot + server validation to
  prevent cheating), defense simulation, leaderboards, accounts/auth, cloud save.
- **High risk:** **Creature Battles balance** (an entire metagame — content-hungry,
  needs continuous tuning), **anti-cheat for any client-authoritative outcome**
  (battle/heist results MUST be server-resolved), **trading/RMT fraud**, **live
  economy tuning**. These are where the project lives or dies.

**MVP (ship to validate fun):** single-player core — zones, capture, base income
(soft-capped), market, fusion, creature levels, **NPC-only Heists**, local save.
No real-time multiplayer. Goal: prove the catch→fuse→heist loop is fun before paying
for servers. *(This is essentially the current prototype + fusion.)*

**Version 1.0 (commercial launch):** accounts + cloud save, **real-player async Heists
with matchmaking**, **ranked Creature Battles**, guilds (basic), season 1, cosmetics
shop, leaderboards, anti-cheat server resolution.

**Future updates:** trading, guild wars, new zones/seasons, mutation expansions,
spectator/replays, creator/UGC creature submissions, mobile app wrappers.

**Scope verdict:** the brief's "do both PvP systems at once" is the biggest scope
trap. Sequencing Heists (MVP) → Battles (1.0) is the difference between shipping and
not.

---

## 15. Balance Analysis (risks → solutions)

| Risk | Failure mode | Solution |
|---|---|---|
| **Idle dominance** | players stop engaging, game feels like a spreadsheet | passive soft-cap + offline cap; active income uncapped |
| **Fusion casino** | farm commons → gamble mythics → infinite power/money | catalyst gate (active-only) + consumes inputs + cooldown + shown odds + pity |
| **Market snipe** | refresh-scumming for rares | personal market + pity, not shared |
| **Economy inflation** | coins worthless, progression flattens | layered sinks, faucet/sink telemetry, reserve coin-only prestige |
| **Heist alt-farming** | farm weak alt bases for free clones | progression-bracket matchmaking, daily caps, entry stake |
| **Offline raiding** | get farmed while away | revenge-shield, async AI defense, safe-slots |
| **Pay-to-win drift** | wallet beats skill, PvP dies | power is play-only; gems = cosmetics/convenience; MMR not spend |
| **PvP snowball** | winners get unraidable/unbeatable | defense hard cap, clone-not-steal, reward = horizontal, MMR |
| **Battle meta staleness** | one team dominates → churn | type RPS chart, regular balance patches, banned-pick rotation, seasons |
| **Griefing (heists)** | targeted harassment of one player | per-target cooldown, caps, no-permanent-loss removes the sting |
| **Trading/RMT fraud** | real-money creature sales, scams | trade holds, level gates, no coin-for-creature, ship post-launch |
| **Retention cliff at 50–200h** | content runs out | season cadence, guild systems, horizontal goals, events |
| **Browser perf** | heavy GLBs, many skinned meshes | model compression pipeline (built), instancing, LOD, cap on-screen animated creatures |
| **AI-gen cost/quality** | credits burned on bad models; off-brand or low-quality creatures ship | batch human-curation gate, fixed approved pool, procedural fallback, per-batch cost cap, never auto-publish |

**Biggest single risk:** the **battle metagame** — it is content-hungry and the most
likely thing to be under-resourced. Mitigation: keep the stat model tiny (3 stats + 1
ability + type chart) so balance is tractable, and treat it as a *live service*, not a
one-shot.

---

## 16. Final Evaluation

| Axis | Score | Note |
|---|---|---|
| **Fun** | 8 | catch+platforming+fusion is immediately satisfying; battles add depth |
| **Originality** | 7 | combination is fresh (skill platforming + collection + dual social PvP); individual parts are known |
| **Replayability** | 8 | collection + ranked + seasons + events |
| **Social interaction** | 8 | heists, battles, guilds, trading, leaderboards |
| **Long-term retention** | 6 | strong *if* content cadence holds; the genre's classic weakness |
| **Development difficulty** | 6 | MVP is modest; 1.0 (netcode, anti-cheat, battle balance) is hard |
| **Commercial potential** | 7 | proven genre demand + fair monetization; success hinges on live-ops |

**Overall: a strong 7.5/10 concept** with a clear path to commercial viability *if*
the team respects the sequencing and the live-service nature of the battle/economy.

### Top recommendations
1. **Ship Heists, not Battles, as MVP.** Validate the cheap, original loop before
   funding the expensive, content-hungry one.
2. **Never let players lose a creature.** Clones and ranked-only stakes. This one rule
   protects retention more than any feature adds to it.
3. **Cap idle, reward active.** The game must punish *nobody* but reward *playing*.
4. **Power is earned, identity is sold.** Hold this line absolutely or PvP dies.
5. **Treat economy + battle balance as live services** with telemetry from day one.
6. **Consider a name/brand audit:** "Brainrot" is trend-timely but may date quickly and
   complicate store/age ratings — evaluate a more durable brand before marketing spend.

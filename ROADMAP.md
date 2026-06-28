# Brainrot Heist — Production Roadmap (Director's cut)

> Collection-first reorder. Respects the existing Three.js/TS/Vite build — no rewrites.
> Principle: prove the single-player *collect → progress* loop is addictive before
> spending a cent on backend or PvP.

---

## 0. The one critical insight (read first)

The brief lists **stats, elements, abilities** as MVP. Half-true:

- **Stats + Elements + Ability *tags*** = cheap **metadata**. Add them to the manifest
  **now** (Low) so hundreds of creatures aren't retrofitted later. ✅ MVP.
- **The Ability *system*** (what abilities *do*) only matters inside **Battles**, which
  are 1.0. Building a combat/ability engine in "MVP" is the expensive rewrite you asked
  me to avoid. ❌ Not MVP.

So: **stamp the data in MVP, build the system in 1.0.** This single split saves the most
development time of anything in this document.

Second insight: a "**living base**" (creatures with personality) is the cheapest,
highest-charm retention hook available and leans directly into the funny-creature
identity. Worth a **light** version in MVP; the full simulation can wait.

---

## 1. Classification of the current roadmap (D1–D7)

| Current item | Verdict | Note |
|---|---|---|
| D1 Avenue + Conveyor shop | **Keep** | done; part of MVP economy |
| D2 Fusion | **Keep / Move Earlier** | it *is* the MVP collection driver — build next |
| D3 NPC Raids | **Move Later** → Early Access | PvE social spice, not core collection |
| D4 Base Defense | **Move Later** → Early Access | depends on raids |
| D5 Day/Night | **Move Later** → Early Access | flavor; postpone |
| D6 Notoriety | **Move Later** → Early Access | depends on raid loop |
| D7 Economy balance/UI | **Keep (continuous)** | ongoing across all stages |

Nothing is removed — the PvP-ish items are **resequenced** behind collection depth.

---

## 🟢 MVP — "make collecting irresistible"

Goal: a single player keeps thinking *"what weird creature is next?"* and *"what does
this fuse into?"* No backend, no PvP.

| Feature | Why this stage | Complexity | Dependencies | Retention | Blocks release? |
|---|---|---|---|---|---|
| **Creature metadata** (type/element/stats/ability-tag) | foundational; avoids mass retrofit later | **Low** | manifest/`CreatureDef` | indirect (enables everything) | **Yes** (foundation) |
| **CreatureDex** (collection book) | collection is the heart; the chase needs a tracker | **Low** | metadata, discovered-set (exists) | **High** | Yes |
| **AI creature pipeline** | already built; the endless-roster engine | **Done** | — | High | Yes |
| **Fusion** | the "wow"; core crafting + coin sink | **Med** | Library, BaseStorage, Economy | **High** | strongly recommended |
| **Evolution (light)** = Lv-milestone form/aura change | satisfying growth without a new system | **Low** | creature levels (exist) | Med | No |
| **Mutation** = rare alt-variant on fusion (~3%) | collectible chase, near-free | **Low** | Fusion | **High** | No |
| **Daily Shop** (rotating offers) | builds the daily-habit loop early | **Low–Med** | Economy, market (exists) | **High** | No |
| **Rare world spawns** (timed wild rare in a zone) | appointment play, "discovery" spikes | **Med** | zones, capture (exist) | **High** | No |
| **World events (light)** (double-income / spawn surge) | low-cost variety + reasons to log in | **Low** | event bus (exists) | Med | No |
| **Personality (light)** — idle reactions/emotes between based creatures | charm = the brand; cheap | **Med** | base, creatures (exist) | **High (charm)** | No |
| **Income soft-cap + economy sinks** | stop idle from killing exploration | **Low** | BaseStorage/Economy | High (health) | Yes |

**MVP exit criteria:** a fresh player plays 30–60 min, owns ~10 creatures, has fused at
least once, hit a rare spawn, and *wants to come back tomorrow* for the daily + the next
weird creature. If that's not true, do not move on.

---

## 🟡 Early Access — "deepen the PvE world"

Goal: more to explore, more to optimize, first taste of social friction (still no
mandatory backend — NPC-driven).

| Feature | Why this stage | Complexity | Dependencies | Retention | Blocks release? |
|---|---|---|---|---|---|
| **More zones** (Jungle, Factory, Carnival, Sky, Desert, Underwater) | content breadth + new creatures | **Med** | obstacle engine (exists, reusable) | **High** | No |
| **Base upgrades & visual tiers** | visible progression / status | **Med** | base, economy | High | No |
| **Decorations** | identity + cosmetic sink (monetization later) | **Low–Med** | props pipeline (built, unwired) | Med | No |
| **NPC encounters** (wandering NPCs, quests, mini-challenges in zones) | PvE social flavor *without* base raiding | **Med** | zones, creatures | Med | No |
| **Economy polish** (telemetry, tuning) | keep faucets/sinks healthy at scale | **Low–Med** | economy | High (health) | No |
| **Seasonal creature additions** | the live-roster promise begins | **Low** (pipeline) | pipeline | High | No |
| **Personality (full)** — relationships, base-wide moods/bonuses | charm → light strategy layer | **Med–High** | personality-light | Med | No |

**Early Access exit criteria:** the PvE loop is *demonstrably* fun for 10+ hours and
players ask for opponents — that demand is the green light to spend on backend.

---

## 🔵 Version 1.0 — "go online" (only after PvE is proven)

Goal: the expensive, irreversible systems. Each one here costs real money/time, so it's
gated behind a proven game.

| Feature | Why this stage | Complexity | Dependencies | Retention | Blocks release? |
|---|---|---|---|---|---|
| **Accounts + Cloud saves** | prerequisite for anything online | **High** | backend | High | **Yes** (for 1.0) |
| **Backend / authoritative server** | anti-cheat foundation for PvP/economy | **High** | — | — | **Yes** |
| **Battle resolver + ability system** | turns the MVP stat metadata into real combat | **High** | metadata (MVP), server | High | **Yes** |
| **PvP "fight for a creature"** (wager → clone) | the core PvP identity; no permanent loss | **Med** (atop resolver) | resolver, clone primitive (from raids) | **High** | **Yes** |
| **Matchmaking** (start with ghost/snapshot) | enables PvP without live netcode first | **Med–High** | server, battle | High | gates ranked |
| **Ranked + Seasons** | competitive retention engine | **Med** | matchmaking | **High** | No |
| **Guilds (basic)** | #1 long-term social glue | **Med–High** | accounts | **High** | No |
| **Anti-cheat (server resolution)** | protects economy + ladder integrity | **High** | backend | — | **Yes** |

**1.0 principle:** all battle power is earnable; matchmaking is by skill not spend; the
collection is never lost (clone rule).

---

## 🟣 Future Updates — "live service"

| Feature | Why this stage | Complexity | Dependencies | Retention | Blocks release? |
|---|---|---|---|---|---|
| **Trading** | collection completion + social, but RMT/fraud risk | **Med–High** | accounts, anti-fraud | High | No |
| **Tournaments / brackets** | esports-lite prestige | **High** | ranked | High | No |
| **World bosses** | shared PvE spectacle | **High** | server, multiplayer instances | High | No |
| **Cooperative events** | social PvE, softer than PvP | **Med–High** | multiplayer | High | No |
| **New regions** | evergreen content | **Med** | obstacle engine | High | No |
| **New creature generations** | the endless-roster promise, ongoing | **Low** (pipeline) | pipeline | **High** | No |
| **Battle Pass / live-service cadence** | sustainable fair monetization | **Med** | accounts, seasons | High | No |

---

## 🟠 Version 2.0 — Creature Siege (future; design-for, don't build)

A real-time **Siege** mode: the player stays in **third-person** and **commands a small
squad** of their own creatures (Follow / Attack target / Defend area / Hold / Ultimate).
Creatures fight via their **own AI**; the player is a *commander*, not a unit-controller.
This is NOT a classic RTS. **Not in MVP, 1.0, or near-term. Do not implement now.**

**The only obligation today:** the architecture must absorb Siege later *without a
rewrite*. Two rules enforce this:

### Rule 1 — Full creature data model exists NOW (even if unused)
`CreatureDef` must carry every field future modes need, populated by the generation
pipeline, defaulted where the MVP doesn't use them. Cost: **Low** (a schema + generator
stamp). MVP/Future: **add schema in MVP**, most fields *consumed* later.

```
CreatureDef = {
  // identity / collection
  id, name, rarity, element, archetype, weight (spawnWeight), cost, evolutionStage,
  // economy (MVP uses these)
  income,
  // combat & AI (Arena 1.0 + Siege 2.0 will consume these; stamped now, dormant in MVP)
  hp, attack, defense, speed, attackRange, attackType, movementSpeed,
  passiveAbility, activeAbility, aiBehavior,
  // presentation
  file, thumb, scale, rotationY, palette, glow, animations[]
}
// instance-level (not in def): level, currentXP, mutationFlag
```

### Rule 2 — Creatures are reusable ENTITIES, not income widgets
A creature is one entity that exposes **capability interfaces** consumed by mode-specific
systems — never bespoke per-mode logic:
- `Carryable` (exploration) — already implemented.
- `Storable` / income source (base) — already implemented.
- `Combatant` (Arena 1.0, Siege 2.0) — *interface reserved now, implemented later*.
- `Commandable` (Siege 2.0) — reserved.

Stat values derive from `def.baseStat × level × rarity` through **one shared helper**, so
income (MVP), battle stats (1.0) and siege stats (2.0) all read the same source of truth.

**The litmus test for every new system:** *"Can Exploration, PvP Arena, and future Siege
all reuse this?"* If no → redesign before building. (e.g. income must read a derived
`value`, not a hardcoded field, so combat can derive its own stats the same way.)

---

## 2. Summary of changes vs the original plan

- **Collection systems pulled into MVP** (Fusion, Dex, Mutation, rare spawns, daily
  shop, light personality) — the heart of the game ships first.
- **Raids/Defense/Day-Night/Notoriety pushed to Early Access** — PvE spice, not core.
- **All backend/PvP pushed to 1.0** — gated behind a *proven-fun* PvE loop.
- **Stats/Elements/Abilities split:** metadata in MVP (Low), combat system in 1.0
  (High). The single biggest anti-rewrite decision.
- **Two urgent, cheap MVP debts:** income soft-cap + creature metadata. Do them with
  Fusion as the immediate next block.

This sequence maximizes retention (collection hooks early), minimizes wasted work
(no battle engine until its data and audience exist), and never throws away the
working Three.js core.

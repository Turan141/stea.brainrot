# Brainrot Heist — Game Design (locked 2026-06-28)

Original game inspired by the *progression loop* of "Steal the Brainrot" — NOT its
content, assets or design. Web 3D (Three.js + TS + Vite). Single-player now with
**NPC rivals**; architecture kept multiplayer-ready.

## World & acquisition
- **Adventure Zones = core earner.** Themed obstacle courses (Ice Cave, Volcano,
  Toxic Lab, Ancient Temple). Catch **rare** creatures free, by skill + risk.
- **Central Avenue = secondary.** A conveyor delivering **common/mid** creatures
  for coins. Market is **personal** (per player) with a **pity timer** on rares —
  no refresh-scumming. Safe but slower payback than zones.
- **Carry rule everywhere:** slower, no sprint, vulnerable. Ties zones/raids/defense.

## Base & income
- Stored creatures give **passive income with a soft cap** (each extra creature
  yields less past a threshold) → active play (zones/raids/fusion) always pays more.
  Kills idle-grind.
- Base visually evolves; slots/decor/defense unlock via progression.

## Fusion
- Consumes **both** inputs. Outcome by **rarity weights** (rarer inputs → better
  odds). Requires a **catalyst** resource (sink, from zones/raids) + **cooldown**.
  **Odds shown**, **pity** on top outcome. No common-farm casino.
- All outcomes drawn from the **fixed approved model pool**.

## PvP Heist (NPC rivals now, multiplayer-ready)
- Steal a **creature, not coins**, **1 per raid**.
- **Steal = CLONE with debuff, not removal:** thief gets a **reduced-income copy**;
  owner keeps the original but takes a temporary **−% income + alarm**. Resolves the
  "no frustrating losses" goal while keeping raids meaningful.
- **Failure costs:** entry stake + cooldown (lost on fail). Success: stolen creature
  on a **protected cooldown** (can't be re-stolen immediately).
- **Protection by slots:** 1–2 player-chosen **safe slots** (not by "freshness").
  Always something stealable, but not everything exposed. Mythics aren't immune but
  yield a smaller clone and harder guards.

## Base defense = skill-check, NOT a wall
- Lasers/turrets/traps/alarms are **dodgeable** (like our obstacles), with
  **cooldown/fuel** and a **hard cap**. No impenetrable base. Money buys **variety**,
  not invulnerability → no pay-to-win.

## Notoriety + Day/Night
- Stealing raises **Notoriety**: NPCs raid you more/harder, but targets get richer.
  Notoriety **decays** over time.
- **Day:** farm / buy / capture / fuse. **Night:** raid windows (raid NPCs / defend).
  Cycle can be sped up — never "stuck".

## Progression
- Income: capped passive + zones + raids + fusion. Spend on: new zones, player
  upgrades, base, defense, slots, catalyst.
- Camera: **third-person** (our action edge vs top-down clones).

## Anti-exploit summary
fusion-casino → catalyst+cooldown+pity · refresh-scum → personal market+pity ·
alt/offline raiding → (NPC now; later brackets + revenge-shield + async defense) ·
low-risk raid → stake+cooldown · fresh-cycling → slot-based protection ·
snowball → income soft-cap + reward scaling + defense cap.

## Meshy / credits policy
Fixed pool **~15–20 creatures** (batch-approved) + 1 character. Fusion/spawn draw
from the pool. New species **only in approved batches** — never automatic. See
memory: confirm-meshy-generation.

## Build order
**D1** scene + conveyor · **D2** fusion · **D3** NPC bases + raid (clone-steal) ·
**D4** defense (skill-check) · **D5** day/night · **D6** notoriety · **D7** balance + UI.

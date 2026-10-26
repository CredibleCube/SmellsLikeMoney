# Playability iteration: v0.2 → v0.3

This is an implemented design experiment, not a claim that automated tests can measure enjoyment. Source notes and precise links are in [cleanup research](research-cleanup.md) and [action research](research-action.md).

## Evidence and decisions

| Evidence actually read or measured | Change made | Why it is testable |
| --- | --- | --- |
| A FuturLab-coauthored PowerWash Simulator research manuscript describes aiming at objects and nested completion, including individual window frames. | Four skum pockets, four crust clumps, four slurry clouds, and twelve wall patches hold real, finite material. Sweeping the tool or using Q changes the local source. | Unhit patches stay dirty; one fixed aim cannot finish a whole spatial phase. Each local account must equal its share of the global conservation ledger. |
| The PowerWash research distinguishes enjoyment, competence, autonomy, and actions from total playtime. Its observational mood results do not establish a causal design recipe. | Faster default operation, small completion rewards, optional boost and collectibles; no forced countdown or irreversible failure. | Measure full-job pacing and early useful feedback. Ordinary completion and the 575-credit invoice do not require mastery points, collectibles, or a perfect run. |
| Developer-published Celeste code deliberately implements forgiving input and variable jumps. | A 120 ms landing jump buffer, short/held jumps, and explicit use commands that plant the worker's feet before validating range. | Test buffered landing, no automatic repeated jumping, immediate stop/use, airborne and distance guards, pause, and reset. |
| Hedgewars has separate aim/fire/tool selection, a crosshair tied to the character, and finite-target training phases. | A continuous mouse reticle affects real cleanup contact; Q/Shift+Q offer keyboard aiming. Each work packet provides a finite visible win and a concise next action. | Verify real pointer movement changes the material source while the tool keeps running; keyboard controls reach every target. |
| The v0.2 normal acceptance route took about 544 seconds. About 80% was fixed-target skimming, drawdown, mixing, and slurry pumping. Default pumping continued removing material after ten seconds with no further input. | Raise provisional rates and replace fixed-target spatial phases with local cleanup. Add an optional heat-managed pump boost. | Compare completed routes; check that unassisted fixed aim stalls at a cleared pocket while the rest remains, and that boost trades throughput for recoverable heat. |
| At 1440×900 in v0.2, the arena ended near y830, primary controls began below y950, and pump controls were around y1307. | Move tools, local progress, flow/load, water minimum, and the next instruction into a compact arena HUD. Keep detailed ledgers and manual controls in an accessible drawer. | Assert the critical HUD elements fit inside common desktop viewports; separately test narrow scrolling and 44 px action targets. |

## Feedback and replay

Local completion points, combos, and three optional crew bolts are separate from the fictional invoice. Rewards have unique per-job keys, so repeated aiming, tool switches, or revisits cannot farm points. Mistakes remain recoverable. Scores and badges offer optional replay goals without preventing job completion or imposing hidden charges.

All visual dirt removal derives from the material state. Particles, sound, and floating rewards reinforce actual work; they never create or delete bulk material. Reduced-motion and mute modes retain progress information.

## Validation and limits

Tests cover water/solids conservation, local/global partition equality, finite sources and rewards, both full jobs, water and clog recovery, boost/bogging, input forgiveness, and DOM aiming/control behavior. Browser reports record actual automated routes using visible controls; time acceleration advances the real fixed steps and does not edit state.

The studies read are not sales/retention analyses and do not prove that a particular mechanic caused commercial success. Several publisher/store/interview hosts were blocked by this environment, so no unread postmortem or sales claim is presented. Human play is still needed to judge whether this iteration feels better and whether players want another run.

## Measured outcome of this build

The full Chromium acceptance routes completed the normal job in 188.7 simulated active seconds and the deliberate recovery challenge in 254.9 seconds, compared with 543.8 and 739.7 seconds in v0.2 (about 65% shorter). A separate arcade route used local aiming, boost, and optional pickups and finished in 190.3 seconds with 7400 unpriced points and the unchanged 575-credit invoice. These are scripted routes, not human enjoyment or first-play measurements.

All 66 automated core tests and 47 browser checks passed. The latter include 23 full-job checks, 15 movement checks, and 9 new arcade checks. The UI measurements place every primary gameplay control/status above y812 at 1440×900 and 1280×900. The new spatial phases cannot be completed by leaving the nozzle on one pocket.

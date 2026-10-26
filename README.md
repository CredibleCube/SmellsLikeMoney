# Smells Like Money

A playable, original 2D septic-service game with direct side-view character control: walk, jump, crouch, aim tools, and work the yard from the first lid to a fictional invoice. Version 0.3 adds active local cleanup, sweeping aim, shorter jobs, heat-managed boost, combos, and optional jump collectibles. The working title is provisional.

**[Play online](https://crediblecube.github.io/SmellsLikeMoney/)**

Built with TypeScript, Vite, Canvas 2D, and accessible HTML controls. No backend, accounts, paid assets, API keys, or runtime network services. The worker always stays outside the tank.

## Play without installing anything

Download [release/Smells-Like-Money.zip](release/Smells-Like-Money.zip), extract it, then open **Smells-Like-Money.html** in a current desktop browser. The HTML contains the production JavaScript and CSS; it needs no server or internet connection. It is also available directly as [release/Smells-Like-Money.html](release/Smells-Like-Money.html).

If the chat's visualization panel says “An error occurred inside the visualization — svg,” download the ZIP rather than using that panel. The game draws with Canvas and its standalone version does not contain an SVG asset.

To regenerate the self-contained document and matching ZIP, then check the result:

```sh
npm run build:standalone
npm run test:standalone
```

The standalone check verified setup, suction/material movement, production walking/jumping/crouching, keyboard controls, pause/resume, and settings with networking disabled, storage denied, and zero external requests or browser errors. It loaded the ZIP-extracted HTML bytes into an opaque-origin browser document. This cloud Chromium's administrator policy blocks `file://` navigation, so double-click opening on a user's device remains a separate check. See [evidence/standalone-report.json](evidence/standalone-report.json). On a browser without that policy, opt into direct file navigation using `STANDALONE_FILE_CHECK=1 npm run test:standalone`.

## Publish through GitHub Pages

The repository includes `.github/workflows/pages.yml`, which tests the simulation, builds the self-contained game and ZIP, and deploys them with GitHub's official Pages actions after pushes to `main`. A final HTTP check verifies the actual published page includes the expected package version, not a cached earlier build. It also supports manual runs from the Actions tab. Publication was authorized separately after the original local-only scope.

One-time repository setup: in **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Then run **Publish playable prototype** from the Actions tab (or rerun its deployment job). If the repository's plan or permissions do not support Pages, the committed ZIP remains available for download without deploying a website.

Use the actual URL reported by the successful `github-pages` deployment; a committed workflow alone does not establish that the site is live. The standalone page needs no backend, secrets, or external runtime services.

## Run it

Prerequisites: Node.js **22.12+** (tested with 24.19.0) and npm (tested with 11.9.0). Standalone ZIP packaging also uses Python 3 (tested with 3.12.14; standard library only).

From `/workspace/SmellsLikeMoney`, or your local checkout:

```sh
npm ci --cache /tmp/smells-npm-cache --no-audit --no-fund
npm run dev
```

Open the address printed by Vite in a desktop browser. The `/tmp` cache flag keeps installation compatible with this cloud environment's writable directories; it is optional on a normal local machine.

```sh
npm run build       # TypeScript checking and production assets in dist/
npm run preview     # Serve the production build locally
npm test            # 66 simulation, spatial-work, movement, and clock tests
npm run test:browser
npm run test:movement-browser
npm run test:arcade-browser
```

The browser check starts Vite if necessary and uses an installed Chromium browser. This environment has `/usr/bin/chromium`; elsewhere specify its executable:

```sh
CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

Use `BASE_URL` to test an already-running development server on another address. Browser acceptance needs the **development build**, because its test clock is deliberately absent from production.

## Play a job

Choose **Clock in** for the normal seed-101 job, or **Try the recovery challenge** for seed 202. The challenge is a test preset in the same yard, with eight wipes, a shorter warning, and a tougher inlet.

1. Stand by the hatch and press **E** to open the lid, then **E** again to connect the vacuum hose.
2. Vacuum four visible skum pockets. Click or press Space to start, then sweep the pointer or press Q to move between dirty pockets. Stop when wipes approach; use Wipe removal. If they clog the hose, the same tool clears it without a restart.
3. Walk right to the inlet marker. Press **E** to inspect, then **E** again to use the clearing tool. Its comic incoming parcel is finite. Return to the hatch for tank work.
4. Draw water toward the displayed 1.8–2.2× mixing band. If you drain below the 1.5× minimum, add water with the garden hose.
5. Continue to mixing and sweep the crust buster across four settled clumps. Celebrate with “Smells like money!” if you like; audio never gates progress.
6. Chase the four slurry clouds, sweep all twelve wall patches with the hose, then vacuum the washdown. Clearing one spot reveals the clean area and earns finite crew points.
7. Walk left to the truck and press **E** to stow the tools. Return to the hatch and press **E** to close the lid, then issue the fictional invoice: 450 base + 75 wipes + 50 inlet = **575 game credits**.

The checklist and contextual instruction show the next step; disabled controls explain their guard. Tool switches stop work immediately. Moving immediately stops work. Stand in the marked work zone to operate a tool; using it plants your feet immediately. Tools use click-to-start/click-to-stop or Space, including timed wipe handling: no rapid clicking or holding required. There is no deadline, irreversible damage, truck capacity limit, or forced restart.

## Controls and accessibility

- **A/D or Left/Right**: hold to walk with acceleration and braking.
- **W or Up**: jump; a short tap makes a small hop, holding makes a higher jump. A fresh press just before landing is buffered for 120 ms. **S or Down**: crouch and move slowly. The worker always lands on the outside path.
- **E**: perform the nearby contextual action: open/connect, inspect/clear, use a tool, continue to mixing, stow, close, or invoice. The world marker and HTML button show the same guarded action.
- **1–5**: equip vacuum, wipe removal, inlet rod, crust buster, or garden hose. Tool selection stops movement and work.
- **Mouse click in the tank**: start the equipped tool. Sweep the pointer across dirt while working; aim changes the actual material source. Dragging also sweeps, and a second click on the same spot stops. **Space** starts/stops the selected tool. A cleared spot yields zero flow until you aim at another one.
- **Q / Shift+Q**: select the next/previous dirty spot without interrupting work. The labeled target selector and Next spot button are keyboard/mouse alternatives. Arrow keys move the worker.
- **Shift** or the **Boost** button: optional faster vacuum flow with greater pump load and heat. Release to cool; bogging remains recoverable. Moving, pausing, and switching tools clear boost.
- Clear spots in succession to build an optional combo. Jump for three optional crew bolts. Points, bolts, and invoice badges never change prices or gate completion.
- **Escape** pauses. Native buttons, sliders, selects, dialogs, and editable controls retain their keyboard behavior. Click the arena to take control; activating gameplay buttons also returns focus to it.
- **Throttle** and **Air break** are keyboard-operable sliders. The initial 80% / 15% settings avoid unavoidable bogging. High suction load heats the pump; lower throttle, add a small air break, or stop to recover. Excessive air reduces throughput.
- Use **How to play**, **Sound**, **Less motion**, and **Larger UI** as needed. Sound starts muted. Pause-menu copies of settings remain usable while paused.
- Pause, focus loss, and hidden-tab events stop tools and freeze time. Resume explicitly; tools remain off until restarted. Restart asks for confirmation.
- Only preferences persist locally. Reload returns to the title; there is **no mid-job save**. Storage failures are harmless.
- The compact desktop arena keeps the toolbelt, use/context actions, local progress, flow/load, and water minimum in view. Detailed controls and material ledgers are inside **Manual actions, pump tuning & material ledger**. Layout supports narrow windows with vertical scrolling. Desktop mouse and keyboard are the primary controls; this is not a mobile-first game.

Captions accompany all important cues. Pump/cue sounds are locally synthesized; the phrase uses an installed local English voice only when available. Missing or blocked audio stays silent. Mute cancels speech and silences every sound source. Reduced motion removes animated tool particles and the inlet splash; there is no camera shake.

## Model and tuning

All volumes and prices are fictional game values, not equipment guidance, operating specifications, or real billing. This is an outside-only game abstraction, never confined-space training.

- `src/config.ts`: rates, capacity, water bands, time step, tolerances, fee amounts, movement physics, and station positions/ranges.
- `src/fixtures.ts`: starting materials, seeds, finite wipe clusters, inlet strength.
- `src/types.ts`: schema, stages, materials, commands, and temporary status.
- `src/commands.ts`: centralized guards for every input route.
- `src/simulation.ts`: pure material transfers, recovery, fixed-step player movement, and stage advancement.
- `src/work.ts`: spatial material partitions, forgiving aim projection, dirty-spot selection, finite rewards, and optional collectible collision.
- `src/movement.ts`: deterministic acceleration, gravity, jumping, crouching, yard bounds, and outside work-position guards.
- `src/events.ts`: caption events and unique per-job fee keys.
- `src/runtime.ts`: 60 Hz fixed steps, clamped frame deltas, and bounded catch-up.
- `src/renderer.ts`: original chunky cartoon terrain, truck, expressive worker poses, aim guide, tool arcs, and effects derived from game state.
- `src/input.ts`, `src/audio.ts`, `src/ui.ts`, `src/main.ts`: controls, local sound, HTML interface, and lifecycle wiring.

Each of four scum/settled/suspended partitions and twelve wall patches exactly projects onto its global material account. The simulation conserves water (`W+CW+PW=550+A`) and solids (`S+U+M+R+CS+PS=290`), including the pending inlet parcel and real completion remainders. Suction never extracts unmixed solids or wall residue. Wipes are discrete, non-volume objects. Fixed fixtures need no random gameplay draws; seed and tick-indexed commands reproduce identical state and invoice results.

The new playability request replaces the original provisional pacing defaults: base vacuum flow is 9 u/s, hose filling 12 u/s, mixing 8 u/s, and wall removal 6 u/s. Boost multiplies pump flow by 1.6 and load by 1.3. Automated full UI routes now take about 3:09 normal and 4:15 with deliberate clog/water recovery, compared with about 9:04 and 12:20 in v0.2. These are accelerated, scripted routes, not measured human first-play times or a deadline. Aiming now changes real local cleanup, so simply waiting at one pocket cannot finish the job.

## Verification and actual-play evidence

Executed successfully in this workspace:

- Frozen installation with `npm ci` using the cache command above.
- `npm run build` and `npm test`: 66/66 tests passed.
- `npm run test:browser`: 23 checks passed; both complete jobs reached 575-credit invoices; no uncaught browser exceptions or console errors.
- `npm run test:movement-browser`: 15 checks passed, including held WASD/arrows, alias release, jump/crouch, bounds, nearby E interactions, native focus, direct mouse aim/fire, and reset/pause. See [evidence/movement-browser-report.json](evidence/movement-browser-report.json).
- `npm run test:arcade-browser`: 9 checks passed for local cleanup, continuous pointer sweeping, meaningful retargeting, finite points/combos, jump bolts, boost risk/recovery, responsive use, viewport fit, and full completion. See [evidence/arcade-browser-report.json](evidence/arcade-browser-report.json).
- Production preview smoke: HTTP 200, title/setup/suction work, material display changes, no browser errors, and the development test bridge is absent. See [evidence/production-report.json](evidence/production-report.json).

The pure tests cover spatial/global ledger equality, finite patch/collectible rewards, continuous aim, boost and recovery, acceleration, gravity, buffered/variable jumps, no held-key auto-jump, crouching, spatial interaction guards, movement stopping tools, station travel, and conservation after every simulated tick, source exhaustion, capacity, partial inlet release, water boundaries and recovery, slurry ratios, retained remainders, wall thresholds, wipe avoidance/clog/clearing, bogging and cooling, unique fees, guards, reset, pause, and exact replay. Clock tests verify clamping and discarded catch-up.

Browser acceptance drives visible HTML controls and native keyboard events. A development-only bridge advances **time**, using the real fixed steps and invariant assertions; it cannot inject gameplay commands or edit state. Production omits this bridge. Lifecycle events are explicitly emulated. Detailed outcomes and final material ledgers are in [evidence/browser-report.json](evidence/browser-report.json).

Actual Chromium screenshots:

| Evidence | Scene |
| --- | --- |
| [01-start.png](evidence/01-start.png) | Title and initial job card |
| [02-scum.png](evidence/02-scum.png) | Active surface suction |
| [03-wipes.png](evidence/03-wipes.png) | Wipe approach warning |
| [04-inlet.png](evidence/04-inlet.png) | Finite inlet event |
| [05-mixing.png](evidence/05-mixing.png) | Crust buster and mixing |
| [06-washing.png](evidence/06-washing.png) | Wall washdown |
| [07-invoice.png](evidence/07-invoice.png) | Completed normal invoice |
| [08-challenge-clog.png](evidence/08-challenge-clog.png) | Recoverable hose clog |
| [09-water-recovery.png](evidence/09-water-recovery.png) | Hose recovery after draining to 40 |
| [10-challenge-invoice.png](evidence/10-challenge-invoice.png) | Completed challenge invoice |
| [11-narrow-layout.png](evidence/11-narrow-layout.png) | Narrow completed layout |
| [12-narrow-controls.png](evidence/12-narrow-controls.png) | Narrow active controls |
| [13-390px-controls.png](evidence/13-390px-controls.png) | 390px controls and 44px button targets |
| [14-standalone-file.png](evidence/14-standalone-file.png) | Offline standalone production document |
| [15-platformer-jump.png](evidence/15-platformer-jump.png) | Direct character jumping |
| [16-crouch-and-aim.png](evidence/16-crouch-and-aim.png) | Crouching and slow movement |
| [17-context-interaction.png](evidence/17-context-interaction.png) | Nearby E interaction |
| [18-direct-tool-aim.png](evidence/18-direct-tool-aim.png) | Mouse aim and tool use in the scene |
| [19-active-cleanup-hud.png](evidence/19-active-cleanup-hud.png) | Compact HUD and actual local cleanup |
| [20-crew-bolt-jump.png](evidence/20-crew-bolt-jump.png) | Optional jump collectible |
| [21-boost-and-bog.png](evidence/21-boost-and-bog.png) | Heat-managed pump boost |
| [22-local-wall-cleaning.png](evidence/22-local-wall-cleaning.png) | Continuous pointer wall cleanup |
| [23-arcade-invoice.png](evidence/23-arcade-invoice.png) | Crew score separate from the 575-credit invoice |

This iteration is grounded in sources actually read: [PowerWash cleanup research](docs/research-cleanup.md), [Celeste and Hedgewars implementation research](docs/research-action.md), and the [evidence-to-change design log](docs/playability-iteration.md). These explain the observations, inferences, source-access limits, and remaining human-play questions. Testing caught and fixed water filling incorrectly selecting a wall, boost toggles re-enabling on focus, and an ambiguous wipe-warning context action.

This iteration takes broad inspiration from side-view tactical games through movement, aim-and-use tools, heavy outlines, and a compact field HUD. Terrain, character, truck, and interface art are original. The single-worker cleanup loop remains real-time; no combat or turn economy was added.

Remaining human checks: audible sound quality/local voice availability, physical tab switching across browsers, screen-reader usability, and first-play pacing. Headless tests verify the audio-denial fallback and lifecycle handlers, not those subjective/device-specific results. The live site is published through GitHub Pages; no commercial-readiness claim is made.

Reusable cloud `install_script` and `start_skill` drafts were saved after validation. They reinstall from the lockfile, validate the build/tests, and explain restarting Vite from the existing isolated checkout. Draft saving does not publish the environment or deploy the application.

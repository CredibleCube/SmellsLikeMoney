# Smells Like Money

A playable, original 2D septic-service prototype: one yard, one parked truck, and one complete job from opening the lid to a fictional invoice. The working title is provisional.

Built with TypeScript, Vite, Canvas 2D, and accessible HTML controls. No backend, accounts, paid assets, API keys, or runtime network services. The worker always stays outside the tank.

## Play without installing anything

Download [release/Smells-Like-Money.zip](release/Smells-Like-Money.zip), extract it, then open **Smells-Like-Money.html** in a current desktop browser. The HTML contains the production JavaScript and CSS; it needs no server or internet connection. It is also available directly as [release/Smells-Like-Money.html](release/Smells-Like-Money.html).

If the chat's visualization panel says “An error occurred inside the visualization — svg,” download the ZIP rather than using that panel. The game draws with Canvas and its standalone version does not contain an SVG asset.

To regenerate and check the self-contained document:

```sh
npm run build:standalone
npm run test:standalone
```

The standalone check verified setup, suction/material movement, keyboard controls, pause/resume, and settings with networking disabled, storage denied, and zero external requests or browser errors. It loaded the ZIP-extracted HTML bytes into an opaque-origin browser document. This cloud Chromium's administrator policy blocks `file://` navigation, so double-click opening on a user's device remains a separate check. See [evidence/standalone-report.json](evidence/standalone-report.json). On a browser without that policy, opt into direct file navigation using `STANDALONE_FILE_CHECK=1 npm run test:standalone`.

## Publish through GitHub Pages

The repository includes `.github/workflows/pages.yml`, which tests the simulation, builds the self-contained game, and deploys it with GitHub's official Pages actions after pushes to `main`. It also supports manual runs from the Actions tab. Publication was authorized separately after the original local-only scope.

One-time repository setup: in **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Then run **Publish playable prototype** from the Actions tab (or rerun its deployment job). If the repository's plan or permissions do not support Pages, the committed ZIP remains available for download without deploying a website.

Use the actual URL reported by the successful `github-pages` deployment; a committed workflow alone does not establish that the site is live. The standalone page needs no backend, secrets, or external runtime services.

## Run it

Prerequisites: Node.js **22.12+** (tested with 24.19.0) and npm (tested with 11.9.0).

From `/workspace/SmellsLikeMoney`, or your local checkout:

```sh
npm ci --cache /tmp/smells-npm-cache --no-audit --no-fund
npm run dev
```

Open the address printed by Vite in a desktop browser. The `/tmp` cache flag keeps installation compatible with this cloud environment's writable directories; it is optional on a normal local machine.

```sh
npm run build       # TypeScript checking and production assets in dist/
npm run preview     # Serve the production build locally
npm test            # 26 simulation and fixed-clock acceptance tests
npm run test:browser
```

The browser check starts Vite if necessary and uses an installed Chromium browser. This environment has `/usr/bin/chromium`; elsewhere specify its executable:

```sh
CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

Use `BASE_URL` to test an already-running development server on another address. Browser acceptance needs the **development build**, because its test clock is deliberately absent from production.

## Play a job

Choose **Clock in** for the normal seed-101 job, or **Try the recovery challenge** for seed 202. The challenge is a test preset in the same yard, with eight wipes, a shorter warning, and a tougher inlet.

1. Open the tank lid and connect the vacuum hose.
2. Vacuum the floating skum. Stop when wipes approach; use Wipe removal. If they clog the hose, the same tool clears it without a restart.
3. Inspect the inlet T, then clear it. Its comic incoming parcel is finite.
4. Draw water toward the displayed 1.8–2.2× mixing band. If you drain below the 1.5× minimum, add water with the garden hose.
5. Continue to mixing and run the crust buster. Celebrate with “Smells like money!” if you like; audio never gates progress.
6. Vacuum the slurry, rinse all four broad wall regions, then vacuum the washdown.
7. Stow the tools, close the lid, and issue the fictional invoice: 450 base  + 75 wipes  + 50 inlet = **575 game credits**.

The checklist and contextual instruction show the next step; disabled controls explain their guard. Tool switches stop work immediately. Every tool uses click-to-start/click-to-stop, including timed wipe handling: no rapid clicking or holding required. There is no deadline, irreversible damage, truck capacity limit, or forced restart.

## Controls and accessibility

- Click tool buttons or press **1–5** with the scene focused.
- Click a broad tank region, use the labeled **target selector**, or press **arrow keys** with scene focus to cycle appropriate targets.
- **Space** starts/stops the selected valid tool; **Escape** pauses. Shortcuts respect native buttons, selects, sliders, dialogs, and editable fields.
- **Throttle** and **Air break** are keyboard-operable sliders. The initial 80% / 15% settings avoid unavoidable bogging. High suction load heats the pump; lower throttle, add a small air break, or stop to recover. Excessive air reduces throughput.
- Use **How to play**, **Sound**, **Less motion**, and **Larger UI** as needed. Sound starts muted. Pause-menu copies of settings remain usable while paused.
- Pause, focus loss, and hidden-tab events stop tools and freeze time. Resume explicitly; tools remain off until restarted. Restart asks for confirmation.
- Only preferences persist locally. Reload returns to the title; there is **no mid-job save**. Storage failures are harmless.
- Layout supports narrow windows with vertical scrolling. Desktop mouse and keyboard are the primary controls; this is not a mobile-first game.

Captions accompany all important cues. Pump/cue sounds are locally synthesized; the phrase uses an installed local English voice only when available. Missing or blocked audio stays silent. Mute cancels speech and silences every sound source. Reduced motion removes animated tool particles and the inlet splash; there is no camera shake.

## Model and tuning

All volumes and prices are fictional game values, not equipment guidance, operating specifications, or real billing. This is an outside-only game abstraction, never confined-space training.

- `src/config.ts`: rates, capacity, water bands, time step, tolerances, and fee amounts.
- `src/fixtures.ts`: starting materials, seeds, finite wipe clusters, inlet strength.
- `src/types.ts`: schema, stages, materials, commands, and temporary status.
- `src/commands.ts`: centralized guards for every input route.
- `src/simulation.ts`: pure material transfers, recovery, and stage advancement.
- `src/events.ts`: caption events and unique per-job fee keys.
- `src/runtime.ts`: 60 Hz fixed steps, clamped frame deltas, and bounded catch-up.
- `src/renderer.ts`: original Canvas art and purely cosmetic animation.
- `src/input.ts`, `src/audio.ts`, `src/ui.ts`, `src/main.ts`: controls, local sound, HTML interface, and lifecycle wiring.

The simulation conserves water (`W+CW+PW=550+A`) and solids (`S+U+M+R+CS+PS=290`), including the pending inlet parcel and real completion remainders. Suction never extracts unmixed solids or wall residue. Wipes are discrete, non-volume objects. Fixed fixtures need no random gameplay draws; seed and tick-indexed commands reproduce identical state and invoice results.

Rates retain the scope's provisional defaults, including 2.8 u/s base vacuum flow. Accelerated UI acceptance measured roughly 8.9 active minutes for an efficient normal route and 12.1 for the deliberate recovery route. Reading, aiming, and decisions add time in first play; the 10–15 minute first-play target still needs human pacing feedback. No artificial wait or time limit was added.

## Verification and actual-play evidence

Executed successfully in this workspace:

- Frozen installation with `npm ci` using the cache command above.
- `npm run build` and `npm test`: 26/26 tests passed.
- `npm run test:browser`: 23 checks passed; both complete jobs reached 575-credit invoices; no uncaught browser exceptions or console errors.
- Production preview smoke: HTTP 200, title/setup/suction work, material display changes, no browser errors, and the development test bridge is absent. See [evidence/production-report.json](evidence/production-report.json).

The pure tests check conservation after every simulated tick, source exhaustion, capacity, partial inlet release, water boundaries and recovery, slurry ratios, retained remainders, wall thresholds, wipe avoidance/clog/clearing, bogging and cooling, unique fees, guards, reset, pause, and exact replay. Clock tests verify clamping and discarded catch-up.

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

Refinements from testing included state-aware broad mouse targets, larger labels, a material-based mixing meter, available pause settings, quieter screen-reader announcements, and hiding irrelevant recovery advice after completion.

Remaining human checks: audible sound quality/local voice availability, physical tab switching across browsers, screen-reader usability, and first-play pacing. Headless tests verify the audio-denial fallback and lifecycle handlers, not those subjective/device-specific results. No deployment or commercial-readiness claim is made.

Reusable cloud `install_script` and `start_skill` drafts were saved after validation. They reinstall from the lockfile, validate the build/tests, and explain restarting Vite from the existing isolated checkout. Draft saving does not publish the environment or deploy the application.

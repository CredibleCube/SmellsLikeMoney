# Cleanup-loop research notes

Research date: 2026-10-26. These notes distinguish material actually read from design proposals. They do not establish that a mechanic caused commercial success or that this prototype is fun for human players.

## Sources actually read

1. Vuorre et al., *An intensive longitudinal dataset of video game play, well-being, and motivations: Case study of PowerWash Simulator*. The manuscript includes a FuturLab coauthor and describes a research edition developed with the studio. [Primary manuscript source](https://github.com/digital-wellbeing/pws-data-ms/blob/main/ms.Rmd).
2. Vuorre, Ballou et al., *Affective Uplift During Video Game Play: A Naturalistic Case Study*. [Primary manuscript and analysis source](https://github.com/digital-wellbeing/pws-prepost/blob/main/ms.Rmd).
3. The associated [PowerWash Simulator data-processing repository](https://github.com/digital-wellbeing/pws-data) describes the research data and links its archived dataset and codebook.
4. Kyle Banks, [educational powerwashing/world-painting implementation](https://github.com/KyleBanks/powerwash-simulator). Its README explicitly calls this an educational recreation of the painting effect. This is an implementation reference, not evidence about the commercial game's development or success.

The manuscript source files label themselves preprints, so these notes treat them as that source version rather than asserting a publication/review status. Numeric values expressed only as unevaluated R expressions were not copied or invented.

## Findings and proposed applications

| Read evidence | Interpretation for this prototype | What to check |
| --- | --- | --- |
| The developer-collaboration manuscript describes the central action as using a power washer to clean objects in an environment; it describes progression through cleaning jobs and credits. | Put tool contact and visible removal at the center of play. Aiming should change what gets cleaned, rather than merely choosing a menu item and watching a timer. | Compare the material/cleanliness change at the aim location with an unhit location; verify a visible response within a few frames. |
| The same source gives an explicit nested completion example: “washed a window frame of the mansion; a ‘subtask_completed’ event,” with level progression such as 80%. | Break the larger tank task into readable, finite local wins. Celebrate a cleaned patch/region before the final invoice, and show remaining dirt without pixel hunting. | Each local completion fires once; repeated spraying cannot farm rewards; the player can identify the next dirty region. |
| The affect manuscript reports that “the bulk of the improvement occurs during the first 15 minutes of play.” It describes small mood increases and predicts positive shifts for nearly three quarters of similar players. | Give a meaningful cleaning action and a small win early. A long session-length target should not be achieved through passive pump waiting. This is a design inference, not a demonstrated causal effect of pacing. | Measure time to first material change and first local completion in the actual prototype; count stretches that require no input. |
| The affect manuscript describes PWS as a “low cognitive effort game” and discusses calm, positive-valence play as a plausible mechanism. It explicitly says those causal mechanisms were not tested. | Preserve recoverable mistakes and an unhurried default mode while making actions responsive. Extra forced deadlines, failure screens, and attention checks would be unproven additions rather than research-backed improvements. | Completing the job never requires a restart; optional mastery rewards do not prevent ordinary completion. |
| The dataset manuscript separately measures enjoyment, autonomy (“doing the things I really wanted to”), competence, and immersion. It also distinguishes what players do from total time played. | Passing software tests and increasing session duration do not demonstrate fun. Offer useful choices in aiming/technique and measure actual interactions, then request human play feedback about satisfaction and friction. | Track useful actions and objective progress locally for QA; do not add analytics or claim enjoyment improved without human feedback. |

## Important limits

The affect study is observational, self-selected, and specific to its sample/game. It states: “We cannot say if the changes in mood observed during PWS play would have occurred with other games, non-game activities, or indeed no activity at all.” These findings are not medical claims, causal proof, sales data, or proof of what made the commercial game successful.

Direct requests to FuturLab's site, Steam's PowerWash store page, RuneStorm's Viscera page, Blackbird Interactive's Shipbreaker page, and Game Developer were blocked by the environment's egress proxy with CONNECT 403 responses. No proxy bypass was attempted. No Viscera/Shipbreaker developer statement, player count, sales figure, or postmortem is claimed from those unread pages. Their exact production lessons remain unverified in this research pass.

# Action and interaction research

Research performed on 2026-10-26. These notes separate what the source actually shows from design proposals for this prototype. Source code was read as a reference; no third-party game code or art was copied.

## Sources read

1. **Celeste, developer-published learning source:** [repository README](https://github.com/NoelFB/Celeste/blob/master/README.md) and [Player.cs](https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs). The README explicitly describes the released classes as a learning resource and general-interest material. This is partial source, not the full commercial game or its assets.
2. **Hedgewars, a Worms-like turn-based game:** [official mirror README](https://github.com/hedgewars/hw/blob/master/README.md), [input implementation](https://github.com/hedgewars/hw/blob/master/hedgewars/uInputHandler.pas), and [gear/crosshair rendering](https://github.com/hedgewars/hw/blob/master/hedgewars/uGearsRender.pas). The README identifies this GitHub repository as the project's daily mirror.
3. **Hedgewars teaching sequence:** [Basic Grenade Training mission](https://github.com/hedgewars/hw/blob/master/share/hedgewars/Data/Missions/Training/Basic_Training_-_Grenade.lua).

The Team17 Worms W.M.D page, Steam's Worms W.M.D store page, and a Squidi design article were attempted but this environment's proxy denied their domains with CONNECT 403. Their contents were not used as evidence. No sales, retention, or player-count claim is made from these sources, and no claim is made that a specific mechanic caused commercial success.

## Findings and proposed applications

### 1. Forgiveness is implemented deliberately

**Observed:** Celeste's `Player.cs` sets `JumpGraceTime` to 0.1 seconds, `VarJumpTime` to 0.2 seconds, and uses explicit jump-buffer consumption. It refreshes the grace timer on the ground and accepts a jump while grace remains. Variable jumping continues while the jump input is held, and ends when it is released. See constants around lines 48–53, grace handling around 713–720, and jump handling around 2952–2975.

**Application:** Buffer a fresh jump pressed shortly before landing and permit short versus held jumps. Keep movement response immediate. The current yard is flat, so do not add ledge/coyote-time complexity merely to imitate another game; it matters when actual ledges or platforms exist. Similarly, avoid a failed fire press solely because braking still has 0.15 seconds left: an explicit use command can stop horizontal movement before validating the nearby work position, while still refusing airborne, distant, or otherwise invalid work.

### 2. Successful input gets several kinds of feedback

**Observed:** Celeste's `Jump()` consumes the input, changes velocity, plays a jump sound, applies sprite scale `(0.6, 1.4)`, and emits dust. These are responses to the real jump state, not independent gameplay quantities. The source also has upward/dash corner correction.

**Application:** Give actual tool contact a small, immediate impact response: material movement, a short caption or floating progress number, particles, and optional local audio. Give meaningful completion events a larger response. Reduced-motion and mute preferences must retain all information. Do not reward merely holding the tool when it is missing or doing no useful work.

### 3. The Worms-like interaction is aim, choose, and commit

**Observed:** Hedgewars documents separate walking/aiming, firing with Space, weapon selection, and a precision modifier. Its renderer computes the crosshair from the active character's angle and weapon launch position; the crosshair is tied to the actual selected tool. Its input layer treats key release separately and permits release during pause.

**Application:** A continuous, clearly visible tool aim point should affect where the tool works. A hose stream should follow the aimed region and useful contact should be obvious. Tool selection should lead to different actions and decisions, not five buttons that all start a timed transfer. Preserve WASD/arrows as requested; mouse aiming and a keyboard aim alternative can supply the deliberate aim stage. Keep all inputs released on pause/focus loss.

### 4. Teach one useful decision, then offer a new one

**Observed:** The Hedgewars grenade tutorial declares a lesson plan: select the tool, aim/shoot, learn the timer, learn wind behavior, learn bounciness, then complete final targets. Each phase has a finite target set. Destroying the final target advances to the next phase. It also tracks shots and a flawless result.

**Application:** Break the long cleanup into small visible targets or work packets with a clear next goal and immediate payoff. Introduce a single mechanic before combining it with others. Optional aim/efficiency awards can encourage replay without blocking job completion, imposing surprise failure, changing the fictional invoice, or allowing repeated actions to farm rewards.

### 5. Iteration requires feedback from play, not just passing tests

**Observed:** Celeste's repository is explicitly used to track issues/bugs and points users to the changelog and closed issues. Hedgewars directs beginners to movement training, then other training, then quick matches, and solicits suggestions through its bug tracker/feedback button.

**Application:** Keep a reproducible benchmark for time to first useful action, time doing productive work versus waiting, blocked input attempts, and full-job completion. Automation should protect conservation, controls, and recovery. Human play is still needed to judge whether aiming, pacing, and the desire to replay improved; automated success alone does not establish fun.

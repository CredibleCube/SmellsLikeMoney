import { CONFIG } from './config';
import { actionReason, commandReason, getContextAction, toolReason } from './commands';
import { finalChecks, recommendedWater, wallTotal } from './simulation';
import { invoiceTotal } from './events';
import type { Command, FixtureName, JobState, Stage, Target, Tool } from './types';

export interface Preferences { muted: boolean; reducedMotion: boolean; largeUI: boolean; }
interface Handlers {
  send: (cmd: Command) => void; start: (fixture: FixtureName) => void;
  pause: () => void; resume: () => void; restart: () => void;
  settings: (key: keyof Preferences, value: boolean) => void;
}
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const n = (v: number) => v.toFixed(v < 10 ? 1 : 0);
export const timeLabel = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const tools: { key: Tool; icon: string; title: string; subtitle: string }[] = [
  { key: 'vacuum', icon: '↟', title: 'Vacuum', subtitle: 'A little suction' },
  { key: 'wipes', icon: '▧', title: 'Wipe removal', subtitle: 'No flushable lies' },
  { key: 'inlet', icon: '⌁', title: 'Inlet tool', subtitle: 'Clear the T' },
  { key: 'mixer', icon: '⤨', title: 'Crust buster', subtitle: 'Make a smoothie' },
  { key: 'hose', icon: '◌', title: 'Garden hose', subtitle: 'The finishing touch' },
];
const steps: { title: string; detail: string }[] = [
  { title: 'Set up shop', detail: 'Open lid · connect hose' },
  { title: 'Skim the skum', detail: 'Floaters first. Mind the wipes.' },
  { title: 'Clear the inlet', detail: 'Inspect · unblock · stand back' },
  { title: 'Find the water sweet spot', detail: 'Aim for the mixing band' },
  { title: 'Make a poop smoothie', detail: 'Crust buster, meet solids' },
  { title: 'Pump the slurry', detail: 'Watch that tank empty' },
  { title: 'Rinse & recover', detail: 'Four walls · one clean tank' },
  { title: 'Leave it tidy', detail: 'Stow tools · close lid' },
  { title: 'Get paid (pretend)', detail: 'One honest fictional invoice' },
];
const stageIndex: Record<Stage, number> = { SETUP: 0, SCUM: 1, INLET: 2, DRAWDOWN: 3, MIX: 4, SLURRY: 5, WASH: 6, FINAL_PUMP: 6, CLEANUP: 7, INVOICE: 8 };
const stageTitles: Record<Stage, string> = {
  SETUP: 'A good job starts outside.', SCUM: 'Skim a little off the top.', INLET: 'Let’s see what’s backing up.',
  DRAWDOWN: 'Find the sweet spot.', MIX: 'Give it a good stir.', SLURRY: 'Now that’s a poop smoothie.',
  WASH: 'Leave those walls gleaming.', FINAL_PUMP: 'The last of the dirty work.', CLEANUP: 'A tidy finish. Always.', INVOICE: 'Smells like a job well done.',
};
export function instruction(s: JobState): string {
  const m = s.materials;
  if (s.paused) return 'Take a breather. Resume when you’re ready; tools will stay off.';
  if (s.wipes.status === 'in_hose') return 'Hose clogged. Select Wipe removal, then Clear hose. No material has been lost.';
  if (s.wipes.status === 'approaching') return 'Wipes incoming! Stop suction and select Wipe removal before they reach the hose. They approach only while suction is running.';
  if (s.bogged) return 'Pump bogged. Stop to cool, lower the throttle, or open the air break a little.';
  switch (s.stage) {
    case 'SETUP': return s.lidOpen ? 'Connect the vacuum hose. Your boots stay on the grass for this entire job.' : 'Open the lid to see what you’re working with. This is an outside-only job.';
    case 'SCUM': return 'Vacuum the floating skum. A small air break keeps the pump happy; watch for the wipe cluster.';
    case 'INLET': return !s.inlet.inspected ? 'Walk right to the inlet marker and press E to inspect. Press E again to clear it. Expect a brief surprise.' : !s.inlet.cleared ? 'Start the inlet tool to clear the blockage. The incoming parcel is finite.' : 'The inlet is emptying. If the tank is full, vacuum some liquid to make room.';
    case 'DRAWDOWN': return m.W < 1.5 * (m.U + m.M) ? 'Too dry to mix. Use the garden hose to add water until the minimum is met.' : 'Pump water toward the marked band, then Continue to mixing. You can recover over-draining with the garden hose.';
    case 'MIX': return m.W < 1.5 * (m.U + m.M) ? 'Not enough water. Select the garden hose and fill to at least 1.5× solids.' : 'Start the crust buster at the bottom. It turns settled solids into a pumpable smoothie.';
    case 'SLURRY': return m.W < 1.5 * m.M ? 'Mixture too dry. Add water before you resume vacuuming.' : 'Vacuum the mixed slurry. Water and suspended solids leave together; settled solids stay put.';
    case 'WASH': case 'FINAL_PUMP': {
      if (m.W < 1.5 * m.M && m.M > 0 && !finalChecks(s).every(c => c.ok)) return 'Add water before pumping this dry mixture. Then rinse or vacuum as needed.';
      if (wallTotal(s) > 2 || m.walls.some((v, i) => v > CONFIG.initialWalls[i] * 0.15)) return 'Rinse all four broad wall regions with the garden hose. Switch to vacuum whenever you need room.';
      return 'Walls look good. Vacuum the washdown until water is ≤5 and total solids are ≤2 units.';
    }
    case 'CLEANUP': return !s.stowed ? 'Clean tank! Walk left to the truck and press E to stow your tools.' : !s.lidClosed ? 'Return to the hatch and press E to close the lid.' : 'Everything is buttoned up. Issue your fictional invoice.';
    case 'INVOICE': return 'Every last credit accounted for. Replay the original job or try the recovery challenge.';
  }
}

export function createUI(h: Handlers) {
  $('app').innerHTML = `
    <header class="masthead"><a class="brand" href="#" aria-label="Smells Like Money home"><span class="brand-mark">S<span>↗</span></span><span>SMELLS LIKE MONEY<span class="brand-sub">SEPTIC CREW / FIELD OPS</span></span></a><nav aria-label="Game settings"><button id="help" class="quiet">How to play <span>?</span></button><button id="mute" class="quiet" aria-pressed="true">Sound off</button><button id="motion" class="quiet" aria-pressed="false">Less motion</button><button id="scale" class="quiet" aria-pressed="false">Larger UI</button><button id="pause" class="pause-button" disabled>Ⅱ <span>Pause</span></button></nav></header>
    <main>
    <section id="briefing" class="briefing"><div><p class="eyebrow"><span class="live-dot"></span> ONE WORKER. FIVE TOOLS. ONE BIG MESS.</p><h1>Big tools.<br><em>Dirty business.</em></h1><p class="intro-copy">Boots on the ground. Tools in your hands.<br>Walk, jump, aim, and turn one messy tank into a payday.</p></div><div class="job-brief"><p class="eyebrow">MAPLE LANE / FIELD OP 001</p><h2>Operation: Backlog.</h2><p>Take control of the crew. Work the hatch, clear the inlet, and clean every last wall.</p><button class="primary start-button" data-fixture="normal" data-command="start">Clock in <span>↗</span></button><button class="challenge-button" data-fixture="challenge">Try the recovery challenge <span>→</span></button><small>Desktop prototype · no time limit · no real sewage</small></div></section>
    <div id="job-banner" class="job-banner" hidden><div><span class="live-dot"></span><span class="eyebrow">FIELD OP ACTIVE</span><span id="fixture-name">THE BACKYARD SPECIAL</span></div><div><span class="job-location">MAPLE LANE · JOB 001</span><span id="elapsed">00:00</span></div></div>
    <div class="workspace"><section class="workbench" aria-label="Interactive tank workspace">
      <div class="scene-header"><div><p class="eyebrow" id="scene-eyebrow">YOUR OFFICE FOR THE DAY</p><h2 id="stage-title">A fresh start. More or less.</h2></div><span id="status-pill" class="status-pill">READY WHEN YOU ARE</span></div>
      <div class="canvas-wrap"><div class="scene-hud" aria-hidden="true"><span class="arena-tag">MAPLE LANE / FIELD OP 001</span></div><canvas id="scene" width="1100" height="660" tabindex="0" role="img" aria-label="Side-on yard with a parked vacuum truck and a cutaway septic tank. Use the target selector and labeled controls to operate tools."></canvas><span class="scene-stamp">MAPLE LANE<br><b>RESIDENTIAL SERVICE</b></span></div>
      <div id="world-controls" class="movement-bar" hidden><div class="movement-help"><span><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> MOVE</span><span><kbd>W</kbd> / <kbd>↑</kbd> JUMP &nbsp; <kbd>S</kbd> / <kbd>↓</kbd> DUCK</span><small id="player-status">ON THE GROUND</small><small>Mouse aim + use · Q cycle target · Space use · E interact</small></div><div class="world-action"><button id="interact" class="primary">E · Open tank lid</button><small id="interact-reason"></small></div></div><div class="legend" aria-label="Tank material legend"><span><i class="swatch skum"></i>Floating skum</span><span><i class="swatch water"></i>Water</span><span><i class="swatch solids"></i>Settled solids</span><span><i class="swatch slurry"></i>Mixed slurry</span><span><i class="swatch residue"></i>Wall residue</span></div>
      <div id="playing-controls" hidden>
        <div class="instruction-bar"><span class="instruction-icon">↳</span><p id="instruction" role="status" aria-live="polite"></p></div>
        <div id="mix-progress" class="mix-progress" hidden><label for="mix-meter">SETTLED SOLIDS MIXED <b id="mix-percent">0%</b></label><progress id="mix-meter" max="100" value="0"></progress></div><div class="tools-heading"><span class="eyebrow">YOUR TOOLBELT</span><span class="shortcut-note">1–5 equip · Q aim · Space use</span></div>
        <div class="tool-grid">${tools.map((t, i) => `<div class="tool-wrap"><button class="tool" data-tool="${t.key}" aria-describedby="reason-${t.key}" aria-pressed="false"><span class="tool-top"><span class="tool-icon">${t.icon}</span><kbd>${i + 1}</kbd></span><strong>${t.title}</strong><small>${t.subtitle}</small></button><span class="tool-reason" id="reason-${t.key}"></span></div>`).join('')}</div>
        <div class="operation-row"><label class="target-label" for="target">AIM YOUR TOOL<select id="target"><option value="surface">Floating skum / surface</option><option value="liquid">Liquid body / add water</option><option value="inlet">Inlet T</option><option value="bottom">Bottom solids</option><option value="wall0">Wall 1 · left side</option><option value="wall1">Wall 2 · right side</option><option value="wall2">Wall 3 · floor left</option><option value="wall3">Wall 4 · floor right</option></select></label><div class="activate-wrap"><button id="activate" class="primary">Start vacuum <span>↗</span></button><small id="action-reason"></small></div></div>
        <div id="stage-actions" class="stage-actions">${[['openLid','Open tank lid'],['connect','Connect vacuum hose'],['inspect','Inspect inlet T'],['continueMix','Continue to mixing →'],['sayPhrase','“Smells like money!”'],['stow','Stow tools'],['closeLid','Close tank lid'],['invoice','Issue fictional invoice →']].map(([key,label]) => `<div class="stage-action" data-action-wrap="${key}"><button class="secondary" data-command="${key}">${label}</button><small id="guard-${key}"></small></div>`).join('')}</div>
        <div class="pump-console"><div class="dial"><label for="throttle">THROTTLE <output id="throttle-value">80%</output></label><input id="throttle" type="range" min="0" max="100" step="1" value="80"><span>Lower it to take a breather.</span></div><div class="dial"><label for="air-break">AIR BREAK <output id="air-value">15%</output></label><input id="air-break" type="range" min="0" max="100" step="1" value="15"><span>A little air goes a long way.</span></div><div class="load-dial"><div><span class="eyebrow">PUMP LOAD</span><strong id="load-label">Idle</strong></div><meter id="load-meter" min="0" max="1.4" low="0.98" high="1.2" optimum="0.7" value="0"></meter><small><span id="flow">0.00</span> u/s · heat <span id="heat">0</span>%</small></div></div>
      </div>
      <div class="scene-footer"><span>BOOTS ON THE GRASS. ALWAYS.</span><span>OUTSIDE-ONLY GAME ABSTRACTION</span></div>
    </section>
    <aside class="sidebar"><section class="checklist-card"><div class="card-heading"><span class="eyebrow">MISSION OBJECTIVES</span><span id="progress-count">0 / 9</span></div><h2>Clean sweep.</h2><ol class="checklist">${steps.map((s,i)=>`<li id="check-${i}"><span class="step-number">${String(i+1).padStart(2,'0')}</span><div><strong>${s.title}</strong><small>${s.detail}</small></div><span class="step-tick" aria-hidden="true">✓</span></li>`).join('')}</ol><div class="checklist-foot">A little patience. A little know-how.<br>A lot less in the tank.</div></section>
    <section id="water-card" class="water-card"><div class="card-heading"><span class="eyebrow">THE MIXING SWEET SPOT</span><span id="water-status">BEFORE MIXING</span></div><div class="water-reading"><strong id="water-amount">520</strong><span>water units <b id="water-ratio">3.25× solids</b></span></div><div class="water-track"><span id="water-band"></span><i id="water-marker"></i></div><p id="water-note">Mixing needs 1.5× solids. Aim for 1.8–2.2×.</p><dl class="material-list"><div><dt>Floating skum</dt><dd id="mat-S">80</dd></div><div><dt>Settled solids</dt><dd id="mat-U">160</dd></div><div><dt>Suspended slurry</dt><dd id="mat-M">0</dd></div><div><dt>Wall residue</dt><dd id="mat-R">40</dd></div><div><dt>Truck recovered</dt><dd id="mat-truck">0</dd></div></dl></section>
    <section id="wall-card" class="wall-card" hidden><p class="eyebrow">FOUR WALLS. FRESH START.</p>${['Left side','Right side','Floor left','Floor right'].map((name,i)=>`<div class="wall-progress"><span>${i+1}. ${name}</span><progress id="wall-${i}" max="100" value="0"></progress><b id="wall-label-${i}">0%</b></div>`).join('')}<p class="fine-print">Each ≥85% clean · total residue ≤2 units</p></section>
    <section id="final-card" class="final-card" hidden><p class="eyebrow">THE FINISH LINE</p><ul id="final-checks"></ul></section>
    <section id="field-note-card" class="field-note"><span>✳</span><div><p class="eyebrow">A NOTE FROM THE CREW</p><p id="field-note">“Flushable” is doing a lot of heavy lifting on that label.</p></div></section>
    <section id="event-card" class="event-card" hidden><p class="eyebrow">THE LATEST FROM THE TANK</p><p id="event-text" aria-live="polite"></p></section>
    </aside></div>
    <section id="invoice-panel" class="invoice-panel" hidden><div class="invoice-intro"><span class="invoice-seal">✓</span><p class="eyebrow">GOOD COMPANY · SEPTIC SERVICE</p><h2>That’s a wrap.</h2><p>Clean tank. Tidy yard. Honest day’s work.</p><button id="replay" class="primary">Another day, same tank ↗</button><button id="invoice-challenge" class="secondary">Try the recovery challenge</button></div><div class="invoice-paper"><div class="invoice-heading"><div><p class="eyebrow">FICTIONAL INVOICE</p><h3>Service complete.</h3></div><span>NO. 001<br><b>PAID IN PRETEND</b></span></div><div id="invoice-lines"></div><div class="invoice-total"><span>Total game credits</span><strong id="invoice-total">575</strong></div><dl class="invoice-stats"><div><dt>Active job time</dt><dd id="invoice-time"></dd></div><div><dt>Hose water added</dt><dd id="invoice-water"></dd></div><div><dt>Checklist</dt><dd>9 / 9 complete</dd></div></dl><p class="fine-print">Fictional game credits. No real pricing, billing, or payment.</p></div></section>
    <footer class="page-footer"><span>SMELLS LIKE MONEY <b>FIELD OPS / 002</b></span><span>Cartoon cleanup. Real satisfaction.</span></footer>
    </main>
    <dialog id="pause-dialog"><div class="dialog-top"><p class="eyebrow">OFF THE CLOCK, FOR A MOMENT</p><span>Ⅱ</span></div><h2>Take a breather.</h2><p>The tank can wait. All tools are off and the job is frozen.</p><p class="notice">No mid-job saves. Reloading returns to the title screen.</p><div class="paused-settings" aria-label="Paused game settings"><button id="pause-mute" class="quiet">Sound off</button><button id="pause-motion" class="quiet">Less motion</button><button id="pause-scale" class="quiet">Larger UI</button></div><button id="resume" class="primary">Back to work →</button><button id="restart" class="secondary">Restart this job</button><button id="pause-help" class="quiet">Read the field guide</button></dialog>
    <dialog id="help-dialog"><p class="eyebrow">THE FIELD GUIDE</p><h2>A little know-how.</h2><p>Follow the checklist from top to bottom. The instruction below the tank always tells you the next useful step.</p><ol class="help-list"><li><b>Vacuum the skum.</b> Keep a slight air break. Stop and remove the approaching wipes, or clear a clog with the wipe tool.</li><li><b>Inspect and clear the inlet T.</b> It releases one finite parcel. You stay outside.</li><li><b>Manage your water.</b> Draw toward 1.8–2.2× solids. Below 1.5×? Add water with the garden hose.</li><li><b>Mix, then pump.</b> Use the crust buster, celebrate your smoothie, then vacuum the slurry.</li><li><b>Rinse all four walls.</b> Select a region with the garden hose. Vacuum the washdown, stow tools, close the lid, and invoice.</li></ol><p><b>Controls:</b> Click the arena to take control. A/D or Left/Right walk; W or Up jumps; S or Down crouches. Stand near the highlighted work station and press E to interact. Mouse clicks aim and use the equipped tool; Space uses it again, 1–5 switch tools, and Q cycles targets (Shift+Q reverses). Escape pauses. Moving stops your tool. Standard controls keep their native keyboard behavior. Every tool can be click-to-start; no rapid clicking needed.</p><p><b>Recovery challenge:</b> Eight wipes and a tougher inlet. Try a clog, then drain water to 40 before mixing. Add water to recover; nothing forces a restart.</p><p class="notice">Fictional units and prices. Outside-only game abstraction, never equipment or confined-space training. Sound is optional; every cue is captioned.</p><button id="close-help" class="primary">Got it. Let’s work. →</button></dialog>
    <dialog id="restart-dialog"><p class="eyebrow">START FRESH?</p><h2>Same yard. Clean slate.</h2><p>This resets all progress, fees, and timers for the current fixture and seed. Your settings stay.</p><button id="confirm-restart" class="primary">Yes, restart the job</button><button id="cancel-restart" class="secondary">Keep this job</button></dialog>
  `;
  $('playing-controls').insertBefore($('stage-actions'), $('mix-progress'));
  for (const el of document.querySelectorAll<HTMLButtonElement>('[data-fixture]')) el.onclick = () => h.start(el.dataset.fixture as FixtureName);
  const actInWorld = (cmd: Command) => {
    h.send(cmd);
    $<HTMLCanvasElement>('scene').focus({preventScroll:true});
  };
  for (const el of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) el.onclick = () => actInWorld({ type: 'selectTool', tool: el.dataset.tool as Tool });
  for (const el of document.querySelectorAll<HTMLButtonElement>('[data-command]:not([data-command="start"])')) el.onclick = () => actInWorld({ type: el.dataset.command } as Command);
  $('activate').onclick = () => actInWorld({type:'toggleActive'});
  $('interact').onclick = () => actInWorld({type:'interact'});
  $<HTMLSelectElement>('target').onchange = e => h.send({ type: 'selectTarget', target: (e.target as HTMLSelectElement).value as Target });
  $<HTMLInputElement>('throttle').oninput = e => h.send({ type:'setThrottle', value: Number((e.target as HTMLInputElement).value) / 100 });
  $<HTMLInputElement>('air-break').oninput = e => h.send({ type:'setAirBreak', value: Number((e.target as HTMLInputElement).value) / 100 });
  $('pause').onclick = h.pause;
  $('resume').onclick = h.resume;
  $('restart').onclick = () => $<HTMLDialogElement>('restart-dialog').showModal();
  $('confirm-restart').onclick = () => { closeDialogs(); h.restart(); };
  $('cancel-restart').onclick = () => $<HTMLDialogElement>('restart-dialog').close();
  $('replay').onclick = () => h.start('normal');
  $('invoice-challenge').onclick = () => h.start('challenge');
  $('help').onclick = () => { h.pause(); $<HTMLDialogElement>('help-dialog').showModal(); };
  $('pause-help').onclick = () => $<HTMLDialogElement>('help-dialog').showModal();
  $('close-help').onclick = () => $<HTMLDialogElement>('help-dialog').close();
  for (const id of ['pause-dialog','restart-dialog','help-dialog']) $<HTMLDialogElement>(id).addEventListener('cancel', e => { e.preventDefault(); if (id === 'pause-dialog') h.resume(); else $<HTMLDialogElement>(id).close(); });
  let prefs: Preferences = { muted: true, reducedMotion: false, largeUI: false };
  $('mute').onclick = () => h.settings('muted', !prefs.muted);
  $('motion').onclick = () => h.settings('reducedMotion', !prefs.reducedMotion);
  $('scale').onclick = () => h.settings('largeUI', !prefs.largeUI);
  $('pause-mute').onclick = () => h.settings('muted', !prefs.muted);
  $('pause-motion').onclick = () => h.settings('reducedMotion', !prefs.reducedMotion);
  $('pause-scale').onclick = () => h.settings('largeUI', !prefs.largeUI);
  function closeDialogs() { document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d => d.close()); }
  function update(s: JobState, p: Preferences) {
    prefs = p;
    document.body.dataset.stage = s.stage;
    document.body.classList.toggle('is-playing', s.started);
    document.body.classList.toggle('large-ui', p.largeUI);
    document.body.classList.toggle('reduced-motion', p.reducedMotion);
    $('briefing').hidden = s.started;
    $('job-banner').hidden = !s.started;
    $('playing-controls').hidden = !s.started || s.stage === 'INVOICE';
    $('world-controls').hidden = !s.started || s.stage === 'INVOICE';
    const context = getContextAction(s);
    const interact = $<HTMLButtonElement>('interact');
    interact.textContent = `E · ${context.label}`;
    interact.disabled = !!context.reason;
    $('interact-reason').textContent = context.reason || context.hint;
    $('player-status').textContent = !s.player.grounded ? 'AIRBORNE' : s.player.crouching ? 'CROUCHED' : Math.abs(s.player.vx) > 5 ? 'ON THE MOVE' : 'READY TO WORK';
    $('invoice-panel').hidden = s.stage !== 'INVOICE';
    $('event-card').hidden = !s.started || s.stage === 'INVOICE';
    $('field-note-card').hidden = s.stage === 'INVOICE';
    $('water-card').hidden = s.stage === 'CLEANUP' || s.stage === 'INVOICE';
    $('fixture-name').textContent = s.fixture === 'normal' ? 'THE BACKYARD SPECIAL' : 'RECOVERY CHALLENGE · TEST PRESET';
    $('elapsed').textContent = timeLabel(s.elapsed);
    $('scene-eyebrow').textContent = s.started ? `THE BACKYARD SPECIAL / STEP ${stageIndex[s.stage] + 1} OF 9` : 'YOUR OFFICE FOR THE DAY';
    $('stage-title').textContent = s.started ? stageTitles[s.stage] : 'A fresh start. More or less.';
    const pill = s.paused ? 'PAUSED · TOOLS OFF' : s.wipes.status === 'in_hose' ? 'HOSE CLOGGED' : s.bogged ? 'PUMP BOGGED' : s.active ? 'NICE & STEADY' : s.stage === 'INVOICE' ? 'JOB WELL DONE' : 'READY WHEN YOU ARE';
    $('status-pill').textContent = pill;
    $('status-pill').classList.toggle('warning', s.wipes.status === 'in_hose' || s.bogged);
    if ($('instruction').textContent !== instruction(s)) $('instruction').textContent = instruction(s);
    $<HTMLButtonElement>('pause').disabled = !s.started || s.stage === 'INVOICE';
    $('mute').textContent = p.muted ? 'Sound off' : 'Sound on';
    $('mute').setAttribute('aria-pressed', String(p.muted));
    $('motion').setAttribute('aria-pressed', String(p.reducedMotion));
    $('scale').setAttribute('aria-pressed', String(p.largeUI));
    $('pause-mute').textContent = p.muted ? 'Sound off' : 'Sound on';
    $('pause-mute').setAttribute('aria-pressed', String(p.muted));
    $('pause-motion').setAttribute('aria-pressed', String(p.reducedMotion));
    $('pause-scale').setAttribute('aria-pressed', String(p.largeUI));
    $('mix-progress').hidden = s.stage !== 'MIX';
    const mixed = 100 * (1 - s.materials.U / s.initialSolids);
    $<HTMLProgressElement>('mix-meter').value = mixed;
    $('mix-percent').textContent = `${mixed.toFixed(0)}%`;
    for (const t of tools) {
      const reason = toolReason(s,t.key);
      const button = document.querySelector<HTMLButtonElement>(`[data-tool="${t.key}"]`)!;
      button.disabled = !!reason;
      button.title = reason || t.subtitle;
      button.setAttribute('aria-pressed',String(s.tool === t.key));
      $(`reason-${t.key}`).textContent = reason ? reason : s.tool === t.key ? 'Selected' : 'Ready';
    }
    const select = $<HTMLSelectElement>('target');
    if (select.value !== s.target) select.value = s.target;
    const active = $<HTMLButtonElement>('activate');
    const reason = actionReason(s);
    active.disabled = !!reason && !s.active;
    const verb = s.tool === 'vacuum' ? 'vacuum' : s.tool === 'wipes' ? s.wipes.status === 'in_hose' ? 'clearing hose' : 'removing wipes' : s.tool === 'inlet' ? 'clearing inlet' : s.tool === 'mixer' ? 'mixing' : s.target.startsWith('wall') ? 'rinsing wall' : 'adding water';
    active.textContent = s.active ? `■ Stop ${verb}` : s.tool === 'wipes' ? s.wipes.status === 'in_hose' ? 'Clear hose · 2.5s →' : 'Remove wipes · 2s →' : s.tool === 'inlet' ? 'Clear inlet →' : s.tool === 'mixer' ? 'Start crust buster ↗' : s.tool === 'hose' ? s.target.startsWith('wall') ? 'Start wall rinse ↗' : 'Add water ↗' : 'Start vacuum ↗';
    active.classList.toggle('running',s.active);
    $('action-reason').textContent = reason || (s.tool === 'wipes' && s.active ? `${s.wipes.progress.toFixed(1)}s · Click once; the tool does the work.` : 'Space or click a tank target to use. Move to stop.');
    const visible: Record<string,boolean> = {
      openLid:s.stage==='SETUP'&&!s.lidOpen,connect:s.stage==='SETUP'&&s.lidOpen&&!s.connected,
      inspect:s.stage==='INLET'&&!s.inlet.inspected,continueMix:s.stage==='DRAWDOWN',
      sayPhrase:['MIX','SLURRY','WASH','FINAL_PUMP'].includes(s.stage),
      stow:s.stage==='CLEANUP'&&!s.stowed,closeLid:s.stage==='CLEANUP'&&s.stowed&&!s.lidClosed,
      invoice:s.stage==='CLEANUP'&&s.stowed&&s.lidClosed,
    };
    for (const [key,show] of Object.entries(visible)) {
      const wrap = document.querySelector<HTMLElement>(`[data-action-wrap="${key}"]`)!;
      wrap.hidden = !show;
      if (show) {
        const guard = commandReason(s,{type:key} as Command);
        wrap.querySelector('button')!.disabled = !!guard;
        $(`guard-${key}`).textContent = guard || '';
      }
    }
    const m=s.materials;
    $('throttle-value').textContent = `${Math.round(s.throttle*100)}%`;
    $('air-value').textContent = `${Math.round(s.airBreak*100)}%`;
    $<HTMLInputElement>('throttle').value = String(Math.round(s.throttle*100));
    $<HTMLInputElement>('air-break').value = String(Math.round(s.airBreak*100));
    $<HTMLMeterElement>('load-meter').value = s.load;
    $('load-label').textContent = s.bogged ? 'Bogged' : s.heat>=40 || s.load>0.98 ? 'Straining' : s.active&&s.tool==='vacuum' ? 'Normal' : 'Idle';
    $('flow').textContent=s.flow.toFixed(2); $('heat').textContent=String(Math.round(s.heat));
    const idx=stageIndex[s.stage];
    for(let i=0;i<9;i++) {
      const el=$(`check-${i}`);el.classList.toggle('current',s.started&&i===idx);el.classList.toggle('done',s.started&&(i<idx||s.stage==='INVOICE'));
      if(s.started&&i===idx) el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
    }
    $('progress-count').textContent=`${s.stage==='INVOICE'?9:s.started?idx:0} / 9`;
    $('water-amount').textContent=n(m.W);
    const solid=m.U+m.M;
    $('water-ratio').textContent=solid>1e-9?`${(m.W/solid).toFixed(2)}× solids`:'No solids to mix';
    const dry=solid>0&&m.W<1.5*solid;
    $('water-card').classList.toggle('dry',dry);
    $('water-status').textContent=dry?'ADD WATER':solid>0&&m.W>=1.8*solid&&m.W<=2.2*solid?'IN THE BAND':'WATER / SOLIDS';
    const [lo,hi]=recommendedWater(s);
    $('water-band').style.left=`${Math.min(95,lo/700*100)}%`; $('water-band').style.width=`${Math.max(2,Math.min(100-lo/700*100,(hi-lo)/700*100))}%`;
    $('water-marker').style.left=`${Math.min(99,m.W/700*100)}%`;
    $('water-note').textContent=solid>0?`Minimum ${n(1.5*solid)} · recommended ${n(lo)}–${n(hi)} units`:'No water ratio required when solids are zero.';
    $('mat-S').textContent=n(m.S);$('mat-U').textContent=n(m.U);$('mat-M').textContent=n(m.M);$('mat-R').textContent=n(wallTotal(s));$('mat-truck').textContent=`${n(m.CW+m.CS)} units`;
    $('wall-card').hidden= !['WASH','FINAL_PUMP','CLEANUP'].includes(s.stage);
    for(let i=0;i<4;i++){const pct=100*(1-m.walls[i]/CONFIG.initialWalls[i]);$<HTMLProgressElement>(`wall-${i}`).value=pct;$(`wall-label-${i}`).textContent=`${pct.toFixed(0)}%`;}
    $('final-card').hidden= !['WASH','FINAL_PUMP','CLEANUP'].includes(s.stage);
    $('final-checks').innerHTML=finalChecks(s).map(c=>`<li class="${c.ok?'passed':''}" title="${c.hint}"><span>${c.ok?'✓':'○'}</span>${c.label}</li>`).join('');
    const event=s.events.at(-1)!;
    if ($('event-text').textContent !== event.text) $('event-text').textContent=event.text;
    $('event-card').classList.toggle('event-warning',event.kind==='warning');
    $('field-note').textContent=s.stage==='MIX'?'Today’s special: one exceptionally unappetizing smoothie.':s.stage==='INVOICE'?'You can’t buy happiness. You can invoice for this, though.':'“Flushable” is doing a lot of heavy lifting on that label.';
    if(s.stage==='INVOICE') {
      $('invoice-lines').innerHTML=[...s.fees].sort((a,b)=>a.key==='base_service'?-1:b.key==='base_service'?1:0).map(f=>`<div class="invoice-line"><span>${f.label}</span><b>${f.amount}</b></div>`).join('');
      $('invoice-total').textContent=String(invoiceTotal(s));$('invoice-time').textContent=timeLabel(s.elapsed);$('invoice-water').textContent=`${n(m.A)} units`;
    }
    const sceneLabel = `Outside-only cutaway tank. ${s.started?stageTitles[s.stage]:'Ready to begin a septic pumping job.'} A/D or arrow keys walk, W or Up jumps, S or Down crouches. E interacts near a station. Mouse aims and uses tools; Space operates, Q cycles targets. Material quantities are in the mixing card.`;
    if ($('scene').getAttribute('aria-label') !== sceneLabel) $('scene').setAttribute('aria-label', sceneLabel);
  }
  return { update, canvas:$<HTMLCanvasElement>('scene'), closeDialogs,
    showPause:()=>{const d=$<HTMLDialogElement>('pause-dialog');if(!d.open)d.showModal();},
  };
}

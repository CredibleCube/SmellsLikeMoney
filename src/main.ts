import './style.css';
import { CONFIG } from './config';
import { createJob } from './fixtures';
import { command, getContextAction } from './commands';
import { assertInvariants, step } from './simulation';
import { renderScene } from './renderer';
import { workSpot } from './work';
import { createUI, type Preferences } from './ui';
import { FixedStepClock } from './runtime';
import { GameAudio } from './audio';
import { bindKeyboard, type KeyboardBinding } from './input';
import type { Command, FixtureName, JobState } from './types';

let state = createJob();
const defaults: Preferences = { muted: true, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches, largeUI: false };
let prefs = { ...defaults };
try {
  const saved = JSON.parse(localStorage.getItem('slm-preferences') || '{}');
  for (const key of Object.keys(defaults) as (keyof Preferences)[]) if (typeof saved[key] === 'boolean') prefs[key] = saved[key];
} catch { /* Storage is optional; gameplay never relies on it. */ }
const audio = new GameAudio();
audio.setMuted(prefs.muted);
let lastEventTick = -1;
let lastEventText = '';
let lastFrame = performance.now();
let lastUI = 0;
let keyboard: KeyboardBinding | undefined;
let pendingAim: {x:number;y:number} | null = null;
let gesture: { pointerId:number; wasActive:boolean; key:string; x:number; y:number; dragged:boolean } | null = null;
function flushAim() {
  if (pendingAim && state.started && !state.paused && state.stage !== 'INVOICE') command(state,{type:'aim',...pendingAim});
  pendingAim = null;
}
function tick(dt: number) {
  const previousStage = state.stage;
  step(state, dt);
  if (previousStage !== state.stage) keyboard?.clear();
  if (import.meta.env.DEV) assertInvariants(state);
}
const clock = new FixedStepClock(tick);
const ui = createUI({ send, start, pause, resume, restart: () => start(state.fixture), settings });
function refresh() {
  ui.update(state, prefs);
  renderScene(ui.canvas, state, { reducedMotion:prefs.reducedMotion, time:state.elapsed });
  audio.update(state);
  const event = state.events.at(-1)!;
  if (event.tick !== lastEventTick || event.text !== lastEventText) {
    if (state.started && lastEventTick >= 0) audio.cue(event.text.includes('MONEY SHOT') ? 'inlet' : event.kind === 'warning' ? 'warning' : 'success');
    lastEventTick = event.tick; lastEventText = event.text;
  }
}
function send(cmd: Command) {
  if (['selectTool','pause','resume','start','stop','continueMix','stow','closeLid','invoice'].includes(cmd.type)) keyboard?.clear();
  else if (cmd.type === 'toggleActive' || cmd.type === 'interact') {
    const stopping = state.active && (cmd.type === 'toggleActive' || getContextAction(state).command.type === 'stop');
    if (stopping) keyboard?.clear(); else keyboard?.releaseMovement();
  }
  void audio.unlock();
  const success = command(state,cmd);
  if (success && cmd.type === 'sayPhrase') audio.sayPhrase();
  refresh();
  if (state.stage === 'INVOICE') document.getElementById('invoice-panel')?.scrollIntoView({block:'nearest',behavior:prefs.reducedMotion?'instant':'smooth'});
}
function start(fixture: FixtureName) {
  keyboard?.clear();
  pendingAim = null; gesture = null;
  state = createJob(fixture); command(state, {type:'start'});
  clock.reset(); lastFrame=performance.now(); lastEventTick=-1; lastEventText='';
  ui.closeDialogs(); void audio.unlock(); refresh();
  ui.canvas.focus({preventScroll:true});
}
function pause() {
  if (!state.started || state.stage === 'INVOICE') return;
  keyboard?.clear();
  pendingAim = null; gesture = null;
  command(state,{type:'pause'});clock.reset();refresh();ui.showPause();
}
function resume() {
  command(state,{type:'resume'});clock.reset();lastFrame=performance.now();ui.closeDialogs();refresh();ui.canvas.focus({preventScroll:true});
}
function settings(key: keyof Preferences,value:boolean) {
  prefs[key]=value;
  try {localStorage.setItem('slm-preferences',JSON.stringify(prefs));}catch{/* Preference persistence is optional. */}
  audio.setMuted(prefs.muted);if(!prefs.muted)void audio.unlock();refresh();
}
keyboard = bindKeyboard(ui.canvas,send,pause,()=>state);
function pointerPoint(event: PointerEvent) {
  const rect = ui.canvas.getBoundingClientRect();
  return { x:(event.clientX-rect.left)*1100/rect.width, y:(event.clientY-rect.top)*660/rect.height };
}
const inTank = (p: {x:number;y:number}) => p.x >= 195 && p.x <= 937 && p.y >= 337 && p.y <= 568;
ui.canvas.addEventListener('pointerdown',event=>{
  if (event.button !== 0 || !state.started || state.paused || state.stage === 'INVOICE') return;
  const point = pointerPoint(event);
  ui.canvas.focus({preventScroll:true});
  if (inTank(point)) {
    event.preventDefault();
    gesture = {pointerId:event.pointerId,wasActive:state.active,key:workSpot(state).key,...point,dragged:false};
    pendingAim=point; flushAim();
    if (!state.active) send({type:'toggleActive'});
    ui.canvas.setPointerCapture(event.pointerId);
    refresh();
  } else {
    const context=getContextAction(state);
    if(point.y>=160&&point.y<=310&&Math.abs(point.x-context.x)<=80) send({type:'interact'});
  }
});
ui.canvas.addEventListener('pointermove',event=>{
  if (!state.started || state.paused || state.stage === 'INVOICE') return;
  const point=pointerPoint(event);
  if(inTank(point)) pendingAim=point;
  if(gesture&&Math.hypot(point.x-gesture.x,point.y-gesture.y)>9) gesture.dragged=true;
});
ui.canvas.addEventListener('pointerup',event=>{
  if(!gesture || gesture.pointerId!==event.pointerId)return;
  flushAim();
  if(gesture.wasActive&&!gesture.dragged&&gesture.key===workSpot(state).key&&state.active) send({type:'stop'});
  gesture=null;
  if(ui.canvas.hasPointerCapture(event.pointerId))ui.canvas.releasePointerCapture(event.pointerId);
});
ui.canvas.addEventListener('pointercancel',()=>{
  pendingAim=null;gesture=null;
  if(state.active)send({type:'stop'});
});
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('resize',refresh);
function frame(now:number) {
  const delta=(now-lastFrame)/1000;lastFrame=now;
  flushAim();
  clock.advance(delta,state.paused||!state.started||state.stage==='INVOICE');
  renderScene(ui.canvas,state,{reducedMotion:prefs.reducedMotion,time:state.elapsed});
  if(now-lastUI>=100){refresh();lastUI=now;}
  requestAnimationFrame(frame);
}
refresh();requestAnimationFrame(frame);
// Development-only clock bridge: tests advance real fixed ticks; commands still use visible controls.
if(import.meta.env.DEV){
  const bridge = {
    snapshot:():JobState=>structuredClone(state),
    advance:(seconds:number)=>{
      if(!Number.isFinite(seconds)||seconds<0||seconds>120)throw new Error('Test clock accepts 0–120 seconds per batch.');
      flushAim();
      for(let i=0;i<Math.round(seconds/CONFIG.step);i++) tick(CONFIG.step);
      clock.reset();lastFrame=performance.now();refresh();
    },
  };
  Object.defineProperty(window,'__game',{value:Object.freeze(bridge),writable:false});
}

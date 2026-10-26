import './style.css';
import { CONFIG } from './config';
import { createJob } from './fixtures';
import { command } from './commands';
import { assertInvariants, step } from './simulation';
import { renderScene, targetAt } from './renderer';
import { createUI, type Preferences } from './ui';
import { FixedStepClock } from './runtime';
import { GameAudio } from './audio';
import { bindKeyboard } from './input';
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
const clock = new FixedStepClock(dt => { step(state, dt); if (import.meta.env.DEV) assertInvariants(state); });
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
  void audio.unlock();
  const success = command(state,cmd);
  if (success && cmd.type === 'sayPhrase') audio.sayPhrase();
  refresh();
  if (state.stage === 'INVOICE') document.getElementById('invoice-panel')?.scrollIntoView({block:'nearest',behavior:prefs.reducedMotion?'instant':'smooth'});
}
function start(fixture: FixtureName) {
  state = createJob(fixture); command(state, {type:'start'});
  clock.reset(); lastFrame=performance.now(); lastEventTick=-1; lastEventText='';
  ui.closeDialogs(); void audio.unlock(); refresh();
  ui.canvas.focus({preventScroll:true});
}
function pause() {
  if (!state.started || state.stage === 'INVOICE') return;
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
bindKeyboard(ui.canvas,send,pause,()=>state);
ui.canvas.addEventListener('click',e=>{const target=targetAt(ui.canvas,e,state);if(target&&state.started){send({type:'selectTarget',target});ui.canvas.focus({preventScroll:true});}});
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('resize',refresh);
function frame(now:number) {
  const delta=(now-lastFrame)/1000;lastFrame=now;
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
      for(let i=0;i<Math.round(seconds/CONFIG.step);i++){step(state,CONFIG.step);assertInvariants(state);}
      clock.reset();lastFrame=performance.now();refresh();
    },
  };
  Object.defineProperty(window,'__game',{value:Object.freeze(bridge),writable:false});
}

import type { JobState, Target } from './types';
import { CONFIG } from './config';

const WIDTH = 1100, HEIGHT = 660;
const ink = '#253e35', cream = '#fff9e9', mint = '#d8e6d6', soil = '#d4b38a';
const interior = { x: 196, y: 337, w: 738, bottom: 565, h: 220 };
type Context = CanvasRenderingContext2D;
function rounded(c: Context, x: number,y: number,w: number,h: number,r=8, fill?:string,stroke?:string,lw=2) {
  c.beginPath(); c.roundRect(x,y,w,h,r); if(fill){c.fillStyle=fill;c.fill();} if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
}
function line(c: Context, points: number[], color=ink, width=2) {
  c.beginPath(); c.moveTo(points[0],points[1]); for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]); c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();
}
function label(c:Context,text:string,x:number,y:number,size=13,color=ink,weight=600,align:CanvasTextAlign='left') {
  c.font=`${weight} ${size}px "Trebuchet MS", sans-serif`;c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y);
}
function ellipse(c:Context,x:number,y:number,rx:number,ry:number,fill:string,stroke?:string){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
function circle(c:Context,x:number,y:number,r:number,color:string,stroke?:string){ellipse(c,x,y,r,r,color,stroke);}
function cloud(c:Context,x:number,y:number,s:number){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='#f6f6e8';c.beginPath();c.moveTo(0,20);c.bezierCurveTo(-12,8,0,-8,18,-4);c.bezierCurveTo(18,-27,55,-28,58,-8);c.bezierCurveTo(83,-19,106,3,94,20);c.closePath();c.fill();c.restore();}
function foliage(c:Context,x:number,y:number,s=1){c.save();c.translate(x,y);c.scale(s,s);line(c,[0,60,0,1],'#6d8064',7);ellipse(c,-19,6,30,37,'#819f77');ellipse(c,13,-15,37,45,'#98ad80');ellipse(c,36,12,28,33,'#8ca775');c.restore();}
function ground(c:Context){
  c.fillStyle=mint;c.fillRect(0,0,WIDTH,282);
  cloud(c,128,40,.8);cloud(c,580,38,.65);cloud(c,994,55,1);
  c.fillStyle='#c1d2b5';c.beginPath();c.moveTo(0,215);c.bezierCurveTo(210,135,350,222,540,190);c.bezierCurveTo(755,144,975,150,1100,204);c.lineTo(1100,284);c.lineTo(0,284);c.fill();
  foliage(c,50,148,.85);foliage(c,1048,137,1);
  // Quiet little house behind the service truck.
  rounded(c,773,119,218,132,3,'#f0e6cd',ink,2);
  c.beginPath();c.moveTo(750,128);c.lineTo(881,51);c.lineTo(1015,128);c.closePath();c.fillStyle='#ad7053';c.fill();c.strokeStyle=ink;c.lineWidth=3;c.stroke();
  line(c,[768,123,881,62,997,123],'#d39a72',3);
  rounded(c,866,177,40,74,2,'#798f7e',ink);circle(c,898,216,2,cream);
  for(const x of [798,933]){rounded(c,x,155,35,44,1,'#b0d6cc',ink);line(c,[x+17.5,155,x+17.5,199]);line(c,[x,178,x+35,178]);}
  c.fillStyle='#d9c6a4';c.fillRect(762,246,239,9);
  // Garden fence.
  for(let x=0;x<1100;x+=38){c.fillStyle='#e8e5c8';c.beginPath();c.moveTo(x,220);c.lineTo(x+9,213);c.lineTo(x+18,220);c.lineTo(x+18,263);c.lineTo(x,263);c.closePath();c.fill();}
  c.fillStyle='#b2b99a';c.fillRect(0,237,1100,5);c.fillRect(0,254,1100,5);
  c.fillStyle='#99ad73';c.fillRect(0,260,1100,23);
  c.fillStyle=soil;c.fillRect(0,283,1100,377);
  c.fillStyle='#bfa07d';c.fillRect(0,283,1100,8);
  for(let i=0;i<120;i++){const x=(i*197+19)%1100,y=304+(i*71)%354;ellipse(c,x,y,2+(i%3),1,'#b79b79');}
  for(let i=0;i<54;i++){const x=(i*113+17)%1100;line(c,[x,273,x-3,267,x,270,x+3,264],'#64815c',1.2);}
  // Foreground flowers.
  for(const x of [36,73,1020,1061]){line(c,[x,275,x+2,257],'#647d53',2);circle(c,x+2,256,5,'#f1ca6e');circle(c,x+2,256,1.7,'#8d744b');}
}
function truck(c:Context,state:JobState){
  ellipse(c,370,260,245,9,'#75916a55');
  line(c,[177,229,585,229],ink,13);
  rounded(c,171,116,333,111,47,'#dc913e',ink,3);
  rounded(c,184,125,305,83,36,'#e9aa51');
  line(c,[212,121,212,216],'#b67b35',2);line(c,[472,121,472,216],'#b67b35',2);
  rounded(c,283,101,98,14,4,'#b27b39',ink,2);
  rounded(c,302,94,59,10,3,'#d7a85b',ink,2);
  // cab
  c.beginPath();c.moveTo(507,148);c.lineTo(564,148);c.lineTo(600,188);c.lineTo(608,231);c.lineTo(503,231);c.closePath();c.fillStyle='#dd8c3a';c.fill();c.strokeStyle=ink;c.lineWidth=3;c.stroke();
  c.beginPath();c.moveTo(520,158);c.lineTo(558,158);c.lineTo(582,186);c.lineTo(520,186);c.closePath();c.fillStyle='#b2d5c6';c.fill();c.stroke();
  line(c,[550,159,550,185],'#7b9b85',2);
  line(c,[512,194,512,225],'#a56c30',1.5);rounded(c,523,198,15,4,2,ink);
  rounded(c,591,205,14,10,2,'#fff0b7',ink,1.5);
  rounded(c,589,230,27,9,3,'#6f7964',ink,2);
  for(const x of [227,447,562]){circle(c,x,237,24,ink);circle(c,x,237,14,'#9ea895');circle(c,x,237,6,'#dce0c8');circle(c,x,237,2,ink);}
  // Distinct original brand on the tank.
  label(c,'GOOD COMPANY',339,159,23,ink,900,'center');
  label(c,'S E P T I C   S E R V I C E',339,180,11,ink,700,'center');
  line(c,[285,190,391,190],ink,1);label(c,'a little dirty work.',339,204,12,ink,500,'center');
  circle(c,191,178,12,'#edd08a',ink);circle(c,191,178,5,'#7b8d63');
  if(state.connected){rounded(c,486,194,16,23,2,'#696e52',ink);line(c,[485,204,501,204],'#e8c179',2);}
}
function worker(c:Context,state:JobState){
  const x=665,y=258;ellipse(c,x+2,y+6,21,5,'#69805b55');
  line(c,[x-6,y-27,x-7,y-2,x-16,y-2],ink,8);line(c,[x+7,y-27,x+12,y-1,x+21,y-1],ink,8);
  rounded(c,x-13,y-61,28,35,6,'#e4a354',ink,2);
  line(c,[x-5,y-58,x-5,y-30],'#f9e9b8',3);line(c,[x+7,y-58,x+7,y-30],'#f9e9b8',3);
  circle(c,x,y-75,12,'#d0a879');
  c.fillStyle=ink;c.beginPath();c.arc(x,y-78,13,Math.PI,0);c.lineTo(x+17,y-76);c.lineTo(x-17,y-76);c.closePath();c.fill();
  circle(c,x+5,y-74,1.5,ink);line(c,[x+2,y-67,x+7,y-67],ink,1.4);
  line(c,[x-13,y-52,x-26,y-39,x-25,y-31],'#cc9d6c',7);
  line(c,[x+15,y-51,x+29,y-36,x+43,y-41],'#cc9d6c',7);
  circle(c,x+44,y-42,5,'#dfbd91');
  if(state.stage==='INVOICE')label(c,'✓',x+31,y-74,22,ink,900);
}
function pipe(c:Context){
  c.beginPath();c.moveTo(1100,329);c.lineTo(992,329);c.quadraticCurveTo(906,329,906,366);c.lineTo(906,390);c.strokeStyle=ink;c.lineWidth=23;c.stroke();
  c.strokeStyle='#9baca0';c.lineWidth=16;c.stroke();line(c,[885,381,927,381],ink,23);line(c,[885,381,927,381],'#9baca0',16);
  line(c,[976,319,976,339],ink,2);line(c,[1012,319,1012,339],ink,2);
}
function tankLevels(state:JobState){const m=state.materials;const scale=interior.h/1000;const bottom=interior.bottom;const solidsTop=bottom-m.U*scale;const waterTop=solidsTop-(m.W+m.M)*scale;const scumTop=waterTop-m.S*scale;return{bottom,solidsTop,waterTop,scumTop,scale};}
function targetPosition(state:JobState):[number,number]{const l=tankLevels(state);switch(state.target){case 'surface':return[510,Math.max(l.scumTop+5,351)];case 'liquid':return[540,Math.max(l.waterTop+22,Math.min(535,l.solidsTop-14))];case 'inlet':return[906,383];case 'bottom':return[550,550];case 'wall0':return[209,452];case 'wall1':return[922,452];case 'wall2':return[389,556];case 'wall3':return[755,556];}}
function tank(c:Context,state:JobState,time:number,reduced:boolean){
  const l=tankLevels(state),m=state.materials;
  const clean=state.stage==='CLEANUP'||state.stage==='INVOICE';
  // Shell and open manhole.
  rounded(c,170,315,790,275,27,'#9fa794',ink,3);
  rounded(c,182,326,766,252,19,'#c3c7b0',ink,2);
  rounded(c,196,337,738,228,12,clean?'#eef2d9':'#e5e9d4',ink,2);
  rounded(c,704,270,83,64,4,'#adb59b',ink,3);
  rounded(c,717,278,57,56,2,'#334b3c');
  if(!state.lidOpen||state.lidClosed){rounded(c,692,263,107,16,6,'#647b60',ink,3);line(c,[726,265,766,265],'#a8b695',2);}
  else{c.save();c.translate(819,263);c.rotate(-.28);rounded(c,-35,-5,83,15,6,'#647b60',ink,3);line(c,[-15,-3,22,-3],'#a8b695',2);c.restore();}
  // Contents are derived only from the material accounts.
  c.save();c.beginPath();c.roundRect(197,338,736,226,11);c.clip();
  if(m.U>.05){c.fillStyle='#8c6846';c.fillRect(197,l.solidsTop,736,l.bottom-l.solidsTop+1);for(let i=0;i<65;i++){const x=209+(i*89)%713,y=l.solidsTop+4+(i*17)%Math.max(2,(l.bottom-l.solidsTop-5));ellipse(c,x,y,2+i%3,1.8,'#b18a57');}}
  if(m.W+m.M>.05){const amount=m.M/Math.max(.001,m.W+m.M);const color=amount>.06?'#7a9b78':'#82b6a4';const grad=c.createLinearGradient(0,l.waterTop,0,l.solidsTop);grad.addColorStop(0,color);grad.addColorStop(1,amount>.06?'#698465':'#5d9588');c.fillStyle=grad;c.fillRect(197,l.waterTop,736,l.solidsTop-l.waterTop);for(let i=0;i<22;i++){const x=212+(i*97)%700,y=l.waterTop+8+(i*41)%Math.max(2,l.solidsTop-l.waterTop-12);line(c,[x,y,x+12,y],'#e0ead944',1.5);}if(amount>.005){for(let i=0;i<38;i++){const x=210+(i*79)%708,y=l.waterTop+5+(i*37+time*(state.active&&!reduced?9:0))%Math.max(2,l.solidsTop-l.waterTop-9);circle(c,x,y,1.4+i%2,'#4d715e88');}}}
  if(m.S>.05){c.fillStyle='#b7b367';c.fillRect(197,l.scumTop,736,Math.max(2,l.waterTop-l.scumTop));for(let i=0;i<40;i++){const x=203+(i*83)%725,y=l.scumTop+2+(i*13)%Math.max(1,l.waterTop-l.scumTop-3);ellipse(c,x,y,4+i%5,1.2,'#858d4e');}line(c,[197,l.scumTop,933,l.scumTop],'#6c794b',1.5);}
  // Four finite residue zones: side walls and floor halves.
  for(let i=0;i<4;i++){const ratio=m.walls[i]/CONFIG.initialWalls[i];if(ratio<.001)continue;c.globalAlpha=.2+.65*ratio;c.fillStyle='#87784d';if(i<2){const x=i===0?198:919;for(let k=0;k<13;k++){const yy=356+k*15;ellipse(c,x+(i===0?3:-3),yy,5+ratio*10,6+(k%3)*4,'#87784d');}}else{for(let k=0;k<18;k++){ellipse(c,226+(i-2)*355+k*19,562,8+(k%3)*3,2+ratio*7,'#87784d');}}c.globalAlpha=1;}
  // Recommended mixing band, visual only.
  if(['DRAWDOWN','MIX'].includes(state.stage)&&(m.U+m.M)>0){const low=interior.bottom-(m.U+1.8*(m.U+m.M))*l.scale;const high=interior.bottom-(m.U+2.2*(m.U+m.M))*l.scale;c.fillStyle='#e9d67e33';c.fillRect(198,high,735,low-high);c.setLineDash([7,5]);line(c,[199,high,930,high],'#f1df91',2);line(c,[199,low,930,low],'#f1df91',2);c.setLineDash([]);label(c,'MIXING BAND',754,(high+low)/2+4,11,'#fff4bb',700);}
  // Cosmetic ripples, never part of the simulation.
  if(state.active&&!reduced&&m.W+m.M>0){for(let i=0;i<4;i++){const x=383+i*111+Math.sin(time+i)*8,y=Math.max(l.waterTop+2,l.scumTop+1);c.beginPath();c.ellipse(x,y,20+Math.sin(time*2+i)*5,2,0,0,Math.PI);c.strokeStyle='#e8eadc88';c.lineWidth=1.5;c.stroke();}}
  c.restore();
  // Corner hardware and wall target tags.
  for(const [x,y] of [[184,340],[947,340],[184,564],[947,564]]){circle(c,x,y,3,'#596e59');}
  const zones:[[number,number],[number,number],[number,number],[number,number]]=[[182,436],[948,436],[382,578],[752,578]];
  zones.forEach(([x,y],i)=>{const selected=state.target===`wall${i}`;circle(c,x,y,11,selected?'#edbd5e':'#eef0d8');label(c,String(i+1).padStart(2,'0'),x,y+3,10,ink,800,'center');});
  if(clean){label(c,'LOOKING FRESH.',566,433,25,'#486e57',900,'center');label(c,'One clean tank. A job well done.',566,456,13,'#63816a',500,'center');}
  // Layer labels are linked to actual layer heights and remain readable.
  const count=(m.S>1?1:0)+(m.W+m.M>5?1:0)+(m.U>.5?1:0);
  if(count){const labels:[string,number,string][]=[];if(m.S>1)labels.push(['FLOATING SCUM',l.scumTop+5,'#6b7544']);if(m.W+m.M>5)labels.push([m.M>2?'SUSPENDED SLURRY':'WATER',Math.max(l.waterTop+20,440),'#48746a']);if(m.U>.5)labels.push(['SETTLED SOLIDS',Math.max(l.solidsTop+8,535),'#77583b']);labels.forEach(([text,y,color])=>{line(c,[127,y,155,y,193,y],color,1);circle(c,194,y,2,color);label(c,text,124,y-6,12,ink,800,'right');});}
  label(c,'CUTAWAY VIEW · FICTIONAL GAME UNITS',191,614,12,'#6e614e',600);
  label(c,`${Math.round(m.W+m.S+m.U+m.M+m.walls.reduce((a,b)=>a+b,0))} / 1,000`,937,614,12,'#6e614e',700,'right');
}
function selectedZone(c:Context,state:JobState){
  if(!state.started||state.stage==='INVOICE')return;
  const [x,y]=targetPosition(state);c.save();c.strokeStyle='#f4d080';c.lineWidth=2;c.setLineDash([4,4]);
  if(state.target==='wall0'||state.target==='wall1')rounded(c,state.target==='wall0'?198:906,350,27,190,8,undefined,'#e8c270',2);
  else if(state.target==='wall2'||state.target==='wall3')rounded(c,state.target==='wall2'?219:572,542,339,24,7,undefined,'#e8c270',2);
  else{c.beginPath();c.ellipse(x,y,30,13,0,0,Math.PI*2);c.stroke();}
  c.restore();
}
function tools(c:Context,state:JobState,time:number,reduced:boolean){
  if(!state.connected||state.stowed)return;
  const [x,y]=targetPosition(state);const active=state.active&&!state.paused;const isVac=state.tool==='vacuum';
  // One vacuum hose always hangs through the access opening.
  const hx=isVac?x:608,hy=isVac?y:456;
  const hose=()=>{c.beginPath();c.moveTo(494,205);c.bezierCurveTo(539,206,510,285,621,287);c.bezierCurveTo(693,288,746,245,746,303);c.bezierCurveTo(746,365,hx-22,hy-70,hx,hy);};
  hose();c.strokeStyle=ink;c.lineWidth=15;c.stroke();hose();c.strokeStyle='#737b54';c.lineWidth=10;c.stroke();hose();c.strokeStyle='#a1a477';c.lineWidth=2;c.setLineDash([3,8]);c.stroke();c.setLineDash([]);
  c.save();c.translate(hx,hy);c.rotate(-.2);rounded(c,-10,-4,20,24,4,ink);line(c,[-6,13,6,13],'#c1c7a0',2);c.restore();
  if(isVac&&active&&state.flow>0&&!reduced){for(let i=0;i<9;i++){const phase=(time*1.2+i/9)%1;const px=hx+(746-hx)*phase,py=hy+(307-hy)*phase;ellipse(c,px,py,2.5,4,'#e9d394');}for(let i=0;i<5;i++){const a=time*2+i*1.24;line(c,[hx+Math.cos(a)*35,hy+Math.sin(a)*12,hx+Math.cos(a)*15,hy+Math.sin(a)*5],'#e8e3b7',1.3);}}
  if(state.tool==='hose'){
    c.beginPath();c.moveTo(680,255);c.bezierCurveTo(760,250,x-50,y-60,x-24,y-25);c.strokeStyle='#496a4d';c.lineWidth=6;c.stroke();line(c,[x-24,y-25,x-14,y-16],'#e9bd64',8);
    if(active){for(let i=0;i<5;i++){line(c,[x-14,y-16,x+10+i*6,y+10+i*3],'#e5f6dfaa',2);if(!reduced)circle(c,x+8+i*6+Math.sin(time*3+i)*3,y+14+i*3,2,'#e2f1de');}}
  }
  if(state.tool==='mixer'){
    line(c,[728,281,x,y],ink,8);line(c,[726,281,x-2,y],'#afba9d',3);rounded(c,x-30,y-7,60,12,5,'#64765b',ink,2);
    if(active){for(let i=0;i<3;i++){c.beginPath();c.ellipse(x,y-5,28+i*17,8+i*3,0,reduced?0:time*2+i,(reduced?0:time*2+i)+4.4);c.strokeStyle='#d9dfb5';c.lineWidth=2;c.stroke();}}
  }
  if(state.tool==='inlet'){line(c,[727,278,905,376],ink,5);line(c,[718,275,734,282],'#e9ba5a',9);circle(c,906,377,8,'#e9ba5a',ink);}
  if(state.tool==='wipes'&&active){line(c,[740,280,x,y],ink,4);line(c,[x-17,y,x+17,y],'#cfab68',4);}
}
function wipes(c:Context,state:JobState,time:number,reduced:boolean){
  if(state.wipes.status==='waiting'||state.wipes.status==='disposed')return;
  if(state.wipes.status==='in_hose'){
    rounded(c,590,262,116,27,13,'#f4d28d',ink,1.5);label(c,'HOSE CLOGGED',648,280,11,ink,800,'center');return;
  }
  const l=tankLevels(state);const progress=state.wipes.approach/state.wipes.warningSeconds;const x=670-progress*100;const y=l.scumTop-1;
  for(let i=0;i<5;i++){c.save();c.translate(x+i*8,y+(i%2)*3);c.rotate((i-2)*.18+(reduced?0:Math.sin(time+i)*.07));rounded(c,-6,-5,14,10,2,'#f5f0cf','#9a956d',1);line(c,[-3,-2,3,-2],'#d5cba4',1);c.restore();}
  line(c,[x+16,y-12,x+16,y-38],'#cc7642',1.5);rounded(c,x-31,y-62,98,25,7,'#ffedbd',ink,1);label(c,'WIPES AHEAD',x+18,y-46,11,ink,800,'center');
}
function inletSplash(c:Context,state:JobState,time:number,reduced:boolean){
  if(state.inlet.eventTick===null)return;
  const age=(state.tick-state.inlet.eventTick)/60;if(age>2.4)return;
  if(!reduced&&age<.85){for(let i=0;i<16;i++){const phase=(age*2+i*.06)%1;const x=907-Math.sin(phase*Math.PI)*65+i*2,y=386-phase*90+phase*phase*150;ellipse(c,x,y,2+i%3,4,'#a6b679');}}
  rounded(c,738,303,160,26,13,'#ffedbd',ink,1.5);label(c,'THE MONEY SHOT!',818,320,12,ink,900,'center');
}
function sceneNotes(c:Context,state:JobState){
  label(c,'MAPLE LANE',1072,32,12,'#536f57',700,'right');label(c,'ONE TANK. GOOD HONEST WORK.',1072,48,10,'#6e8468',600,'right');
  if(state.inlet.inspected&&!state.inlet.cleared){rounded(c,939,359,131,43,8,'#f7e7bd',ink,1);label(c,'INLET T',951,376,12,ink,800);label(c,`Blockage ${Math.ceil(state.inlet.strength)} / ${state.inlet.initialStrength}`,951,391,11,ink,500);}
  else{label(c,'INLET T',1001,361,12,ink,800);line(c,[994,365,961,365,931,379],ink,1);}
  // Small near-surface safety sign: the worker never enters the tank.
  rounded(c,34,211,98,36,3,'#f3e7b9',ink,1.5);label(c,'OUTSIDE ONLY',83,226,10,ink,900,'center');label(c,'game · not training',83,239,9,ink,500,'center');line(c,[83,247,83,272],ink,3);
}
export function renderScene(canvas:HTMLCanvasElement,state:JobState,options:{reducedMotion:boolean;time:number}):void{
  const dpr=Math.min(window.devicePixelRatio||1,2);const rect=canvas.getBoundingClientRect();const desiredWidth=Math.round(Math.max(1,rect.width)*dpr);const desiredHeight=Math.round(desiredWidth*HEIGHT/WIDTH);
  if(canvas.width!==desiredWidth||canvas.height!==desiredHeight){canvas.width=desiredWidth;canvas.height=desiredHeight;}
  const c=canvas.getContext('2d');if(!c)return;c.setTransform(canvas.width/WIDTH,0,0,canvas.height/HEIGHT,0,0);c.clearRect(0,0,WIDTH,HEIGHT);c.lineCap='round';c.lineJoin='round';
  const time=options.reducedMotion?0:options.time;
  ground(c);truck(c,state);tank(c,state,time,options.reducedMotion);pipe(c);selectedZone(c,state);tools(c,state,time,options.reducedMotion);wipes(c,state,time,options.reducedMotion);inletSplash(c,state,time,options.reducedMotion);worker(c,state);sceneNotes(c,state);
}
export function targetAt(canvas:HTMLCanvasElement,event:MouseEvent,state?:JobState):Target|null{
  const rect=canvas.getBoundingClientRect();const x=(event.clientX-rect.left)*WIDTH/rect.width,y=(event.clientY-rect.top)*HEIGHT/rect.height;
  if(x>861&&x<976&&y>318&&y<408)return'inlet';
  if(x<185||x>949||y<338||y>577)return null;
  if(x<233)return'wall0';if(x>902)return'wall1';
  // Wall rinsing uses the whole lower third as two generous floor regions.
  // Other tools follow the visible material boundaries as the tank drains.
  if(state){
    const levels=tankLevels(state);
    if(state.tool==='hose'&&['WASH','FINAL_PUMP'].includes(state.stage)&&y>510)return x<560?'wall2':'wall3';
    if((state.stage==='SCUM'||state.tool==='wipes')&&y>=levels.scumTop-25&&y<=levels.waterTop+24)return'surface';
    if(state.tool==='mixer'&&y>Math.max(460,levels.solidsTop-38))return'bottom';
    if(state.materials.U>.5&&y>levels.solidsTop-25)return'bottom';
    if(y>=levels.waterTop-20)return'liquid';
    return'surface';
  }
  if(y>542)return x<560?'wall2':'wall3';
  if(y<419)return'surface';if(y>510)return'bottom';return'liquid';
}

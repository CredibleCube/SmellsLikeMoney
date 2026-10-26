import type { JobState, Target } from './types';
import { ARCADE, CONFIG, WORLD } from './config';
import { hotspots, materialSpots, wallSpots, workSpot } from './work';
import { getContextAction } from './commands';

// All scene art is original Canvas drawing. Physics and quantities live elsewhere.
const WIDTH = 1100, HEIGHT = 660;
const ink = '#18383b', cream = '#fff2ce', lime = '#d4e76c', gold = '#ffc45f';
const interior = { x: 196, y: 337, w: 738, bottom: 565, h: 220 };
type C = CanvasRenderingContext2D;
function round(c:C,x:number,y:number,w:number,h:number,r=8,fill?:string|CanvasGradient,stroke?:string,lw=3){
  c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
}
function line(c:C,p:number[],color=ink,width=3){c.beginPath();c.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)c.lineTo(p[i],p[i+1]);c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.stroke();}
function poly(c:C,p:number[],fill:string,stroke?:string,width=3){c.beginPath();c.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)c.lineTo(p[i],p[i+1]);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function oval(c:C,x:number,y:number,rx:number,ry:number,fill:string,stroke?:string,width=2){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function dot(c:C,x:number,y:number,r:number,fill:string,stroke?:string,lw=2){oval(c,x,y,r,r,fill,stroke,lw);}
function text(c:C,s:string,x:number,y:number,size=13,color=ink,weight=800,align:CanvasTextAlign='left') {c.font=`${weight} ${size}px "Trebuchet MS", "DejaVu Sans", sans-serif`;c.textAlign=align;c.fillStyle=color;c.fillText(s,x,y);}
function panel(c:C,x:number,y:number,w:number,h:number,fill=cream,r=7){round(c,x+3,y+4,w,h,r,'#102c3066');round(c,x,y,w,h,r,fill,ink,2.5);}
function cloud(c:C,x:number,y:number,s:number){c.save();c.translate(x,y);c.scale(s,s);c.beginPath();c.moveTo(-12,21);c.bezierCurveTo(-24,0,-1,-15,13,-10);c.bezierCurveTo(18,-44,62,-40,67,-10);c.bezierCurveTo(95,-28,126,-3,113,20);c.closePath();c.fillStyle='#f2f5da';c.fill();c.strokeStyle='#a8d0c3';c.lineWidth=2;c.stroke();line(c,[0,26,87,26],'#d1e4c7',3);c.restore();}
function tree(c:C,x:number,y:number,s:number){c.save();c.translate(x,y);c.scale(s,s);poly(c,[-9,0,-7,-56,6,-58,14,0],'#70654a',ink,3);line(c,[0,-30,-20,-53,1,-41,19,-66],'#786c4b',6);for(const [tx,ty,r] of [[-18,-79,31],[9,-107,34],[32,-76,33],[-2,-61,27]])dot(c,tx,ty,r,'#5c8d65',ink,3);oval(c,2,-117,23,12,'#86ae75');oval(c,34,-84,21,13,'#739e69');c.restore();}
function sky(c:C,time:number,reduced:boolean){
  const skyGrad=c.createLinearGradient(0,0,0,290);skyGrad.addColorStop(0,'#78bdcc');skyGrad.addColorStop(.6,'#b9d9bf');skyGrad.addColorStop(1,'#d7e2ab');c.fillStyle=skyGrad;c.fillRect(0,0,WIDTH,HEIGHT);
  // Soft, layered silhouettes establish a side-on miniature world.
  poly(c,[0,202,70,139,131,176,234,91,332,166,415,124,506,187,608,96,698,157,780,88,881,166,970,103,1100,176,1100,300,0,300],'#82b3ad');
  poly(c,[0,222,110,164,198,208,303,146,408,205,516,164,624,208,718,152,821,207,917,159,1029,202,1100,175,1100,300,0,300],'#6f9e8c');
  const drift=reduced?0:Math.sin(time*.045)*7;
  cloud(c,115+drift,69,.73);cloud(c,572-drift*.4,64,.68);cloud(c,944+drift*.3,73,.76);
  c.save();c.globalAlpha=.35;dot(c,1001,47,31,'#fff0b2');c.restore();
  // Original cottage and tiny windmill tucked into the distant field.
  poly(c,[801,205,863,143,934,199,931,259,803,259],'#e3ca8b',ink,3);
  poly(c,[781,202,861,131,949,201,931,211,862,153,800,214],'#a76d56',ink,3);
  line(c,[801,199,860,148,934,201],'#d29167',3);
  round(c,852,216,29,44,4,'#5f8476',ink,2);dot(c,875,239,2,gold);
  for(const x of [812,895]){round(c,x,207,23,27,3,'#a9d9cd',ink,2);line(c,[x+11,207,x+11,233,x+22,221,x,221],ink,1.5);}
  round(c,909,166,12,26,1,'#9c775a',ink,2);
  poly(c,[70,256,79,190,91,190,103,256],'#e6dcaa',ink,2);
  const angle=reduced?.4:time*.12+.4;c.save();c.translate(85,191);c.rotate(angle);for(let i=0;i<4;i++){c.rotate(Math.PI/2);poly(c,[0,-3,36,-8,33,2,0,4],'#d5e4b7','#507e70',1.5);}dot(c,0,0,5,'#e2b770',ink);c.restore();
  tree(c,24,269,.93);tree(c,1061,268,1.06);
  // Fence is background scenery, never a movement obstacle.
  for(let x=90;x<1045;x+=42){poly(c,[x,257,x+2,234,x+10,225,x+20,235,x+21,258],'#b8c7a0','#607d67',1.2);}
  line(c,[94,242,1040,242],'#8da67e',4);line(c,[97,254,1042,254],'#819a70',4);
}
function earth(c:C){
  // A chunky floating cutaway, with an irregular painted edge and thick ink.
  c.fillStyle='#17363b';c.fillRect(0,620,1100,40);
  poly(c,[0,279,46,281,71,276,145,280,206,276,269,280,334,276,396,282,464,277,534,282,603,278,670,282,738,278,807,282,879,277,948,281,1011,277,1100,281,1100,612,1078,629,1014,634,985,643,895,637,860,648,774,642,711,649,630,642,542,648,475,641,405,647,335,640,250,645,195,636,120,643,83,634,24,632,0,617],'#9a744e',ink,5);
  poly(c,[0,297,160,296,282,304,443,300,590,307,762,299,926,307,1100,298,1100,359,971,353,790,365,615,353,460,367,287,355,122,363,0,353],'#b38d5f');
  poly(c,[0,391,164,399,321,388,490,406,638,397,804,411,968,392,1100,401,1100,444,909,435,743,446,572,434,374,443,176,431,0,446],'#9f7951');
  poly(c,[0,521,145,509,315,524,494,510,667,524,831,512,1014,527,1100,519,1100,551,950,548,766,558,590,549,413,560,246,549,0,559],'#846c4d');
  for(let i=0;i<126;i++){const x=(i*139+29)%1100,y=309+(i*71)%313;oval(c,x,y,2+i%4,1,'#d2ae7388');}
  for(const [x,y,s] of [[62,354,1],[1008,443,1.4],[91,572,.8],[1027,587,1],[146,453,.7],[423,613,.55]]){
    poly(c,[x-13*s,y,x-10*s,y-8*s,x+3*s,y-12*s,x+14*s,y-4*s,x+10*s,y+6*s,x-4*s,y+8*s],'#758375','#3d5951',2);line(c,[x-10*s,y-6*s,x+2*s,y-10*s,x+10*s,y-4*s],'#b2bd93',2);
  }
  for(const [x,y] of [[43,300],[1044,300],[126,296]]){line(c,[x,y,x+8,y+35,x-5,y+61],'#624f38',3);line(c,[x+7,y+30,x+24,y+41],'#624f38',2);}
  // Grass lip stays on the physics floor; its blades are decorative.
  poly(c,[0,272,55,273,112,270,170,274,233,269,291,273,349,270,410,274,472,269,533,274,594,270,654,274,714,270,776,274,837,270,899,274,961,269,1020,273,1100,269,1100,287,1055,285,1015,292,965,286,909,291,851,286,797,292,738,286,684,291,626,286,571,292,512,286,456,291,397,285,343,292,285,287,229,291,172,286,114,292,59,286,0,292],'#7ea847',ink,3);
  line(c,[0,272,112,270,170,274,233,269,291,273,349,270,410,274,472,269,533,274,594,270,654,274,714,270,776,274,837,270,899,274,961,269,1020,273,1100,269],'#c5db70',3);
  for(let i=0;i<65;i++){const x=(i*83+8)%1100;line(c,[x,278,x-3,267,x+1,274,x+6,264],'#476c3e',1.5);}
  for(const x of [73,110,982,1024]){line(c,[x,273,x+3,253],'#426d48',3);dot(c,x+3,252,6,'#ffe697',ink,1);dot(c,x+3,252,2,'#c28945');}
}
function truck(c:C,state:JobState){
  oval(c,351,273,240,10,'#344b3777');line(c,[163,244,554,244],ink,15);
  // Oversized tank and wheels deliberately read like a toy service vehicle.
  round(c,133,131,328,117,48,'#d99545',ink,5);
  const tankGrad=c.createLinearGradient(0,136,0,241);tankGrad.addColorStop(0,'#ffc56b');tankGrad.addColorStop(.45,'#efa650');tankGrad.addColorStop(1,'#cf7e37');round(c,141,137,311,102,42,tankGrad);
  round(c,159,144,281,35,18,'#ffd27d');line(c,[171,139,171,236],'#aa692f',4);line(c,[423,140,423,234],'#aa692f',4);
  round(c,249,113,109,19,4,'#7a8d55',ink,4);round(c,273,103,60,11,3,'#acb46c',ink,3);
  poly(c,[458,171,505,165,552,204,567,246,455,246],'#d78e3d',ink,5);
  poly(c,[470,177,500,174,533,203,471,203],'#8ec2b7',ink,3);poly(c,[475,180,497,178,514,192,475,192],'#d8edc5');line(c,[504,178,504,201],'#5d8c7c',2);
  round(c,470,216,17,5,2,ink);round(c,549,218,15,12,2,'#ffe49b',ink,2);round(c,550,246,28,9,3,'#728773',ink,3);
  for(const x of [207,397,523]){dot(c,x,251,29,'#284044',ink,4);dot(c,x,251,18,'#83947a',ink,3);dot(c,x,251,10,'#c5c9a4',ink,2);dot(c,x,251,3,ink);for(let i=0;i<8;i++){const a=i*Math.PI/4;line(c,[x+Math.cos(a)*23,251+Math.sin(a)*23,x+Math.cos(a)*27,251+Math.sin(a)*27],'#52625a',2);}}
  text(c,'GOOD COMPANY',296,181,26,ink,950,'center');text(c,'S E P T I C   S Q U A D',296,202,11,ink,800,'center');text(c,'WE TAKE THE BAD WITH THE GOOD.',296,220,8,'#734e2e',800,'center');
  dot(c,153,195,15,'#dbc376',ink,3);dot(c,153,195,7,'#718653',ink,2);
  round(c,438,217,19,26,3,'#4b6662',ink,3);line(c,[439,228,455,228],gold,3);
  if(state.bogged){panel(c,281,82,112,27,'#ffc16e');text(c,'BRR… BOGGED!',337,101,11,ink,900,'center');}
  else if(state.work.boost&&state.active&&state.tool==='vacuum'){panel(c,281,82,134,27,'#ffb34f');text(c,`BOOST!  ${Math.round(state.heat)}%`,348,101,11,ink,950,'center');}
}
function levels(state:JobState){const m=state.materials;const scale=interior.h/1000;const solidsTop=interior.bottom-m.U*scale;const waterTop=solidsTop-(m.W+m.M)*scale;return{solidsTop,waterTop,scumTop:waterTop-m.S*scale,scale};}
function targetPosition(state:JobState):[number,number]{
  const spot=workSpot(state), aim=state.work.aim;
  if(spot.kind==='wall')return[aim.x,aim.y];
  if(['scum','settled','suspended','water'].includes(spot.kind))return[aim.x,spot.y];
  return[spot.x,spot.y];
}
function layerTag(c:C,name:string,y:number,color:string){panel(c,24,y-16,127,27,'#e6e3b7',5);dot(c,38,y-2,4,color,ink,1);text(c,name,49,y+2,10,ink,900);line(c,[151,y-2,172,y-2,193,y],color,2);}
function tank(c:C,state:JobState,time:number,reduced:boolean){
  const l=levels(state),m=state.materials,clean=['CLEANUP','INVOICE'].includes(state.stage);
  round(c,172,322,796,279,28,'#16373b88');round(c,170,315,790,275,26,'#638474',ink,5);round(c,180,324,770,257,20,'#b1b99a',ink,3);round(c,192,333,746,236,14,'#335b55',ink,3);round(c,196,337,738,228,12,clean?'#d8e8ba':'#c0d1ab',ink,2);
  for(const x of [181,948])for(const y of [341,452,568]){dot(c,x,y,4,'#d4d6ac',ink,2);line(c,[x-1,y-1,x+2,y+2],ink,1);}
  round(c,704,270,83,65,5,'#84997c',ink,4);round(c,717,278,57,55,2,'#244a43',ink,3);
  if(!state.lidOpen||state.lidClosed){round(c,692,261,107,17,5,'#78966e',ink,4);line(c,[712,265,779,265],'#d0d9a1',3);}
  else{c.save();c.translate(819,261);c.rotate(-.33);round(c,-35,-5,83,16,5,'#78966e',ink,4);line(c,[-17,-1,26,-1],'#d0d9a1',3);c.restore();}
  c.save();c.beginPath();c.roundRect(197,338,736,226,11);c.clip();
  // Flat water is shared; all dirt shapes below are the actual finite local accounts.
  if(m.W+m.M>.05){
    const g=c.createLinearGradient(0,l.waterTop,0,565);g.addColorStop(0,'#63c6bd');g.addColorStop(1,'#267d82');c.fillStyle=g;c.fillRect(197,l.waterTop,736,565-l.waterTop);line(c,[197,l.waterTop,933,l.waterTop],'#b6f4d3',3);
    for(let i=0;i<27;i++){const x=207+(i*97)%716,y=l.waterTop+8+(i*41)%Math.max(2,565-l.waterTop-12);line(c,[x,y,x+9+(i%3)*4,y],'#b6f3d144',2);}
  }
  // Four settled clumps expose clean floor independently as the mixer sweeps.
  for(const spot of materialSpots(state,'settled')){
    if(spot.remaining<=.001)continue;
    const x=197+spot.column*184.5,h=Math.max(3,spot.remaining*.88),top=565-h;
    poly(c,[x,565,x,top+8,x+17,top+2,x+45,top+5,x+72,top,x+109,top+5,x+139,top+2,x+182,top+8,x+182,565],'#8b613e',ink,1.8);
    for(let i=0;i<15;i++){const xx=x+10+(i*31)%163,yy=top+5+(i*11)%Math.max(2,h-6);oval(c,xx,yy,3+i%4,2,'#d29b54');}
  }
  // Visible suspended clouds give proportional suction a local place to aim.
  for(const spot of materialSpots(state,'suspended')){
    if(spot.remaining<=.002)continue;
    const amount=Math.min(1,spot.remaining/50),low=565-state.work.settled[spot.column]*.88;
    const mid=Math.max(l.waterTop+12,(l.waterTop+low)/2),hh=Math.max(10,Math.min(76,(low-l.waterTop)*.43));
    c.save();c.globalAlpha=.28+.57*amount;
    oval(c,spot.x,mid,65+amount*20,hh,'#8fae60','#44694a',2);
    for(let i=0;i<15;i++){const a=i*2.41,rr=13+(i%6)*9,dy=(reduced?0:Math.sin(time*.6+i)*2);oval(c,spot.x+Math.cos(a)*rr,mid+Math.sin(a)*Math.min(hh-3,rr*.55)+dy,3+i%4,2.2,'#405b3b');}
    c.restore();
  }
  // Floating pockets retain their own height; clearing one leaves a visible gap.
  for(const spot of materialSpots(state,'scum')){
    if(spot.remaining<=.001)continue;
    const x=199+spot.column*184.5,h=Math.max(3,spot.remaining*.88),top=l.waterTop-h;
    poly(c,[x,l.waterTop,x,top+6,x+16,top+1,x+39,top+4,x+64,top,x+88,top+3,x+117,top,x+143,top+4,x+165,top+1,x+180,top+6,x+180,l.waterTop],'#b6c65f','#6a823c',1.8);
    for(let i=0;i<11;i++){const xx=x+10+(i*43)%161,yy=top+3+(i*7)%Math.max(1,h-4);oval(c,xx,yy,4+i%4,1.8,'#667d3d');}
    line(c,[x+7,top+2,x+44,top+3,x+63,top+1],'#e1ec8a',2);
  }
  // Twelve generous residue patches fade independently instead of globally.
  for(const spot of wallSpots(state)){
    const ratio=Math.max(0,Math.min(1,spot.remaining/spot.initial));if(ratio<.001)continue;
    c.save();c.globalAlpha=.2+.7*ratio;
    if(spot.target==='wall0'||spot.target==='wall1'){
      const xx=spot.target==='wall0'?204:923;
      for(let i=0;i<5;i++)oval(c,xx+(i%2?3:-2),spot.y-23+i*11,5+ratio*9,6+(i%3)*2,'#8c8543');
      for(let i=0;i<4;i++)dot(c,xx+(spot.target==='wall0'?7:-7),spot.y-15+i*12,1.8,'#c9b865');
    }else{
      for(let i=0;i<7;i++)oval(c,spot.x-43+i*14,560,7+(i%3)*3,2+ratio*7,'#8c8543');
      for(let i=0;i<4;i++)oval(c,spot.x-32+i*21,556,3,1.5,'#c9b865');
    }
    c.restore();
  }
  if(['DRAWDOWN','MIX'].includes(state.stage)&&m.U+m.M>0){const low=565-(m.U+1.8*(m.U+m.M))*l.scale,high=565-(m.U+2.2*(m.U+m.M))*l.scale;c.fillStyle='#ffe89933';c.fillRect(198,high,735,low-high);c.setLineDash([8,6]);line(c,[199,high,930,high],gold,2);line(c,[199,low,930,low],gold,2);c.setLineDash([]);text(c,'MIXING ZONE',752,(high+low)/2+4,12,'#fff3b0',900);}
  if(state.active&&state.flow>0&&!reduced&&m.W+m.M>0){for(let i=0;i<4;i++){const x=365+i*127+Math.sin(time+i)*9,y=Math.max(l.waterTop+2,l.scumTop+1);c.beginPath();c.ellipse(x,y,18+Math.sin(time*2+i)*5,2,0,0,Math.PI);c.strokeStyle='#e9f5c999';c.lineWidth=2;c.stroke();}}
  c.restore();
  const zones:[[number,number],[number,number],[number,number],[number,number]]=[[182,436],[948,436],[382,578],[752,578]];
  zones.forEach(([x,y],i)=>{const selected=state.target===`wall${i}`;dot(c,x+1,y+2,12,ink);dot(c,x,y,12,selected?gold:cream,ink,2);text(c,String(i+1).padStart(2,'0'),x,y+4,10,ink,900,'center');});
  if(clean){text(c,'SQUEAKY. CLEAN.',565,441,29,'#3c7f5d',950,'center');text(c,'Good work, crew.',565,465,15,'#648f64',800,'center');}
  if(m.S>1)layerTag(c,'FLOATING SKUM',l.scumTop+5,'#7b913d');
  if(m.W+m.M>5)layerTag(c,m.M>2?'MIXED SLURRY':'WATER',Math.max(l.waterTop+27,m.S>1?l.scumTop+36:440),'#3f9690');
  if(m.U>.5)layerTag(c,'SETTLED SOLIDS',Math.max(l.solidsTop+12,539),'#9b6c40');
  text(c,'CUTAWAY CAM  /  FICTIONAL UNITS',191,617,11,'#ead2a2',900);
  panel(c,807,601,132,25,'#c5cf91',4);text(c,`${Math.round(m.W+m.S+m.U+m.M+m.walls.reduce((a,b)=>a+b,0))} / 1,000`,873,618,11,ink,900,'center');
}
function pipe(c:C,state:JobState){
  c.beginPath();c.moveTo(1100,329);c.lineTo(992,329);c.quadraticCurveTo(906,329,906,366);c.lineTo(906,390);c.strokeStyle=ink;c.lineWidth=26;c.stroke();c.strokeStyle='#7b9d8d';c.lineWidth=17;c.stroke();
  line(c,[885,381,927,381],ink,26);line(c,[885,381,927,381],'#91af99',17);line(c,[976,319,976,339],ink,3);line(c,[1012,319,1012,339],ink,3);
  panel(c,969,370,106,38,state.inlet.inspected&&!state.inlet.cleared?'#ffd47e':'#d9dfac',5);text(c,'INLET T',1022,386,11,ink,900,'center');text(c,state.inlet.cleared?'CLEAR':state.inlet.inspected?`BLOCKED: ${Math.ceil(state.inlet.strength)}`:'INSPECT FIRST',1022,400,9,'#5b6a47',800,'center');
}
function targetZone(c:C,state:JobState,time:number,reduced:boolean){
  if(!state.started||state.stage==='INVOICE'||state.stowed)return;
  const spot=workSpot(state),[x,y]=targetPosition(state),working=state.active&&!state.paused&&state.flow>0;
  const relevant=hotspots(state);
  // Small numbered rings make each finite cleanup opportunity discoverable.
  if(relevant.length>1)relevant.forEach((other,i)=>{
    if(other.key===spot.key)return;
    c.save();c.globalAlpha=other.remaining>.001?.58:.32;
    dot(c,other.x,other.y,8,other.remaining>.001?'#c7d975':'#dceec8',ink,1.5);
    text(c,other.remaining>.001?String(i+1):'✓',other.x,other.y+3,8,ink,900,'center');c.restore();
  });
  c.save();c.strokeStyle=working?'#fff5ba':gold;c.lineWidth=2;
  const radius=17+(working&&!reduced?Math.sin(time*7)*2:0);
  c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.stroke();
  for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])line(c,[x+dx*(radius+3),y+dy*(radius+3),x+dx*(radius+10),y+dy*(radius+10)],working?cream:gold,2);
  dot(c,x,y,2.5,working?cream:gold);
  const progress=1-Math.min(1,spot.remaining/Math.max(.001,spot.initial));
  c.beginPath();c.arc(x,y,radius+5,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);c.strokeStyle=lime;c.lineWidth=4;c.stroke();
  // This progress is local material removed, not elapsed time or a particle count.
  if(['scum','settled','suspended','wall'].includes(spot.kind)){
    const empty=spot.remaining<=.001;
    const caption=empty?'CLEAR · Q NEXT':`${spot.kind==='wall'?'PATCH':spot.kind==='scum'?'POCKET':spot.kind==='settled'?'CLUMP':'CLOUD'} ${spot.kind==='wall'?spot.patch+1:spot.column+1} · ${Math.round(progress*100)}%`;
    const bx=Math.max(221,Math.min(795,x-65)),by=Math.max(347,Math.min(530,y+32));
    panel(c,bx,by,130,23,empty?'#d4e79b':'#fbefc4',4);text(c,caption,bx+65,by+16,9.5,ink,900,'center');
  }
  c.restore();
}
function aimFacing(state:JobState): -1|1 {return state.active&&!state.paused?(targetPosition(state)[0]<state.player.x?-1:1):state.player.facing;}
function hand(state:JobState):[number,number]{const p=state.player;return[p.x+aimFacing(state)*20,p.y-(p.crouching?28:45)];}
function quad(a:number,b:number,c:number,t:number){return(1-t)*(1-t)*a+2*(1-t)*t*b+t*t*c;}
function tools(c:C,state:JobState,time:number,reduced:boolean){
  if(!state.connected||state.stowed)return;
  const [x,y]=targetPosition(state),[sx,sy]=hand(state);const active=state.active&&!state.paused;const contact=active&&(state.flow>0||state.tool==='inlet'||state.tool==='wipes');
  const vac=state.tool==='vacuum';const hx=vac?x:608,hy=vac?y:486;
  const hose=()=>{c.beginPath();c.moveTo(448,229);c.bezierCurveTo(476,236,495,292,sx,sy);c.bezierCurveTo(sx+40,sy-12,747,249,746,303);c.bezierCurveTo(745,363,hx-22,hy-76,hx,hy);};
  hose();c.strokeStyle=ink;c.lineWidth=17;c.stroke();hose();c.strokeStyle=vac?'#81965f':'#667e67';c.lineWidth=11;c.stroke();hose();c.strokeStyle='#b4c17b';c.lineWidth=2;c.setLineDash([3,8]);c.stroke();c.setLineDash([]);
  c.save();c.translate(hx,hy);c.rotate(-.16);round(c,-12,-4,24,24,4,'#395550',ink,3);line(c,[-8,13,8,13],gold,3);c.restore();
  // A target guide is only an aiming aid. It never creates material or momentum.
  if(!vac){const cx=(sx+x)/2,cy=Math.min(sy,y)-45;c.save();c.setLineDash([2,8]);c.beginPath();c.moveTo(sx,sy);c.quadraticCurveTo(cx,cy,x,y);c.strokeStyle='#fff3b477';c.lineWidth=2;c.stroke();c.restore();}
  if(vac&&active&&state.flow>0&&!reduced){for(let i=0;i<10;i++){const t=(time*1.35+i/10)%1;oval(c,hx+(746-hx)*t,hy+(307-hy)*t,state.work.boost?3.5:2.5,state.work.boost?5:4,state.work.boost?'#ffd173':'#f0dc8b');}for(let i=0;i<6;i++){const a=time*3+i*1.04;line(c,[hx+Math.cos(a)*35,hy+Math.sin(a)*12,hx+Math.cos(a)*16,hy+Math.sin(a)*5],'#d2f2b9',2);}}
  if(state.tool==='hose'){
    c.beginPath();c.moveTo(484,269);c.bezierCurveTo(543,292,sx-50,sy+35,sx,sy);c.strokeStyle=ink;c.lineWidth=8;c.stroke();c.strokeStyle='#759851';c.lineWidth=4;c.stroke();
    const cx=(sx+x)/2,cy=Math.min(sy,y)-45;line(c,[sx-6,sy+3,sx+13,sy-6],'#d6af5e',10);line(c,[sx-6,sy+3,sx+13,sy-6],ink,2);
    if(contact){c.beginPath();c.moveTo(sx+10,sy-5);c.quadraticCurveTo(cx,cy,x,y);c.strokeStyle='#c4f1db88';c.lineWidth=5;c.stroke();if(!reduced)for(let i=0;i<18;i++){const t=(time*1.3+i/18)%1;dot(c,quad(sx,cx,x,t),quad(sy,cy,y,t),1.6+(i%3)*.5,'#efffc9');}for(let i=0;i<6;i++){const a=(i-3)*.5;line(c,[x,y,x+Math.cos(a)*17,y+Math.sin(a)*20],'#dff8c4',2);}}
  }
  if(state.tool==='mixer'){
    line(c,[sx,sy,x,y],ink,9);line(c,[sx-1,sy,x-2,y],'#aebc8e',3);round(c,sx-15,sy-11,30,18,4,'#d9a84d',ink,3);round(c,x-30,y-7,60,12,5,'#6c855e',ink,3);
    if(contact)for(let i=0;i<3;i++){c.beginPath();c.ellipse(x,y-5,28+i*17,8+i*3,0,reduced?0:time*2+i,(reduced?0:time*2+i)+4.4);c.strokeStyle='#e2e8a3';c.lineWidth=2.5;c.stroke();}
  }
  if(state.tool==='inlet'){line(c,[sx,sy,905,376],ink,6);line(c,[sx-8,sy,sx+8,sy-3],gold,9);dot(c,906,377,10,gold,ink,3);}
  if(state.tool==='wipes'){line(c,[sx,sy,x,y],ink,4);line(c,[x-18,y,x+18,y],gold,5);line(c,[x-18,y,x-14,y+10,x-8,y+1,x,y+11,x+8,y+1,x+14,y+10,x+18,y],ink,2);}
}
function worker(c:C,state:JobState,reduced:boolean){
  const p=state.player;const moving=Math.abs(p.vx)>5&&p.grounded;const phase=reduced?0:p.stride;const leg=moving?Math.sin(phase)*10:0;
  const airborne= Math.max(0,WORLD.groundY-p.y);oval(c,p.x,WORLD.groundY+3,Math.max(11,24-airborne*.08),Math.max(3,6-airborne*.02),'#26483766');
  c.save();c.translate(p.x,p.y);c.scale(aimFacing(state),p.crouching?.67:1);if(!p.grounded)c.rotate(Math.max(-.12,Math.min(.12,p.vy*.0003)));
  // Broad boots, overalls, oversized face, and earmuffs form an original technician.
  line(c,[-9,-27,-11+leg,-5,-21+leg,-3],ink,11);line(c,[9,-27,10-leg,-5,21-leg,-3],ink,11);
  line(c,[-21+leg,-2,-8+leg,-2],'#7a9384',4);line(c,[8-leg,-2,21-leg,-2],'#7a9384',4);
  round(c,-18,-54,35,31,9,'#f6aa4d',ink,3);poly(c,[-13,-53,-8,-39,7,-39,12,-53,15,-25,-15,-25],'#577e63',ink,2);line(c,[-10,-51,-10,-35,9,-35,9,-51],'#cad49a',3);dot(c,-10,-36,2,gold);dot(c,9,-36,2,gold);
  line(c,[-16,-48,-26,-33,-25,-27],'#d8a67a',9);line(c,[17,-48,24,-38,29,-43],'#d8a67a',9);dot(c,29,-43,6,'#ecc792',ink,2);
  oval(c,1,-69,23,22,'#e5b589',ink,3);oval(c,12,-64,16,12,'#f1c99a');
  // Visor-like eyes and a slightly cocky grin, not a borrowed character design.
  oval(c,6,-72,8,10,'#fff8df',ink,1.7);oval(c,20,-71,7,9,'#fff8df',ink,1.7);dot(c,9,-70,2.6,ink);dot(c,22,-69,2.3,ink);oval(c,26,-61,7,5,'#e5b589',ink,1.5);line(c,[7,-54,17,-52,23,-56],ink,2);line(c,[-12,-57,-5,-52],'#b57c63',2);
  c.beginPath();c.moveTo(-25,-77);c.bezierCurveTo(-25,-105,22,-107,25,-79);c.lineTo(31,-77);c.lineTo(31,-71);c.lineTo(-25,-71);c.closePath();c.fillStyle='#eebf51';c.fill();c.strokeStyle=ink;c.lineWidth=3;c.stroke();
  line(c,[-17,-85,19,-85],'#ffe596',4);line(c,[0,-100,0,-82],'#c78e3f',4);round(c,-26,-77,10,20,4,'#6b8b6b',ink,2);round(c,-5,-89,15,10,3,'#4e7365',ink,2);dot(c,3,-84,3,'#d9edb1');
  if(state.bogged){line(c,[6,-81,14,-78,19,-80,25,-77],ink,2);}
  c.restore();
  const nearBolt=ARCADE.collectibles.some((token,i)=>!state.work.collectibles[i]&&Math.abs(p.x-token.x)<105);
  if(state.started&&p.grounded&&!p.crouching&&!nearBolt){panel(c,p.x-25,p.y-145,50,19,'#e2e9b8',4);text(c,'BUD',p.x,p.y-132,10,ink,900,'center');}
  if(moving&&!reduced)for(let i=0;i<3;i++){const t=(p.stride*.065+i/3)%1;oval(c,p.x-p.facing*(18+t*23),WORLD.groundY-1-t*5,2+t*3,1.5+t,'#d6cd8999');}
}
function wipes(c:C,state:JobState,time:number,reduced:boolean){
  if(state.wipes.status==='waiting'||state.wipes.status==='disposed')return;
  if(state.wipes.status==='in_hose'){panel(c,603,289,121,27,'#ffc86c');text(c,'HOSE JAMMED!',664,307,11,ink,900,'center');return;}
  const l=levels(state),progress=state.wipes.approach/state.wipes.warningSeconds,x=670-progress*100,y=l.scumTop-1;
  for(let i=0;i<5;i++){c.save();c.translate(x+i*8,y+(i%2)*3);c.rotate((i-2)*.18+(reduced?0:Math.sin(time+i)*.07));round(c,-6,-5,14,10,2,'#fff4d5','#7f8d5e',1.5);line(c,[-3,-2,3,-2],'#d5cba4',1);c.restore();}
  line(c,[x+16,y-11,x+16,y-31],'#e8c062',2);panel(c,x-32,y-58,100,24,'#ffdf91',5);text(c,'WIPE ALERT!',x+18,y-42,11,ink,900,'center');
}
function inletSplash(c:C,state:JobState,reduced:boolean){
  if(state.inlet.eventTick===null)return;const age=(state.tick-state.inlet.eventTick)/60;if(age>2.4)return;
  if(!reduced&&age<.85){for(let i=0;i<18;i++){const p=(age*2+i*.06)%1,x=907-Math.sin(p*Math.PI)*65+i*2,y=386-p*90+p*p*150;oval(c,x,y,2+i%3,4,'#c1d773',ink,1);}}
  c.save();c.translate(806,331);c.rotate(-.06);panel(c,-87,-19,174,31,'#ffe38c',5);text(c,'THE MONEY SHOT!',0,2,13,ink,950,'center');c.restore();
}
function worldLabels(c:C,state:JobState,time:number,reduced:boolean){
  panel(c,936,21,139,35,'#486f67',6);text(c,'OUTSIDE ONLY',1005,36,11,'#f2edbd',900,'center');text(c,'KEEP YOUR BOOTS UP HERE',1005,48,6.8,'#b6d5b7',800,'center');
  for(const [name,station]of Object.entries(WORLD.stations)){
    const color=name==='truck'?'#dfae59':name==='hatch'?'#c5d871':'#a3c9a2';
    dot(c,station.x,292,5,color,ink,2);text(c,name.toUpperCase(),station.x,309,9,'#efddaa',900,'center');
  }
  if(!state.started||state.stage==='INVOICE')return;
  const context=getContextAction(state);const near=Math.abs(state.player.x-context.x)<=WORLD.stations[context.station].radius;
  const pulse=reduced?0:Math.sin(time*3)*2;
  // Destination arrow is grounded in actual station range and never advances a task.
  poly(c,[context.x-8,235+pulse,context.x+8,235+pulse,context.x,245+pulse],near?gold:'#e3e4a7',ink,2);
  const caption=near?`E  ${context.label}`:`${context.station.toUpperCase()}  ${context.x>state.player.x?'→':'←'}`;
  c.font='900 12px "Trebuchet MS", sans-serif';const width=Math.max(98,Math.min(240,c.measureText(caption).width+29));
  const bx=Math.max(195,Math.min(893-width,context.x-width/2));
  panel(c,bx,82,width,30,near?'#ffe2a0':'#dde7bb',5);text(c,caption,bx+width/2,102,12,ink,900,'center');
  if(!near){text(c,'WALK OVER TO INTERACT',bx+width/2,128,8,'#426a60',900,'center');}
}
function crewTokens(c:C,state:JobState,time:number,reduced:boolean){
  if(state.stage==='INVOICE')return;
  ARCADE.collectibles.forEach((token,i)=>{
    if(state.work.collectibles[i])return;
    const bob=reduced?0:Math.sin(time*2+i)*3;
    oval(c,token.x,token.y+31,16,4,'#28423733');
    c.save();c.translate(token.x,token.y+bob);
    dot(c,0,0,15,'#fff0a333');
    poly(c,[-7,-10,5,-10,11,-4,11,5,5,11,-7,11,-12,5,-12,-4],gold,ink,2.3);
    poly(c,[-4,-4,4,-4,6,0,3,5,-4,5,-6,0],'#a56a30',ink,1.5);
    line(c,[-6,-7,3,-7],'#fff0a3',2);c.restore();
    if(state.started&&Math.abs(state.player.x-token.x)<105&&state.player.grounded){
      text(c,'JUMP FOR A CREW BOLT',token.x,token.y-23,8.5,'#234e49',900,'center');
    }
  });
}
function milestoneToast(c:C,state:JobState,reduced:boolean){
  if(!state.started)return;
  const milestone=[...state.events].reverse().find(event=>event.kind==='success'&&/Connected\.|Surface cleared|Inlet serviced|Poop smoothie|Bulk pumping|Tank clean|Job complete/.test(event.text));
  if(!milestone)return;
  const age=(state.tick-milestone.tick)*CONFIG.step;if(age<0||age>2.25)return;
  const names:Record<string,string>={SCUM:'CONNECTED. LET’S CLEAN.',INLET:'SURFACE CLEAR!',DRAWDOWN:'INLET CLEAR!',MIX:'MIX IT UP!',SLURRY:'SMELLS LIKE MONEY!',WASH:'BULK PUMPING DONE!',FINAL_PUMP:'FINAL SWEEP!',CLEANUP:'SQUEAKY CLEAN!',INVOICE:'JOB COMPLETE!'};
  const title=names[state.stage];if(!title)return;
  c.save();if(!reduced)c.globalAlpha=Math.min(1,(2.25-age)*2.5);
  panel(c,360,23,380,35,'#e6efab',6);text(c,title,550,47,16,ink,950,'center');c.restore();
}

function rewardPop(c:C,state:JobState,reduced:boolean){
  const reward=state.work.lastReward;if(!reward)return;
  const age=(state.tick-reward.tick)*CONFIG.step;if(age<0||age>1.8)return;
  const rise=reduced?0:Math.min(24,age*18),alpha=reduced?1:Math.min(1,(1.8-age)*2.5);
  c.save();c.globalAlpha=alpha;
  const x=Math.max(200,Math.min(880,reward.x)),y=Math.max(102,Math.min(548,reward.y-39-rise));
  c.font='950 12px "Trebuchet MS", sans-serif';const w=Math.min(290,Math.max(132,c.measureText(reward.text).width+26));
  c.translate(x,y);if(!reduced)c.rotate(-.035);
  panel(c,-w/2,-17,w,31,state.work.combo>1?'#e0ed88':'#fff0a7',5);text(c,reward.text,0,3,11.5,ink,950,'center');
  if(!reduced){for(let i=0;i<8;i++){const a=i*Math.PI/4;const d=20+Math.min(30,age*36);line(c,[Math.cos(a)*d,Math.sin(a)*d,Math.cos(a)*(d+5),Math.sin(a)*(d+5)],i%2?gold:lime,2);}}
  c.restore();
}

export function renderScene(canvas:HTMLCanvasElement,state:JobState,options:{reducedMotion:boolean;time:number}):void{
  const dpr=Math.min(window.devicePixelRatio||1,2),rect=canvas.getBoundingClientRect();const w=Math.round(Math.max(1,rect.width)*dpr),h=Math.round(w*HEIGHT/WIDTH);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const c=canvas.getContext('2d');if(!c)return;c.setTransform(canvas.width/WIDTH,0,0,canvas.height/HEIGHT,0,0);c.clearRect(0,0,WIDTH,HEIGHT);c.lineCap='round';c.lineJoin='round';
  const time=options.reducedMotion?0:options.time;
  sky(c,time,options.reducedMotion);earth(c);truck(c,state);crewTokens(c,state,time,options.reducedMotion);tank(c,state,time,options.reducedMotion);pipe(c,state);tools(c,state,time,options.reducedMotion);targetZone(c,state,time,options.reducedMotion);wipes(c,state,time,options.reducedMotion);inletSplash(c,state,options.reducedMotion);worker(c,state,options.reducedMotion);worldLabels(c,state,time,options.reducedMotion);milestoneToast(c,state,options.reducedMotion);rewardPop(c,state,options.reducedMotion);
}
export function targetAt(canvas:HTMLCanvasElement,event:MouseEvent,state?:JobState):Target|null{
  const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*WIDTH/rect.width,y=(event.clientY-rect.top)*HEIGHT/rect.height;
  if(x>861&&x<976&&y>318&&y<408)return'inlet';
  if(x<185||x>949||y<338||y>577)return null;
  if(x<233)return'wall0';if(x>902)return'wall1';
  if(state){const l=levels(state);if(state.tool==='hose'&&['WASH','FINAL_PUMP'].includes(state.stage)&&y>510)return x<560?'wall2':'wall3';if((state.stage==='SCUM'||state.tool==='wipes')&&y>=l.scumTop-25&&y<=l.waterTop+24)return'surface';if(state.tool==='mixer'&&y>Math.max(460,l.solidsTop-38))return'bottom';if(state.materials.U>.5&&y>l.solidsTop-25)return'bottom';if(y>=l.waterTop-20)return'liquid';return'surface';}
  if(y>542)return x<560?'wall2':'wall3';if(y<419)return'surface';if(y>510)return'bottom';return'liquid';
}

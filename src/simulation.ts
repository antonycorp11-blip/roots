import {COST,H,PREP_HOURS,SURFACE,W,canAfford,cell,inBounds,index,log,spend,type Game,type Job,type Stock,type Structure,type Tool} from './model';

export function neighbors(x:number,y:number){return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]] as const}
function passable(g:Game,x:number,y:number){if(!inBounds(x,y)||y<SURFACE-1)return false;const c=cell(g,x,y);return c.material==='empty'&&c.structure!=='wall'}
export function pathTo(g:Game,sx:number,sy:number,tx:number,ty:number){
 if(!passable(g,tx,ty))return [];
 const start=index(Math.max(0,Math.min(W-1,sx)),Math.max(0,Math.min(H-1,sy))),end=index(tx,ty);
 if(start===end)return [start];
 const prev=new Int32Array(W*H).fill(-1),q=new Int32Array(W*H);let head=0,tail=0;q[tail++]=start;prev[start]=start;
 while(head<tail){const n=q[head++],x=n%W,y=Math.floor(n/W);for(const [nx,ny] of neighbors(x,y)){if(!passable(g,nx,ny))continue;const ni=index(nx,ny);if(prev[ni]!==-1)continue;prev[ni]=n;if(ni===end){const path=[end];let p=n;while(p!==start){path.push(p);p=prev[p]}path.push(start);return path.reverse()}q[tail++]=ni}}
 return [];
}
function workPosition(g:Game,j:Job){const w=g.worker,sx=Math.floor(w.x),sy=Math.floor(w.y);if(j.kind==='move')return pathTo(g,sx,sy,j.x,j.y);let best:number[]=[];for(const [x,y] of neighbors(j.x,j.y)){if(!passable(g,x,y))continue;const p=pathTo(g,sx,sy,x,y);if(p.length&&(!best.length||p.length<best.length))best=p}return best}
export function structuralRisk(g:Game,x:number,y:number){
 const c=cell(g,x,y);if(c.material!=='empty'||y<SURFACE+1)return 0;
 let score=0,span=0;for(let xx=x-4;xx<=x+4;xx++){if(!inBounds(xx,y))continue;const n=cell(g,xx,y);if(n.material==='empty'&&n.structure!=='wall'&&n.structure!=='support')span++;if(n.structure==='support'||n.structure==='wall')score+=Math.max(0,5-Math.abs(xx-x))*13}
 const above=inBounds(x,y-1)?cell(g,x,y-1):null;return Math.max(0,span*9+(above?.material==='hard'?19:0)-score-35);
}
export function queueTool(g:Game,tool:Tool,x:number,y:number){
 if(!inBounds(x,y)||x===0||x===W-1||y<SURFACE||g.phase==='ended'||g.phase==='blast')return false;
 const c=cell(g,x,y);if(g.jobs.some(j=>j.x===x&&j.y===y))return false;
 if(tool==='move'){if(!passable(g,x,y))return false;g.jobs.push({id:g.nextJob++,kind:'move',x,y,progress:0,duration:.1});log(g,`Ari irá para ${x}, ${y}.`);return true}
 if(tool==='dig'){
  if(c.material==='empty')return false;
  const duration=c.material==='hard'?13:c.material==='rock'?9:4;
  g.jobs.push({id:g.nextJob++,kind:'dig',x,y,progress:0,duration});log(g,`Escavação marcada em ${x}, ${y}.`);return true;
 }
 if(tool==='repair'){
  if(c.material!=='empty'||c.integrity>=98||!c.structure||!canAfford(g.stock,{parts:1}))return false;
  spend(g.stock,{parts:1});g.jobs.push({id:g.nextJob++,kind:'repair',x,y,progress:0,duration:5,reserved:{parts:1}});log(g,'Reparo solicitado.');return true;
 }
 if(tool==='inspect')return false;
 const structure=tool as Structure;
 if(c.material!=='empty'||c.structure||!canAfford(g.stock,COST[structure]))return false;
 spend(g.stock,COST[structure]);g.jobs.push({id:g.nextJob++,kind:'build',x,y,structure,progress:0,duration:structure==='wall'?7:structure==='support'?5:structure==='door'?6:10,reserved:COST[structure]});log(g,`${structure} na fila. Materiais reservados.`);return true;
}
export function cancelJob(g:Game,id:number){const i=g.jobs.findIndex(j=>j.id===id);if(i<0)return;const j=g.jobs[i];if(j.reserved)spend(g.stock,j.reserved,1);g.jobs.splice(i,1);if(g.worker.jobId===id){g.worker.jobId=null;g.worker.path=[];g.worker.state='idle'}log(g,'Tarefa cancelada; materiais devolvidos.')}
function chooseJob(g:Game){for(const j of g.jobs){const path=workPosition(g,j);if(path.length){g.worker.jobId=j.id;g.worker.path=path.slice(1);g.worker.state='walking';return}}g.worker.jobId=null;g.worker.state='idle'}
function finishJob(g:Game,j:Job){const c=cell(g,j.x,j.y);if(j.kind==='dig'){c.material='empty';c.integrity=100;c.cracks=0;g.stock.stone+=c.ore?2:1;log(g,c.ore?'Veio mineral encontrado: +2 pedra.':'Escavação concluída: +1 pedra.')}else if(j.kind==='repair'){c.integrity=Math.min(100,c.integrity+60);c.cracks=0;log(g,'Estrutura reparada.')}else if(j.kind==='build'){c.structure=j.structure;c.integrity=100;log(g,`${j.structure} instalado.`)}g.jobs.splice(g.jobs.indexOf(j),1);g.worker.jobId=null;g.worker.state='idle'}
export function resolveBlast(g:Game){
 g.phase='blast';g.blastClock=4;log(g,'DETONAÇÃO! A onda de choque atravessa o solo.');
 let breaches=0,collapses=0;for(let y=SURFACE;y<H;y++)for(let x=1;x<W-1;x++){
  const c=cell(g,x,y);if(c.material!=='empty')continue;
  const nearSurface=Math.max(0,1-(y-SURFACE)/12),risk=structuralRisk(g,x,y),protection=c.structure==='wall'?42:c.structure==='support'?32:c.structure==='door'?23:0;
  const wave=Math.max(0,Math.round(nearSurface*56+risk*.62-protection));
  if(wave>0){c.integrity=Math.max(0,c.integrity-wave);c.cracks=Math.min(3,Math.floor((100-c.integrity)/25));}
  if(c.integrity<25&&y>SURFACE+1&&risk>23){c.material='rock';c.structure=undefined;collapses++}
  if(c.structure==='door'&&c.integrity<48)breaches++;
 }
 const w=g.worker,wx=Math.floor(w.x),wy=Math.floor(w.y),underCover=wy>SURFACE+1&&cell(g,wx,wy).material==='empty';
 w.health-=underCover?Math.max(0,Math.round(22+structuralRisk(g,wx,wy)*.3)):110;
 if(breaches)g.oxygen=Math.max(25,g.oxygen-breaches*12);
 log(g,`${collapses} desabamentos; ${breaches} portas rompidas. ${underCover?'Você estava abrigado.':'Você ficou exposto na superfície.'}`);
 if(collapses)g.knowledge.push('impacto');
}
function systems(g:Game,dt:number){
 const structures=(s:Structure)=>g.cells.filter(c=>c.structure===s&&c.integrity>20).length;
 const generators=structures('generator'),vents=structures('vent'),tanks=structures('tank'),pantries=structures('pantry');
 const running=generators>0&&g.stock.fuel>0;
 g.power=running?generators*4:0;g.generated+=g.power*dt;
 if(running)g.stock.fuel=Math.max(0,g.stock.fuel-generators*.018*dt);
 const ventilation=Math.min(vents,g.power);
 g.oxygen=Math.max(0,Math.min(100,g.oxygen+(ventilation*.24-.18)*dt));
 const waterRate=tanks>0?.024:.048,foodRate=pantries>0?.022:.045;
 g.stock.water=Math.max(0,g.stock.water-waterRate*dt);g.stock.food=Math.max(0,g.stock.food-foodRate*dt);
 if(g.oxygen<20||g.stock.water===0||g.stock.food===0)g.worker.health-=1.2*dt;
 if(g.oxygen<35&&Math.floor(g.tick)%20===0)g.knowledge.includes('ar')||g.knowledge.push('ar');
 if(g.worker.health<=0){g.worker.health=0;g.worker.state='dead';g.phase='ended';g.cause=g.oxygen<20?'Asfixia':g.stock.water===0?'Desidratação':g.stock.food===0?'Fome':'Ferimentos';log(g,`Linha temporal encerrada: ${g.cause}.`)}
}
export function update(g:Game,dt:number){
 if(g.speed===0||g.phase==='ended')return;const step=dt*g.speed;g.tick+=step;
 if(g.phase==='blast'){g.blastClock-=step;if(g.blastClock<=0){g.phase='survival';log(g,'O clarão passou. Sobreviva e mantenha o abrigo funcionando.')}return}
 if(g.phase==='prep'){g.hours+=step;if(g.hours>=PREP_HOURS){g.hours=PREP_HOURS;resolveBlast(g)}}else{g.survivalHours+=step;systems(g,step);if(g.survivalHours>=30*24&&g.phase==='survival'){g.phase='ended';g.cause='Trinta dias sobrevividos';log(g,'Você atravessou os primeiros 30 dias.')}}
 const w=g.worker;if(w.state==='dead')return;
 w.energy=Math.max(0,Math.min(100,w.energy+(w.state==='working'?-.035:.016)*step));
 if(w.energy<8){w.state='resting';w.energy=Math.min(100,w.energy+.32*step);if(w.energy<65)return;w.state='idle'}
 if(w.jobId===null||!g.jobs.some(j=>j.id===w.jobId))chooseJob(g);
 const job=g.jobs.find(j=>j.id===w.jobId);if(!job)return;
 if(w.path.length){const n=w.path[0],tx=n%W+.5,ty=Math.floor(n/W)+.5,dx=tx-w.x,dy=ty-w.y,d=Math.hypot(dx,dy),travel=Math.min(d,2.1*step);if(d>.001){w.x+=dx/d*travel;w.y+=dy/d*travel}if(d<.08||travel>=d)w.path.shift();w.state='walking';return}
 w.state='working';job.progress+=step*(.65+w.energy/200);if(job.progress>=job.duration)finishJob(g,job);
}

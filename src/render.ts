import {H,SURFACE,TILE,W,cell,index,type Game,type Tool} from './model';
import {structuralRisk} from './simulation';
import {drawRoom,drawSoil,drawStructure,drawSurface,drawWorker,grain,oval,rect,rr,stroke} from './art';

let cachedSeed=-1;
const soilTiles=new Map<number,{material:string;canvas:HTMLCanvasElement}>();
function paintedSoil(c:CanvasRenderingContext2D,g:Game,x:number,y:number){
 if(cachedSeed!==g.seed){soilTiles.clear();cachedSeed=g.seed}
 const a=cell(g,x,y),key=index(x,y),previous=soilTiles.get(key);let tile=previous;
 if(!tile||tile.material!==a.material){const off=document.createElement('canvas');off.width=off.height=TILE;const brush=off.getContext('2d')!;brush.translate(-x*TILE,-y*TILE);drawSoil(brush,g,x,y,a);tile={material:a.material,canvas:off};soilTiles.set(key,tile)}
 c.drawImage(tile.canvas,x*TILE,y*TILE);
}

function cameraRange(g:Game,width:number,height:number){return {minX:Math.max(0,Math.floor(g.camera.x/TILE)-1),maxX:Math.min(W-1,Math.ceil((g.camera.x+width/g.camera.zoom)/TILE)+1),minY:Math.max(0,Math.floor(g.camera.y/TILE)-1),maxY:Math.min(H-1,Math.ceil((g.camera.y+height/g.camera.zoom)/TILE)+1)}}

export function draw(canvas:HTMLCanvasElement,g:Game,tool:Tool,hover:{x:number;y:number}|null,time:number){
 const c=canvas.getContext('2d')!,dpr=Math.min(devicePixelRatio||1,2),width=canvas.clientWidth,height=canvas.clientHeight;
 if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)}
 c.setTransform(dpr,0,0,dpr,0,0);rect(c,0,0,width,height,'#19252e');
 c.save();c.scale(g.camera.zoom,g.camera.zoom);c.translate(-g.camera.x,-g.camera.y);
 const {minX,maxX,minY,maxY}=cameraRange(g,width,height);
 if(minY<SURFACE)drawSurface(c,g,minX,maxX,time);
 for(let y=Math.max(SURFACE,minY);y<=maxY;y++)for(let x=minX;x<=maxX;x++){
  const a=cell(g,x,y);
  if(a.material==='empty')drawRoom(c,g,x,y,time);else paintedSoil(c,g,x,y);
 }
 // Excavations read as cuts into earth rather than painted grid cells.
 for(let y=Math.max(SURFACE,minY);y<=maxY;y++)for(let x=minX;x<=maxX;x++){
  const a=cell(g,x,y),px=x*TILE,py=y*TILE;if(a.material!=='empty')continue;
  if(y>SURFACE&&cell(g,x,y-1).material!=='empty'){
   rect(c,px,py,44,4,'#161b1e77');
   for(let k=0;k<2;k++){const sx=px+grain(x,y*3+k,g.seed)*TILE;stroke(c,sx,py,sx+2,py+3,'#b09b7766',1)}
  }
  if(x>0&&cell(g,x-1,y).material!=='empty')rect(c,px,py,3,TILE,'#181e2488');
  if(x<W-1&&cell(g,x+1,y).material!=='empty')rect(c,px+TILE-3,py,3,TILE,'#1a1e2488');
  if(a.structure)drawStructure(c,g,a.structure,x,y,time,a);
  if(x===Math.floor(W/2)&&y<=SURFACE+1&&!a.structure){stroke(c,px+14,py,px+14,py+TILE,'#332f2b',4);stroke(c,px+30,py,px+30,py+TILE,'#332f2b',4);stroke(c,px+14,py,px+14,py+TILE,'#c3a579',2);stroke(c,px+30,py,px+30,py+TILE,'#c3a579',2);for(let rung=8;rung<TILE;rung+=10)stroke(c,px+14,py+rung,px+30,py+rung,'#d3b887',2.5)}
  if(a.cracks){stroke(c,px+9,py+2,px+19,py+18,'#1d2427',1.5);stroke(c,px+19,py+18,px+12,py+28,'#1d2427',1.1)}
  if(g.selected===index(x,y)){c.strokeStyle='#f9d78f';c.lineWidth=2;c.setLineDash([5,3]);c.strokeRect(px+2,py+2,TILE-4,TILE-4);c.setLineDash([])}
 }
 for(const j of g.jobs){if(j.x<minX||j.x>maxX||j.y<minY||j.y>maxY)continue;const px=j.x*TILE,py=j.y*TILE;
  c.strokeStyle=j.kind==='dig'?'#ffd18b':'#91e1cb';c.lineWidth=2;c.setLineDash([5,3]);c.strokeRect(px+3,py+3,TILE-6,TILE-6);c.setLineDash([]);
  if(j.kind==='dig'){for(let k=0;k<3;k++)stroke(c,px+8+k*10,py+7,px+16+k*10,py+15,'#f3b78180',1)}
  rr(c,px+5,py+TILE-8,TILE-10,5,2,'#18262ccc');rect(c,px+6,py+TILE-7,(TILE-12)*Math.min(1,j.progress/j.duration),3,'#f5ca82');
 }
 if(hover&&hover.x>=minX&&hover.x<=maxX&&hover.y>=minY&&hover.y<=maxY){const x=hover.x,y=hover.y,a=cell(g,x,y),px=x*TILE,py=y*TILE,valid=tool==='dig'?a.material!=='empty':tool==='repair'?!!a.structure&&a.integrity<98:tool==='inspect'||tool==='move'?a.material==='empty':a.material==='empty'&&!a.structure;
  rect(c,px+2,py+2,TILE-4,TILE-4,valid?'#d8e2ad22':'#e96a682f');c.strokeStyle=valid?'#f4d58e':'#e5766d';c.lineWidth=2;c.strokeRect(px+2,py+2,TILE-4,TILE-4)}
 drawWorker(c,g,time);
 if(g.phase==='blast'){for(let i=0;i<22;i++){const x=(grain(i,2,g.seed)*W*TILE+time*(i%3+1)*16)%(W*TILE),y=SURFACE*TILE+grain(i,6,g.seed)*210;oval(c,x,y,1.5+grain(i,1,g.seed)*2,1,'#eac7a566')}}
 c.restore();
 const vignette=c.createRadialGradient(width/2,height/2,height*.24,width/2,height/2,Math.max(width,height)*.76);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#08101845');rect(c,0,0,width,height,vignette as unknown as string);
 if(g.phase==='blast')rect(c,0,0,width,height,`rgba(255,222,172,${Math.min(.48,g.blastClock/8)})`);
}

export function drawMini(canvas:HTMLCanvasElement,g:Game){const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height;rect(c,0,0,w,h,'#1b2630');const sx=w/W,sy=h/H;for(let y=SURFACE;y<H;y++)for(let x=0;x<W;x++){const a=g.cells[index(x,y)];rect(c,x*sx,y*sy,Math.ceil(sx),Math.ceil(sy),a.material==='empty'?'#485552':a.material==='rock'?'#656366':a.material==='hard'?'#514b51':'#614334');if(a.structure)rect(c,x*sx,y*sy,Math.max(2,sx),Math.max(2,sy),a.structure==='generator'?'#dfa66a':a.structure==='vent'?'#88c5ad':'#bcab87')}rect(c,0,(SURFACE-.25)*sy,w,2,'#b39067');rect(c,g.worker.x*sx-2,g.worker.y*sy-2,4,4,'#f6d28f');c.strokeStyle='#f7e3b2';c.lineWidth=1.5;c.strokeRect(g.camera.x/TILE*sx,g.camera.y/TILE*sy,canvas.clientWidth/g.camera.zoom/TILE*sx,canvas.clientHeight/g.camera.zoom/TILE*sy)}
export function selectedDescription(g:Game){if(g.selected===null)return 'Selecione uma célula para examinar a estrutura e suas condições.';const x=g.selected%W,y=Math.floor(g.selected/W),a=g.cells[g.selected],risk=structuralRisk(g,x,y);return `${x}, ${y} · ${a.structure||a.material} · integridade ${Math.round(a.integrity)}%${risk>20?' · teto vulnerável':''}`}

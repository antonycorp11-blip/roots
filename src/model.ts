export const TILE=44, W=64, H=32, SURFACE=6, PREP_HOURS=168, SAVE_KEY='bunker-loop-v1';
export type Tool='inspect'|'move'|'dig'|'wall'|'support'|'door'|'generator'|'vent'|'tank'|'pantry'|'repair';
export type Material='soil'|'rock'|'hard'|'empty';
export type Structure='wall'|'support'|'door'|'generator'|'vent'|'tank'|'pantry';
export interface Cell {material:Material; structure?:Structure; integrity:number; ore:number; cracks:number; work:number}
export interface Job {id:number;kind:'dig'|'build'|'repair'|'move';x:number;y:number;structure?:Structure;progress:number;duration:number;reserved?:Partial<Stock>}
export interface Stock {wood:number;stone:number;concrete:number;steel:number;parts:number;fuel:number;food:number;water:number}
export interface Worker {x:number;y:number;tx:number;ty:number;path:number[];energy:number;health:number;hunger:number;thirst:number;jobId:number|null;step:number;state:'idle'|'walking'|'working'|'resting'|'dead'}
export interface Game {version:1;seed:number;cycle:number;cells:Cell[];jobs:Job[];nextJob:number;stock:Stock;worker:Worker;hours:number;speed:number;phase:'prep'|'blast'|'survival'|'ended';blastClock:number;survivalHours:number;oxygen:number;power:number;generated:number;log:string[];knowledge:string[];cause:string;camera:{x:number;y:number;zoom:number};selected:number|null;tick:number}
export const COST:Record<Structure,Partial<Stock>>={wall:{concrete:2,stone:1},support:{wood:3,steel:1},door:{steel:3,parts:1},generator:{steel:5,parts:4,fuel:5},vent:{steel:2,parts:3},tank:{steel:3,parts:2},pantry:{wood:3,parts:1,food:8}};
export const LABEL:Record<Structure,string>={wall:'Parede de concreto',support:'Viga de suporte',door:'Porta de vedação',generator:'Gerador',vent:'Ventilador',tank:'Reservatório',pantry:'Despensa'};
export function rng(seed:number){let s=seed|0;return ()=>{s=(Math.imul(s,1664525)+1013904223)|0;return (s>>>0)/4294967296}}
export function index(x:number,y:number){return y*W+x}
export function inBounds(x:number,y:number){return x>=0&&x<W&&y>=0&&y<H}
export function cell(g:Game,x:number,y:number){return g.cells[index(x,y)]}
export function log(g:Game,msg:string){g.log.unshift(msg);g.log.length=Math.min(g.log.length,24)}
export function createGame(seed=Math.floor(Math.random()*1e9),cycle=1,knowledge:string[]=[]):Game{
 const random=rng(seed);const cells:Cell[]=[];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  let material:Material=y<SURFACE?'empty':random()<Math.min(.13,(y-SURFACE)*.008)?'rock':'soil';
  if(y>12&&random()<.10)material='hard';
  if(y>13&&random()<.018)material='empty';
  cells.push({material,integrity:100,ore:random()<.13?1:0,cracks:0,work:0});
 }
 const cx=Math.floor(W/2);for(let y=SURFACE;y<=SURFACE+1;y++)for(let x=cx-2;x<=cx+2;x++)cell({cells} as Game,x,y).material='empty';
 for(let x=cx-2;x<=cx+2;x++)cell({cells} as Game,x,SURFACE+1).material='empty';
 cell({cells} as Game,cx+2,SURFACE+1).structure='door';
 const g:Game={version:1,seed,cycle,cells,jobs:[],nextJob:1,stock:{wood:42,stone:24,concrete:32,steel:26,parts:24,fuel:30,food:28,water:24},worker:{x:cx+.5,y:SURFACE-.6,tx:cx+.5,ty:SURFACE-.6,path:[],energy:100,health:100,hunger:0,thirst:0,jobId:null,step:0,state:'idle'},hours:0,speed:1,phase:'prep',blastClock:0,survivalHours:0,oxygen:100,power:0,generated:0,log:[],knowledge,cause:'',camera:{x:cx*TILE-450,y:2*TILE,zoom:1.22},selected:null,tick:0};
 log(g,'O relógio voltou. Restam 7 dias até a detonação.');return g;
}
export function canAfford(s:Stock,c:Partial<Stock>){return (Object.keys(c) as (keyof Stock)[]).every(k=>s[k]>=(c[k]||0))}
export function spend(s:Stock,c:Partial<Stock>,sign= -1){for(const k of Object.keys(c) as (keyof Stock)[])s[k]+=sign*(c[k]||0)}

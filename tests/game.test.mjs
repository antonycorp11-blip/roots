import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['tests/fixture.ts'],bundle:true,platform:'node',format:'esm',write:false});
const game=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const {createGame,cell,queueTool,update,resolveBlast,cancelJob,pathTo,structuralRisk,W,SURFACE}=game;

test('same seed reproduces geological cells',()=>{
 const a=createGame(487),b=createGame(487),c=createGame(488);
 assert.deepEqual(a.cells,b.cells);assert.notDeepEqual(a.cells,c.cells);
});
test('construction reserves resources and cancellation refunds them',()=>{
 const g=createGame(3),x=Math.floor(W/2)+1,y=SURFACE+1;
 const before=g.stock.wood;
 assert.equal(queueTool(g,'support',x,y),true);
 assert.equal(g.stock.wood,before-3);
 cancelJob(g,g.jobs[0].id);
 assert.equal(g.stock.wood,before);
 assert.equal(g.jobs.length,0);
});
test('excavation takes time and changes ground',()=>{
 const g=createGame(9),x=Math.floor(W/2),y=SURFACE+2;
 assert.notEqual(cell(g,x,y).material,'empty');
 assert.equal(queueTool(g,'dig',x,y),true);
 update(g,.1);assert.notEqual(cell(g,x,y).material,'empty');
 for(let i=0;i<1000&&g.jobs.length;i++)update(g,1/30);
 assert.equal(cell(g,x,y).material,'empty');
});
test('path cannot traverse solid soil',()=>{
 const g=createGame(9),x=Math.floor(W/2);
 assert.deepEqual(pathTo(g,x,SURFACE-1,x,SURFACE+2),[]);
});
test('supports reduce structural risk and blast damage',()=>{
 const x=Math.floor(W/2),y=SURFACE+1;
 const bare=createGame(5),reinforced=createGame(5);
 cell(reinforced,x-1,y).structure='support';cell(reinforced,x+1,y).structure='support';
 assert.ok(structuralRisk(reinforced,x,y)<structuralRisk(bare,x,y));
 resolveBlast(bare);resolveBlast(reinforced);
 assert.ok(cell(reinforced,x,y).integrity>=cell(bare,x,y).integrity);
});
test('post-blast ventilation depends on both generator and fuel',()=>{
 const x=Math.floor(W/2),y=SURFACE+1;
 const g=createGame(13);cell(g,x,y).structure='generator';cell(g,x+1,y).structure='vent';
 g.phase='survival';const initial=g.oxygen;
 for(let i=0;i<100;i++)update(g,1);
 assert.ok(g.oxygen>=initial-.01);assert.ok(g.stock.fuel<30);
 g.stock.fuel=0;for(let i=0;i<100;i++)update(g,1);
 assert.ok(g.oxygen<initial);
});
test('survival requires systems rather than only waiting',()=>{
 const x=Math.floor(W/2),y=SURFACE+1;
 const safe=createGame(21),empty=createGame(21);
 for(const [i,s] of ['generator','vent','tank','pantry'].entries())cell(safe,x-2+i,y).structure=s;
 safe.phase='survival';empty.phase='survival';
 for(let i=0;i<720&&safe.phase!=='ended';i++)update(safe,1);
 for(let i=0;i<720&&empty.phase!=='ended';i++)update(empty,1);
 assert.equal(safe.cause,'Trinta dias sobrevividos');
 assert.notEqual(empty.cause,'Trinta dias sobrevividos');
});

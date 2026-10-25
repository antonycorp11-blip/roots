import type { Faction } from './model';

// Original pixel silhouettes. Each character is a palette index, not an external asset.
const silhouettes: Record<string, string[]> = {
  warrior: [
    '             yy         ',
    '            yyy         ',
    '          oohhoo        ',
    '         ohhhhhoo     w  ',
    '         ohllhhoo    ww  ',
    '         ohttttoo    ws  ',
    '          tktkto    wss  ',
    '          ottto     ws   ',
    '       oooggggoo    ws   ',
    '      ohhggllggho   ws   ',
    '     ohhggggggghho yy   ',
    '    oyyyyoggggohttyy    ',
    '    oyhhyoggggoott      ',
    '    oyhlyogyygo oo      ',
    '    oyhhyoggggo         ',
    '     oyyogggggo         ',
    '      ooogggggo         ',
    '        oobboo          ',
    '        obbboo          ',
    '       obbo obbo        ',
    '       ooo  oooo        ',
  ],
  archer: [
    '         yy             ',
    '        ygggo           ',
    '       ogllggo          ',
    '      ogllllggo         ',
    '      oggtttggo     y   ',
    '      ogtktktgo     yy  ',
    '       ogtttgo     y sy ',
    '     w  ogggo      y sy ',
    '    ww oaggggo     y  sy',
    '    w ooglggggo    y  sy',
    '    aaogglggggoottty wsy',
    '    aaoggggggggottwywwsy',
    '     aogggyyggo    y  sy',
    '      ogggggggo    y sy ',
    '      ogggggggo    y sy ',
    '      oggggggggo    yy  ',
    '       ooggggoo     y   ',
    '        obbbbo          ',
    '       obboobbo         ',
    '       ooo oooo         ',
  ],
  scout: [
    '       y     y          ',
    '       yy   yy          ',
    '       ogggggo          ',
    '      ogllggggo         ',
    '      ogttttggo         ',
    '      ogtkktggo         ',
    '       ogggggo          ',
    '     ooggllggoo         ',
    '    oggggggggggo        ',
    '   oggoggggggoggo       ',
    '  ottogggggggootto      ',
    '  ow ogggyyggo wo       ',
    '  ww ogggggggo ww       ',
    ' ww ogggggggggo ww      ',
    ' w  ogggggggggo  w      ',
    '     ogggoooggo         ',
    '      obbo obbo         ',
    '      obbo obbo         ',
    '     oooo   oooo        ',
  ],
  guardian: [
    '   a     a    a         ',
    '   aa   aa   aa         ',
    '    aaoaaa ooa          ',
    '     aalllaaa           ',
    '   oollgggllloo         ',
    '  ollggggggglllo        ',
    ' ollggllggggglllo       ',
    '  oaaakaaakaaao         ',
    '   oaaaawaaaao          ',
    ' oohaaaaaaaaahoo        ',
    'ohhhaaayyaaahhhho       ',
    'ohhaaaywyaaahhaaho      ',
    'oaaoaaayaaaao oaao      ',
    'oaaoaayaaaaao oaao      ',
    'oaaoaaaaayaao oaao      ',
    ' oooaaayaaaao ooo       ',
    '   oaayaaaaao           ',
    '   oaaoooaaao           ',
    '   oaao  oaao           ',
    '  oaaao  oaaao          ',
    ' ooaooo  oooaoo         ',
  ],
  ballista: [
    '           w            ',
    '          www           ',
    '          awa           ',
    '     oo   awa   oo      ',
    '   oayyaooawaooayyo     ',
    '  oayyyyaaaaayyyyao     ',
    ' oaaaooaaaaaaaooaaao    ',
    ' oaao  s awa s  oaao    ',
    '  oo    ssass    oo     ',
    '         aaa            ',
    '      ooaaaaaoo         ',
    '     oahaaaaahao        ',
    '    oohhaayaahhoo       ',
    '    oboaaaaaaaobo       ',
    '   obboaaaaaaao bbo     ',
    '   obyoaaaaaaao ybo     ',
    '   obbooooooooobbo      ',
    '    oo         oo       ',
  ],
};
const cache = new Map<string, HTMLCanvasElement>();
const palettes = {
  nature: {o:'#102a28',g:'#32715d',l:'#89b867',h:'#608b7b',t:'#f3c28c',k:'#17232e',y:'#e2ce83',w:'#f1f5d6',s:'#92b9b4',a:'#88654c',b:'#3b3e39'},
  corruption: {o:'#201c36',g:'#794a89',l:'#c479ac',h:'#777293',t:'#bba3d4',k:'#f3a6e4',y:'#ed9bd8',w:'#f2d8ff',s:'#b69ad0',a:'#604e72',b:'#332c46'},
};

export function sprite(kind: string, faction: Faction = 'nature'): HTMLCanvasElement {
  const key = kind + faction;
  if (cache.has(key)) return cache.get(key)!;
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const ctx = c.getContext('2d')!;
  const palette = palettes[faction] as Record<string,string>;
  const rows = silhouettes[kind];
  if (rows) {
    rows.forEach((row,y) => [...row].forEach((v,x) => { if (palette[v]) { ctx.fillStyle = palette[v]; ctx.fillRect(x+3,y+5,1,1); } }));
  } else {
    // Stepped stone, timber and foliage for structures.
    ctx.fillStyle = palette.o; ctx.fillRect(5,24,23,4);
    if(kind==='core') {
      // Ancient living heart: exposed roots, layered crown and luminous seed.
      ctx.fillStyle=palette.o;ctx.fillRect(2,23,28,6);ctx.fillRect(5,5,23,17);
      ctx.fillStyle=palette.a;ctx.fillRect(12,13,9,14);ctx.fillRect(7,23,19,4);ctx.fillRect(3,26,8,3);ctx.fillRect(24,25,6,3);
      ctx.fillStyle=palette.h;ctx.fillRect(13,15,2,10);ctx.fillRect(18,18,2,8);
      ctx.fillStyle=palette.g;ctx.fillRect(3,9,27,8);ctx.fillRect(6,5,21,13);ctx.fillRect(10,2,14,17);
      ctx.fillStyle=palette.l;ctx.fillRect(7,6,8,3);ctx.fillRect(11,3,9,3);ctx.fillRect(23,10,5,3);
      ctx.fillStyle=palette.o;ctx.fillRect(12,9,10,12);ctx.fillRect(10,12,14,6);
      ctx.fillStyle=palette.y;ctx.fillRect(14,10,6,10);ctx.fillRect(12,13,10,4);
      ctx.fillStyle=palette.w;ctx.fillRect(15,11,3,6);ctx.fillRect(14,13,5,2);
    } else if (kind === 'tower') {
      ctx.fillStyle=palette.a; ctx.fillRect(10,12,12,14);ctx.fillRect(8,20,16,6);
      ctx.fillStyle=palette.h; ctx.fillRect(10,13,3,12);ctx.fillRect(14,18,8,2);
      ctx.fillStyle=palette.g;ctx.fillRect(6,7,22,8);ctx.fillRect(9,4,16,5);
      ctx.fillStyle=palette.l;ctx.fillRect(9,5,10,3);
      ctx.fillStyle=palette.y;ctx.fillRect(14,5,5,8);ctx.fillStyle=palette.w;ctx.fillRect(15,5,2,5);
    } else if(kind === 'grove' || kind === 'tree') {
      ctx.fillStyle=palette.a;ctx.fillRect(14,14,4,13);
      ctx.fillStyle=palette.o;ctx.fillRect(4,10,24,11);ctx.fillRect(8,3,17,19);
      ctx.fillStyle=palette.g;ctx.fillRect(5,9,22,11);ctx.fillRect(9,4,15,15);
      ctx.fillStyle=palette.h;ctx.fillRect(8,7,16,8);ctx.fillRect(7,11,5,5);
      ctx.fillStyle=palette.l;ctx.fillRect(10,5,10,3);ctx.fillRect(8,10,5,3);ctx.fillRect(17,9,5,2);
      ctx.fillStyle=palette.y;ctx.fillRect(15,12,2,3);
    } else {
      ctx.fillStyle=palette.o;ctx.fillRect(2,16,29,11);
      ctx.fillStyle=palette.a;ctx.fillRect(4,17,25,7);
      ctx.fillStyle=palette.h;ctx.fillRect(4,18,25,2);ctx.fillRect(5,23,23,1);
      for(let i=6;i<29;i+=7){ctx.fillRect(i,10,3,16);ctx.fillStyle=palette.l;ctx.fillRect(i-1,9,5,3);ctx.fillStyle=palette.a;}
    }
  }
  cache.set(key,c); return c;
}

const textures = new Map<string,HTMLCanvasElement>();
export function terrain(variant: number, state: number): HTMLCanvasElement {
  const key = `${variant}:${state}`;
  if(textures.has(key)) return textures.get(key)!;
  const c=document.createElement('canvas'); c.width=44;c.height=44;
  const ctx=c.getContext('2d')!;
  const colors = state > 0 ? ['#294b43','#31584a','#416550','#64845a','#9baf6e'] : state < 0 ? ['#302d44','#39334d','#4a3c5a','#665071','#99718b'] : ['#555447','#5a594b','#656151','#77715b','#969177'];
  ctx.fillStyle=colors[0];ctx.fillRect(0,0,44,44);
  let seed = variant*1543+6721;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<24;i++) {const x=Math.floor(rand()*44),y=Math.floor(rand()*44);ctx.fillStyle=colors[i%3];ctx.fillRect(x,y,1+Math.floor(rand()*6),1+Math.floor(rand()*2));}
  for(let i=0;i<4;i++){const x=Math.floor(rand()*38),y=Math.floor(rand()*38);ctx.fillStyle=colors[2];ctx.fillRect(x,y,4,3);ctx.fillStyle=colors[3];ctx.fillRect(x,y,3,1);}
  if(state>0)for(let i=0;i<2;i++){const x=Math.floor(rand()*40),y=Math.floor(rand()*40);ctx.fillStyle=colors[3];ctx.fillRect(x,y,1,3);ctx.fillRect(x+2,y+1,1,2);if(variant%5===0){ctx.fillStyle='#d8c997';ctx.fillRect(x,y,1,1);}}
  textures.set(key,c);return c;
}

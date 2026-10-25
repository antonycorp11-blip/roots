import { BUILDING_DEFS, UNIT_DEFS, buildingKinds, unitKinds } from './defs';
import { CFG, COLORS, WORLD_H, WORLD_W } from './config';
import { sprite, terrain } from './pixelArt';
import type {
  Building, BuildingKind, BuildSlot, Economy, Faction, OrderType, Owner, Particle,
  Phase, Projectile, Reinforcement, Tile, Unit, UnitKind, Vec,
} from './model';

type CardSelection = { type: 'unit'; kind: UnitKind } | { type: 'building'; kind: BuildingKind } | null;
type PointerInfo = { x: number; y: number; startX: number; startY: number; lastX: number; lastY: number; type: string; button: number };

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Elemento ausente: ${selector}`);
  return element;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const dist2 = (a: Vec, b: Vec) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const seeded = (n: number) => {
  const x = Math.sin(n * 91.733 + 14.17) * 43758.5453;
  return x - Math.floor(x);
};
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private minimap: HTMLCanvasElement;
  private miniCtx: CanvasRenderingContext2D;
  private miniBase = document.createElement('canvas');
  private miniBaseCtx: CanvasRenderingContext2D;
  private lastMinimapUpdate = 0;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private phase: Phase = 'prep';
  private tiles: Tile[] = [];
  private units: Unit[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private buildings: Building[] = [];
  private slots: BuildSlot[] = [];
  private queues: Reinforcement[] = [];
  private reinforcementCooldowns: Record<Faction, Record<UnitKind, number>> = {
    nature: { warrior: 0, archer: 0, scout: 0, guardian: 0, ballista: 0 },
    corruption: { warrior: 0, archer: 0, scout: 0, guardian: 0, ballista: 0 },
  };
  private economy: Record<Faction, Economy> = {
    nature: { coins: CFG.startingCoins, generated: 0, income: 0, tiles: 0 },
    corruption: { coins: CFG.startingCoins, generated: 0, income: 0, tiles: 0 },
  };
  private camera = { x: 0, y: 0, zoom: 1 };
  private nextId = 1;
  private prepRemaining = CFG.prepPoints;
  private selectedCard: CardSelection = null;
  private activeOrder: OrderType = 'advance';
  private pointers = new Map<number, PointerInfo>();
  private isPanning = false;
  private didDrag = false;
  private dragSelectStart: Vec | null = null;
  private dragSelectCurrent: Vec | null = null;
  private dragPrepUnit: Unit | null = null;
  private pinchDistance = 0;
  private spaceDown = false;
  private hoverWorld: Vec = { x: 0, y: 0 };
  private hoveredSlot: BuildSlot | null = null;
  private battleTime = 0;
  private captureClock = 0;
  private aiClock = 0;
  private hudClock = 0;
  private natureDominance = 0;
  private corruptionDominance = 0;
  private lastFrame = 0;
  private accumulator = 0;
  private toastTimer = 0;
  private playerKills = 0;
  private enemyKills = 0;
  private sound = true;
  private audio: AudioContext | null = null;
  private running = false;
  private shake = 0;
  private fps = 60;

  private coinsEl = $<HTMLElement>('#coins');
  private incomeEl = $<HTMLElement>('#income');
  private territoryEl = $<HTMLElement>('#territory');
  private timerEl = $<HTMLElement>('#timer');
  private prepPanel = $<HTMLElement>('#prepPanel');
  private prepPointsEl = $<HTMLElement>('#prepPoints');
  private cardsEl = $<HTMLElement>('#cards');
  private selectionEl = $<HTMLElement>('#selectionInfo');
  private resultEl = $<HTMLElement>('#result');

  constructor(canvas: HTMLCanvasElement, minimap: HTMLCanvasElement) {
    this.canvas = canvas;
    this.minimap = minimap;
    const ctx = canvas.getContext('2d', { alpha: false });
    const miniCtx = minimap.getContext('2d');
    this.miniBase.width = minimap.width;
    this.miniBase.height = minimap.height;
    const miniBaseCtx = this.miniBase.getContext('2d');
    if (!ctx || !miniCtx || !miniBaseCtx) throw new Error('Canvas 2D indisponível');
    this.ctx = ctx;
    this.miniCtx = miniCtx;
    this.miniBaseCtx = miniBaseCtx;
    this.bindEvents();
    this.reset();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame(this.frame);
  }

  private reset() {
    this.phase = 'prep';
    this.tiles = [];
    this.units = [];
    this.projectiles = [];
    this.particles = [];
    this.buildings = [];
    this.slots = [];
    this.queues = [];
    this.reinforcementCooldowns = {
      nature: { warrior: 0, archer: 0, scout: 0, guardian: 0, ballista: 0 },
      corruption: { warrior: 0, archer: 0, scout: 0, guardian: 0, ballista: 0 },
    };
    this.nextId = 1;
    this.lastMinimapUpdate = 0;
    this.prepRemaining = CFG.prepPoints;
    this.selectedCard = null;
    this.activeOrder = 'advance';
    this.battleTime = 0;
    this.natureDominance = 0;
    this.corruptionDominance = 0;
    this.playerKills = 0;
    this.enemyKills = 0;
    this.captureClock=0;this.aiClock=0;this.hudClock=0;this.accumulator=0;
    this.toastTimer=0;$<HTMLElement>('#toast').classList.remove('show');
    this.economy = {
      nature: { coins: CFG.startingCoins, generated: 0, income: 0, tiles: 0 },
      corruption: { coins: CFG.startingCoins, generated: 0, income: 0, tiles: 0 },
    };

    for (let row = 0; row < CFG.rows; row++) {
      for (let col = 0; col < CFG.cols; col++) {
        const owner: Owner = row < CFG.initialRows ? 'corruption' : row >= CFG.rows - CFG.initialRows ? 'nature' : 'neutral';
        this.tiles.push({ col, row, owner, targetOwner: owner as Faction | 'neutral', visual: owner === 'nature' ? 1 : owner === 'corruption' ? -1 : 0, capture: 0, seed: seeded(row * 73 + col * 11), dirty: true });
      }
    }

    for (let row = 12; row < CFG.rows - 12; row += 8) {
      this.slots.push({ id: this.nextId++, x: CFG.tile * 1.65, y: (row + .5) * CFG.tile, occupied: null });
      this.slots.push({ id: this.nextId++, x: WORLD_W - CFG.tile * 1.65, y: (row + .5) * CFG.tile, occupied: null });
    }

    this.buildings.push(this.createCore('corruption'), this.createCore('nature'));
    this.prepareEnemyDefenses();
    this.recountTerritory();
    this.resize();
    const fitWidth = this.minimumZoom();
    this.camera.zoom = clamp(Math.max(.96, fitWidth * 1.42), fitWidth, CFG.maxZoom);
    this.camera.x = WORLD_W / 2 - this.width / this.camera.zoom / 2;
    this.camera.y = WORLD_H / 2 - this.height / this.camera.zoom * .35;
    this.clampCamera();
    this.prepPanel.classList.remove('hidden');
    this.resultEl.classList.add('hidden');
    this.selectionEl.classList.add('hidden');
    this.renderCards();
    this.updateHud();
  }

  private createCore(faction: Faction): Building {
    return {
      id: this.nextId++, faction, kind: 'core',
      x: WORLD_W / 2, y: faction === 'nature' ? WORLD_H - CFG.tile * 2 : CFG.tile * 2,
      hp: CFG.coreHp, maxHp: CFG.coreHp, build: 1, cooldown: 0, slotId: -1, hitFlash: 0,
    };
  }

  private deployStarterArmy(faction: Faction) {
    const rowY = WORLD_H - CFG.tile * (CFG.initialRows - 2);
    const starters: UnitKind[] = ['warrior', 'warrior', 'archer', 'scout', 'guardian'];
    starters.forEach((kind, i) => {
      const unit = this.createUnit(faction, kind, WORLD_W / 2 + (i - 2) * 58, rowY + Math.abs(i - 2) * 25);
      while(this.buildings.some(b=>dist2(b,unit)<65**2) && unit.y<WORLD_H-150) unit.y+=44;
      this.units.push(unit);
    });
  }

  private prepareEnemyDefenses() {
    let budget: number = CFG.prepPoints;
    const layout: {kind: BuildingKind; dx: number; row: number}[] = [
      {kind:'tower',dx:-3,row:20},{kind:'tower',dx:3,row:20},
      {kind:'barrier',dx:-1,row:21},{kind:'barrier',dx:0,row:21},{kind:'barrier',dx:1,row:21},
      {kind:'grove',dx:0,row:18},{kind:'tower',dx:0,row:6},{kind:'barrier',dx:2,row:5},
    ];
    for(const item of layout) {
      const def=BUILDING_DEFS[item.kind]; if(budget<def.cost) continue;
      budget-=def.cost;
      this.buildings.push({id:this.nextId++,faction:'corruption',kind:item.kind,x:(CFG.cols/2+item.dx+.5)*CFG.tile,y:(item.row+.5)*CFG.tile,hp:def.hp,maxHp:def.hp,build:1,cooldown:0,slotId:-1,hitFlash:0});
    }
  }

  private deployEnemyArmy() {
    const composition: UnitKind[] = ['warrior', 'warrior', 'archer', 'scout', 'guardian'];
    composition.forEach((kind, i) => {
      const lane = (i % 3 - 1) * 100 + (seeded(i + 99) - .5) * 45;
      const unit = this.createUnit('corruption', kind, WORLD_W / 2 + lane, CFG.tile * (CFG.initialRows - 2 - Math.floor(i / 3) * 1.25));
      unit.pathAngle = seeded(i * 31) * .5 - .25;
      this.units.push(unit);
    });
  }

  private createUnit(faction: Faction, kind: UnitKind, x: number, y: number): Unit {
    const def = UNIT_DEFS[faction][kind];
    const direction = faction === 'nature' ? -1 : 1;
    return {
      id: this.nextId++, faction, kind, x, y, hp: def.hp, maxHp: def.hp, targetId: null,
      cooldown: seeded(this.nextId) * .5, selected: false, order: 'advance',
      orderTarget: { x, y: clamp(y + direction * CFG.tile * 16, 50, WORLD_H - 50) },
      decisionTimer: seeded(this.nextId) * .35, pathAngle: faction === 'nature' ? -Math.PI / 2 : Math.PI / 2, anim: seeded(this.nextId) * 10,
      hitFlash: 0, dead: 0, kills: 0,
    };
  }

  private bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', event => { if (event.code === 'Space') this.spaceDown = false; });

    this.minimap.addEventListener('pointerdown', event => {
      event.preventDefault();
      this.navigateMinimap(event);
      this.minimap.setPointerCapture(event.pointerId);
    });
    this.minimap.addEventListener('pointermove', event => { if (event.buttons) this.navigateMinimap(event); });

    $<HTMLButtonElement>('#startBattle').addEventListener('click', () => this.beginBattle());
    $<HTMLButtonElement>('#enemyCore').addEventListener('click', () => {
      this.camera.x=WORLD_W/2-this.width/this.camera.zoom/2;
      this.camera.y=0; this.clampCamera();
    });
    $<HTMLButtonElement>('#restart').addEventListener('click', () => this.reset());
    $<HTMLButtonElement>('#centerBattle').addEventListener('click', () => this.centerBattle());
    $<HTMLButtonElement>('#zoomOut').addEventListener('click', () => this.zoomAt(this.width / 2, this.height / 2, .82));
    $<HTMLButtonElement>('#zoomIn').addEventListener('click', () => this.zoomAt(this.width / 2, this.height / 2, 1.22));
    $<HTMLButtonElement>('#soundToggle').addEventListener('click', event => {
      this.sound = !this.sound;
      (event.currentTarget as HTMLButtonElement).textContent = this.sound ? '♪' : '×';
      this.beep(330, .05);
    });
    document.querySelectorAll<HTMLButtonElement>('#orders button').forEach(button => {
      button.addEventListener('click', () => this.setOrder(button.dataset.order as OrderType));
    });
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.width * this.dpr);
    const h = Math.round(this.height * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.camera.zoom = Math.max(this.camera.zoom, this.minimumZoom());
    this.clampCamera();
  }

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.zoomAt(event.clientX - rect.left, event.clientY - rect.top, Math.exp(-event.deltaY * .0012));
  };

  private onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.pointers.set(event.pointerId, { x, y, startX: x, startY: y, lastX: x, lastY: y, type: event.pointerType, button: event.button });
    this.didDrag = false;

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      this.isPanning = true;
      this.dragSelectStart = null;
      return;
    }

    const world = this.screenToWorld(x, y);
    const hit = this.findUnitAt(world, this.phase === 'prep' ? 'nature' : undefined);
    if (this.phase === 'prep' && hit?.faction === 'nature') this.dragPrepUnit = hit;

    const wantsPan = event.button === 2 || this.spaceDown || event.pointerType === 'touch';
    if (wantsPan) {
      this.isPanning = !this.dragPrepUnit;
    } else if (event.button === 0 && this.phase === 'battle' && !this.selectedCard) {
      this.dragSelectStart = world;
      this.dragSelectCurrent = world;
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId);
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.hoverWorld = this.screenToWorld(x, y);
    this.hoveredSlot = this.findSlotAt(this.hoverWorld);
    if (!pointer) return;
    pointer.x = x;
    pointer.y = y;
    const moved = Math.hypot(x - pointer.startX, y - pointer.startY);
    if (moved > (event.pointerType === 'touch' ? 9 : 4)) this.didDrag = true;

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      if (this.pinchDistance > 0) this.zoomAt(midX, midY, distance / this.pinchDistance);
      this.pinchDistance = distance;
      const dx = ((a.x - a.lastX) + (b.x - b.lastX)) / 2;
      const dy = ((a.y - a.lastY) + (b.y - b.lastY)) / 2;
      this.panCamera(dx, dy);
    } else if (this.isPanning && this.didDrag) {
      this.panCamera(x - pointer.lastX, y - pointer.lastY);
    } else if (this.dragSelectStart) {
      this.dragSelectCurrent = this.screenToWorld(x, y);
    }
    pointer.lastX = x;
    pointer.lastY = y;
  };

  private onPointerUp = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    this.pointers.delete(event.pointerId);
    if (!this.didDrag && this.pointers.size === 0) {
      const world = this.screenToWorld(pointer.x, pointer.y);
      this.handleTap(world, event.shiftKey);
    } else if (this.phase === 'prep' && this.dragPrepUnit && this.validDeploy(this.hoverWorld, 'nature')) {
      this.dragPrepUnit.x = this.hoverWorld.x;
      this.dragPrepUnit.y = this.hoverWorld.y;
    } else if (this.dragSelectStart && this.dragSelectCurrent && !this.selectedCard) {
      this.selectRect(this.dragSelectStart, this.dragSelectCurrent, event.shiftKey);
    }
    this.isPanning = false;
    this.dragSelectStart = null;
    this.dragSelectCurrent = null;
    this.dragPrepUnit = null;
    if (this.pointers.size < 2) this.pinchDistance = 0;
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Space') { event.preventDefault(); this.spaceDown = true; }
    const orders: Record<string, OrderType> = { KeyQ: 'advance', KeyW: 'attack', KeyE: 'defend', KeyR: 'hold', KeyT: 'return' };
    if (orders[event.code]) this.setOrder(orders[event.code]);
    if (event.code === 'Escape') { this.selectedCard = null; this.renderCards(); }
    if (event.code === 'KeyF') this.centerBattle();
    if (event.code === 'Equal' || event.code === 'NumpadAdd') this.zoomAt(this.width / 2, this.height / 2, 1.18);
    if (event.code === 'Minus' || event.code === 'NumpadSubtract') this.zoomAt(this.width / 2, this.height / 2, .84);
  };

  private handleTap(world: Vec, additive = false) {
    if (this.phase === 'ended') return;
    if (this.phase === 'prep') {
      const placed=this.buildings.find(b=>b.faction==='nature' && b.kind!=='core' && dist2(b,world)<28**2);
      if(placed && placed.kind!=='core') {
        this.prepRemaining+=BUILDING_DEFS[placed.kind].cost;
        this.buildings=this.buildings.filter(b=>b!==placed);
        const slot=this.slots.find(s=>s.occupied===placed.id); if(slot) slot.occupied=null;
        this.renderCards();this.toast('Construção removida — orçamento devolvido');
      } else if(this.selectedCard?.type==='building') this.tryBuild(this.selectedCard.kind,world,'nature');
      return;
    }

    if (this.selectedCard?.type === 'building') {
      this.tryBuild(this.selectedCard.kind, world, 'nature');
      return;
    }
    if (this.selectedCard?.type === 'unit') {
      this.placeReinforcement(world, this.selectedCard.kind);
      return;
    }

    const unit = this.findUnitAt(world);
    if (unit?.faction === 'nature') {
      if (!additive) this.units.forEach(other => other.selected = false);
      unit.selected = additive ? !unit.selected : true;
      this.updateSelectionInfo();
      return;
    }

    const selected = this.units.filter(u => u.selected && u.faction === 'nature' && !u.dead);
    if (selected.length) {
      selected.forEach((selectedUnit, index) => {
        selectedUnit.order = unit?.faction === 'corruption' ? 'attack' : this.activeOrder;
        selectedUnit.targetId = unit?.faction === 'corruption' ? unit.id : null;
        const spread = this.formationOffset(index, selected.length);
        selectedUnit.orderTarget = { x: clamp(world.x + spread.x, 15, WORLD_W - 15), y: clamp(world.y + spread.y, 15, WORLD_H - 15) };
        selectedUnit.decisionTimer = 0;
      });
      this.spawnPing(world, this.activeOrder === 'attack' ? '#ff8b72' : '#bcec83');
    } else if (unit?.faction === 'corruption') {
      this.units.forEach(other => other.selected = false);
    }
  }

  private placePrepUnit(world: Vec, kind: UnitKind) {
    const def = UNIT_DEFS.nature[kind];
    if (!this.validDeploy(world, 'nature')) return this.toast('Posicione dentro da zona verde');
    if (this.prepRemaining < def.prepCost) return this.toast('Pontos de preparação insuficientes');
    if (this.units.filter(u => u.faction === 'nature').length >= 12) return this.toast('Limite inicial atingido');
    this.units.push(this.createUnit('nature', kind, world.x, world.y));
    this.prepRemaining -= def.prepCost;
    this.prepPointsEl.textContent = `${this.prepRemaining}`;
    this.beep(520, .04);
  }

  private validDeploy(world: Vec, faction: Faction) {
    const inX = world.x > CFG.tile * 2 && world.x < WORLD_W - CFG.tile * 2;
    const inY = this.tileAt(world.x, world.y)?.owner === faction;
    return inX && inY && !this.units.some(unit => !unit.dead && dist2(unit, world) < 25 ** 2);
  }

  private beginBattle() {
    if (this.phase !== 'prep') return;
    this.phase = 'battle';
    this.deployStarterArmy('nature');
    this.deployEnemyArmy();
    this.units.forEach(unit => {
      const direction = unit.faction === 'nature' ? -1 : 1;
      unit.order = 'advance';
      unit.orderTarget = { x: clamp(unit.x + (seeded(unit.id) - .5) * 160, 60, WORLD_W - 60), y: unit.faction === 'nature' ? CFG.tile * 2 : WORLD_H - CFG.tile * 2 };
      unit.pathAngle = direction < 0 ? -Math.PI / 2 : Math.PI / 2;
    });
    this.prepPanel.classList.add('hidden');
    this.selectedCard = null;
    this.renderCards();
    this.toast('Defesas reveladas. Recrute tropas e destrua o núcleo ao norte!');
    this.beep(180, .14);
    setTimeout(() => this.beep(260, .12), 140);
  }

  private setOrder(order: OrderType) {
    this.activeOrder = order;
    document.querySelectorAll<HTMLButtonElement>('#orders button').forEach(button => button.classList.toggle('active', button.dataset.order === order));
    const selected = this.units.filter(unit => unit.selected && !unit.dead);
    if (order === 'hold' || order === 'return') {
      selected.forEach(unit => {
        unit.order = order;
        unit.targetId = null;
        unit.orderTarget = order === 'return'
          ? { x: WORLD_W / 2, y: WORLD_H - CFG.tile * 3 }
          : { x: unit.x, y: unit.y };
      });
    }
    this.toast(selected.length ? `Ordem: ${this.orderLabel(order)}` : 'Selecione tropas para emitir ordens');
  }

  private orderLabel(order: OrderType) {
    return ({ advance: 'Avançar', attack: 'Atacar', defend: 'Defender', hold: 'Manter posição', return: 'Retornar' } as Record<OrderType, string>)[order];
  }

  private selectRect(a: Vec, b: Vec, additive: boolean) {
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    if (!additive) this.units.forEach(unit => unit.selected = false);
    this.units.forEach(unit => {
      if (unit.faction === 'nature' && !unit.dead && unit.x >= minX && unit.x <= maxX && unit.y >= minY && unit.y <= maxY) unit.selected = true;
    });
    this.updateSelectionInfo();
  }

  private renderCards() {
    this.cardsEl.classList.toggle('defense-deck',this.phase==='prep');
    const fragments: string[] = [];
    for (const kind of this.phase === 'prep' ? [] : unitKinds) {
      const def = UNIT_DEFS.nature[kind];
      const cost = this.phase === 'prep' ? `${def.prepCost} pts` : `${def.coinCost}`;
      const disabled = this.phase === 'prep' ? this.prepRemaining < def.prepCost : this.economy.nature.coins < def.coinCost;
      const active = this.selectedCard?.type === 'unit' && this.selectedCard.kind === kind;
      fragments.push(`<button class="card unit-card ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}" data-type="unit" data-kind="${kind}"><span class="card-visual">${this.cardPortrait(kind)}</span><span class="card-copy"><b>${def.name}</b><small>${this.phase === 'prep' ? `PREPARAÇÃO · ${def.hp} VIDA` : `${def.mobilize}s · ${def.damage} DANO`}</small></span><span class="cost"><i>◆</i>${cost}</span><span class="cooldown hidden"></span></button>`);
    }
    if (this.phase !== 'ended') {
      for (const kind of buildingKinds) {
        const def = BUILDING_DEFS[kind];
        const active = this.selectedCard?.type === 'building' && this.selectedCard.kind === kind;
        const budget=this.phase==='prep'?this.prepRemaining:this.economy.nature.coins;
        const effect=kind==='tower'?'ATAQUE À DISTÂNCIA':kind==='barrier'?'BLOQUEIA INIMIGOS':'CURA ALIADOS';
        fragments.push(`<button class="card build ${budget < def.cost ? 'disabled' : ''} ${active ? 'active' : ''}" data-type="building" data-kind="${kind}"><span class="card-visual">${this.cardPortrait(kind)}</span><span class="card-copy"><b>${def.name}</b><small>${effect}</small></span><span class="cost"><i>◆</i>${def.cost}</span></button>`);
      }
    }
    this.cardsEl.innerHTML = fragments.join('');
    this.cardsEl.querySelectorAll<HTMLButtonElement>('.card').forEach(button => button.addEventListener('click', () => {
      const type = button.dataset.type as 'unit' | 'building';
      const kind = button.dataset.kind!;
      if (type === 'unit') {
        this.selectedCard = this.selectedCard?.type === 'unit' && this.selectedCard.kind === kind ? null : { type, kind: kind as UnitKind };
        if (this.selectedCard) this.toast(this.phase === 'prep' ? 'Posicione na clareira verde' : 'Posicione em qualquer território aliado seguro');
      } else {
        this.selectedCard = this.selectedCard?.type === 'building' && this.selectedCard.kind === kind ? null : { type, kind: kind as BuildingKind };
        if (this.selectedCard) this.toast('Escolha terreno aliado livre para construir');
      }
      this.renderCards();
    }));
    this.prepPointsEl.textContent = `${this.prepRemaining}`;
  }

  private cardPortrait(kind: UnitKind | BuildingKind) {
    return '<img class="pixel-portrait" alt="" src="' + sprite(kind).toDataURL() + '">';
  }

  private placeReinforcement(world: Vec, kind: UnitKind) {
    const tile = this.tileAt(world.x, world.y);
    const valid = tile?.owner === 'nature' && !this.closestEnemyUnit(world, 'nature', 85);
    if (!valid) return this.toast('Escolha território aliado seguro, longe de inimigos');
    if (this.queueReinforcement('nature', kind, world)) {
      this.selectedCard = null;
      this.spawnPing(world, '#d4f890');
      this.renderCards();
    }
  }

  private queueReinforcement(faction: Faction, kind: UnitKind, entry?: Vec) {
    if (this.phase !== 'battle') return;
    const def = UNIT_DEFS[faction][kind];
    const alive = this.units.filter(unit => unit.faction === faction && !unit.dead).length + this.queues.filter(q => q.faction === faction).length;
    if (alive >= CFG.maxUnits) { if (faction === 'nature') this.toast('Limite de tropas atingido'); return false; }
    if (this.reinforcementCooldowns[faction][kind] > 0) { if (faction === 'nature') this.toast(`Carta em recarga: ${this.reinforcementCooldowns[faction][kind].toFixed(1)}s`); return false; }
    if (this.economy[faction].coins < def.coinCost) { if (faction === 'nature') this.toast('Moedas insuficientes'); return false; }
    this.economy[faction].coins -= def.coinCost;
    this.reinforcementCooldowns[faction][kind] = Math.max(1.2, def.mobilize * .45);
    const candidates = this.tiles.filter(t => t.owner === faction && Math.abs(t.col - CFG.cols / 2) < 7);
    candidates.sort((a,b) => faction === 'nature' ? a.row-b.row : b.row-a.row);
    const forward = candidates.find(t => !this.closestEnemyUnit({x:(t.col+.5)*CFG.tile,y:(t.row+.5)*CFG.tile}, faction, 100));
    const defaultY = forward ? (forward.row + .5) * CFG.tile : faction === 'nature' ? WORLD_H - 100 : 100;
    const defaultX = forward ? (forward.col + .5) * CFG.tile : WORLD_W / 2;
    this.queues.push({ faction, kind, remaining: def.mobilize, x: entry?.x ?? defaultX, y: entry?.y ?? defaultY });
    if (faction === 'nature') {
      this.toast(`${def.name} a caminho — ${def.mobilize}s`);
      this.beep(460, .05);
      this.renderCards();
    }
    return true;
  }

  private tryBuild(kind: BuildingKind, world: Vec, faction: Faction) {
    const slot = this.findSlotAt(world);
    const def = BUILDING_DEFS[kind];
    if (!slot || !this.validBuildSlot(slot, faction)) return faction === 'nature' && this.toast('Escolha terreno aliado livre, sem sobrepor estruturas');
    const preparing=this.phase==='prep' && faction==='nature';
    if ((preparing?this.prepRemaining:this.economy[faction].coins) < def.cost) return faction === 'nature' && this.toast(preparing?'Orçamento insuficiente':'Moedas insuficientes');
    if(preparing) this.prepRemaining-=def.cost; else this.economy[faction].coins -= def.cost;
    const building: Building = { id: this.nextId++, faction, kind, x: slot.x, y: slot.y, hp: def.hp, maxHp: def.hp, build: preparing?1:0, cooldown: 0, slotId: slot.id, hitFlash: 0 };
    slot.occupied = building.id;
    this.buildings.push(building);
    if(!preparing) this.selectedCard = null;
    this.spawnBurst(slot, faction === 'nature' ? '#b9e879' : '#b56ae0', 14, 'dust');
    if (faction === 'nature') { this.toast(`${def.name} ${preparing?'posicionada — toque novamente para remover':'em construção'}`); this.beep(290, .08); this.renderCards(); }
  }

  private validBuildSlot(slot: BuildSlot, faction: Faction) {
    if (slot.occupied !== null) return false;
    const tile = this.tileAt(slot.x, slot.y);
    return tile?.owner === faction && !this.buildings.some(b => dist2(b, slot) < (b.kind==='core'?90:40) ** 2) && !this.units.some(u => !u.dead && dist2(u, slot) < 28 ** 2);
  }

  private findSlotAt(world: Vec) {
    const tile = this.tileAt(world.x, world.y);
    if (!tile) return null;
    const x = (tile.col + .5) * CFG.tile, y = (tile.row + .5) * CFG.tile;
    return this.slots.find(slot => dist2(slot, {x,y}) < 15 ** 2) ?? { id: this.nextId++, x, y, occupied: null };
  }

  private formationOffset(index: number, count: number): Vec {
    const cols = Math.ceil(Math.sqrt(count));
    return { x: ((index % cols) - (cols - 1) / 2) * 28, y: (Math.floor(index / cols) - Math.floor((count - 1) / cols) / 2) * 25 };
  }

  private findUnitAt(world: Vec, faction?: Faction) {
    let best: Unit | null = null;
    let bestDistance = 28 ** 2 / this.camera.zoom;
    for (const unit of this.units) {
      if (unit.dead || (faction && unit.faction !== faction)) continue;
      const d = dist2(unit, world);
      if (d < bestDistance) { best = unit; bestDistance = d; }
    }
    return best;
  }

  private zoomAt(screenX: number, screenY: number, factor: number) {
    const before = this.screenToWorld(screenX, screenY);
    this.camera.zoom = clamp(this.camera.zoom * factor, this.minimumZoom(), CFG.maxZoom);
    this.camera.x = before.x - screenX / this.camera.zoom;
    this.camera.y = before.y - screenY / this.camera.zoom;
    this.clampCamera();
  }

  private panCamera(dx: number, dy: number) {
    this.camera.x -= dx / this.camera.zoom;
    this.camera.y -= dy / this.camera.zoom;
    this.clampCamera();
  }

  private clampCamera() {
    const viewW = this.width / this.camera.zoom;
    const viewH = this.height / this.camera.zoom;
    this.camera.x = clamp(this.camera.x, 0, Math.max(0, WORLD_W - viewW));
    this.camera.y = clamp(this.camera.y, 0, Math.max(0, WORLD_H - viewH));
    const label = document.querySelector<HTMLElement>('#zoomLabel');
    if (label) label.textContent = `${Math.round(this.camera.zoom * 100)}%`;
  }

  private minimumZoom() {
    return Math.max(CFG.minZoom, this.width / WORLD_W, this.height / WORLD_H);
  }

  private screenToWorld(x: number, y: number): Vec {
    return { x: this.camera.x + x / this.camera.zoom, y: this.camera.y + y / this.camera.zoom };
  }

  private navigateMinimap(event: PointerEvent) {
    const rect = this.minimap.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1) * WORLD_W;
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1) * WORLD_H;
    this.camera.x = x - this.width / this.camera.zoom / 2;
    this.camera.y = y - this.height / this.camera.zoom / 2;
    this.clampCamera();
  }

  private centerBattle() {
    const combatants = this.units.filter(unit => !unit.dead && this.units.some(other => !other.dead && other.faction !== unit.faction && dist2(unit, other) < 300 ** 2));
    const focus = combatants.length ? combatants : this.units.filter(unit => unit.faction === 'nature' && !unit.dead);
    if (!focus.length) return;
    const x = focus.reduce((sum, item) => sum + item.x, 0) / focus.length;
    const y = focus.reduce((sum, item) => sum + item.y, 0) / focus.length;
    this.camera.x = x - this.width / this.camera.zoom / 2;
    this.camera.y = y - this.height / this.camera.zoom / 2;
    this.clampCamera();
  }

  private tileAt(x: number, y: number) {
    const col = Math.floor(x / CFG.tile), row = Math.floor(y / CFG.tile);
    if (col < 0 || row < 0 || col >= CFG.cols || row >= CFG.rows) return null;
    return this.tiles[row * CFG.cols + col];
  }

  private updateSelectionInfo() {
    const selected = this.units.filter(unit => unit.selected && !unit.dead);
    if (!selected.length) return this.selectionEl.classList.add('hidden');
    const hp = selected.reduce((sum, unit) => sum + unit.hp, 0);
    const max = selected.reduce((sum, unit) => sum + unit.maxHp, 0);
    this.selectionEl.innerHTML = `<b>${selected.length} TROPA${selected.length > 1 ? 'S' : ''}</b> · VIDA ${Math.round(hp)}/${max} · ${this.orderLabel(selected[0].order).toUpperCase()}`;
    this.selectionEl.classList.remove('hidden');
  }

  private toast(message: string) {
    const element = $<HTMLElement>('#toast');
    element.textContent = message;
    element.classList.add('show');
    this.toastTimer = 2.2;
  }

  private beep(frequency: number, duration: number) {
    if (!this.sound) return;
    try {
      this.audio ??= new AudioContext();
      const oscillator = this.audio.createOscillator();
      const gain = this.audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.035, this.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, this.audio.currentTime + duration);
      oscillator.connect(gain).connect(this.audio.destination);
      oscillator.start(); oscillator.stop(this.audio.currentTime + duration);
    } catch { /* áudio é melhoria opcional */ }
  }

  private frame = (time: number) => {
    if (!this.running) return;
    const rawDt = (time - this.lastFrame) / 1000;
    this.lastFrame = time;
    const dt = Math.min(rawDt, .1);
    this.fps += ((rawDt > 0 ? 1 / rawDt : 60) - this.fps) * .05;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= CFG.simStep && steps++ < 4) {
      this.update(CFG.simStep);
      this.accumulator -= CFG.simStep;
    }
    this.render();
    requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) $<HTMLElement>('#toast').classList.remove('show');
    }
    this.shake = Math.max(0, this.shake - dt * 10);
    for (const faction of ['nature', 'corruption'] as Faction[]) {
      for (const kind of unitKinds) this.reinforcementCooldowns[faction][kind] = Math.max(0, this.reinforcementCooldowns[faction][kind] - dt);
    }
    for (const tile of this.tiles) {
      const target = tile.targetOwner === 'nature' ? 1 : tile.targetOwner === 'corruption' ? -1 : 0;
      if (Math.abs(tile.visual - target) > .001) tile.visual += (target - tile.visual) * Math.min(1, dt * .85);
    }
    this.updateParticles(dt);
    if (this.phase !== 'battle') return;

    this.battleTime += dt;
    for (const faction of ['nature', 'corruption'] as Faction[]) {
      const eco = this.economy[faction];
      const gain = eco.income * dt;
      eco.coins += gain;
      eco.generated += gain;
    }

    this.updateQueues(dt);
    this.updateBuildings(dt);
    this.updateUnits(dt);
    this.updateProjectiles(dt);
    this.captureClock += dt;
    if (this.captureClock >= .2) {
      this.updateCapture(this.captureClock);
      this.captureClock = 0;
    }
    this.aiClock += dt;
    if (this.aiClock >= CFG.aiTick) {
      this.updateAi(this.aiClock);
      this.aiClock = 0;
    }
    this.hudClock += dt;
    if (this.hudClock >= .12) {
      this.hudClock = 0;
      this.updateHud();
      this.updateSelectionInfo();
    }
    this.checkVictory(dt);
  }

  private updateQueues(dt: number) {
    for (let i = this.queues.length - 1; i >= 0; i--) {
      const queue = this.queues[i];
      queue.remaining -= dt;
      if (queue.remaining > 0) continue;
      const unit = this.createUnit(queue.faction, queue.kind, queue.x, queue.y);
      unit.orderTarget = { x: queue.x, y: queue.faction === 'nature' ? CFG.tile * 2 : WORLD_H - CFG.tile * 2 };
      this.units.push(unit);
      this.queues.splice(i, 1);
      this.spawnBurst(unit, queue.faction === 'nature' ? COLORS.natureLight : COLORS.corruptionLight, 10, 'leaf');
      if (queue.faction === 'nature') this.toast(`${UNIT_DEFS.nature[queue.kind].name} entrou no campo`);
    }
  }

  private updateBuildings(dt: number) {
    for (const building of this.buildings) {
      building.hitFlash = Math.max(0, building.hitFlash - dt * 5);
      building.cooldown -= dt;
      if (building.kind !== 'core' && building.build < 1) {
        building.build = Math.min(1, building.build + dt / BUILDING_DEFS[building.kind].buildTime);
        continue;
      }
      if (building.hp <= 0) continue;
      if (building.kind === 'grove') {
        const def = BUILDING_DEFS.grove;
        for (const unit of this.units) {
          if (!unit.dead && unit.faction === building.faction && unit.hp < unit.maxHp && dist2(unit, building) <= def.range ** 2) {
            unit.hp = Math.min(unit.maxHp, unit.hp + 8 * dt);
            if (seeded(unit.id * 17 + Math.floor(this.battleTime * 3)) > .96) this.spawnParticle(unit, building.faction === 'nature' ? '#aeea7c' : '#c986eb', 'leaf');
          }
        }
      } else if ((building.kind === 'tower' || building.kind === 'core') && building.cooldown <= 0) {
        const range = building.kind === 'core' ? 205 : BUILDING_DEFS.tower.range;
        const target = this.closestEnemyUnit(building, building.faction, range);
        if (target) {
          this.fireProjectile(building, target, building.kind === 'core' ? 22 : 27, false, building.faction);
          building.cooldown = building.kind === 'core' ? 1.15 : .92;
        }
      }
    }

    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const building = this.buildings[i];
      if (building.hp > 0 || building.kind === 'core') continue;
      const slot = this.slots.find(item => item.id === building.slotId);
      if (slot) slot.occupied = null;
      this.spawnBurst(building, '#8d7768', 18, 'smoke');
      this.buildings.splice(i, 1);
    }
  }

  private updateUnits(dt: number) {
    for (const unit of this.units) {
      unit.anim += dt * (2 + UNIT_DEFS[unit.faction][unit.kind].speed / 30);
      unit.hitFlash = Math.max(0, unit.hitFlash - dt * 7);
      unit.cooldown -= dt;
      if (unit.dead) { unit.dead += dt; continue; }
      if (unit.hp <= 0) { this.killUnit(unit); continue; }

      unit.decisionTimer -= dt;
      if (unit.decisionTimer <= 0) {
        this.decideUnit(unit);
        unit.decisionTimer = .28 + seeded(unit.id * 5 + Math.floor(this.battleTime * 2)) * .22;
      }

      const target = this.targetById(unit.targetId);
      const def = UNIT_DEFS[unit.faction][unit.kind];
      if (target && target.hp > 0 && !('dead' in target && target.dead)) {
        const targetRadius = 'kind' in target && target.kind === 'core' ? 37 : 'build' in target ? 22 : UNIT_DEFS[(target as Unit).faction][(target as Unit).kind].radius;
        const distance = Math.sqrt(dist2(unit, target));
        if (distance <= def.range + def.radius + targetRadius) {
          if (unit.cooldown <= 0) this.unitAttack(unit, target);
        } else if (unit.order !== 'hold') {
          this.moveUnit(unit, target, dt);
        }
      } else {
        unit.targetId = null;
        if (unit.order !== 'hold') this.moveUnit(unit, unit.orderTarget, dt);
      }
    }

    this.resolveUnitSeparation();
    for (let i = this.units.length - 1; i >= 0; i--) {
      if (this.units[i].dead > .85) this.units.splice(i, 1);
    }
  }

  private decideUnit(unit: Unit) {
    const def = UNIT_DEFS[unit.faction][unit.kind];
    const leash = unit.order === 'defend' ? 155 : unit.order === 'hold' ? def.range + 80 : 285;
    let bestId: number | null = null;
    let bestD = leash ** 2;
    for (const other of this.units) {
      if (other.dead || other.faction === unit.faction) continue;
      const d = dist2(unit, other);
      if (d < bestD) { bestD = d; bestId = other.id; }
    }
    for (const building of this.buildings) {
      if (building.hp <= 0 || building.faction === unit.faction || building.build < 1) continue;
      const d = dist2(unit, building);
      if (d < bestD || (unit.order === 'attack' && dist2(unit.orderTarget, building) < 75 ** 2)) { bestD = d; bestId = building.id; }
    }
    unit.targetId = bestId;

    if(!bestId && unit.order==='advance' && (unit.faction==='nature'?unit.y<CFG.tile*12:unit.y>WORLD_H-CFG.tile*12)) {
      const core=this.buildings.find(b=>b.kind==='core'&&b.faction!==unit.faction);
      if(core) unit.orderTarget={x:core.x,y:core.y};
    }

    if (!bestId && unit.order === 'advance' && dist2(unit, unit.orderTarget) < 45 ** 2) {
      const direction = unit.faction === 'nature' ? -1 : 1;
      unit.orderTarget = {
        x: clamp(unit.x + (seeded(unit.id + Math.floor(this.battleTime)) - .5) * 140, CFG.tile * 2, WORLD_W - CFG.tile * 2),
        y: clamp(unit.y + direction * CFG.tile * 8, CFG.tile * 2, WORLD_H - CFG.tile * 2),
      };
    }
  }

  private moveUnit(unit: Unit, destination: Vec, dt: number) {
    let dx = destination.x - unit.x, dy = destination.y - unit.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 3) return;
    dx /= distance; dy /= distance;
    const def = UNIT_DEFS[unit.faction][unit.kind];
    let speed = def.speed;
    const tile = this.tileAt(unit.x, unit.y);
    if (tile && tile.owner !== unit.faction && this.connectedToFaction(tile, unit.faction)) speed *= .28;
    if (unit.order === 'defend' && dist2(unit, unit.orderTarget) > 175 ** 2) speed *= 1.15;

    for (const building of this.buildings) {
      if (building.hp <= 0 || building.build < .7) continue;
      const minDistance = building.kind === 'core' ? 42 : building.kind === 'barrier' ? 32 : 23;
      const bx = unit.x - building.x, by = unit.y - building.y;
      const bd = Math.hypot(bx, by);
      if(building.kind==='barrier' && building.faction!==unit.faction && bd<minDistance+def.radius+4) {
        unit.targetId=building.id;
        return;
      }
      if (bd < minDistance + def.radius && building.faction === unit.faction) {
        dx += (bx / Math.max(1, bd)) * 1.3;
        dy += (by / Math.max(1, bd)) * 1.3;
      }
    }
    const length = Math.hypot(dx, dy) || 1;
    unit.x = clamp(unit.x + dx / length * speed * dt, 10, WORLD_W - 10);
    unit.y = clamp(unit.y + dy / length * speed * dt, 10, WORLD_H - 10);
    unit.pathAngle = Math.atan2(dy, dx);
  }

  private resolveUnitSeparation() {
    for (let i = 0; i < this.units.length; i++) {
      const a = this.units[i];
      if (a.dead) continue;
      const ar = UNIT_DEFS[a.faction][a.kind].radius;
      for (let j = i + 1; j < this.units.length; j++) {
        const b = this.units[j];
        if (b.dead) continue;
        const br = UNIT_DEFS[b.faction][b.kind].radius;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const min = (ar + br) * (a.faction === b.faction ? .75 : .9);
        if (d2 > 0 && d2 < min * min) {
          const d = Math.sqrt(d2), push = (min - d) * .18;
          const px = dx / d * push, py = dy / d * push;
          a.x -= px; a.y -= py; b.x += px; b.y += py;
        }
      }
    }
  }

  private unitAttack(unit: Unit, target: Unit | Building) {
    const def = UNIT_DEFS[unit.faction][unit.kind];
    unit.cooldown = def.cooldown;
    if (def.ranged) {
      this.fireProjectile(unit, target, def.damage, !!def.siege, unit.faction);
    } else {
      this.damageTarget(target, def.damage * (def.siege && !('dead' in target) ? 1.35 : 1), unit.faction, unit);
      this.spawnBurst(target, unit.faction === 'nature' ? '#d1e995' : '#ca7ee2', 4, 'spark');
      if (def.siege) this.shake = 3;
    }
  }

  private fireProjectile(source: Vec, target: Unit | Building, damage: number, siege: boolean, faction: Faction) {
    const dx = target.x - source.x, dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const speed = siege ? 210 : 285;
    this.projectiles.push({ x: source.x, y: source.y, vx: dx / distance * speed, vy: dy / distance * speed, faction, damage, targetId: target.id, life: 2.2, siege });
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      const target = this.targetById(projectile.targetId);
      if (target && target.hp > 0 && !('dead' in target && target.dead)) {
        const dx = target.x - projectile.x, dy = target.y - projectile.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = Math.hypot(projectile.vx, projectile.vy);
        projectile.vx += (dx / d * speed - projectile.vx) * Math.min(1, dt * 2.4);
        projectile.vy += (dy / d * speed - projectile.vy) * Math.min(1, dt * 2.4);
        if (d < (projectile.siege ? 17 : 11) + speed * dt) {
          this.damageTarget(target, projectile.damage, projectile.faction);
          this.spawnBurst(target, projectile.faction === 'nature' ? '#c5e87f' : '#c277e1', projectile.siege ? 9 : 5, 'spark');
          if (projectile.siege) this.shake = 2;
          this.projectiles.splice(i, 1);
          continue;
        }
      }
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      if (projectile.life <= 0) this.projectiles.splice(i, 1);
    }
  }

  private damageTarget(target: Unit | Building, damage: number, faction: Faction, attacker?: Unit) {
    target.hp -= damage;
    target.hitFlash = 1;
    if (target.hp <= 0 && 'dead' in target && !target.dead) {
      if (attacker) attacker.kills++;
      faction === 'nature' ? this.playerKills++ : this.enemyKills++;
      this.killUnit(target);
    }
  }

  private killUnit(unit: Unit) {
    if (unit.dead) return;
    unit.dead = .001;
    unit.selected = false;
    unit.hp = 0;
    this.spawnBurst(unit, unit.faction === 'nature' ? '#759b5b' : '#725177', 11, 'dust');
  }

  private targetById(id: number | null): Unit | Building | null {
    if (id === null) return null;
    return this.units.find(unit => unit.id === id) ?? this.buildings.find(building => building.id === id) ?? null;
  }

  private closestEnemyUnit(origin: Vec, faction: Faction, range: number) {
    let result: Unit | null = null, best = range ** 2;
    for (const unit of this.units) {
      if (unit.dead || unit.faction === faction) continue;
      const d = dist2(origin, unit);
      if (d < best) { result = unit; best = d; }
    }
    return result;
  }

  private updateCapture(dt: number) {
    const influence = new Map<number, { nature: number; corruption: number }>();
    for (const unit of this.units) {
      if (unit.dead) continue;
      const def = UNIT_DEFS[unit.faction][unit.kind];
      if (def.capture <= 0) continue;
      const col = Math.floor(unit.x / CFG.tile), row = Math.floor(unit.y / CFG.tile);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const c = col + ox, r = row + oy;
        if (c < 0 || r < 0 || c >= CFG.cols || r >= CFG.rows) continue;
        const center = { x: (c + .5) * CFG.tile, y: (r + .5) * CFG.tile };
        if (dist2(unit, center) > 44 ** 2) continue;
        const index = r * CFG.cols + c;
        const amount = def.capture * (ox === 0 && oy === 0 ? 1 : .34);
        const value = influence.get(index) ?? { nature: 0, corruption: 0 };
        value[unit.faction] += amount;
        influence.set(index, value);
      }
    }

    let changed = false;
    for (let index = 0; index < this.tiles.length; index++) {
      const tile = this.tiles[index];
      if (tile.owner === 'contested' && !influence.has(index)) {
        tile.owner = tile.targetOwner;
        tile.capture = 0;
        changed = true;
      }
    }
    for (const [index, value] of influence) {
      const tile = this.tiles[index];
      const nature = value.nature, corruption = value.corruption;
      if (nature > 0 && corruption > 0) {
        if (tile.owner !== 'contested') { tile.targetOwner = tile.owner === 'nature' || tile.owner === 'corruption' ? tile.owner : 'neutral'; tile.owner = 'contested'; changed = true; }
        tile.capture = Math.max(0, tile.capture - dt * .25);
        continue;
      }
      const faction: Faction = nature > 0 ? 'nature' : 'corruption';
      const strength = Math.max(nature, corruption);
      if (tile.owner === faction) { tile.capture = Math.max(0, tile.capture - dt); continue; }
      if (!this.connectedToFaction(tile, faction)) continue;
      tile.capture += strength * dt / CFG.captureSeconds;
      tile.targetOwner = faction;
      if (tile.capture >= 1) {
        tile.owner = faction;
        tile.targetOwner = faction;
        tile.capture = 0;
        tile.dirty = true;
        changed = true;
        if (seeded(index + this.battleTime) > .68) this.spawnParticle({ x: (tile.col + .5) * CFG.tile, y: (tile.row + .5) * CFG.tile }, faction === 'nature' ? '#9fde6d' : '#a965cc', faction === 'nature' ? 'leaf' : 'smoke');
      }
    }
    if (changed) this.recountTerritory();
  }

  private connectedToFaction(tile: Tile, faction: Faction) {
    if (tile.owner === faction) return true;
    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    return neighbors.some(([dx, dy]) => {
      const col = tile.col + dx, row = tile.row + dy;
      return col >= 0 && row >= 0 && col < CFG.cols && row < CFG.rows && this.tiles[row * CFG.cols + col].owner === faction;
    });
  }

  private recountTerritory() {
    let nature = 0, corruption = 0;
    for (const tile of this.tiles) {
      if (tile.owner === 'nature') nature++;
      else if (tile.owner === 'corruption') corruption++;
    }
    this.economy.nature.tiles = nature;
    this.economy.corruption.tiles = corruption;
    this.economy.nature.income = nature * CFG.coinPerTile;
    this.economy.corruption.income = corruption * CFG.coinPerTile;
  }

  private updateAi(dt: number) {
    const eco = this.economy.corruption;
    const aiUnits = this.units.filter(unit => unit.faction === 'corruption' && !unit.dead).length + this.queues.filter(queue => queue.faction === 'corruption').length;
    const threat = this.units.filter(unit => unit.faction === 'nature' && !unit.dead && unit.y < CFG.tile * 18).length;
    if (aiUnits < CFG.maxUnits && eco.coins >= 28 && seeded(Math.floor(this.battleTime / CFG.aiTick) * 7) > .66) {
      const roll = seeded(Math.floor(this.battleTime * 3.1));
      const kind: UnitKind = threat > 3 && eco.coins >= 72 ? 'guardian' : roll < .28 ? 'warrior' : roll < .5 ? 'archer' : roll < .74 ? 'scout' : eco.coins >= 80 ? 'ballista' : 'warrior';
      this.queueReinforcement('corruption', kind);
    }
    if (eco.coins >= 70 && seeded(Math.floor(this.battleTime / 4) * 13) > .93) {
      const available = this.slots.filter(slot => this.validBuildSlot(slot, 'corruption'));
      if (available.length) {
        const slot = available[Math.floor(seeded(this.battleTime) * available.length)];
        const kind: BuildingKind = threat > 4 && eco.coins >= 95 ? 'grove' : 'tower';
        this.tryBuild(kind, slot, 'corruption');
      }
    }

    for (const unit of this.units) {
      if (unit.dead || unit.faction !== 'corruption') continue;
      if (threat > 4 && unit.y < CFG.tile * 15 && seeded(unit.id + Math.floor(this.battleTime)) > .72) {
        unit.order = 'defend';
        unit.orderTarget = { x: WORLD_W / 2, y: CFG.tile * 8 };
      } else if (!unit.targetId && unit.order !== 'advance') {
        unit.order = 'advance';
        unit.orderTarget = { x: clamp(unit.x + (seeded(unit.id) - .5) * 180, 70, WORLD_W - 70), y: WORLD_H - CFG.tile * 2 };
      }
    }
  }

  private checkVictory(dt: number) {
    const natureCore = this.buildings.find(building => building.kind === 'core' && building.faction === 'nature')!;
    const corruptionCore = this.buildings.find(building => building.kind === 'core' && building.faction === 'corruption')!;
    if (corruptionCore.hp <= 0) return this.endGame('nature', 'O núcleo da Corrupção foi destruído');
    if (natureCore.hp <= 0) return this.endGame('corruption', 'O Coração da Floresta foi destruído');
  }

  private endGame(winner: Faction, reason: string) {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.units.forEach(unit => unit.selected = false);
    const won = winner === 'nature';
    $<HTMLElement>('#resultTitle').textContent = won ? 'VITÓRIA' : 'DERROTA';
    $<HTMLElement>('#resultTitle').style.color = won ? '#c4f18c' : '#d187df';
    $<HTMLElement>('#resultReason').textContent = reason;
    $<HTMLElement>('#resultStats').innerHTML = `
      <div><span>TERRITÓRIO</span><b>${Math.round(this.economy.nature.tiles / this.tiles.length * 100)}%</b></div>
      <div><span>INIMIGOS DERROTADOS</span><b>${this.playerKills}</b></div>
      <div><span>TEMPO DE BATALHA</span><b>${formatTime(this.battleTime)}</b></div>
      <div><span>MOEDAS GERADAS</span><b>${Math.floor(this.economy.nature.generated)}</b></div>`;
    this.resultEl.classList.remove('hidden');
    this.beep(won ? 520 : 120, .28);
  }

  private updateHud() {
    const own=this.buildings.find(b=>b.kind==='core'&&b.faction==='nature');
    const enemy=this.buildings.find(b=>b.kind==='core'&&b.faction==='corruption');
    $<HTMLElement>('#coreStatus').textContent=this.phase==='prep'?'600 pontos para fortificar. Exércitos chegam ao iniciar. Território gera renda, não vitória.':`Seu núcleo: ${Math.max(0,Math.ceil(own?.hp??0))} / ${CFG.coreHp} · Inimigo: ${Math.max(0,Math.ceil(enemy?.hp??0))} / ${CFG.coreHp}`;
    const eco = this.economy.nature;
    this.coinsEl.textContent = `${Math.floor(eco.coins)}`;
    this.incomeEl.textContent = `+${eco.income.toFixed(1)}/s`;
    this.territoryEl.textContent = `${Math.round(eco.tiles / this.tiles.length * 100)}% · ${eco.tiles}`;
    this.timerEl.textContent = this.phase === 'prep' ? 'PREP' : formatTime(this.battleTime);
    if (this.phase === 'battle' && Math.floor(this.battleTime * 4) % 4 === 0) {
      this.cardsEl.querySelectorAll<HTMLButtonElement>('[data-type="unit"]').forEach(button => {
        const kind = button.dataset.kind as UnitKind;
        const def = UNIT_DEFS.nature[kind];
        const cooldown = this.reinforcementCooldowns.nature[kind];
        button.classList.toggle('disabled', eco.coins < def.coinCost || cooldown > 0);
        const overlay = button.querySelector<HTMLElement>('.cooldown');
        if (overlay) {
          overlay.textContent = cooldown > 0 ? cooldown.toFixed(1) : '';
          overlay.classList.toggle('hidden', cooldown <= 0);
        }
      });
      this.cardsEl.querySelectorAll<HTMLButtonElement>('[data-type="building"]').forEach(button => {
        const def = BUILDING_DEFS[button.dataset.kind as BuildingKind];
        button.classList.toggle('disabled', eco.coins < def.cost);
      });
    }
  }

  private spawnParticle(origin: Vec, color: string, kind: Particle['kind']) {
    if (this.particles.length >= CFG.maxParticles) return;
    const angle = seeded(this.nextId++ * 2.4) * Math.PI * 2;
    const speed = 10 + seeded(this.nextId * 4.1) * 38;
    this.particles.push({ x: origin.x, y: origin.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .6 + seeded(this.nextId) * .8, maxLife: 1.4, color, size: 1.5 + seeded(this.nextId * 8) * 3, kind });
  }

  private spawnBurst(origin: Vec, color: string, count: number, kind: Particle['kind']) {
    for (let i = 0; i < count; i++) this.spawnParticle(origin, color, kind);
  }

  private spawnPing(origin: Vec, color: string) {
    for (let i = 0; i < 10; i++) {
      const angle = i / 10 * Math.PI * 2;
      if (this.particles.length < CFG.maxParticles) this.particles.push({ x: origin.x + Math.cos(angle) * 8, y: origin.y + Math.sin(angle) * 8, vx: Math.cos(angle) * 23, vy: Math.sin(angle) * 23, life: .7, maxLife: .7, color, size: 2, kind: 'spark' });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.kind === 'smoke') particle.vy -= 4 * dt;
      else particle.vy += 6 * dt;
      particle.vx *= .985;
      particle.life -= dt;
      if (particle.life <= 0) this.particles.splice(i, 1);
    }
  }

  private render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, this.height);
    bg.addColorStop(0, '#08110e'); bg.addColorStop(1, '#11150f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.width, this.height);
    const shakeX = this.shake ? (seeded(this.battleTime * 999) - .5) * this.shake : 0;
    const shakeY = this.shake ? (seeded(this.battleTime * 771) - .5) * this.shake : 0;
    ctx.setTransform(this.dpr * this.camera.zoom, 0, 0, this.dpr * this.camera.zoom,
      (-this.camera.x * this.camera.zoom + shakeX) * this.dpr,
      (-this.camera.y * this.camera.zoom + shakeY) * this.dpr);

    const bounds = {
      left: this.camera.x - CFG.tile,
      top: this.camera.y - CFG.tile,
      right: this.camera.x + this.width / this.camera.zoom + CFG.tile,
      bottom: this.camera.y + this.height / this.camera.zoom + CFG.tile,
    };
    this.drawTerrain(ctx, bounds);
    // Sparse low canopies on the support banks leave combat lanes readable.
    for(const tile of this.tiles) {
      if(tile.seed < .78 || (tile.col > 5 && tile.col < CFG.cols-6) || Math.abs(tile.visual)<.6) continue;
      const p={x:(tile.col+.5)*CFG.tile,y:(tile.row+.5)*CFG.tile};
      if(!this.visible(p,bounds,80)) continue;
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(sprite('tree',tile.visual>0?'nature':'corruption'),p.x-36,p.y-42,72,72);
    }
    for (const building of this.buildings) if (this.visible(building, bounds, 70) && (this.phase!=='prep'||building.faction==='nature'||building.kind==='core')) this.drawBuilding(ctx, building);
    for (const projectile of this.projectiles) if (this.visible(projectile, bounds, 10)) this.drawProjectile(ctx, projectile);
    const visibleUnits = this.units.filter(unit => this.visible(unit, bounds, 30) && (this.phase !== 'prep' || unit.faction === 'nature'));
    visibleUnits.sort((a, b) => a.y - b.y);
    for (const unit of visibleUnits) this.drawUnit(ctx, unit);
    for (const particle of this.particles) if (this.visible(particle, bounds, 10)) this.drawParticle(ctx, particle);

    if (this.dragSelectStart && this.dragSelectCurrent) this.drawSelectionBox(ctx, this.dragSelectStart, this.dragSelectCurrent);
    if (this.phase === 'prep') this.drawDeploymentZone(ctx);
    if (this.selectedCard?.type === 'building') this.drawBuildPreview(ctx, this.selectedCard.kind);
    if (this.phase === 'battle' && this.selectedCard?.type === 'unit') this.drawReinforcementZone(ctx);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawScreenVignette(ctx);
    this.renderMinimap();
  }

  private visible(position: Vec, bounds: { left: number; top: number; right: number; bottom: number }, margin: number) {
    return position.x >= bounds.left - margin && position.x <= bounds.right + margin && position.y >= bounds.top - margin && position.y <= bounds.bottom + margin;
  }

  private drawTerrain(ctx: CanvasRenderingContext2D, bounds: { left: number; top: number; right: number; bottom: number }) {
    const minCol = clamp(Math.floor(bounds.left / CFG.tile), 0, CFG.cols - 1);
    const maxCol = clamp(Math.ceil(bounds.right / CFG.tile), 0, CFG.cols - 1);
    const minRow = clamp(Math.floor(bounds.top / CFG.tile), 0, CFG.rows - 1);
    const maxRow = clamp(Math.ceil(bounds.bottom / CFG.tile), 0, CFG.rows - 1);
    ctx.fillStyle = '#26251e';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const tile = this.tiles[row * CFG.cols + col];
        const x = col * CFG.tile, y = row * CFG.tile;
        ctx.imageSmoothingEnabled=false;
        const variant=Math.floor(tile.seed*16);
        ctx.drawImage(terrain(variant,0),x,y,CFG.tile,CFG.tile);
        if(Math.abs(tile.visual)>.01){ctx.globalAlpha=Math.abs(tile.visual);ctx.drawImage(terrain(variant,tile.visual>0?1:-1),x,y,CFG.tile,CFG.tile);ctx.globalAlpha=1;}
        if (tile.owner === 'contested') {
          ctx.fillStyle = 'rgba(224,185,96,.09)';
          ctx.fillRect(x, y, CFG.tile, CFG.tile);
          ctx.strokeStyle = 'rgba(255,220,123,.6)';
          ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.arc(x + CFG.tile / 2, y + CFG.tile / 2, CFG.tile * .38, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        if (tile.capture > .01) {
          ctx.fillStyle = '#111a'; ctx.fillRect(x + 5, y + CFG.tile - 5, CFG.tile - 10, 2.5);
          ctx.fillStyle = tile.targetOwner === 'nature' ? COLORS.natureLight : COLORS.corruptionLight;
          ctx.fillRect(x + 5, y + CFG.tile - 5, (CFG.tile - 10) * clamp(tile.capture, 0, 1), 2.5);
        }
      }
    }
    for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
      const tile = this.tiles[row * CFG.cols + col];
      if (col < CFG.cols - 1) {
        const right = this.tiles[row * CFG.cols + col + 1];
        if (right.owner !== tile.owner) this.drawTerritorySeam(ctx, tile, right, (col + 1) * CFG.tile, row * CFG.tile, true);
      }
      if (row < CFG.rows - 1) {
        const below = this.tiles[(row + 1) * CFG.cols + col];
        if (below.owner !== tile.owner) this.drawTerritorySeam(ctx, tile, below, col * CFG.tile, (row + 1) * CFG.tile, false);
      }
    }
    ctx.strokeStyle = 'rgba(197,229,158,.18)'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, WORLD_W - 4, WORLD_H - 4);
  }


  private drawTerritorySeam(ctx: CanvasRenderingContext2D, a: Tile, b: Tile, x: number, y: number, vertical: boolean) {
    const owner = a.owner === 'contested' ? b.owner : a.owner;
    const color = owner === 'nature' ? 'rgba(143,218,91,.38)' : owner === 'corruption' ? 'rgba(178,88,209,.4)' : 'rgba(210,189,139,.16)';
    const bend = (a.seed - .5) * 10;
    ctx.strokeStyle = color; ctx.lineWidth = 2.2 / Math.max(.8, this.camera.zoom); ctx.lineCap = 'round';
    ctx.beginPath();
    if (vertical) { ctx.moveTo(x, y); ctx.bezierCurveTo(x + bend, y + CFG.tile * .28, x - bend, y + CFG.tile * .7, x, y + CFG.tile); }
    else { ctx.moveTo(x, y); ctx.bezierCurveTo(x + CFG.tile * .28, y + bend, x + CFG.tile * .7, y - bend, x + CFG.tile, y); }
    ctx.stroke();
  }

  private drawDeploymentZone(ctx: CanvasRenderingContext2D) {
    const x = CFG.tile * 2, y = WORLD_H - CFG.tile * CFG.initialRows, w = WORLD_W - CFG.tile * 4, h = CFG.tile * (CFG.initialRows - 1);
    ctx.fillStyle = 'rgba(115,201,94,.075)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(170,236,126,.72)'; ctx.lineWidth = 2; ctx.setLineDash([10, 7]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(202,241,169,.65)'; ctx.font = '700 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('ZONA DE POSICIONAMENTO', WORLD_W / 2, y + 21);
  }

  private drawReinforcementZone(ctx: CanvasRenderingContext2D) {
    const y = Math.min(...this.tiles.filter(t => t.owner === 'nature').map(t => t.row * CFG.tile));
    const pulse = .55 + Math.sin(this.battleTime * 4) * .18;
    ctx.fillStyle = `rgba(127,220,106,${.055 + pulse * .035})`;
    for (const tile of this.tiles) if (tile.owner === 'nature') ctx.fillRect(tile.col * CFG.tile, tile.row * CFG.tile, CFG.tile, CFG.tile);
    ctx.strokeStyle = `rgba(192,246,143,${pulse})`;
    ctx.lineWidth = 2 / this.camera.zoom;
    ctx.setLineDash([12 / this.camera.zoom, 8 / this.camera.zoom]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#e5ffc2'; ctx.font = `800 ${13 / Math.max(.8, this.camera.zoom)}px system-ui`; ctx.textAlign = 'center';
    ctx.fillText('ESCOLHA O PONTO DE ENTRADA DO REFORÇO', WORLD_W / 2, y + 24 / this.camera.zoom);
  }

  private drawBuildSlots(ctx: CanvasRenderingContext2D, bounds: { left: number; top: number; right: number; bottom: number }) {
    for (const slot of this.slots) {
      if (!this.visible(slot, bounds, 40) || slot.occupied !== null) continue;
      const tile = this.tileAt(slot.x, slot.y);
      const active = this.selectedCard?.type === 'building';
      const valid = tile?.owner === 'nature';
      ctx.save(); ctx.translate(slot.x, slot.y);
      ctx.fillStyle = active ? (valid ? 'rgba(142,219,91,.18)' : 'rgba(199,79,87,.13)') : 'rgba(190,185,142,.07)';
      ctx.strokeStyle = active ? (valid ? '#a5de74' : '#b46169') : 'rgba(197,191,154,.28)';
      ctx.lineWidth = active ? 2 : 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = active ? ctx.strokeStyle : '#c3b89455'; ctx.font = '15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', 0, -1);
      ctx.restore();
    }
  }

  private drawBuildPreview(ctx: CanvasRenderingContext2D, kind: BuildingKind) {
    const slot = this.hoveredSlot;
    if (!slot || slot.occupied !== null) return;
    const valid = this.validBuildSlot(slot, 'nature') && (this.phase==='prep'?this.prepRemaining:this.economy.nature.coins) >= BUILDING_DEFS[kind].cost;
    ctx.save(); ctx.globalAlpha = .58; this.drawBuildingShape(ctx, { id: -1, faction: 'nature', kind, x: slot.x, y: slot.y, hp: 1, maxHp: 1, build: 1, cooldown: 0, slotId: slot.id, hitFlash: 0 }); ctx.restore();
    ctx.strokeStyle = valid ? '#a9e36f' : '#ef6e6e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(slot.x, slot.y, BUILDING_DEFS[kind].range || 29, 0, Math.PI * 2); ctx.stroke();
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, building: Building) {
    ctx.save();
    if(building.kind==='core') {
      ctx.fillStyle=building.faction==='nature'?'#d5edb4':'#ecc4eb';ctx.font='bold 12px monospace';ctx.textAlign='center';
      ctx.fillText(building.faction==='nature'?'CORAÇÃO DA FLORESTA':'NÚCLEO DA CORRUPÇÃO',building.x,building.y-66);
    }
    if(this.phase==='prep' && building.kind!=='core' && building.kind!=='barrier') {
      ctx.strokeStyle='#c9dfa52c';ctx.lineWidth=1;ctx.setLineDash([4,6]);ctx.beginPath();ctx.arc(building.x,building.y,BUILDING_DEFS[building.kind].range,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    }
    if (building.hp <= 0) ctx.globalAlpha = .3;
    this.drawBuildingShape(ctx, building);
    if (building.build < 1) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = building.faction === 'nature' ? COLORS.natureLight : COLORS.corruptionLight;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(building.x, building.y, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * building.build); ctx.stroke();
    }
    if (building.hp < building.maxHp || building.kind === 'core') this.drawHealthBar(ctx, building.x, building.y - (building.kind === 'core' ? 49 : 31), building.hp / building.maxHp, building.kind === 'core' ? 65 : 38);
    ctx.restore();
  }

  private drawBuildingShape(ctx: CanvasRenderingContext2D, building: Building) {
    ctx.save();ctx.imageSmoothingEnabled=false;
    const size=building.kind==='core'?112:80;
    ctx.globalAlpha *= .4+building.build*.6;
    ctx.drawImage(sprite(building.kind,building.faction),Math.round(building.x-size/2),Math.round(building.y-size/2),size,size);
    ctx.restore();
  }

  private drawUnit(ctx: CanvasRenderingContext2D, unit: Unit) {
    const size = unit.kind === 'guardian' ? 80 : unit.kind === 'ballista' ? 72 : 64;
    ctx.save(); ctx.translate(Math.round(unit.x), Math.round(unit.y));ctx.imageSmoothingEnabled=false;
    if(unit.dead) ctx.globalAlpha=Math.max(0,1-unit.dead/.85);
    ctx.fillStyle='#081b2266';ctx.fillRect(-size*.26,10,size*.52,9);
    if(unit.selected){ctx.strokeStyle='#eedb95';ctx.lineWidth=2;ctx.strokeRect(-22,-19,44,40);}
    const bob=!unit.dead && !unit.targetId && unit.order!=='hold'?Math.floor(Math.sin(unit.anim*3)*1.5):0;
    ctx.drawImage(sprite(unit.kind,unit.faction),-size/2,-size/2-4+bob,size,size);
    if(unit.hitFlash>0){ctx.globalAlpha=unit.hitFlash*.35;ctx.fillStyle='#fff4cc';ctx.fillRect(-9,-15,18,22);}
    ctx.restore();
    if(!unit.dead && (unit.hp<unit.maxHp || unit.selected)) this.drawHealthBar(ctx,unit.x,unit.y-32,unit.hp/unit.maxHp,32);
  }

  private drawHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, ratio: number, width: number) {
    ctx.fillStyle = '#090d0ab8'; ctx.fillRect(x - width / 2, y, width, 3.5);
    ctx.fillStyle = ratio > .5 ? '#9edc6f' : ratio > .25 ? '#e2b75c' : '#d65d65'; ctx.fillRect(x - width / 2 + .7, y + .7, (width - 1.4) * clamp(ratio, 0, 1), 2.1);
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, projectile: Projectile) {
    ctx.save(); ctx.translate(projectile.x, projectile.y); ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
    ctx.strokeStyle = projectile.faction === 'nature' ? '#d8e7a2' : '#d384ec'; ctx.lineWidth = projectile.siege ? 3.5 : 1.7;
    ctx.beginPath(); ctx.moveTo(projectile.siege ? -10 : -6, 0); ctx.lineTo(projectile.siege ? 8 : 5, 0); ctx.stroke();
    if (projectile.siege) { ctx.fillStyle = projectile.faction === 'nature' ? '#8ab859' : '#974eb2'; ctx.beginPath(); ctx.arc(8, 0, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  private drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
    const alpha = clamp(particle.life / Math.min(particle.maxLife, .45), 0, 1);
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(particle.x, particle.y); ctx.fillStyle = particle.color;
    if (particle.kind === 'leaf') { ctx.rotate(Math.atan2(particle.vy, particle.vx)); ctx.beginPath(); ctx.ellipse(0, 0, particle.size * 1.7, particle.size * .65, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (particle.kind === 'smoke') { ctx.beginPath(); ctx.arc(0, 0, particle.size * 1.6, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size); }
    ctx.restore();
  }

  private drawSelectionBox(ctx: CanvasRenderingContext2D, a: Vec, b: Vec) {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
    ctx.fillStyle = 'rgba(170,231,117,.08)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#b8e783'; ctx.lineWidth = 1 / this.camera.zoom; ctx.setLineDash([5 / this.camera.zoom, 3 / this.camera.zoom]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  }

  private drawScreenVignette(ctx: CanvasRenderingContext2D) {
    const gradient = ctx.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * .25, this.width / 2, this.height / 2, Math.max(this.width, this.height) * .72);
    gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(0,8,4,.38)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.width, this.height);
  }

  private renderMinimap() {
    const ctx = this.miniCtx;
    const w = this.minimap.width, h = this.minimap.height;
    const now = performance.now();
    if (now - this.lastMinimapUpdate > 120) {
      this.lastMinimapUpdate = now;
      const base = this.miniBaseCtx;
      base.clearRect(0, 0, w, h);
      base.fillStyle = '#25261e'; base.fillRect(0, 0, w, h);
      const tileW = w / CFG.cols, tileH = h / CFG.rows;
      for (const tile of this.tiles) {
        base.fillStyle = tile.owner === 'nature' ? '#3b7a46' : tile.owner === 'corruption' ? '#633a78' : tile.owner === 'contested' ? '#9b7844' : '#454238';
        base.fillRect(tile.col * tileW, tile.row * tileH, tileW + .35, tileH + .35);
      }
    }
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.miniBase, 0, 0);
    for (const slot of this.slots) {
      if (slot.occupied === null) continue;
      const building = this.buildings.find(item => item.id === slot.occupied);
      if (!building) continue;
      ctx.fillStyle = building.faction === 'nature' ? '#d1ed8f' : '#dc8aee';
      ctx.fillRect(building.x / WORLD_W * w - 1, building.y / WORLD_H * h - 1, 3, 3);
    }
    for (const unit of this.units) {
      if (unit.dead || (this.phase === 'prep' && unit.faction === 'corruption')) continue;
      ctx.fillStyle = unit.faction === 'nature' ? '#c8ee89' : '#e080f1';
      ctx.fillRect(unit.x / WORLD_W * w - 1, unit.y / WORLD_H * h - 1, 2.2, 2.2);
    }
    const cores = this.buildings.filter(building => building.kind === 'core');
    for (const core of cores) {
      ctx.fillStyle = core.faction === 'nature' ? '#efffc2' : '#f3b4ff';
      ctx.beginPath(); ctx.arc(core.x / WORLD_W * w, core.y / WORLD_H * h, 3.4, 0, Math.PI * 2); ctx.fill();
    }
    const vx = this.camera.x / WORLD_W * w, vy = this.camera.y / WORLD_H * h;
    const vw = Math.min(w, this.width / this.camera.zoom / WORLD_W * w), vh = Math.min(h, this.height / this.camera.zoom / WORLD_H * h);
    ctx.strokeStyle = '#f1f4d8'; ctx.lineWidth = 1.2; ctx.strokeRect(vx, vy, vw, vh);
  }

  private mixColor(a: string, b: string, t: number) {
    const value = clamp(t, 0, 1);
    const parse = (color: string) => {
      if (color.startsWith('#')) return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      return channels?.length === 3 ? channels : [0, 0, 0];
    };
    const ca = parse(a), cb = parse(b);
    return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * value)},${Math.round(ca[1] + (cb[1] - ca[1]) * value)},${Math.round(ca[2] + (cb[2] - ca[2]) * value)})`;
  }
}

export type Faction = 'nature' | 'corruption';
export type Owner = Faction | 'neutral' | 'contested';
export type Phase = 'prep' | 'battle' | 'ended';
export type OrderType = 'advance' | 'attack' | 'defend' | 'hold' | 'return';
export type UnitKind = 'warrior' | 'archer' | 'scout' | 'guardian' | 'ballista';
export type BuildingKind = 'tower' | 'barrier' | 'grove';

export interface Vec { x: number; y: number }

export interface Tile {
  col: number;
  row: number;
  owner: Owner;
  targetOwner: Faction | 'neutral';
  visual: number;
  capture: number;
  seed: number;
  dirty: boolean;
}

export interface UnitDef {
  kind: UnitKind;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  range: number;
  cooldown: number;
  coinCost: number;
  prepCost: number;
  mobilize: number;
  capture: number;
  radius: number;
  symbol: string;
  ranged?: boolean;
  siege?: boolean;
}

export interface Unit extends Vec {
  id: number;
  faction: Faction;
  kind: UnitKind;
  hp: number;
  maxHp: number;
  targetId: number | null;
  cooldown: number;
  selected: boolean;
  order: OrderType;
  orderTarget: Vec;
  decisionTimer: number;
  pathAngle: number;
  anim: number;
  hitFlash: number;
  dead: number;
  kills: number;
}

export interface Projectile extends Vec {
  vx: number;
  vy: number;
  faction: Faction;
  damage: number;
  targetId: number;
  life: number;
  siege: boolean;
}

export interface Particle extends Vec {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  kind: 'leaf' | 'spark' | 'dust' | 'smoke';
}

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  cost: number;
  hp: number;
  buildTime: number;
  range: number;
  symbol: string;
}

export interface Building extends Vec {
  id: number;
  faction: Faction;
  kind: BuildingKind | 'core';
  hp: number;
  maxHp: number;
  build: number;
  cooldown: number;
  slotId: number;
  hitFlash: number;
}

export interface BuildSlot extends Vec {
  id: number;
  occupied: number | null;
}

export interface Reinforcement {
  faction: Faction;
  kind: UnitKind;
  remaining: number;
}

export interface Economy {
  coins: number;
  generated: number;
  income: number;
  tiles: number;
}

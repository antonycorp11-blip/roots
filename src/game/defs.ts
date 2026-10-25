import type { BuildingDef, BuildingKind, Faction, UnitDef, UnitKind } from './model';

const base: Record<UnitKind, Omit<UnitDef, 'kind'>> = {
  warrior: { name: 'Guerreiro das Raízes', hp: 175, speed: 58, damage: 25, range: 24, cooldown: .82, coinCost: 32, prepCost: 3, mobilize: 2, capture: 1, radius: 10, symbol: '⚔' },
  archer: { name: 'Arqueiro Silvestre', hp: 92, speed: 52, damage: 20, range: 155, cooldown: 1.2, coinCost: 38, prepCost: 4, mobilize: 3, capture: .55, radius: 9, symbol: '➶', ranged: true },
  scout: { name: 'Batedor da Floresta', hp: 80, speed: 88, damage: 14, range: 23, cooldown: .65, coinCost: 28, prepCost: 3, mobilize: 2.5, capture: 1.65, radius: 8, symbol: '◆' },
  guardian: { name: 'Guardião Arbóreo', hp: 390, speed: 32, damage: 48, range: 30, cooldown: 1.35, coinCost: 72, prepCost: 7, mobilize: 7, capture: .8, radius: 15, symbol: '♜', siege: true },
  ballista: { name: 'Balista Móvel', hp: 135, speed: 28, damage: 68, range: 235, cooldown: 2.35, coinCost: 80, prepCost: 7, mobilize: 6, capture: .18, radius: 13, symbol: '✣', ranged: true, siege: true },
};

export const UNIT_DEFS: Record<Faction, Record<UnitKind, UnitDef>> = {
  nature: Object.fromEntries(Object.entries(base).map(([kind, d]) => [kind, { ...d, kind }])) as Record<UnitKind, UnitDef>,
  corruption: Object.fromEntries(Object.entries(base).map(([kind, d]) => [kind, {
    ...d,
    kind,
    name: ({ warrior: 'Espinho Profano', archer: 'Vidente Sombrio', scout: 'Rastejante', guardian: 'Colosso Maculado', ballista: 'Lançador de Ruína' } as Record<string, string>)[kind],
    hp: Math.round(d.hp * (kind === 'warrior' ? .94 : 1)),
    speed: d.speed * (kind === 'scout' ? 1.06 : 1),
  }])) as Record<UnitKind, UnitDef>,
};

export const BUILDING_DEFS: Record<BuildingKind, BuildingDef> = {
  tower: { kind: 'tower', name: 'Torre de Sementes', cost: 85, hp: 310, buildTime: 4, range: 185, symbol: '♝' },
  barrier: { kind: 'barrier', name: 'Barreira de Raízes', cost: 52, hp: 620, buildTime: 3, range: 0, symbol: '▰' },
  grove: { kind: 'grove', name: 'Bosque Curativo', cost: 95, hp: 280, buildTime: 5, range: 125, symbol: '✤' },
};

export const unitKinds = Object.keys(base) as UnitKind[];
export const buildingKinds = Object.keys(BUILDING_DEFS) as BuildingKind[];

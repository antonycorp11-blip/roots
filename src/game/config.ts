export const CFG = {
  cols: 28,
  rows: 72,
  tile: 40,
  maxUnits: 60,
  startingCoins: 90,
  coinPerTile: 0.06,
  prepPoints: 24,
  captureSeconds: 1.8,
  aiTick: 0.7,
  simStep: 1 / 30,
  minZoom: 0.62,
  maxZoom: 1.65,
  victoryShare: 0.70,
  victoryHold: 15,
  coreHp: 1500,
  reinforceEntryRows: 6,
  initialRows: 9,
  maxParticles: 260,
} as const;

export const WORLD_W = CFG.cols * CFG.tile;
export const WORLD_H = CFG.rows * CFG.tile;

export const COLORS = {
  nature: '#78b65b',
  natureLight: '#b8e67e',
  natureDark: '#254a31',
  corruption: '#8454a9',
  corruptionLight: '#ce82ea',
  corruptionDark: '#291d36',
  neutral: '#665d4a',
  neutralDark: '#342f27',
} as const;

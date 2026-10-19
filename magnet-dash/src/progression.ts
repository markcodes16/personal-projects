import type { PlayerData } from './storage';

export const FINISHES = [
  { id: 'factory', name: 'Factory Mint', energy: 0, body: '#e7efdc', trail: '#caff94' },
  { id: 'copper', name: 'Copper Scout', energy: 60, body: '#f8cba1', trail: '#ffc17d' },
  { id: 'ion', name: 'Ion Runner', energy: 180, body: '#b5eaff', trail: '#79dfff' },
  { id: 'orchid', name: 'Orchid Drift', energy: 400, body: '#dfcaff', trail: '#c7a3ff' },
] as const;
export function finishFor(player: Pick<PlayerData, 'skin' | 'totalCoins'>) {
  return FINISHES.find(finish => finish.id === player.skin && player.totalCoins >= finish.energy) ?? FINISHES[0];
}
export function missions(player: PlayerData) {
  const next = (value: number, step: number) => (Math.floor(value / step) + 1) * step;
  return [
    { id: 'energy', title: 'Collect energy', value: player.totalCoins, target: next(player.totalCoins, 60), unit: 'collected across runs' },
    { id: 'perfect', title: 'Land perfect passes', value: player.totalPerfects, target: next(player.totalPerfects, 6), unit: 'clean, controlled crossings' },
    { id: 'bonus', title: 'Explore bonus routes', value: player.totalRisky, target: next(player.totalRisky, 3), unit: 'optional upper passages' },
  ];
}

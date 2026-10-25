import './styles.css';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const minimap = document.querySelector<HTMLCanvasElement>('#minimap');
if (!canvas || !minimap) throw new Error('Canvas não encontrado');

const game = new Game(canvas, minimap);
game.start();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

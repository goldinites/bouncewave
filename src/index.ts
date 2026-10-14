import '@/styles/main.css';
import { Game } from '@/core/Game';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas element #c not found');
  }

  const game = new Game(canvas);
  game.init();
});

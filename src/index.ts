import '@/styles/main.css';
import { Game } from '@/core/Game';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('c') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas element #c not found');
  }

  const game = new Game(canvas);
  game.init();
});

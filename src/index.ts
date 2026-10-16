import '@/styles/main.css';
import { Game } from '@/app/Game';
import { dismissBootScreen } from '@/ui/BootScreen';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas element #gameCanvas not found');
  }

  const game = new Game(canvas);
  game.init();
  dismissBootScreen();
});

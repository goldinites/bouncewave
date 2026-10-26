import '@/styles/main.css';
import { boot } from '@/app/boot';
import { Game } from '@/app/Game';
import { dismissBootScreen } from '@/ui/BootScreen';

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas element #gameCanvas not found');
  }

  // The loader stays up until what the game needs first is in
  const { profile } = await boot();
  const game = new Game(canvas, profile);
  game.init();
  dismissBootScreen();
});

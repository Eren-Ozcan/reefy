import './style.css';
import { audio } from './audio';
import { Game } from './game';
import { UI } from './ui';

const menu = document.getElementById('menu')!;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
let started = false;

playBtn.addEventListener('click', () => {
  if (started) return;
  started = true;
  playBtn.disabled = true;

  audio.ensure();
  audio.click();

  void (async () => {
    const game = new Game();
    const ui = new UI(game);
    game.ui = ui;

    audio.music = game.save.music;
    audio.sfx = game.save.sfx;

    await game.init(document.getElementById('canvas-wrap')!);
    ui.mount(document.getElementById('ui')!);

    menu.classList.add('hidden');
    audio.startAmbient();
  })();
});

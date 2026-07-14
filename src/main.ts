import './style.css';
import { audio } from './audio';
import { Game } from './game';
import { UI } from './ui';
import { APP_VERSION } from './version';

const menu = document.getElementById('menu')!;
const foot = document.querySelector('.menu-foot');
if (foot) foot.textContent = `v${APP_VERSION} • reefy.games`;
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

    // Test/geliştirme kancası: e2e testi oyun durumuna buradan erişir.
    // Yalnızca dev sunucusunda etkin — prod/iOS derlemesinde tree-shake ile silinir,
    // böylece herkese açık build'de tüm oyun state'i/API'si console'a sızmaz.
    if (import.meta.env.DEV) {
      (window as unknown as { __reefyGame?: Game }).__reefyGame = game;
    }

    menu.classList.add('hidden');
    audio.startAmbient();
  })();
});

import './fonts.css';
import './style.css';
import { audio } from './audio';
import { Game } from './game';
import { UI } from './ui';
import { APP_VERSION } from './version';
import { getLang, initLang, t } from './i18n';

const menu = document.getElementById('menu')!;
const foot = document.querySelector('.menu-foot');
if (foot) foot.textContent = `v${APP_VERSION} • reefy.games`;
// The public web demo runs entirely in this browser: no cloud save, no
// account, no ads and no purchases (see isFirebaseConfigured in
// firebase-config.ts). Saying so on the menu keeps the missing Settings rows
// from reading as breakage.
if (import.meta.env.VITE_DEMO === '1' && foot) {
  const note = document.createElement('p');
  note.className = 'menu-foot menu-demo-note';
  note.textContent = t('Web demo — progress is saved in this browser only.');
  foot.after(note);
}
document.documentElement.lang = getLang();
const tagline = document.querySelector('.tagline');
if (tagline) {
  tagline.innerHTML = t('Build your own reef, grow your fish,\ncomplete your collection').replace('\n', '<br/>');
}
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
if (playBtn) playBtn.innerHTML = `▶&nbsp; ${t('Play')}`;
let started = false;
/**
 * The UI that the back button talks to. Stays null until mount() is called —
 * handleBack relies on panel/toast nodes, which are only wired up at mount.
 */
let mountedUI: UI | null = null;

/**
 * Wires the Android back button to in-game navigation.
 *
 * Unless a listener is REGISTERED, Capacitor turns the back button directly
 * into "close the app" — even while the player is in the middle of a panel.
 * On the entry menu, back exits directly like in any app; while in-game, the
 * decision is made by UI.handleBack().
 *
 * If the plugin is absent (running in the browser) the import fails and is
 * silently ignored — the "no-op if plugin absent" idiom used elsewhere in
 * the codebase.
 */
void import('@capacitor/app')
  .then(({ App: CapApp }) => {
    void CapApp.addListener('backButton', () => {
      if (mountedUI === null || mountedUI.handleBack()) void CapApp.exitApp();
    });
  })
  .catch(() => {
    /* there's no such thing as a back button in the browser */
  });

playBtn.addEventListener('click', () => {
  if (started) return;
  started = true;
  playBtn.disabled = true;

  audio.ensure();
  audio.click();

  void (async () => {
    const game = new Game();
    initLang(game.save.lang, game.save.langChosen);
    const ui = new UI(game);
    game.ui = ui;

    audio.music = game.save.music;
    audio.sfx = game.save.sfx;

    await game.init(document.getElementById('canvas-wrap')!);
    // A cloud sync may have resolved inside game.init()'s CLOUD_STARTUP_GRACE_MS
    // window; sync() mutates `save` IN PLACE (see cloud-save.ts), so the
    // lang/music/sfx read above may now be stale — reapply with the real
    // final value now that init() is done.
    initLang(game.save.lang, game.save.langChosen);
    audio.music = game.save.music;
    audio.sfx = game.save.sfx;
    ui.mount(document.getElementById('ui')!);
    mountedUI = ui;

    // Test/dev hook: e2e tests access game state through this.
    // Only active on the dev server — stripped by tree-shaking in prod/iOS builds,
    // so the whole game state/API doesn't leak into the console on public builds.
    if (import.meta.env.DEV) {
      (window as unknown as { __reefyGame?: Game }).__reefyGame = game;
    }

    menu.classList.add('hidden');
    audio.startAmbient();
  })();
});

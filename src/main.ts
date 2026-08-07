import './style.css';
import { audio } from './audio';
import { Game } from './game';
import { UI } from './ui';
import { APP_VERSION } from './version';
import { getLang, initLang, t } from './i18n';

const menu = document.getElementById('menu')!;
const foot = document.querySelector('.menu-foot');
if (foot) foot.textContent = `v${APP_VERSION} • reefy.games`;
document.documentElement.lang = getLang();
const tagline = document.querySelector('.tagline');
if (tagline) {
  tagline.innerHTML = t('Kendi resifini kur, balıklarını büyüt,\nkoleksiyonunu tamamla').replace('\n', '<br/>');
}
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
if (playBtn) playBtn.innerHTML = `▶&nbsp; ${t('Oyna')}`;
let started = false;
/**
 * Geri tuşunun konuşacağı UI. mount() çağrılana kadar null kalır — handleBack
 * panel/toast düğümlerine dayanır ve onlar ancak mount'ta bağlanır.
 */
let mountedUI: UI | null = null;

/**
 * Android geri tuşunu oyun içi gezinmeye bağlar.
 *
 * Bir dinleyici KAYDEDİLMEDİĞİ sürece Capacitor geri tuşunu doğrudan
 * "uygulamayı kapat"a çevirir — oyuncu bir panelin ortasındayken bile.
 * Giriş menüsündeyken geri, her uygulamada olduğu gibi doğrudan çıkar;
 * oyun içindeyken kararı UI.handleBack() verir.
 *
 * Eklenti yoksa (tarayıcıda çalışırken) import başarısız olur ve sessizce
 * geçilir — kod tabanının geri kalanındaki "eklenti yoksa no-op" deyimi.
 */
void import('@capacitor/app')
  .then(({ App: CapApp }) => {
    void CapApp.addListener('backButton', () => {
      if (mountedUI === null || mountedUI.handleBack()) void CapApp.exitApp();
    });
  })
  .catch(() => {
    /* tarayıcıda geri tuşu diye bir şey yok */
  });

playBtn.addEventListener('click', () => {
  if (started) return;
  started = true;
  playBtn.disabled = true;

  audio.ensure();
  audio.click();

  void (async () => {
    const game = new Game();
    initLang(game.save.lang);
    const ui = new UI(game);
    game.ui = ui;

    audio.music = game.save.music;
    audio.sfx = game.save.sfx;

    await game.init(document.getElementById('canvas-wrap')!);
    ui.mount(document.getElementById('ui')!);
    mountedUI = ui;

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

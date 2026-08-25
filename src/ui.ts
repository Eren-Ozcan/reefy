import { AD_TEST_DEVICE_TAGS } from './ads';
import { audio } from './audio';
import { APP_VERSION } from './version';
import { DECOR, DECOR_BOOST, DecorDef, MAX_PLACED, decorById } from './decor';
import type { Fish } from './fish';
import { SAD_THRESHOLD } from './fish';
import { INCOME_CAP_HOURS, type FishEarning, type Game } from './game';
import { ACHIEVEMENTS } from './quests';
import { EggTier, PITY_LIMIT, RARITY_INCOME, RARITY_INFO, Rarity, SPECIES, Species, speciesById } from './species';
import { FEEDS, FEED_PACKS, FeedDef, feedById } from './feeds';
import { TANK_CAP_BONUS, TankDef } from './tanks';
import { biomeIcon } from './biome-icons';
import { AVAILABLE_LANGS, LANG_LABELS, Lang, getLang, setLang, storedStoreCurrency, t as tt } from './i18n';
import {
  ICON_ARRANGE, ICON_BAG, ICON_CLEAN, ICON_COIN, ICON_EGG, ICON_FEED, ICON_MENU, ICON_PEARL,
  ICON_QUEST, ICON_SHOP, ICON_TANK, ICON_TROPHY, ICON_YOU,
} from './icons';
import { isAccountLinkingAvailable, isLinked, linkedLabel, linkWithGoogle } from './firebase-app';
import { isPlayLeaderboardAvailable, showPlayLeaderboard } from './services';
import type { FishSave } from './save';

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export function fmt(n: number): string {
  // If the threshold check ran BEFORE rounding, values in 999_950-999_999
  // would hit the k-branch where (n/1000).toFixed(1) gives "1000.0" ->
  // "1000k"; the M threshold is checked against the rounded value (999_950).
  if (n >= 999_950) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

/** Remaining wait as a countdown: `3s 12m` reads worse than `3h 12m`, so the
 *  unit pair shown always starts at the largest non-zero unit. */
function fmtLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}${tt('h')} ${m}${tt('m')}`;
  if (m > 0) return `${m}${tt('m')} ${sec}${tt('s')}`;
  return `${sec}${tt('s')}`;
}

/** External text like a friend name from Firestore must be escaped before being inserted
 * into innerHTML — firestore.rules doesn't restrict name content, only checks type/length. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Produces a deterministic -1..1 offset from the species id (matches idJitter in fish.ts). */
function idJitter(id: string, salt: number): number {
  let h = 0;
  const s = id + ':' + salt;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 2001) / 1000 - 1;
}

const TAIL_PIVOT_X = -48;

/** SVG path 'd' data for the tail shape (matches drawTail in fish.ts). */
function tailPathD(H: number, FS: number, shape: Species['tailShape']): string {
  const ext = 34 * FS;
  const px = TAIL_PIVOT_X;
  switch (shape) {
    case 'forked': {
      const notch = ext * 0.35;
      return `M ${px} 0 L ${px - ext} ${-H * 0.55 * FS} L ${px - ext + notch} ${-H * 0.1 * FS} L ${px - ext} 0 L ${px - ext + notch} ${H * 0.1 * FS} L ${px - ext} ${H * 0.55 * FS} Z`;
    }
    case 'lunate':
      return `M ${px} 0 Q ${px - ext * 0.55} ${-H * 0.3 * FS} ${px - ext * 1.15} ${-H * 0.62 * FS} Q ${px - ext * 0.62} ${-H * 0.14 * FS} ${px - ext * 0.5} 0 Q ${px - ext * 0.62} ${H * 0.14 * FS} ${px - ext * 1.15} ${H * 0.62 * FS} Q ${px - ext * 0.55} ${H * 0.3 * FS} ${px} 0 Z`;
    case 'round':
      return `M ${px} ${-H * 0.03} Q ${px - ext * 1.1} ${-H * 0.55 * FS} ${px - ext * 0.6} 0 Q ${px - ext * 1.1} ${H * 0.55 * FS} ${px} ${H * 0.03} Z`;
    case 'lyre':
      return `M ${px} 0 Q ${px - ext * 0.5} ${-H * 0.2 * FS} ${px - ext * 1.5} ${-H * 0.7 * FS} Q ${px - ext * 0.85} ${-H * 0.12 * FS} ${px - ext * 0.3} 0 Q ${px - ext * 0.85} ${H * 0.12 * FS} ${px - ext * 1.5} ${H * 0.7 * FS} Q ${px - ext * 0.5} ${H * 0.2 * FS} ${px} 0 Z`;
    case 'ribbon':
      return `M ${px} ${-H * 0.08} L ${px - ext * 1.8} ${-H * 0.09} L ${px - ext * 1.95} 0 L ${px - ext * 1.8} ${H * 0.09} L ${px} ${H * 0.08} Z`;
    default: // 'lens'
      return `M ${px} 0 L ${px - ext} ${-H * 0.45 * FS} Q ${px - ext * 0.6} 0 ${px - ext} ${H * 0.45 * FS} Z`;
  }
}

/** SVG path 'd' data for the dorsal fin shape (matches dorsalStyle in fish.ts). */
function dorsalPathD(H: number, FS: number, style: Species['dorsalStyle']): string {
  switch (style) {
    case 'flowing':
      return `M -22 ${-H / 2 + 2} Q -2 ${-H / 2 - H * 0.55 * FS} 18 ${-H / 2 - H * 0.78 * FS} Q 30 ${-H / 2 - H * 0.3 * FS} 26 ${-H / 2 + 2} Z`;
    case 'sail':
      return `M -26 ${-H / 2 + 2} L 0 ${-H / 2 - H * 0.85 * FS} L 30 ${-H / 2 + 2} Z`;
    default: // 'triangle'
      return `M -15 ${-H / 2 + 2} L 5 ${-H / 2 - H * 0.45 * FS} L 22 ${-H / 2 + 2} Z`;
  }
}

/** SVG element for the snout/forehead protrusion (matches snout in fish.ts). */
function snoutSVG(H: number, snout: Species['snout'], color: string): string {
  switch (snout) {
    case 'long':
      return `<path d="M 42 ${-H * 0.05} L 66 ${-H * 0.02} L 42 ${H * 0.09} Z" fill="${color}"/>`;
    case 'hump':
      return `<circle cx="20" cy="${-H * 0.44}" r="10" fill="${color}"/>`;
    case 'blunt':
      return `<rect x="40" y="${-H * 0.14}" width="10" height="${H * 0.28}" rx="3" fill="${color}"/>`;
    default:
      return '';
  }
}

/** Mini SVG preview for a species (shop/collection cards). */
export function fishSVG(sp: Species, size = 84, silhouette = false): string {
  const c = silhouette
    ? { body: '#a9b8c2', belly: '#c3cfd8', fin: '#93a5b1', accent: '#c3cfd8' }
    : { body: hex(sp.colors.body), belly: hex(sp.colors.belly), fin: hex(sp.colors.fin), accent: hex(sp.colors.accent) };
  const jTail = 1 + 0.09 * idJitter(sp.id, 1);
  const jDorsal = 1 + 0.14 * idJitter(sp.id, 2);
  const jEye = 1 + 0.09 * idJitter(sp.id, 3);
  const jDetail = 1 + 0.08 * idJitter(sp.id, 5);
  const H = 100 * ((sp.bodyH ?? 0.48) + 0.025 * idJitter(sp.id, 4));
  const FS = sp.finScale ?? 1;
  let pattern = '';
  if (!silhouette) {
    switch (sp.pattern) {
      case 'stripes':
        pattern = [-22, 0, 22].map((x) => `<rect x="${x - 5.5}" y="${-H / 2}" width="11" height="${H}" fill="${c.accent}"/>`).join('');
        break;
      case 'hstripe':
        pattern = `<rect x="-50" y="${-H * 0.12}" width="100" height="${H * 0.16}" fill="${c.accent}"/>`;
        break;
      case 'spots':
        pattern = [[-18, -6, 5], [4, 8, 4], [16, -8, 4.5], [-4, -12, 3.5], [22, 6, 3.5], [-26, 8, 4]]
          .map(([x, y, r]) => `<circle cx="${x}" cy="${y * (H / 48)}" r="${r}" fill="${c.accent}"/>`).join('');
        break;
      case 'gradient':
        pattern = `<rect x="-5" y="${-H / 2}" width="55" height="${H}" fill="${c.accent}"/>`;
        break;
    }
  }
  const glow = !silhouette && (sp.rarity === 'epic' || sp.rarity === 'legendary')
    ? `<circle cx="0" cy="0" r="66" fill="${hex(RARITY_INFO[sp.rarity].glow)}" opacity="0.35"/>`
    : '';
  const uid = sp.id + (silhouette ? '-s' : '') + '-' + size;
  const snout = snoutSVG(H, sp.snout, c.body);
  return `<svg viewBox="-105 -70 210 140" width="${size}" height="${(size * 140) / 210}" xmlns="http://www.w3.org/2000/svg">
    ${glow}
    <path d="${tailPathD(H, FS * jTail, sp.tailShape)}" fill="${c.fin}"/>
    <path d="${dorsalPathD(H, FS * jDorsal, sp.dorsalStyle)}" fill="${c.fin}" opacity="0.95"/>
    <clipPath id="b-${uid}"><ellipse cx="0" cy="0" rx="50" ry="${H / 2}"/></clipPath>
    <ellipse cx="0" cy="0" rx="50" ry="${H / 2}" fill="${c.body}"/>
    ${snout}
    <g clip-path="url(#b-${uid})">
      <ellipse cx="2" cy="${H * 0.16}" rx="${40 * jDetail}" ry="${H * 0.32}" fill="${c.belly}"/>
      ${pattern}
    </g>
    <circle cx="30" cy="${-H * 0.08}" r="${5.2 * jEye}" fill="${silhouette ? '#e6edf2' : '#ffffff'}"/>
    <circle cx="31.5" cy="${-H * 0.08}" r="${2.6 * jEye}" fill="${silhouette ? '#8a99a5' : '#26262e'}"/>
  </svg>`;
}

/** Mini SVG preview for a decor item. */
export function decorSVG(d: DecorDef, size = 64): string {
  const c1 = hex(d.color), c2 = hex(d.color2);
  let body = '';
  switch (d.kind) {
    case 'kelp':
      body = `<path d="M 0 30 Q -8 10 0 -8 Q 8 -22 2 -32" stroke="${c1}" stroke-width="6" fill="none" stroke-linecap="round"/>
              <ellipse cx="-7" cy="8" rx="8" ry="4" fill="${c2}"/><ellipse cx="7" cy="-10" rx="8" ry="4" fill="${c2}"/>`;
      break;
    case 'sword':
      body = `<path d="M 0 30 Q -14 6 -12 -22 Q -4 4 0 30" fill="${c1}"/>
              <path d="M 0 30 Q 0 -4 0 -30 Q 6 0 0 30" fill="${c2}"/>
              <path d="M 0 30 Q 14 8 12 -18 Q 4 6 0 30" fill="${c1}"/>`;
      break;
    case 'coral-mound':
      body = `<circle cx="-14" cy="18" r="12" fill="${c1}"/><circle cx="0" cy="10" r="14" fill="${c2}"/><circle cx="15" cy="18" r="11" fill="${c1}"/>`;
      break;
    case 'tube-coral':
      body = `<rect x="-16" y="-6" width="8" height="36" rx="4" fill="${c1}"/><rect x="-4" y="-18" width="8" height="48" rx="4" fill="${c1}"/><rect x="8" y="-2" width="8" height="32" rx="4" fill="${c1}"/>
              <circle cx="-12" cy="-6" r="5" fill="${c2}"/><circle cx="0" cy="-18" r="5" fill="${c2}"/><circle cx="12" cy="-2" r="5" fill="${c2}"/>`;
      break;
    case 'fan-coral':
      body = [-3, -2, -1, 0, 1, 2, 3].map((i) =>
        `<line x1="0" y1="28" x2="${i * 11}" y2="${-20 + Math.abs(i) * 6}" stroke="${i % 2 === 0 ? c1 : c2}" stroke-width="3.4" stroke-linecap="round"/>`).join('');
      break;
    case 'anemone':
      body = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((i) =>
        `<line x1="0" y1="22" x2="${i * 7}" y2="${-16 + Math.abs(i) * 4}" stroke="${i % 2 === 0 ? c1 : c2}" stroke-width="4.5" stroke-linecap="round"/>`).join('') +
        `<ellipse cx="0" cy="24" rx="15" ry="7" fill="${c1}"/>`;
      break;
    case 'rock':
      body = `<ellipse cx="0" cy="16" rx="24" ry="15" fill="${c1}"/><ellipse cx="-9" cy="4" rx="13" ry="8" fill="${c2}"/>`;
      break;
    case 'arch':
      body = `<path d="M -24 30 Q 0 -34 24 30" stroke="${c1}" stroke-width="12" fill="none" stroke-linecap="round"/><circle cx="-22" cy="24" r="6" fill="${c2}"/>`;
      break;
    case 'shell':
      body = `<path d="M -18 26 Q 0 -18 18 26 Z" fill="${c1}"/>` +
        [-2, -1, 0, 1, 2].map((i) => `<line x1="0" y1="24" x2="${i * 7}" y2="-4" stroke="${c2}" stroke-width="1.6"/>`).join('');
      break;
    case 'starfish':
      body = [0, 1, 2, 3, 4].map((i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        return `<line x1="0" y1="6" x2="${Math.cos(a) * 20}" y2="${6 + Math.sin(a) * 20}" stroke="${c1}" stroke-width="8" stroke-linecap="round"/>`;
      }).join('') + `<circle cx="0" cy="6" r="7" fill="${c2}"/>`;
      break;
    case 'chest':
      body = `<rect x="-20" y="0" width="40" height="24" rx="4" fill="${c1}"/><rect x="-22" y="-10" width="44" height="13" rx="6" fill="${c1}"/><rect x="-3" y="-2" width="6" height="10" fill="${c2}"/>`;
      break;
    case 'wreck':
      body = `<path d="M -26 26 Q 0 4 26 18 L 22 26 Z" fill="${c1}"/><rect x="-3" y="-24" width="4" height="34" fill="${c2}"/><path d="M 1 -24 L 20 -10 L 1 -4 Z" fill="${c2}" opacity="0.75"/>`;
      break;
    case 'column':
      body = `<rect x="-8" y="-20" width="16" height="48" fill="${c1}"/><rect x="-13" y="-27" width="26" height="8" fill="${c2}"/><rect x="-13" y="24" width="26" height="6" fill="${c2}"/>`;
      break;
    case 'statue':
      body = `<rect x="-14" y="22" width="28" height="7" rx="2" fill="${c2}"/><path d="M -8 22 Q -10 -8 0 -14 Q 10 -8 8 22 Z" fill="${c1}"/><circle cx="0" cy="-20" r="8" fill="${c1}"/>`;
      break;
    case 'castle':
      body = `<rect x="-18" y="-2" width="36" height="30" fill="${c1}"/><rect x="-26" y="-14" width="12" height="42" fill="${c2}"/><rect x="14" y="-14" width="12" height="42" fill="${c2}"/>
              <path d="M -26 -14 L -20 -26 L -14 -14 Z" fill="${c1}"/><path d="M 14 -14 L 20 -26 L 26 -14 Z" fill="${c1}"/><rect x="-5" y="12" width="10" height="16" rx="5" fill="${c2}"/>`;
      break;
    case 'skull':
      body = `<ellipse cx="0" cy="2" rx="20" ry="17" fill="${c1}"/><rect x="-10" y="13" width="20" height="9" fill="${c1}"/>
              <ellipse cx="-8" cy="0" rx="5" ry="6" fill="#2e3440"/><ellipse cx="8" cy="0" rx="5" ry="6" fill="#2e3440"/><path d="M -3 8 L 0 14 L 3 8 Z" fill="#2e3440"/>`;
      break;
    case 'amphora':
      body = `<path d="M -4 -20 Q -18 -8 -9 26 L 9 26 Q 18 -8 4 -20 Z" fill="${c1}"/><rect x="-6" y="-26" width="12" height="7" fill="${c2}"/>`;
      break;
    case 'lamp':
      body = `<rect x="-2.5" y="-14" width="5" height="42" fill="${c1}"/><circle cx="0" cy="-20" r="9" fill="${c2}"/><path d="M 0 -20 L -20 28 L 20 28 Z" fill="${c2}" opacity="0.25"/>`;
      break;
    case 'bubbler':
      body = `<ellipse cx="0" cy="22" rx="14" ry="8" fill="${c1}"/><circle cx="-3" cy="6" r="3" fill="none" stroke="${c2}" stroke-width="1.5"/><circle cx="4" cy="-6" r="4" fill="none" stroke="${c2}" stroke-width="1.5"/><circle cx="-2" cy="-18" r="5" fill="none" stroke="${c2}" stroke-width="1.5"/>`;
      break;
    case 'sign':
      body = `<rect x="-2" y="-8" width="4" height="36" fill="${c1}"/><rect x="-22" y="-22" width="44" height="17" rx="4" fill="${c2}"/><line x1="-14" y1="-13" x2="14" y2="-13" stroke="${c1}" stroke-width="2"/>`;
      break;
  }
  return `<svg viewBox="-36 -36 72 72" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><g transform="scale(${d.scale})">${body}</g></svg>`;
}

function rarityChip(r: Rarity): string {
  const info = RARITY_INFO[r];
  return `<span class="chip" style="background:${info.color}">${tt(info.name)}</span>`;
}

function tankSwatch(t: TankDef): string {
  return `<div class="tank-swatch" style="background:linear-gradient(180deg, ${hex(t.water[0])}, ${hex(t.water[1])} 55%, ${hex(t.water[2])}); border-bottom: 8px solid ${hex(t.sand)}"></div>`;
}

export class UI {
  private game: Game;
  private root!: HTMLElement;
  private hudCoins!: HTMLElement;
  private hudPearls!: HTMLElement;
  private hudLevel!: HTMLElement;
  private hudRing!: HTMLElement;
  private hudTank!: HTMLElement;
  private hudStreak!: HTMLElement;
  private panelHost!: HTMLElement;
  private toastHost!: HTMLElement;
  private fishInfoTimer: number | null = null;
  private friendScoresCache: Record<string, number> = {};
  /**
   * Until when (epoch ms) the "press again to exit" warning is valid when the
   * back button is pressed on the aquarium screen. See handleBack.
   */
  private exitArmedUntil = 0;
  private lastGoalReward = '';
  /** Whether shop prices have already been fetched once (see renderShop 'pearls' branch) */
  private pricesLoaded = false;

  constructor(game: Game) {
    this.game = game;
  }

  mount(root: HTMLElement): void {
    this.root = root;
    root.innerHTML = `
      <div id="topbar">
      <div id="hud">
        <div class="hud-chip"><b id="hud-coins"></b>${ICON_COIN}</div>
        <div class="hud-chip"><b id="hud-pearls"></b>${ICON_PEARL}</div>
        <div class="hud-chip hud-tank" id="hud-tank" title="${tt('Switch tank')}"></div>
        <div class="hud-chip hud-streak hidden" id="hud-streak"></div>
        <div class="hud-ring" id="hud-ring"><b id="hud-level"></b></div>
      </div>
      <div id="carebar">
        <button data-care="feed">${ICON_FEED}<span>${tt('Feed')}</span><small></small></button>
        <button data-care="clean" class="care-round" id="clean-chip">
          <span class="clean-ring"><span class="clean-face">${ICON_CLEAN}</span></span>
          <span>${tt('Clean')}</span>
        </button>
        <button data-care="arrange">${ICON_ARRANGE}<span>${tt('Arrange')}</span><small></small></button>
        <button data-care="eggs" class="hidden">${ICON_EGG}<span>${tt('Eggs')}</span><small></small></button>
        <button data-care="collect" id="collect-btn" class="care-collect">
          <span>${tt('COLLECT')}</span><small></small>
        </button>
      </div>
      </div>
      <div id="bottombar">
        <div id="next-goal" class="hidden" role="button" tabindex="0">
          <div class="goal-main">
            <span class="goal-text"></span>
            <div class="goal-bar"><div></div></div>
          </div>
          <span class="goal-reward"></span>
        </div>
        <div class="dock-tabs">
          <button data-act="aquarium">${ICON_TANK}<span>${tt('Aquarium')}</span><small></small></button>
          <button data-act="shop">${ICON_SHOP}<span>${tt('Shop')}</span><small></small></button>
          <button data-act="inventory">${ICON_BAG}<span>${tt('Inventory')}</span><small></small></button>
          <button data-act="quests">${ICON_QUEST}<span>${tt('Quests')}</span><small></small></button>
          <button data-act="you">${ICON_YOU}<span>${tt('You')}</span><small></small></button>
        </div>
      </div>
      <div id="feed-pop" class="hidden"></div>
      <div id="mode-chip" class="hidden"><span id="mode-label"></span><button id="mode-done">${tt('Done ✓')}</button></div>
      <div id="panel-host"></div>
      <div id="toasts"></div>
    `;
    this.hudCoins = root.querySelector('#hud-coins')!;
    this.hudPearls = root.querySelector('#hud-pearls')!;
    this.hudLevel = root.querySelector('#hud-level')!;
    this.hudRing = root.querySelector('#hud-ring')!;
    this.hudTank = root.querySelector('#hud-tank')!;
    this.hudStreak = root.querySelector('#hud-streak')!;
    this.panelHost = root.querySelector('#panel-host')!;
    this.toastHost = root.querySelector('#toasts')!;

    root.querySelectorAll<HTMLButtonElement>('#bottombar button').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        const act = btn.dataset.act!;
        if (act === 'aquarium') { this.dismissPanel(); return; }
        this.setActiveTab(act);
        if (act === 'shop') this.renderShop('fish');
        else if (act === 'inventory') this.renderInventory('fish');
        else if (act === 'quests') this.renderQuests();
        else this.renderYou();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('#carebar button').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        switch (btn.dataset.care) {
          case 'feed': this.toggleFeedPop(); break;
          case 'arrange': this.startEditMode(); break;
          case 'eggs': this.renderShop('eggs'); break;
          case 'collect': this.toast(this.game.collectIncome().msg); break;
          // Cleaning has no mode of its own — the glass is scrubbed by tapping the
          // dirt itself, which is the whole point of the interaction. So the chip
          // reports the state and says where to tap rather than pretending to be
          // a button that does the cleaning.
          case 'clean': this.toast(this.game.dirtPct(this.game.save.activeTank) > 0
            ? tt('Tap the dirt on the glass to scrub it off.')
            : tt('The glass is spotless. ✨')); break;
        }
      });
    });

    // The strip already says "Ready" — so it has to be the thing you press. Sending
    // the player into the Quests panel to claim a reward the main screen is
    // announcing is a dead end dressed up as a status line.
    root.querySelector('#next-goal')!.addEventListener('click', () => {
      audio.click();
      const id = this.goalQuestId;
      const goal = this.game.nextGoal();
      if (!id || !goal || goal.progress < goal.target) { this.setActiveTab('quests'); this.renderQuests(); return; }
      const res = this.game.claimQuestById(id);
      this.toast(res.msg);
      if (!res.ok) audio.error();
      this.refreshHUD();
    });

    root.querySelector('#mode-done')!.addEventListener('click', () => {
      this.exitModes();
      audio.click();
    });
    this.hudTank.addEventListener('click', () => {
      audio.click();
      this.renderInventory('tanks');
    });
    this.hudStreak.addEventListener('click', () => {
      audio.click();
      this.showStreak();
    });
    // The Aquarium IS a tab, and it is the one you start on: without this the dock
    // opened with nothing marked, so "where am I" was answered only after the
    // player had visited somewhere else and come back.
    this.setActiveTab('aquarium');
    this.syncBottomInset();
    window.addEventListener('resize', () => this.syncBottomInset());
    // The dock is not a fixed slab: the goal line inside it changes text, wraps,
    // and disappears entirely once every goal is done, and both the floor line and
    // the collect button are positioned from its height. Watching the element is
    // the only way to catch a resize the game itself did not trigger.
    if (typeof ResizeObserver !== 'undefined') {
      const bar = root.querySelector('#bottombar');
      if (bar) new ResizeObserver(() => this.syncBottomInset()).observe(bar);
    }

    this.refreshHUD();
    // Subscribe FIRST for late-arriving sync, then check: if the result lands
    // between these two lines, the subscription would miss it and the conflict would never show.
    this.game.onLateConflict = () => this.showCloudConflict();
    // A conflict takes priority over everything: if the player starts playing without
    // choosing which progress to continue with, the side they didn't choose could get overwritten.
    if (this.game.cloudSync === 'conflict') this.showCloudConflict();
    else {
      this.showWelcome();
      this.runTutorial();
    }
  }

  /** How far below the bottom bar's top edge the floor line is allowed to drop: only the
   *  base of decor stays behind the bar, the rest stays fully visible. Otherwise there's too much empty sand gap in between. */
  private static readonly FLOOR_OVERLAP = 28;

  /** Measures the height taken up by the bottom bar and reports it to the scene: the floor
   *  line is placed above it, so decor doesn't end up beneath the bar (or the mode chip that replaces it). */
  private syncBottomInset(): void {
    const bar = this.root.querySelector<HTMLElement>('#bottombar');
    if (!bar) return;
    // The bottom bar may be hidden while a mode is active; if the measurement can't be taken, the current inset is kept.
    const rect = bar.getBoundingClientRect();
    if (rect.height <= 0) return;
    this.game.setUiBottomInset(window.innerHeight - rect.top - UI.FLOOR_OVERLAP);
    // The collect button rides just above the dock, and the dock's height changes
    // with the goal line, so it is published rather than guessed at in CSS.
    this.root.style.setProperty('--dock-h', `${Math.round(window.innerHeight - rect.top)}px`);
    this.syncKeepOut();
  }

  /** Controls that stand ON the water, as opposed to the chrome above and below it. */
  private static readonly SCENE_CONTROLS = ['#topbar'];

  /** Padding added around each control, as a fraction of the scene — dirt drawn
   *  right up against a button's edge is still awkward to hit. */
  private static readonly KEEP_OUT_PAD = 0.02;

  /**
   * Tells the scene where its water is covered, so dirt is never spawned somewhere
   * it cannot be tapped. Measured from the laid-out DOM rather than declared as
   * constants: these elements move with safe-area insets, text length and language.
   */
  private syncKeepOut(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= 0 || h <= 0) return;
    const pad = UI.KEEP_OUT_PAD;
    const rects = UI.SCENE_CONTROLS.flatMap((sel) => {
      const el = this.root.querySelector<HTMLElement>(sel);
      if (!el) return [];
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return [];
      return [{
        x0: r.left / w - pad,
        y0: r.top / h - pad,
        x1: r.right / w + pad,
        y1: r.bottom / h + pad,
      }];
    });
    this.game.setUiKeepOut(rects);
  }

  refreshHUD(): void {
    const s = this.game.save;
    this.hudCoins.textContent = fmt(s.coins);
    this.hudPearls.textContent = fmt(s.pearls);
    this.hudLevel.textContent = String(s.level);
    this.hudRing.style.setProperty('--xp', String(Math.min(100, (100 * s.xp) / this.game.xpNeed(s.level))));
    this.hudRing.title = `${tt('Lv')} ${s.level}`;
    this.refreshStreakChip(s.streak);
    this.refreshCareBar();
    this.refreshDock();
    const activeTank = this.game.activeTank;
    const boost = Math.round((this.game.growthMult - 1) * 100);
    // The dirt figure moved to the care bar's own chip, where it sits beside the
    // action that answers it. Leaving it here as well would report one number twice.
    const boostBadge = boost !== 0 ? ` <b class="${boost > 0 ? 'boost' : 'boost-neg'}">${boost > 0 ? '+' : ''}${boost}%</b>` : '';
    // The name gets its own element because it is the only part of this chip that
    // may be cut: the row is held to the dock's width, and when the badge appears
    // the chip has to give the width back from somewhere. Cutting the badge
    // instead would hide the thing the chip just grew to show.
    this.hudTank.innerHTML = `${biomeIcon(activeTank.biome)}<span class="hud-tank-name">${tt(activeTank.name)}</span>${boostBadge}`;
  }

  /**
   * The care bar: the three things a tank asks of its owner, plus the egg that is
   * on its own clock. Each chip carries the state that decides whether it is worth
   * tapping, so the bar answers "does anything need me?" without opening anything.
   *
   * It replaced a vertical rail pinned to the right edge of the water, which put
   * two permanent buttons over the middle of the scene — the area feeding and
   * arranging both ask the player to tap.
   */
  private refreshCareBar(): void {
    const s = this.game.save;
    const hungry = this.game.fishes.filter((f) => f.isSad).length;
    const clean = 100 - this.game.dirtPct(s.activeTank);
    const placed = (s.decorPlaced[s.activeTank] ?? []).length;

    this.setCareChip('feed', hungry > 0 ? tt('{n} hungry', { n: hungry }) : tt('all fed'), hungry > 0);
    this.setCareChip('arrange', tt('{n} decor', { n: placed }), false);

    // Cleanliness is a ring rather than a number: it is the one care value that is
    // a proportion, and a full circle reads as "done" at a glance where "%71" has
    // to be compared against a maximum the player has to remember.
    const cleanBtn = this.root.querySelector<HTMLElement>('#clean-chip');
    if (cleanBtn) {
      cleanBtn.classList.toggle('urgent', clean < 100);
      cleanBtn.style.setProperty('--clean', String(clean));
      cleanBtn.title = tt('Glass {n}% clean', { n: clean });
    }

    // The egg chip exists only while something is incubating: an empty countdown
    // is a fourth chip that never has anything to say, and it would squeeze the
    // three that do on a narrow phone.
    const eggBtn = this.root.querySelector<HTMLElement>('#carebar button[data-care="eggs"]');
    const next = this.game.pendingEggs()[0];
    if (!eggBtn) return;
    eggBtn.classList.toggle('hidden', !next);
    if (!next) return;
    const ready = this.game.readyEggs();
    this.setCareChip('eggs', ready > 0 ? tt('{n} ready', { n: ready }) : UI.countdown(next.readyAt - Date.now()), ready > 0);
  }

  /** Writes one care chip's status line, and flags it when it wants attention. */
  private setCareChip(care: string, status: string, urgent: boolean): void {
    const btn = this.root.querySelector<HTMLElement>(`#carebar button[data-care="${care}"]`);
    if (!btn) return;
    btn.classList.toggle('urgent', urgent);
    const small = btn.querySelector('small');
    if (small) small.textContent = status;
  }

  /** m:ss for anything under an hour, h:mm above it — the egg chip is one line wide. */
  private static countdown(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  }

  /** The streak is already tracked and already scales the daily gift; this only makes it
   *  visible. Every 7th day pays 3 pearls instead of 1, so the day before is worth teasing. */
  private refreshStreakChip(streak: number): void {
    if (streak < 2) {
      this.hudStreak.classList.add('hidden');
      return;
    }
    this.hudStreak.classList.remove('hidden');
    // The tease is a pearl mark rather than the sentence it used to be. The
    // sentence was 90px of the 430px top row — more than the tank chip and the
    // level ring together — and it was the widest state the row had to be sized
    // against, which is what squeezed the tank name down to an ellipsis. The
    // pearl is what the seventh day actually pays, the chip opens the ladder
    // that spells it out, and the sentence survives as the chip's title.
    const teaseBigGift = streak % 7 === 6;
    this.hudStreak.classList.toggle('tease', teaseBigGift);
    this.hudStreak.title = teaseBigGift ? tt('big reward tomorrow') : tt('Daily streak');
    const tease = teaseBigGift ? ICON_PEARL : '';
    this.hudStreak.innerHTML = `${tt('{n}-day streak', { n: streak })}${tease}`;
  }

  private toggleFeedPop(): void {
    if (this.game.inputMode !== 'normal') { this.exitModes(); return; }
    const pop = this.root.querySelector('#feed-pop')!;
    if (pop.classList.contains('hidden')) { this.renderFeedPop(); pop.classList.remove('hidden'); }
    else pop.classList.add('hidden');
  }

  /** Redraws the feed picker with current stock. */
  private renderFeedPop(): void {
    const pop = this.root.querySelector<HTMLElement>('#feed-pop')!;
    const s = this.game.save;
    pop.innerHTML = FEEDS.map((f) => {
      const stock = s.feedOwned[f.id] ?? 0;
      const cost = f.cost === 0 ? tt('Free') : stock > 0 ? `🎒 ${tt('{n} in stock', { n: stock })}` : `🪙 ${tt('{cost} each', { cost: f.cost })}`;
      return `
        <button class="feed-opt" data-feed="${f.id}">
          <span class="feed-emoji">${f.emoji}</span>
          <span class="feed-info"><b>${tt(f.name)}</b><small>${tt(f.desc)}</small></span>
          <span class="feed-cost">${cost}</span>
        </button>`;
    }).join('');
    pop.querySelectorAll<HTMLButtonElement>('.feed-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = FEEDS.find((x) => x.id === btn.dataset.feed)!;
        this.game.setFeedType(f);
        pop.classList.add('hidden');
        this.showModeChip('');
        this.updateFeedChip(f);
        // Hint has been shown once: from now on only the feed name/stock stays in the bar.
        if (!this.game.save.feedHintSeen) {
          this.game.save.feedHintSeen = true;
          this.game.syncSave();
        }
        audio.click();
      });
    });
  }

  /** Updates the feed mode label with stock status (called every time stock is eaten from).
   *  The "tap the water to feed" hint is only added the first time feed mode is entered. */
  updateFeedChip(f: FeedDef): void {
    const s = this.game.save;
    const stock = s.feedOwned[f.id] ?? 0;
    const suffix = stock > 0
      ? ` — 🎒 ${tt('{stock} left', { stock })}`
      : s.feedHintSeen ? '' : ` — ${tt('feed by tapping the water')}`;
    this.root.querySelector('#mode-label')!.textContent = `${f.emoji} ${tt(f.name)}${suffix}`;
  }

  private showModeChip(label: string): void {
    this.root.querySelector('#mode-label')!.textContent = label;
    this.root.querySelector('#mode-chip')!.classList.remove('hidden');
    this.root.classList.add('mode-active'); // hide the bottom bar — so the floor is touchable
  }

  /** Exit feed/edit mode. */
  exitModes(): void {
    this.game.setFeedType(null);
    this.game.setEditMode(false);
    this.root.querySelector('#mode-chip')!.classList.add('hidden');
    this.root.querySelector('#feed-pop')!.classList.add('hidden');
    this.root.classList.remove('mode-active');
  }

  /** Called from the inventory: starts decor edit mode.
   *  Only a short label stays in the bar; the detailed hint is shown once as a toast on first entry
   *  (long text was growing the bar and covering the decor). */
  startEditMode(): void {
    this.closePanel();
    this.game.setEditMode(true);
    this.showModeChip(tt('🛠️ Drag decorations'));
    if (!this.game.save.editHintSeen) {
      this.game.save.editHintSeen = true;
      this.game.syncSave();
      this.toast(tt('🛠️ Drag a decoration to move it — the last one you drop comes to the front.'));
    }
  }

  /** Updates the passive income button (called ~2 times per second from the game loop). */
  updateIncome(pot: number, ratePerHour: number): void {
    if (!this.root) return;
    const btn = this.root.querySelector<HTMLElement>('#collect-btn');
    if (!btn) return;
    // Always present — it reads 0 even with no adult fish, so the player learns
    // where income lands before owning anything that produces it.
    btn.classList.toggle('empty', pot < 1);
    // Amount and rate share the cell's one status line: the rate used to hang off
    // the button as a tab, and a tab has nowhere to hang inside a care chip.
    btn.querySelector('small')!.textContent = `${fmt(pot)} · ${fmt(ratePerHour)}${tt('/hr')}`;
    // The egg chip counts seconds down, so it rides this tick rather than waiting
    // for the next HUD refresh, which only happens when something is spent.
    this.refreshCareBar();
    // This runs about twice a second from the game loop, which is the only tick that
    // reliably follows quest progress — questEvent() does not refresh the HUD.
    this.refreshDock();
  }

  /** Max number of toasts that stay on screen at once — excess drops the oldest. */
  private static readonly MAX_TOASTS = 3;

  toast(msg: string): void {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.toastHost.appendChild(t);
    // Prevent stacking: start closing the oldest toasts above the limit early.
    // Marked with .dismissed so ones already closing aren't counted.
    const live = this.toastHost.querySelectorAll<HTMLElement>('.toast:not(.dismissed)');
    for (let i = 0; i < live.length - UI.MAX_TOASTS; i++) this.dismissToast(live[i]);
    setTimeout(() => t.classList.add('show'), 20);
    setTimeout(() => this.dismissToast(t), 3400);
  }

  private dismissToast(el: HTMLElement): void {
    if (el.classList.contains('dismissed')) return;
    el.classList.add('dismissed');
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }

  /**
   * Android back button/gesture.
   *
   * This behavior didn't exist before: since the plugin that captures the back
   * button wasn't installed, pressing back in the middle of a panel (shop, inventory,
   * quests…) would exit the app entirely instead of closing the panel.
   *
   * If a panel is open, it just closes that — consistent with existing behavior,
   * since panels can already be closed via ✕ or tapping the backdrop. If there's no
   * panel, we're in the aquarium; requires pressing twice to prevent accidental exit.
   *
   * @returns true if the app should exit
   */
  handleBack(): boolean {
    if (this.panelHost.childElementCount > 0) {
      audio.click();
      this.dismissPanel();
      return false;
    }
    const now = Date.now();
    if (now < this.exitArmedUntil) return true;
    this.exitArmedUntil = now + 2000;
    this.toast(tt('Press back again to exit'));
    return false;
  }

  // ---------- panel scaffolding ----------

  private closePanel(): void {
    if (this.fishInfoTimer !== null) {
      clearInterval(this.fishInfoTimer);
      this.fishInfoTimer = null;
    }
    this.panelHost.innerHTML = '';
  }

  /** Closing back to the scene, as opposed to panelShell swapping one panel for the
   *  next: the dock has to follow the player back to the Aquarium tab. */
  private dismissPanel(): void {
    this.closePanel();
    this.setActiveTab('aquarium');
  }

  private setActiveTab(act: string): void {
    this.root.querySelectorAll<HTMLButtonElement>('#bottombar button').forEach((b) => {
      b.classList.toggle('active', b.dataset.act === act);
    });
  }

  /** Live status under each dock label, so a waiting reward or an affordable purchase
   *  is visible without opening the panel that holds it. */
  private refreshDock(): void {
    const s = this.game.save;
    const bag = Object.values(s.feedOwned ?? {}).reduce((n, q) => n + q, 0)
      + Object.values(s.decorOwned ?? {}).reduce((n, q) => n + q, 0);
    const ready = this.game.claimableQuests();
    const set = (act: string, text: string) => {
      const el = this.root.querySelector(`#bottombar button[data-act="${act}"] small`);
      if (el) el.textContent = text;
    };
    set('aquarium', `${this.game.fishes.length}/${this.game.capacity}`);
    const eggsReady = this.game.readyEggs();
    set('shop', eggsReady > 0
      ? tt('{n} egg ready', { n: eggsReady })
      : tt('{n} affordable', { n: this.game.affordableShopItems() }));
    set('inventory', bag > 0 ? tt('{n} items', { n: bag }) : '');
    set('quests', ready > 0 ? tt('{n} ready', { n: ready }) : '');
    set('you', `${tt('Lv')} ${s.level}`);
    const questBtn = this.root.querySelector('#bottombar button[data-act="quests"]');
    questBtn?.classList.toggle('has-badge', ready > 0);
    const shopBtn = this.root.querySelector('#bottombar button[data-act="shop"]');
    shopBtn?.classList.toggle('has-badge', eggsReady > 0);
    this.refreshNextGoal();
    this.tickHatching();
  }

  /** The quest the goal strip is currently showing, so a tap can claim it. */
  private goalQuestId: string | null = null;

  /** The strip above the dock. Its whole point is that the current objective and the
   *  bar filling toward it are visible without opening the Quests panel. */
  private refreshNextGoal(): void {
    const host = this.root.querySelector<HTMLElement>('#next-goal');
    if (!host) return;
    const goal = this.game.nextGoal();
    if (!goal) { host.classList.add('hidden'); this.goalQuestId = null; return; }
    host.classList.remove('hidden');
    this.goalQuestId = goal.id;
    const done = goal.progress >= goal.target;
    host.classList.toggle('ready', done);
    host.querySelector('.goal-text')!.textContent =
      `${done ? tt('Ready') : tt('Next up')}: ${tt(goal.name)} · ${goal.progress}/${goal.target}`;
    (host.querySelector('.goal-bar > div') as HTMLElement).style.width =
      `${Math.round((100 * goal.progress) / goal.target)}%`;
    // Rebuilt only when it actually changes: this method runs about twice a second and
    // the reward markup carries inline SVG.
    const reward = goal.pearls > 0
      ? `${ICON_COIN}${fmt(goal.coins)}${ICON_PEARL}${goal.pearls}`
      : `${ICON_COIN}${fmt(goal.coins)}`;
    if (this.lastGoalReward !== reward) {
      host.querySelector('.goal-reward')!.innerHTML = reward;
      this.lastGoalReward = reward;
    }
  }

  private panelShell(title: string, bodyHTML: string, tabs?: { id: string; label: string; active: boolean }[], blocking = false): HTMLElement {
    this.closePanel();
    const wrap = document.createElement('div');
    wrap.className = 'panel-backdrop';
    const tabHTML = tabs
      ? `<div class="tabs">${tabs.map((t) => `<button class="tab ${t.active ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>`
      : '';
    wrap.innerHTML = `
      <div class="panel">
        <div class="grabber"></div>
        <div class="panel-head"><h2>${title}</h2>${blocking ? '' : '<button class="close-btn">✕</button>'}</div>
        ${tabHTML}
        <div class="panel-body">${bodyHTML}</div>
      </div>`;
    if (!blocking) {
      // A backdrop tap only counts when the press STARTED on the backdrop.
      //
      // The fish card opens on pointerdown, straight from the scene, so the
      // release of that very press lands on a backdrop that did not exist when
      // the press began — and the click it produced closed the card instantly.
      // The card was reachable only by holding the button down and dragging onto
      // the panel before letting go. Requiring both ends of the gesture also
      // fixes the ordinary case of pressing inside the panel and releasing
      // outside it, which used to dismiss.
      let pressedBackdrop = false;
      wrap.addEventListener('pointerdown', (e) => { pressedBackdrop = e.target === wrap; });
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap && pressedBackdrop) { audio.click(); this.dismissPanel(); }
      });
      wrap.querySelector('.close-btn')!.addEventListener('click', () => {
        audio.click(); this.dismissPanel();
      });
    }
    this.panelHost.appendChild(wrap);
    return wrap;
  }

  // ---------- SHOP ----------

  private shopTabs(active: string) {
    return [
      { id: 'fish', label: tt('🐟 Fish'), active: active === 'fish' },
      { id: 'eggs', label: tt('🥚 Eggs'), active: active === 'eggs' },
      { id: 'feeds', label: tt('🍤 Feed'), active: active === 'feeds' },
      { id: 'decor', label: tt('🪸 Decor'), active: active === 'decor' },
      { id: 'tanks', label: tt('🏝️ Tank'), active: active === 'tanks' },
      { id: 'pearls', label: tt('💎 Pearls'), active: active === 'pearls' },
    ];
  }

  private bindShopTabs(el: HTMLElement): void {
    el.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        this.renderShop(btn.dataset.tab as Parameters<UI['renderShop']>[0]);
      });
    });
  }

  /**
   * Advances the countdowns of an open Eggs tab in place. Runs on the same
   * ~2Hz beat as the rest of the dock; it only writes text, and re-renders
   * the panel once, at the moment an egg becomes collectable, so the button
   * turns into "Collect" without the player having to reopen the tab.
   */
  private tickHatching(): void {
    const rows = this.root.querySelectorAll<HTMLElement>('[data-egg-row]');
    if (rows.length === 0) return;
    const now = Date.now();
    let flipped = false;
    for (const row of rows) {
      const p = this.game.pendingEggs().find((e) => e.id === Number(row.dataset.eggRow));
      if (!p) { flipped = true; continue; }
      const left = p.readyAt - now;
      // Only a row still SHOWING a countdown needs the re-render; asking
      // "is it ready" alone would re-render on every tick forever once it is.
      if (left <= 0) {
        if (row.querySelector('[data-speed-egg]')) flipped = true;
        continue;
      }
      const el = row.querySelector('.egg-left');
      if (el) el.textContent = fmtLeft(left);
      const btn = row.querySelector<HTMLElement>('[data-speed-egg]');
      if (btn) btn.textContent = `🦪 ${this.game.eggSpeedUpCost(p)} · ${tt('Finish now')}`;
    }
    if (flipped) {
      const body = this.root.querySelector<HTMLElement>('.panel-body');
      this.renderShop('eggs', body?.scrollTop ?? 0);
    }
  }

  /**
   * The incubating queue, rendered above the egg tiers for sale. It is the
   * only place a paid-for egg exists, so it comes first: a player who opens
   * the tab to check on an egg should not have to scroll past the shop.
   */
  private hatchingHTML(): string {
    const pending = this.game.pendingEggs();
    if (pending.length === 0) return '';
    const rows = pending.map((p) => {
      const tier = this.game.eggList().find((e) => e.id === p.tier);
      const left = p.readyAt - Date.now();
      const action = left <= 0
        ? `<button class="buy-btn" data-collect-egg="${p.id}">${tt('Collect')}</button>`
        : `<button class="buy-btn" data-speed-egg="${p.id}">🦪 ${this.game.eggSpeedUpCost(p)} · ${tt('Finish now')}</button>`;
      return `
        <div class="card hatching" data-egg-row="${p.id}">
          <div class="egg-emoji">${tier?.emoji ?? '🥚'}</div>
          <div class="card-name">${tt(tier?.name ?? 'Egg')}</div>
          <div class="card-meta egg-left">${left <= 0 ? tt('Ready!') : fmtLeft(left)}</div>
          ${action}
        </div>`;
    }).join('');
    return `<h3 class="dex-info">${tt('Incubating')}</h3><div class="grid">${rows}</div>`;
  }

  renderShop(tab: 'fish' | 'eggs' | 'feeds' | 'decor' | 'tanks' | 'pearls', keepScroll = 0): void {
    const s = this.game.save;
    let body = '';

    if (tab === 'fish') {
      const list = [...this.game.shopFish()].sort((a, b) => a.unlockLevel - b.unlockLevel || a.buyPrice - b.buyPrice);
      body = `<div class="grid">${list.map((sp) => {
        const locked = !sp.pearlPrice && s.level < sp.unlockLevel;
        const price = sp.pearlPrice ? `🦪 ${fmt(sp.pearlPrice)}` : `🪙 ${fmt(sp.buyPrice)}`;
        return `
          <div class="card ${locked ? 'locked' : ''}">
            <div class="card-art">${fishSVG(sp, 88, locked)}</div>
            <div class="card-name">${locked ? '🔒 ' + tt(sp.name) : tt(sp.name)}</div>
            ${rarityChip(sp.rarity)}
            <div class="card-meta">${tt('Sale: 🪙 {price} • {min} min', { price: fmt(sp.sellPrice), min: Math.round(sp.growthMs / 60000) })}${locked ? ` • ${tt('Lv')} ${sp.unlockLevel}` : ''}</div>
            <button class="buy-btn" data-sp="${sp.id}" ${locked ? 'disabled' : ''}>${price}</button>
          </div>`;
      }).join('')}</div>`;
    } else if (tab === 'eggs') {
      body = this.hatchingHTML() + `<div class="grid">${this.game.eggList().map((egg) => {
        const odds = (Object.entries(egg.odds) as [Rarity, number][])
          .map(([r, p]) => `<div class="odd-row"><span style="color:${RARITY_INFO[r].color}">●</span> ${tt(RARITY_INFO[r].name)} <b>${p}%</b></div>`)
          .join('');
        const cur = egg.currency === 'coins' ? '🪙' : '🦪';
        const pity = egg.id === 'altin'
          ? `<div class="pity">${tt('Legendary guarantee: {cur}/{max}', { cur: s.pityCounter, max: PITY_LIMIT })}</div>` : '';
        return `
          <div class="card">
            <div class="egg-emoji">${egg.emoji}</div>
            <div class="card-name">${tt(egg.name)}</div>
            <div class="card-desc">${tt(egg.desc)}</div>
            <div class="odds">${odds}</div>
            ${pity}
            ${egg.hatchMs ? `<div class="pity">${tt('Hatches in {t}', { t: fmtLeft(egg.hatchMs) })}</div>` : ''}
            <button class="buy-btn" data-egg="${egg.id}">${cur} ${fmt(egg.cost)}</button>
          </div>`;
      }).join('')}</div>`;
    } else if (tab === 'feeds') {
      body = `
        <p class="dex-info">${tt('Feed bought in packs is added to your bag as stock and costs <b>less per piece</b> than normal. Once stock runs out, the selected feed keeps being dropped at the normal per-piece coin price.')}</p>
        <div class="grid">${FEED_PACKS.map((p) => {
          const fd = feedById(p.feed);
          const stock = s.feedOwned[fd.id] ?? 0;
          return `
            <div class="card">
              <div class="egg-emoji">${fd.emoji}</div>
              <div class="card-name">${tt(fd.name)} ×${p.qty}</div>
              <div class="card-desc">${tt(fd.desc)}</div>
              <div class="card-meta">${tt('Per piece 🪙 {price} (normal {cost})', { price: (p.price / p.qty).toLocaleString('tr-TR'), cost: fd.cost })}${stock ? ` • 🎒 ${tt('{n} in stock', { n: stock })}` : ''}</div>
              <button class="buy-btn" data-feedpack="${p.id}">🪙 ${fmt(p.price)}</button>
            </div>`;
        }).join('')}</div>`;
    } else if (tab === 'decor') {
      const list = [...DECOR].sort((a, b) => RARITY_INFO[a.rarity].order - RARITY_INFO[b.rarity].order || a.price - b.price);
      body = `<div class="grid">${list.map((d) => {
        const cur = d.currency === 'coins' ? '🪙' : '🦪';
        const owned = s.decorOwned[d.id] ?? 0;
        return `
          <div class="card">
            <div class="card-art">${decorSVG(d, 60)}</div>
            <div class="card-name">${tt(d.name)}</div>
            ${rarityChip(d.rarity)}
            <div class="card-meta">${tt('+{n}% growth & income', { n: DECOR_BOOST[d.rarity] })}${owned ? ` • 🎒 ${owned}` : ''}</div>
            <button class="buy-btn" data-decor="${d.id}">${cur} ${fmt(d.price)}</button>
          </div>`;
      }).join('')}</div>`;
    } else if (tab === 'tanks') {
      const list = this.game.tankList();
      body = `<div class="grid tanks-grid">${list.map((t) => {
        const ownedT = s.tanksOwned.includes(t.id);
        const locked = !ownedT && s.level < t.unlockLevel;
        const cur = t.currency === 'coins' ? '🪙' : '🦪';
        return `
          <div class="card ${locked ? 'locked' : ''}">
            ${tankSwatch(t)}
            <div class="card-name">${biomeIcon(t.biome)} ${tt(t.name)}</div>
            ${rarityChip(t.rarity)}
            <div class="card-desc">${tt(t.desc)}</div>
            <div class="card-meta">${tt('+{n}% growth & income', { n: t.growthBonus })}${TANK_CAP_BONUS[t.rarity] ? ` • ${tt('🐟 +{n} capacity', { n: TANK_CAP_BONUS[t.rarity] })}` : ''}${locked ? ` • ${tt('Lv')} ${t.unlockLevel}` : ''}</div>
            ${ownedT
              ? `<button class="buy-btn owned" disabled>${tt('You own this ✓')}</button>`
              : `<button class="buy-btn" data-tank="${t.id}" ${locked ? 'disabled' : ''}>${t.price === 0 ? tt('Free') : `${cur} ${fmt(t.price)}`}</button>`}
          </div>`;
      }).join('')}</div>`;
    } else {
      const packs = this.game.services.iap.packs();
      const adsRemoved = s.adsRemoved;
      // Shown rather than silently enforced: a Watch button that starts
      // refusing with no explanation reads as a broken button.
      const adsLeft = this.game.adRewardsLeftToday();
      body = `
        <p class="dex-info">${tt("💎 Pearl packs are purchased with real money. You're in <b>{store}</b> mode — purchases are enabled in the Google Play / App Store build. You can also earn pearls from quests, level-ups, and collection sets.", { store: this.game.services.iap.storeLabel })}</p>
        <div class="grid">
          <div class="card">
            <div class="egg-emoji">🎬</div>
            <div class="card-name">${tt('Watch Ad')}</div>
            <div class="card-desc">${tt('🦪 Earn 5 pearls<br/><b>{n} left today</b>', { n: adsLeft })}</div>
            <button class="buy-btn watch-ad" ${adsLeft > 0 ? '' : 'disabled'}>${adsLeft > 0 ? tt('Watch') : tt('Back tomorrow')}</button>
          </div>
          ${packs.map((p) => p.removesAds ? `
          <div class="card">
            <div class="egg-emoji">${p.emoji}</div>
            <div class="card-name">${tt(p.name)}</div>
            <div class="card-desc">${tt(p.bonus)}</div>
            ${adsRemoved
              ? `<button class="buy-btn owned" disabled>${tt('You own this ✓')}</button>`
              : `<button class="buy-btn iap" data-iap="${p.id}">${p.priceLabel}</button>`}
          </div>` : `
          <div class="card">
            <div class="egg-emoji">${p.emoji}</div>
            <div class="card-name">${tt(p.name)}</div>
            <div class="card-desc">${tt('🦪 {n} pearls {bonus}', { n: p.pearls, bonus: p.bonus ? `<br/><b>${tt(p.bonus)}</b>` : '' })}</div>
            <button class="buy-btn iap" data-iap="${p.id}">${p.priceLabel}</button>
          </div>`).join('')}
        </div>`;
    }

    const el = this.panelShell(tt('🛒 Shop'), body, this.shopTabs(tab));
    this.bindShopTabs(el);
    const bodyEl = el.querySelector<HTMLElement>('.panel-body')!;
    if (keepScroll > 0) bodyEl.scrollTop = keepScroll;
    // Prices on the pearls tab should be in the player's own currency. The shop
    // response is NOT awaited — the panel opens immediately with fallback labels
    // and refreshes once prices arrive if the tab is still open. Loaded once;
    // switching between tabs doesn't trigger a new request.
    if (tab === 'pearls' && !this.pricesLoaded) {
      void this.game.services.iap.loadPrices().then(() => {
        this.pricesLoaded = true;
        if (this.panelHost.contains(el)) this.renderShop('pearls', bodyEl.scrollTop);
      });
    }

    el.querySelectorAll<HTMLButtonElement>('.buy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = bodyEl.scrollTop; // keep the scroll position across bulk purchases
        if (btn.dataset.sp) {
          const res = this.game.buyFish(btn.dataset.sp);
          if (!res.ok) audio.error();
          this.toast(res.msg);
          if (res.ok) this.renderShop('fish', st);
        } else if (btn.dataset.egg) {
          const egg = this.game.eggList().find((e) => e.id === btn.dataset.egg)!;
          const res = this.game.hatchEgg(egg);
          if (!res.ok) { audio.error(); this.toast(res.msg); return; }
          // A timed egg has nothing to reveal yet — it goes into the queue above.
          // Scrolled to the TOP, not to the kept position: the egg just bought
          // now sits in the incubating queue above the tiers, and the buy
          // button is at the bottom of the list — keeping the scroll would
          // leave the player looking at the shop instead of their egg.
          if (res.pending) { this.toast(res.msg); this.renderShop('eggs', 0); return; }
          this.showEggReveal(egg, res.species!);
        } else if (btn.dataset.collectEgg) {
          const id = Number(btn.dataset.collectEgg);
          // Read the tier BEFORE collecting: collectEgg removes the queue entry.
          const pending = this.game.pendingEggs().find((p) => p.id === id);
          const egg = this.game.eggList().find((e) => e.id === pending?.tier);
          const res = this.game.collectEgg(id);
          if (!res.ok) { audio.error(); this.toast(res.msg); return; }
          this.renderShop('eggs', st);
          if (egg) this.showEggReveal(egg, res.species!);
        } else if (btn.dataset.speedEgg) {
          const res = this.game.speedUpEgg(Number(btn.dataset.speedEgg));
          if (!res.ok) { audio.error(); this.toast(res.msg); return; }
          this.renderShop('eggs', st);
        } else if (btn.dataset.feedpack) {
          const res = this.game.buyFeedPack(btn.dataset.feedpack);
          if (!res.ok) audio.error();
          this.toast(res.msg);
          if (res.ok) this.renderShop('feeds', st);
        } else if (btn.dataset.decor) {
          const res = this.game.buyDecor(btn.dataset.decor);
          if (!res.ok) audio.error();
          this.toast(res.msg);
          if (res.ok) this.renderShop('decor', st);
        } else if (btn.dataset.tank) {
          const res = this.game.buyTank(btn.dataset.tank);
          if (!res.ok) audio.error();
          this.toast(res.msg);
          if (res.ok) this.renderShop('tanks', st);
        } else if (btn.dataset.iap) {
          void this.game.services.iap.purchase(btn.dataset.iap).then((res) => {
            if (res.ok) {
              if (res.grantPearls) this.game.save.pearls += res.grantPearls;
              if (res.grantCoins) this.game.save.coins += res.grantCoins;
              if (res.grantRemovesAds) this.game.save.adsRemoved = true;
              this.game.syncSave();
              this.refreshHUD();
              this.renderShop('pearls', st);
            }
            this.toast(res.msg);
          });
        } else if (btn.classList.contains('watch-ad')) {
          // Checked again here, not just in the markup: the panel may have been
          // open since before the day's last ad was watched.
          if (this.game.adRewardsLeftToday() <= 0) {
            audio.error();
            this.toast(tt("That's all the ads for today — come back tomorrow."));
            return;
          }
          void this.game.services.ads.showRewarded().then((res) => {
            if (res.ok && res.grantPearls) {
              this.game.save.pearls += res.grantPearls;
              this.game.noteAdRewardWatched();
              this.game.syncSave();
              this.refreshHUD();
              this.renderShop('pearls', st);
            } else if (!res.ok) {
              audio.error();
            }
            this.toast(res.msg);
          });
        }
      });
    });
  }

  // ---------- INVENTORY ----------

  renderInventory(tab: 'fish' | 'feeds' | 'decor' | 'tanks'): void {
    const s = this.game.save;
    const tabs = [
      { id: 'fish', label: tt('🐟 My Fish'), active: tab === 'fish' },
      { id: 'feeds', label: tt('🍤 My Feed'), active: tab === 'feeds' },
      { id: 'decor', label: tt('🪸 My Decor'), active: tab === 'decor' },
      { id: 'tanks', label: tt('🏝️ My Tanks'), active: tab === 'tanks' },
    ];
    let body = '';

    const flat: FishEarning[] = []; // row references for sell buttons
    if (tab === 'fish') {
      const groups = this.game.earningsByTank();
      body = groups.map((g) => {
        const rows = g.fishes.length
          ? g.fishes.map((fe) => {
              const i = flat.push(fe) - 1;
              const sub = fe.adult
                ? `${tt(fe.sp.name)} • 🪙 ${fmt(fe.perHour)}${tt('/hr')}${fe.sad ? ` • ${tt('😢 hungry')}` : ''}`
                : `${tt(fe.sp.name)} • ${tt('Sale')} 🪙 ${fmt(fe.sellValue)}${fe.sad ? ` • ${tt('😢 hungry')}` : ''}`;
              return `
                <div class="inv-row clickable" data-fish="${i}">
                  <span class="inv-art">${fishSVG(fe.sp, 44)}</span>
                  <span class="inv-name">${fe.name}<small class="inv-sub">${sub}</small></span>
                  ${fe.adult
                    ? `<button class="tgl on inv-sell" data-sell="${i}">${tt('{n} sell', { n: `🪙 ${fmt(fe.sellValue)}` })}</button>`
                    : `<span class="inv-right">${tt('🌱 growing')}</span>`}
                </div>`;
            }).join('')
          : `<p class="empty">${tt('No fish in this tank.')}</p>`;
        return `
          <h3 class="inv-head">${biomeIcon(g.tank.biome)} ${tt(g.tank.name)} — 🐟 ${g.count}/${this.game.capacityFor(g.tank.id)}${g.perHour > 0 ? ` • 🪙 ${fmt(g.perHour)}${tt('/hr')}` : ''}${g.dirtPct > 0 ? ` <span class="dirt-badge">🧹 -${g.dirtPct}%</span>` : ''}</h3>
          ${rows}`;
      }).join('');
    } else if (tab === 'feeds') {
      const paid = FEEDS.filter((f) => f.cost > 0);
      body = `
        ${paid.map((f) => {
          const stock = s.feedOwned[f.id] ?? 0;
          return `
            <div class="inv-row">
              <span class="inv-art feed-art">${f.emoji}</span>
              <span class="inv-name">${tt(f.name)}<small class="inv-sub">${tt(f.desc)}</small></span>
              <span class="inv-right">${stock > 0 ? `🎒 ×${stock}` : tt('out of stock')}</span>
            </div>`;
        }).join('')}
        <p class="dex-info">${tt('Once stock runs out, feed is dropped at the normal per-piece coin price. Packs are cheaper per piece.')}</p>
        <button class="buy-btn" id="go-feed-shop">${tt('🛒 Go to feed packs')}</button>`;
    } else if (tab === 'decor') {
      const placed = s.decorPlaced[s.activeTank] ?? [];
      const ownedIds = Object.keys(s.decorOwned).filter((id) => (s.decorOwned[id] ?? 0) > 0);
      const placedHTML = placed.length
        ? placed.map((p, i) => {
            const d = decorById(p.def);
            return `
              <div class="inv-row">
                <span class="inv-art">${decorSVG(d, 44)}</span>
                <span class="inv-name">${tt(d.name)} ${rarityChip(d.rarity)}</span>
                <button class="tgl danger" data-remove="${i}">${tt('Remove')}</button>
              </div>`;
          }).join('')
        : `<p class="empty">${tt('No decorations in this tank yet.')}</p>`;
      const ownedHTML = ownedIds.length
        ? ownedIds.map((id) => {
            const d = decorById(id);
            return `
              <div class="inv-row">
                <span class="inv-art">${decorSVG(d, 44)}</span>
                <span class="inv-name">${tt(d.name)} <b>×${s.decorOwned[id]}</b> ${rarityChip(d.rarity)}</span>
                <button class="tgl on" data-place="${id}">${tt('Place')}</button>
              </div>`;
          }).join('')
        : `<p class="empty">${tt("You don't have any decorations — check the Shop → Decor tab! 🛒")}</p>`;
      body = `
        ${placed.length ? `<button class="buy-btn edit-mode-btn">${tt('🛠️ Edit Layout')}</button>` : ''}
        <h3 class="inv-head">${tt('In this tank ({n}/{max})', { n: placed.length, max: MAX_PLACED })}</h3>${placedHTML}
        <h3 class="inv-head">${tt('In your bag')}</h3>${ownedHTML}`;
    } else {
      body = `<div class="grid tanks-grid">${this.game.tankList()
        .filter((t) => s.tanksOwned.includes(t.id))
        .map((t) => {
          const active = t.id === s.activeTank;
          const count = this.game.tankFishCount(t.id);
          return `
            <div class="card ${active ? 'active-tank' : ''}">
              ${tankSwatch(t)}
              <div class="card-name">${biomeIcon(t.biome)} ${tt(t.name)}</div>
              <div class="card-meta">${tt('🐟 {n}/{cap} fish • +{boost}% growth & income', { n: count, cap: this.game.capacityFor(t.id), boost: this.game.tankBoostPct(t.id) })}</div>
              ${active
                ? `<button class="buy-btn owned" disabled>${tt('You are here 📍')}</button>`
                : `<button class="buy-btn" data-switch="${t.id}">${tt('Switch')}</button>`}
            </div>`;
        }).join('')}</div>
        <p class="dex-info">${tt('New tanks are in the Shop → Tank tab! 🛒')}</p>`;
    }

    const el = this.panelShell(tt('🎒 Inventory'), body, tabs);
    el.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        this.renderInventory(btn.dataset.tab as 'fish' | 'feeds' | 'decor' | 'tanks');
      });
    });
    el.querySelector('#go-feed-shop')?.addEventListener('click', () => {
      audio.click();
      this.renderShop('feeds');
    });
    el.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.game.sellEarning(flat[Number(btn.dataset.sell)]);
        if (!res.ok) audio.error();
        this.toast(res.msg);
        if (res.ok) this.renderInventory('fish');
      });
    });
    el.querySelectorAll<HTMLElement>('.inv-row[data-fish]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const fe = flat[Number(row.dataset.fish)];
        if (fe.live) this.showFishInfo(fe.live);
        else if (fe.saved) this.showDormantFishInfo(fe.saved);
      });
    });
    el.querySelector('.edit-mode-btn')?.addEventListener('click', () => {
      audio.click();
      this.startEditMode();
    });
    el.querySelectorAll<HTMLButtonElement>('[data-place]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.game.placeDecor(btn.dataset.place!);
        if (!res.ok) audio.error();
        this.toast(res.msg);
        if (res.ok) { this.renderInventory('decor'); this.refreshHUD(); }
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.game.removeDecor(Number(btn.dataset.remove));
        this.toast(res.msg);
        if (res.ok) { this.renderInventory('decor'); this.refreshHUD(); }
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-switch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.game.switchTank(btn.dataset.switch!);
        this.toast(res.msg);
        if (res.ok) { this.closePanel(); this.refreshHUD(); }
      });
    });
  }

  // ---------- SOCIAL ----------

  renderSocial(tab: 'leaderboard' | 'friends', skipFriendScoreFetch = false): void {
    const s = this.game.save;
    const tabs = [
      { id: 'leaderboard', label: tt('🏆 Leaderboard'), active: tab === 'leaderboard' },
      { id: 'friends', label: tt('👥 Friends'), active: tab === 'friends' },
    ];
    let body = '';

    if (tab === 'leaderboard') {
      const rows = this.game.services.social.leaderboard(s, this.friendScoresCache);
      // The in-app board ranks the player against visible bots and any friends
      // whose score came back; the global ranking lives with Play Games, which
      // owns the accounts and the abuse handling. The button appears only where
      // that is actually reachable.
      const playRow = isPlayLeaderboardAvailable()
        ? `<button class="buy-btn lb-global" id="play-leaderboard">${tt('🏆 Global ranking')}</button>` : '';
      body = `
        <p class="dex-info">${tt('Ranked by total earnings.')} <i>${tt(this.game.services.social.label)}</i></p>
        ${playRow}
        <div class="lb">${rows.map((r) => `
          <div class="lb-row ${r.isPlayer ? 'me' : ''}">
            <span class="lb-rank">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : '#' + r.rank}</span>
            <span class="lb-name">${escapeHtml(tt(r.name))}</span>
            <span class="lb-score">🪙 ${fmt(r.score)}</span>
          </div>`).join('')}</div>`;
    } else {
      const friendRows = s.friends.length
        ? s.friends.map((f) => {
            const visited = this.game.hasVisitedFriendToday(f.code);
            const gifted = this.game.hasGiftedFriendToday(f.code);
            return `
            <div class="inv-row">
              <span class="inv-name">👤 ${escapeHtml(tt(f.name))} <span class="lb-code">${escapeHtml(f.code)}</span></span>
              <div class="friend-actions">
                <button class="tgl" data-visit="${f.code}" ${visited ? 'disabled' : ''}>${visited ? tt('Visited ✓') : tt('Visit')}</button>
                <button class="tgl" data-gift="${f.code}" ${gifted ? 'disabled' : ''}>${gifted ? tt('Gift sent ✓') : tt('🎁 Send Gift')}</button>
              </div>
            </div>`;
          }).join('')
        : `<p class="empty">${tt("You haven't added any friends yet.")}</p>`;
      body = `
        <div class="friend-code-box">
          <span>${tt('Your code:')}</span> <b id="my-code">${s.friendCode}</b>
          <button class="tgl" id="copy-code">${tt('Copy')}</button>
        </div>
        <div class="friend-add">
          <input id="friend-input" placeholder="REEF-XXXXX" maxlength="10" autocomplete="off"/>
          <button class="buy-btn" id="friend-add-btn">${tt('Add')}</button>
        </div>
        <h3 class="inv-head">${tt('Your friends')}</h3>
        ${friendRows}
        <p class="dex-info">${tt("Visit each friend once a day to earn coins and XP. Once the online version is connected, you'll be able to see their real tanks. 🤝")}</p>`;
    }

    const el = this.panelShell(tt('🏆 Social'), body, tabs);
    if (tab === 'leaderboard' && !skipFriendScoreFetch && s.friends.length) {
      this.game.services.social.friendScores(s).then((scores) => {
        this.friendScoresCache = scores;
        if (this.panelHost.contains(el)) this.renderSocial('leaderboard', true);
      });
    }
    el.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        this.renderSocial(btn.dataset.tab as 'leaderboard' | 'friends');
      });
    });
    el.querySelector('#play-leaderboard')?.addEventListener('click', () => {
      audio.click();
      void showPlayLeaderboard().then((res) => { if (!res.ok) { audio.error(); this.toast(res.msg); } });
    });
    el.querySelector('#copy-code')?.addEventListener('click', () => {
      void navigator.clipboard?.writeText(s.friendCode);
      this.toast(tt('Code copied! Share it with your friends 📋'));
    });
    el.querySelector<HTMLButtonElement>('#friend-add-btn')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const input = el.querySelector<HTMLInputElement>('#friend-input')!;
      btn.disabled = true;
      this.game.services.social.addFriend(s, input.value).then((res) => {
        btn.disabled = false;
        if (!res.ok) audio.error(); else { audio.click(); this.game.syncSave(); }
        this.toast(res.msg);
        if (res.ok) this.renderSocial('friends');
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-visit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.game.visitFriend(btn.dataset.visit!);
        if (!res.ok) audio.error();
        this.toast(res.msg);
        if (res.ok) this.renderSocial('friends');
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-gift]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.game.giftFriend(btn.dataset.gift!);
        if (!res.ok) audio.error();
        this.toast(res.msg);
        if (res.ok) this.renderSocial('friends');
      });
    });
  }

  // ---------- MORE / QUESTS / COLLECTION / SETTINGS ----------

  /** The player hub. Social used to be its own dock tab and everything else hid behind
   *  "More"; both belong to the same question — how am I doing — so they share one door. */
  private renderYou(): void {
    const el = this.panelShell(tt('You'), `
      <div class="more-grid">
        <button class="more-btn" data-go="social">🏆<span>${tt('Social')}</span></button>
        <button class="more-btn" data-go="collection">📖<span>${tt('Collection')}</span></button>
        <button class="more-btn" data-go="earnings">📈<span>${tt('Earnings')}</span></button>
        <button class="more-btn" data-go="profile">👤<span>${tt('Profile')}</span></button>
        <button class="more-btn" data-go="settings">⚙️<span>${tt('Settings')}</span></button>
      </div>`);
    el.querySelectorAll<HTMLButtonElement>('.more-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        const go = btn.dataset.go!;
        if (go === 'social') this.renderSocial('leaderboard');
        else if (go === 'collection') this.renderCollection();
        else if (go === 'earnings') this.renderEarnings();
        else if (go === 'profile') this.renderProfile();
        else this.renderSettings();
      });
    });
  }

  /** Profile: player identity, progress summary, and lifetime stats. */
  private renderProfile(): void {
    const s = this.game.save;
    const st = s.stats;
    const achDone = ACHIEVEMENTS.filter((a) => a.check(s) >= a.target).length;
    const fishCount = s.tanksOwned.reduce((n, t) => n + this.game.tankFishCount(t), 0);
    const row = (label: string, value: string) =>
      `<div class="set-row"><span>${label}</span><b class="stat-val">${value}</b></div>`;
    this.panelShell(tt('👤 Profile'), `
      <div class="profile-head">
        <div class="profile-name">${s.playerName}</div>
        <div class="profile-code">${s.friendCode}</div>
      </div>
      ${row(tt('⭐ Level'), tt('{n} ({xp}/{need} XP)', { n: s.level, xp: fmt(s.xp), need: fmt(this.game.xpNeed(s.level)) }))}
      ${row(tt('🐟 Your fish'), `${fishCount}`)}
      ${row(tt('🏝️ Your tanks'), tt('{count}/{total}', { count: s.tanksOwned.length, total: this.game.tankList().length }))}
      ${row(tt('📖 Collection'), tt('{n}/{total} species', { n: s.collection.length, total: SPECIES.length }))}
      ${row(tt('🏆 Achievements'), tt('{count}/{total}', { count: achDone, total: ACHIEVEMENTS.length }))}
      ${row(tt('🔥 Daily streak'), tt('{n} days', { n: s.streak }))}
      <hr/>
      <h3 class="inv-head">${tt('📊 Lifetime stats')}</h3>
      ${row(tt('🤝 Fish sold'), fmt(st.totalSold))}
      ${row(tt('💰 Total earned'), `🪙 ${fmt(st.totalEarned)}`)}
      ${row(tt('🍤 Times fed'), fmt(st.totalFed))}
      ${row(tt('🥚 Eggs hatched'), fmt(st.eggsHatched))}
      ${row(tt('🪸 Decorations placed'), fmt(st.decorPlacedCount))}
      ${row(tt('🧹 Dirt cleaned'), fmt(st.totalCleaned))}
    `);
  }

  /** Earnings report: total output, per-tank subtotals, and per-fish income. */
  private renderEarnings(): void {
    const g = this.game;
    const groups = g.earningsByTank();
    const total = g.incomePerHour;
    const pot = Math.floor(g.save.incomePot);
    const cap = total * INCOME_CAP_HOURS;
    const blocks = groups.map((grp) => {
      const rows = grp.fishes.length
        ? grp.fishes.map((fe) => `
            <div class="inv-row">
              <span class="inv-art">${fishSVG(fe.sp, 44)}</span>
              <span class="inv-name">${fe.name}<small class="inv-sub">${tt(fe.sp.name)} • ${tt('Sale')} 🪙 ${fmt(fe.sellValue)}${fe.sad ? ` • ${tt('😢 hungry')}` : ''}</small></span>
              <span class="inv-right">${fe.adult ? `🪙 ${fmt(fe.perHour)}${tt('/hr')}` : tt('🌱 once grown {n}/hr', { n: fmt(fe.perHour) })}</span>
            </div>`).join('')
        : `<p class="empty">${tt('No fish in this tank.')}</p>`;
      return `
        <h3 class="inv-head">${biomeIcon(grp.tank.biome)} ${tt(grp.tank.name)}
          — 🪙 ${fmt(grp.perHour)}${tt('/hr')}${grp.boostPct > 0 ? ` <span class="boost">+${grp.boostPct}%</span>` : ''}${grp.dirtPct > 0 ? ` <span class="dirt-badge">🧹 -${grp.dirtPct}%</span>` : ''}</h3>
        ${rows}`;
    }).join('');
    this.panelShell(tt('📈 Earnings Report'), `
      <p class="dex-info">${tt('Total output: <b>🪙 {n}/hour</b> • Accumulated: <b>{pot}</b>{cap}.\n      Only adult fish produce; tank + decor bonuses affect output and growth. Dirty tanks fog up the glass and slow production and growth — tap dirt spots to clean them! 🧹', { n: fmt(total), pot: fmt(pot), cap: total > 0 ? tt(' (cap {n})', { n: fmt(cap) }) : '' })}</p>
      ${blocks}`);
  }

  /**
   * The festival block, or '' when none is running. It goes ABOVE the dailies
   * in renderQuests(): the event is the thing with a deadline on it, and it is
   * the only part of that panel a player can permanently miss.
   */
  private festivalHTML(): string {
    const def = this.game.visibleEvent();
    if (!def) return '';
    const s = this.game.save;
    const pts = s.event.id === def.id ? s.event.points : 0;
    const running = this.game.activeEvent() !== null;
    const last = def.tiers[def.tiers.length - 1];
    const rows = def.tiers.map((tier, i) => {
      const claimed = s.event.id === def.id && s.event.claimed.includes(i);
      const reached = pts >= tier.points;
      return `
        <div class="quest-row ${claimed ? 'claimed' : ''}">
          <span class="q-emoji">${reached ? '🏆' : '🔒'}</span>
          <div class="q-mid">
            <div class="q-name">${tt('{n} points', { n: tier.points })}</div>
            <div class="q-meta">🪙 ${fmt(tier.coins)}${tier.pearls ? ` + 🦪 ${tier.pearls}` : ''}</div>
          </div>
          ${claimed ? '<span class="q-done">✓</span>'
            : reached ? `<button class="buy-btn" data-event-tier="${i}">${tt('Claim')}</button>`
            : ''}
        </div>`;
    }).join('');
    // Once the event is over, the header stops advertising a deadline and says
    // what is actually true: the only thing left is collecting what was earned.
    const head = running
      ? tt('Ends {day}', { day: def.end })
      : tt('Ended — claim what you earned');
    return `
      <h3 class="inv-head">${def.emoji} ${tt(def.name)}</h3>
      <div class="festival">
        <p class="card-desc">${tt(def.desc)}</p>
        <div class="q-name">${tt('{n} festival points', { n: pts })} · <small>${head}</small></div>
        <div class="bar"><div style="width:${Math.min(100, (100 * pts) / last.points)}%"></div></div>
      </div>
      ${rows}`;
  }

  private renderQuests(): void {
    const s = this.game.save;
    const daily = this.game.dailyQuests();
    const dailyHTML = daily.map((q) => {
      const cur = Math.min(q.target, s.quests.progress[q.id] ?? 0);
      const claimed = s.quests.claimed.includes(q.id);
      const done = cur >= q.target;
      const coins = Math.round(q.rewardCoins * (1 + s.level * 0.1));
      return `
        <div class="quest-row ${claimed ? 'claimed' : ''}">
          <span class="q-emoji">${q.emoji}</span>
          <div class="q-mid">
            <div class="q-name">${tt(q.name)}</div>
            <div class="bar"><div style="width:${(100 * cur) / q.target}%"></div></div>
            <div class="q-meta">${cur}/${q.target} • 🪙 ${coins}${q.rewardPearls ? ` + 🦪 ${q.rewardPearls}` : ''}</div>
          </div>
          ${claimed ? '<span class="q-done">✓</span>'
            : done ? `<button class="buy-btn" data-claim="${q.id}">${tt('Claim')}</button>`
            : ''}
        </div>`;
    }).join('');

    const wq = this.game.weeklyQuest();
    const wCur = Math.min(wq.target, s.weeklyQuest.progress[wq.id] ?? 0);
    const wClaimed = s.weeklyQuest.claimed.includes(wq.id);
    const wDone = wCur >= wq.target;
    const wCoins = Math.round(wq.rewardCoins * (1 + s.level * 0.1));
    const weeklyHTML = `
        <div class="quest-row weekly ${wClaimed ? 'claimed' : ''}">
          <span class="q-emoji">${wq.emoji}</span>
          <div class="q-mid">
            <div class="q-name">${tt(wq.name)}</div>
            <div class="bar"><div style="width:${(100 * wCur) / wq.target}%"></div></div>
            <div class="q-meta">${wCur}/${wq.target} • 🪙 ${wCoins}${wq.rewardPearls ? ` + 🦪 ${wq.rewardPearls}` : ''}</div>
          </div>
          ${wClaimed ? '<span class="q-done">✓</span>'
            : wDone ? `<button class="buy-btn" id="weekly-claim">${tt('Claim')}</button>`
            : ''}
        </div>`;

    // Achievements used to sit at the bottom of this same scroll, which is where the
    // IA audit found them: reachable in principle, never seen in practice. They get
    // their own screen and a row here that says how many are waiting.
    const achReady = ACHIEVEMENTS.filter(
      (a) => a.check(s) >= a.target && !s.achievementsClaimed.includes(a.id),
    ).length;
    const achDone = ACHIEVEMENTS.filter((a) => s.achievementsClaimed.includes(a.id)).length;

    const el = this.panelShell(tt('Quests'), `
      ${this.festivalHTML()}
      <h3 class="inv-head">${tt('Daily quests 🔥 Streak: {n} days', { n: s.streak })}</h3>
      ${dailyHTML}
      <h3 class="inv-head">${tt('Weekly quest')}</h3>
      ${weeklyHTML}
      <button class="nav-row" id="go-achievements">
        <span class="nav-row-main">
          <b>${tt('Achievements')}</b>
          <small>${tt('{done}/{total} unlocked', { done: achDone, total: ACHIEVEMENTS.length })}</small>
        </span>
        ${achReady > 0 ? `<span class="nav-row-badge">${tt('{n} ready', { n: achReady })}</span>` : '<span class="nav-row-chevron">›</span>'}
      </button>`);
    el.querySelector('#go-achievements')!.addEventListener('click', () => {
      audio.click();
      this.renderAchievements();
    });
    el.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = daily.find((x) => x.id === btn.dataset.claim)!;
        const res = this.game.claimQuest(q);
        this.toast(res.msg);
        if (res.ok) this.renderQuests();
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-event-tier]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.game.claimEventTier(Number(btn.dataset.eventTier));
        this.toast(res.msg);
        if (res.ok) this.renderQuests();
      });
    });
    el.querySelector('#weekly-claim')?.addEventListener('click', () => {
      const res = this.game.claimWeeklyQuest();
      this.toast(res.msg);
      if (res.ok) this.renderQuests();
    });
  }

  private renderAchievements(): void {
    const s = this.game.save;
    const rows = ACHIEVEMENTS.map((a) => {
      const cur = Math.min(a.target, a.check(s));
      const claimed = s.achievementsClaimed.includes(a.id);
      const done = cur >= a.target;
      return `
        <div class="quest-row ${claimed ? 'claimed' : ''}">
          <span class="q-emoji">${a.emoji}</span>
          <div class="q-mid">
            <div class="q-name">${tt(a.name)} — <span class="q-desc">${tt(a.desc)}</span></div>
            <div class="bar"><div style="width:${(100 * cur) / a.target}%"></div></div>
            <div class="q-meta">${cur}/${a.target} • 🪙 ${a.rewardCoins}${a.rewardPearls ? ` + 🦪 ${a.rewardPearls}` : ''}</div>
          </div>
          ${claimed ? '<span class="q-done">✓</span>'
            : done ? `<button class="buy-btn" data-ach="${a.id}">${tt('Claim')}</button>`
            : ''}
        </div>`;
    }).join('');

    const el = this.panelShell(tt('Achievements'), rows);
    el.querySelectorAll<HTMLButtonElement>('[data-ach]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.game.claimAchievement(btn.dataset.ach!);
        this.toast(res.msg);
        if (res.ok) this.renderAchievements();
      });
    });
  }

  private renderCollection(): void {
    const s = this.game.save;
    const groups = (Object.keys(RARITY_INFO) as Rarity[]).map((r) => {
      const info = RARITY_INFO[r];
      const list = SPECIES.filter((sp) => sp.rarity === r);
      const got = list.filter((sp) => s.collection.includes(sp.id)).length;
      const done = got === list.length;
      const cards = list.map((sp) => {
        const has = s.collection.includes(sp.id);
        return `
          <div class="dex-card ${has ? '' : 'unknown'}">
            ${fishSVG(sp, 60, !has)}
            <div class="dex-name">${has ? tt(sp.name) : '???'}</div>
          </div>`;
      }).join('');
      return `
        <div class="dex-group">
          <div class="dex-head">
            <span class="chip" style="background:${info.color}">${tt(info.name)}</span>
            <span class="dex-count">${got}/${list.length} ${done ? tt('✅ +5% sale bonus') : ''}</span>
          </div>
          <div class="dex-row">${cards}</div>
        </div>`;
    }).join('');
    const bonus = Math.round((this.game.sellMult - 1) * 100);
    this.panelShell(tt('📖 Collection'), `
      <p class="dex-info">${tt('{n}/100 species collected. A species is added to your collection the first time it reaches adulthood.\n      Each completed set gives a permanent <b>+5% sale bonus</b>. Current bonus: <b>+{n2}%</b>', { n: s.collection.length, n2: bonus })}</p>
      ${groups}`);
  }

  /**
   * Reads env(safe-area-inset-top/bottom) off a throwaway element. There is no
   * way to ask for these values directly — env() only resolves inside a CSS
   * property — so a hidden probe takes the padding and the computed style is
   * read back. Rounded: fractional device pixels are noise here.
   */
  private static measureSafeArea(): { top: number; bottom: number } {
    const probe = document.createElement('div');
    probe.style.cssText = [
      'position:fixed', 'left:0', 'top:0', 'width:0',
      'visibility:hidden', 'pointer-events:none',
      'padding-top:env(safe-area-inset-top, 0px)',
      'padding-bottom:env(safe-area-inset-bottom, 0px)',
    ].join(';');
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const out = {
      top: Math.round(parseFloat(cs.paddingTop) || 0),
      bottom: Math.round(parseFloat(cs.paddingBottom) || 0),
    };
    probe.remove();
    return out;
  }

  private renderSettings(): void {
    const s = this.game.save;
    const identity = this.game.services.auth.current();
    const lang = getLang();
    // The store's billing currency, shown as a diagnostic under the version.
    // It is the ONE part of the language guess that no test can settle: the
    // mocks prove the app reads `currencyCode` and lets it outrank the device
    // language, but only a real Play account can show whether Play fills that
    // field for this app's offering at all. Rendered even when empty, so
    // "the store never answered" stays distinguishable from "old build".
    // Two things that can only be observed on a real device, side by side: the
    // currency the store reported, and why ads are off if they are. Both fail
    // silently by nature, which is exactly why they get a line.
    const adErr = this.game.services.ads.lastError;
    // Which test devices this build names — not a claim that this device is one
    // of them, which the SDK never tells the app. Compare the prefixes against
    // what logcat asks for (`adb logcat -s Ads | grep setTestDeviceIds`); if the
    // SDK is still asking, the ids here are stale and Watch Ad serves a real
    // advertiser a real impression.
    const adMode = AD_TEST_DEVICE_TAGS.length ? `dev ${AD_TEST_DEVICE_TAGS.join(',')}` : 'live';
    // The safe-area numbers the platform actually reports, measured rather than
    // assumed. Every bottom-pinned element adds env(safe-area-inset-bottom) to
    // its own offset, and on the test handset — Android 10, WebView 150 — the
    // dock and the last line of every sheet still sat inside the navigation
    // bar's band, which can only mean that value is arriving as 0. Whether it
    // is 0 because the webview was already inset natively, or because nothing
    // inset it at all, is the difference between "working" and "broken", and
    // the viewport figure beside it is what separates the two: a natively
    // padded webview is SHORTER than the screen.
    // screen.height is already CSS pixels, so it is compared to innerHeight
    // directly — dividing it by devicePixelRatio was wrong and made the two
    // numbers incomparable. The ratio is printed separately because it is what
    // turns these figures back into the device pixels a screenshot is measured
    // in.
    const sa = UI.measureSafeArea();
    const saDiag = `sa ${sa.top}/${sa.bottom} · vh ${Math.round(window.innerHeight)}/${screen.height}@${window.devicePixelRatio || 1}`;
    const storeCurrencyDiag = `store: ${storedStoreCurrency() || '—'} · ads: ${adErr || adMode} · ${saDiag}`;
    // With only one language shipped there is nothing to choose, so the row is
    // omitted entirely. It comes back on its own once AVAILABLE_LANGS grows.
    const langRowHTML = AVAILABLE_LANGS.length < 2 ? '' : `
      <hr/>
      <div class="set-row"><span>${tt('🌐 Language')}</span>
        <span class="lang-toggle">
          ${AVAILABLE_LANGS.map((l) => `<button class="tgl ${lang === l ? 'on' : ''}" data-lang="${l}">${tt(LANG_LABELS[l])}</button>`).join('')}
        </span></div>
      <hr/>`;
    const el = this.panelShell(tt('⚙️ Settings'), `
      <div class="set-row"><span>${tt('👤 Player name')}</span>
        <span class="name-edit"><input id="name-input" value="${s.playerName}" maxlength="16"/><button class="tgl" id="name-save">${tt('Save')}</button></span></div>
      <div class="set-row"><span>${tt('🎮 Account')}</span>
        <button class="tgl" id="auth-btn">${identity ? this.game.services.auth.platformLabel : tt('Sign in')}</button></div>
      <div class="set-row"><span>${tt('☁️ Cloud save')}</span>${this.cloudRowHTML()}</div>
      ${langRowHTML}
      <div class="set-row"><span>${tt('🎵 Music')}</span><button class="tgl ${s.music ? 'on' : ''}" data-t="music">${s.music ? tt('On') : tt('Off')}</button></div>
      <div class="set-row"><span>${tt('🔊 Sound Effects')}</span><button class="tgl ${s.sfx ? 'on' : ''}" data-t="sfx">${s.sfx ? tt('On') : tt('Off')}</button></div>
      <div class="set-row"><span>${tt('📤 Tell your friends')}</span><button class="tgl" data-t="share">${tt('Share')}</button></div>
      <div class="set-row"><span>${tt('🧾 Restore purchases')}</span>
        <button class="tgl" id="restore-iap">${tt('Restore')}</button></div>
      <p class="set-note-block">${tt('Brings back Remove Ads if you bought it on this store account — after a reinstall or on a new phone.')}</p>
      <hr/>
      <div class="set-links">
        <a href="https://reefy.games" target="_blank" rel="noopener">🌐 reefy.games</a>
        <a href="mailto:destek@reefy.games">✉️ destek@reefy.games</a>
      </div>
      <hr/>
      <div class="set-row"><span>${tt('☁️ Delete my cloud data')}</span>
        <button class="tgl danger" id="cloud-delete">${tt('Delete')}</button></div>
      <p class="set-note-block">${tt('Removes the copy of your save in the cloud and your friend-code record. The game on this device is untouched.')}</p>
      <div class="set-row"><span>${tt('🗑️ Delete all progress')}</span><button class="tgl danger" data-t="reset">${tt('Reset')}</button></div>
      <p class="version">${tt('Reefy v{v} — made with love 🐠', { v: APP_VERSION })}<br/>
        <span class="diag">${storeCurrencyDiag}</span></p>
    `);
    el.querySelector('#name-save')!.addEventListener('click', () => {
      const input = el.querySelector<HTMLInputElement>('#name-input')!;
      const name = input.value.replace(/[<>&"']/g, '').trim();
      if (name.length < 3) { this.toast(tt('Name must be at least 3 characters')); return; }
      s.playerName = name;
      input.value = name;
      this.game.syncSave();
      audio.click();
      this.toast(tt('Name updated: {name}', { name }));
    });
    el.querySelector('#restore-iap')!.addEventListener('click', () => {
      const btn = el.querySelector<HTMLButtonElement>('#restore-iap')!;
      // Disabled for the round trip: the store call is not instant and a
      // second press would start a second restore against the same account.
      btn.disabled = true;
      audio.click();
      this.toast(tt('Checking your purchases…'));
      void this.game.restorePurchases().then((msg) => {
        btn.disabled = false;
        this.toast(msg);
      });
    });
    el.querySelector('#auth-btn')!.addEventListener('click', () => {
      void this.game.services.auth.signIn().then((res) => this.toast(res.msg));
    });
    el.querySelector('#cloud-btn')?.addEventListener('click', () => void this.onLinkCloud());
    this.bindCloudDelete(el);
    el.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const l = btn.dataset.lang as Lang;
        if (l === lang) return;
        s.lang = l;
        // From here on this is a CHOICE, and outranks detection on every
        // future launch (see save.ts langChosen).
        s.langChosen = true;
        setLang(l);
        this.game.syncSave();
        audio.click();
        location.reload();
      });
    });
    el.querySelectorAll<HTMLButtonElement>('.tgl[data-t]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.t!;
        if (t === 'music') {
          s.music = !s.music; audio.setMusic(s.music); this.game.syncSave(); this.renderSettings();
        } else if (t === 'sfx') {
          s.sfx = !s.sfx; audio.setSfx(s.sfx); audio.click(); this.game.syncSave(); this.renderSettings();
        } else if (t === 'share') {
          const data = { title: 'Reefy', text: tt('Check out my aquarium! 🐠'), url: 'https://reefy.games' };
          if (navigator.share) void navigator.share(data).catch(() => undefined);
          else {
            void navigator.clipboard?.writeText(data.url);
            this.toast(tt('Link copied! 📋'));
          }
        } else if (t === 'reset') {
          if (confirm(tt('All progress will be deleted. Are you sure?'))) this.game.resetAll();
        }
      });
    });
  }

  /**
   * Two taps, in place, rather than a confirm() dialog. The reset row still
   * uses confirm() and can stay that way, but a native modal blocks the page
   * hard enough that automation cannot get past it, and this is a path the
   * smoke run needs to be able to drive.
   */
  private bindCloudDelete(el: HTMLElement): void {
    const btn = el.querySelector<HTMLButtonElement>('#cloud-delete');
    if (!btn) return;
    let armed = false;
    btn.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        btn.textContent = tt('Tap again to confirm');
        btn.classList.add('armed');
        // Disarms itself, so a stray tap does not sit primed indefinitely.
        window.setTimeout(() => {
          if (!armed) return;
          armed = false;
          btn.textContent = tt('Delete');
          btn.classList.remove('armed');
        }, 5000);
        return;
      }
      armed = false;
      btn.disabled = true;
      btn.textContent = tt('Deleting…');
      void this.game.deleteCloudData().then((res) => {
        this.toast(res.msg);
        if (!res.ok) {
          btn.disabled = false;
          btn.textContent = tt('Delete');
          btn.classList.remove('armed');
          audio.error();
          return;
        }
        btn.textContent = tt('Deleted');
        btn.classList.remove('armed');
      });
    });
  }

  // ---------- cloud save ----------

  private cloudRowHTML(): string {
    if (!isAccountLinkingAvailable()) {
      return `<span class="set-note">${tt('On mobile')}</span>`;
    }
    if (isLinked()) {
      const who = linkedLabel();
      return `<span class="set-note ok">${who ? tt('Linked: {who}', { who }) : tt('Linked')}</span>`;
    }
    return `<button class="tgl" id="cloud-btn">${tt('Link')}</button>`;
  }

  /**
   * "Link" flow. If switched=true is returned, it means the selected account already
   * has a save; a cloud sync is run from scratch to compare that account's progress
   * with this device's, and if a conflict comes up the decision is left to the user.
   */
  private async onLinkCloud(): Promise<void> {
    this.toast(tt('Connecting to your Google account…'));
    const res = await linkWithGoogle();
    if (!res.ok) { audio.error(); this.toast(res.msg); return; }

    audio.click();
    this.toast(res.msg);

    if (!res.switched) { this.renderSettings(); return; }

    const outcome = await this.game.resyncCloudForNewAccount();
    if (outcome === 'conflict') { this.showCloudConflict(); return; }
    if (outcome === 'restored') {
      // Since the scene is built from the current save, restarting after a restore
      // is safer than playing with a half-updated state.
      this.toast(tt('Your progress was restored, restarting…'));
      setTimeout(() => location.reload(), 1200);
      return;
    }
    this.renderSettings();
  }

  /** Puts two saves side by side and lets the player choose. Auto-merging is NOT done:
   *  blending two economies breaks balance and opens the door to abuse. */
  showCloudConflict(): void {
    const c = this.game.cloud.conflictSummary;
    if (!c) return;
    const s = this.game.save;
    const when = c.updatedAtMs > 0 ? this.agoLabel(c.updatedAtMs) : tt('unknown');

    const el = this.panelShell(tt('☁️ Two progressions found'), `
      <p class="card-desc">${tt('You have also played on another device with this account. Which one do you want to continue with? The one you do not pick is not deleted, it stays in the cloud.')}</p>
      <div class="conflict-grid">
        <div class="conflict-card">
          <h3>☁️ ${tt('Cloud')}</h3>
          <p>${tt('Level {n}', { n: c.level })}</p>
          <p>${tt('{n} coins', { n: c.coins })}</p>
          <p>${tt('{n} species', { n: c.collection })}</p>
          <p class="muted">${when}</p>
          <button class="buy-btn" id="keep-cloud">${tt('Use this one')}</button>
        </div>
        <div class="conflict-card">
          <h3>📱 ${tt('This device')}</h3>
          <p>${tt('Level {n}', { n: s.level })}</p>
          <p>${tt('{n} coins', { n: s.coins })}</p>
          <p>${tt('{n} species', { n: s.collection.length })}</p>
          <p class="muted">${tt('just now')}</p>
          <button class="buy-btn" id="keep-local">${tt('Use this one')}</button>
        </div>
      </div>
    `, undefined, true);

    el.querySelector('#keep-cloud')!.addEventListener('click', () => {
      audio.click();
      if (this.game.cloud.resolveKeepCloud(this.game.save)) {
        // The scene still holds the old save's fish; no writes should happen
        // before the reload (see Game.freezeForRestore).
        this.game.freezeForRestore();
        this.toast(tt('Loading the progress from the cloud…'));
        setTimeout(() => location.reload(), 1000);
      } else {
        this.toast(tt('The save could not be read, the progress on this device was kept.'));
        this.closePanel();
      }
    });
    el.querySelector('#keep-local')!.addEventListener('click', () => {
      audio.click();
      void this.game.cloud.resolveKeepLocal(this.game.save).then(() => {
        this.toast(tt('The progress on this device was written to the cloud.'));
      });
      this.closePanel();
    });
  }

  private agoLabel(ms: number): string {
    const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (mins < 1) return tt('moments ago');
    if (mins < 60) return tt('{n} minutes ago', { n: mins });
    const hours = Math.round(mins / 60);
    if (hours < 24) return tt('{n} hours ago', { n: hours });
    return tt('{n} days ago', { n: Math.round(hours / 24) });
  }

  // ---------- modals ----------

  private showEggReveal(egg: EggTier, sp: Species): void {
    const info = RARITY_INFO[sp.rarity];
    const el = this.panelShell('', `
      <div class="reveal">
        <div class="reveal-egg">${egg.emoji}</div>
        <div class="reveal-fish" style="--glow:${info.color}">
          ${fishSVG(sp, 150)}
          <div class="card-name big">${tt(sp.name)}</div>
          ${rarityChip(sp.rarity)}
          <p class="card-desc">${tt(sp.desc)}</p>
          <button class="buy-btn reveal-ok">${tt('Awesome! 🎉')}</button>
        </div>
      </div>`);
    setTimeout(() => el.querySelector('.reveal')!.classList.add('hatched'), 1100);
    el.querySelector('.reveal-ok')!.addEventListener('click', () => {
      audio.click(); this.closePanel();
    });
  }

  showFishInfo(f: Fish): void {
    audio.click();
    const s = this.game.save;
    const gain = Math.round(f.sp.sellPrice * this.game.sellMult * (1 + f.bonus));
    const otherTanks = this.game.tankList().filter((t) => s.tanksOwned.includes(t.id) && t.id !== s.activeTank);
    const moveHTML = otherTanks.length
      ? `
        <h3 class="inv-head">${tt('🔀 Move to another tank')}</h3>
        <div class="move-list">${otherTanks.map((t) => {
          const count = this.game.tankFishCount(t.id);
          const cap = this.game.capacityFor(t.id);
          const boost = this.game.tankBoostPct(t.id);
          const full = count >= cap;
          return `
            <button class="tgl move-btn" data-move="${t.id}" ${full ? 'disabled' : ''}>
              <span>${biomeIcon(t.biome)} ${tt(t.name)}</span>
              <small>${tt('🐟 {n}/{cap}{boost}{full}', { n: count, cap, boost: boost > 0 ? tt(' • +{n}%', { n: boost }) : '', full: full ? tt(' • full') : '' })}</small>
            </button>`;
        }).join('')}</div>`
      : '';
    const el = this.panelShell(`${f.name}`, `
      <div class="fish-info">
        <div class="card-art">${fishSVG(f.sp, 120)}</div>
        <div class="card-name">${tt(f.sp.name)} ${rarityChip(f.sp.rarity)}</div>
        <div class="name-edit fish-rename">
          <input id="fish-name-input" value="${f.name}" maxlength="14" autocomplete="off"/>
          <button class="tgl" id="fish-name-save">${tt('✏️ Rename')}</button>
        </div>
        <button class="tgl" id="fish-pet-btn" ${this.game.canPetToday ? '' : 'disabled'}>${this.game.canPetToday ? tt('🤗 Pet') : tt('🤗 Petted today')}</button>
        <p class="card-desc">${tt(f.sp.desc)}</p>
        <div class="bar-row"><span>${tt('Growth ({stage})', { stage: f.stageName })}</span>
          <div class="bar"><div id="fi-grow" style="width:${Math.min(100, f.progress * 100)}%"></div></div></div>
        <div class="bar-row"><span>${tt('Hunger')} ${f.isSad ? tt('😢 hungry!') : ''}</span>
          <div class="bar"><div id="fi-hunger" class="hunger" style="width:${f.hunger * 100}%"></div></div></div>
        <div class="card-meta">${tt('Output: 🪙 {n}/hour {state}', { n: RARITY_INCOME[f.sp.rarity], state: f.isAdult ? tt('(active)') : tt('(once adult)') })}</div>
        ${f.bonus > 0 ? `<div class="card-meta bonus-line">${tt('✨ Feed bonus: sale +{n}%', { n: Math.round(f.bonus * 100) })}</div>` : ''}
        ${f.isAdult
          ? `<button class="buy-btn sell">${tt('🪙 Sell for {n}', { n: fmt(gain) })}</button>`
          : `<p class="growing">${tt('Growing… wait for it to become an adult to sell 🌱')}</p>`}
        ${moveHTML}
      </div>`);
    el.querySelector('#fish-name-save')!.addEventListener('click', () => {
      const input = el.querySelector<HTMLInputElement>('#fish-name-input')!;
      const name = input.value.replace(/[<>&"']/g, '').trim();
      if (name.length < 2) { this.toast(tt('Name must be at least 2 characters')); return; }
      f.name = name;
      input.value = name;
      el.querySelector('.panel-head h2')!.textContent = name;
      this.game.syncSave();
      audio.click();
      this.toast(tt('Name updated: {name} 🐟', { name }));
    });
    el.querySelector('#fish-pet-btn')?.addEventListener('click', () => {
      const res = this.game.petFish(f);
      if (!res.ok) audio.error();
      this.toast(res.msg);
      if (res.ok) this.closePanel();
    });
    const sellBtn = el.querySelector<HTMLButtonElement>('.sell');
    if (sellBtn) {
      sellBtn.addEventListener('click', () => {
        const res = this.game.sellFish(f);
        this.toast(res.msg);
        this.closePanel();
      });
    }
    el.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.game.moveFish(f, btn.dataset.move!);
        if (!res.ok) audio.error();
        this.toast(res.msg);
        if (res.ok) this.closePanel();
      });
    });
    this.fishInfoTimer = window.setInterval(() => {
      const g = el.querySelector<HTMLElement>('#fi-grow');
      const h = el.querySelector<HTMLElement>('#fi-hunger');
      if (!g || !h) return;
      g.style.width = `${Math.min(100, f.progress * 100)}%`;
      h.style.width = `${f.hunger * 100}%`;
    }, 500);
  }

  /** Opens the profile of a (dormant) fish in another tank from the inventory — the counterpart to showFishInfo that doesn't require a live Fish. */
  private showDormantFishInfo(fs: FishSave): void {
    audio.click();
    const sp = speciesById(fs.sp);
    const bonus = fs.bonus ?? 0;
    const gain = Math.round(sp.sellPrice * this.game.sellMult * (1 + bonus));
    const stageName = fs.progress >= 1 ? tt('Adult') : fs.progress >= 0.5 ? tt('Young') : tt('Baby');
    const isSad = fs.hunger < SAD_THRESHOLD;
    const el = this.panelShell(`${fs.name}`, `
      <div class="fish-info">
        <div class="card-art">${fishSVG(sp, 120)}</div>
        <div class="card-name">${tt(sp.name)} ${rarityChip(sp.rarity)}</div>
        <div class="name-edit fish-rename">
          <input id="fish-name-input" value="${fs.name}" maxlength="14" autocomplete="off"/>
          <button class="tgl" id="fish-name-save">${tt('✏️ Rename')}</button>
        </div>
        <button class="tgl" id="fish-pet-btn" ${this.game.canPetToday ? '' : 'disabled'}>${this.game.canPetToday ? tt('🤗 Pet') : tt('🤗 Petted today')}</button>
        <p class="card-desc">${tt(sp.desc)}</p>
        <div class="bar-row"><span>${tt('Growth ({stage})', { stage: stageName })}</span>
          <div class="bar"><div id="fi-grow" style="width:${Math.min(100, fs.progress * 100)}%"></div></div></div>
        <div class="bar-row"><span>${tt('Hunger')} ${isSad ? tt('😢 hungry!') : ''}</span>
          <div class="bar"><div id="fi-hunger" class="hunger" style="width:${fs.hunger * 100}%"></div></div></div>
        <div class="card-meta">${tt('Output: 🪙 {n}/hour {state}', { n: RARITY_INCOME[sp.rarity], state: fs.progress >= 1 ? tt('(active)') : tt('(once adult)') })}</div>
        ${bonus > 0 ? `<div class="card-meta bonus-line">${tt('✨ Feed bonus: sale +{n}%', { n: Math.round(bonus * 100) })}</div>` : ''}
        ${fs.progress >= 1
          ? `<button class="buy-btn sell">${tt('🪙 Sell for {n}', { n: fmt(gain) })}</button>`
          : `<p class="growing">${tt('Growing… wait for it to become an adult to sell 🌱')}</p>`}
      </div>`);
    el.querySelector('#fish-name-save')!.addEventListener('click', () => {
      const input = el.querySelector<HTMLInputElement>('#fish-name-input')!;
      const name = input.value.replace(/[<>&"']/g, '').trim();
      if (name.length < 2) { this.toast(tt('Name must be at least 2 characters')); return; }
      fs.name = name;
      input.value = name;
      el.querySelector('.panel-head h2')!.textContent = name;
      this.game.syncSave();
      audio.click();
      this.toast(tt('Name updated: {name} 🐟', { name }));
    });
    el.querySelector('#fish-pet-btn')?.addEventListener('click', () => {
      const res = this.game.petDormant(fs);
      if (!res.ok) audio.error();
      this.toast(res.msg);
      if (res.ok) this.closePanel();
    });
    const sellBtn = el.querySelector<HTMLButtonElement>('.sell');
    if (sellBtn) {
      sellBtn.addEventListener('click', () => {
        const res = this.game.sellDormant(fs);
        this.toast(res.msg);
        this.closePanel();
      });
    }
    this.fishInfoTimer = window.setInterval(() => {
      const g = el.querySelector<HTMLElement>('#fi-grow');
      const h = el.querySelector<HTMLElement>('#fi-hunger');
      if (!g || !h) return;
      g.style.width = `${Math.min(100, fs.progress * 100)}%`;
      h.style.width = `${fs.hunger * 100}%`;
    }, 500);
  }

  /**
   * The streak ladder. The gift already grows with the streak and every seventh day
   * already pays three pearls instead of one; none of that was visible anywhere, so
   * this screen adds no incentive, it just shows the one that exists.
   */
  private showStreak(): void {
    const s = this.game.save;
    const cycle = this.game.streakCycle();
    const cells = cycle.map((c) => `
      <div class="streak-cell ${c.state}">
        <span class="streak-day">${c.day}</span>
        ${c.state === 'done'
          ? '<span class="streak-tick">✓</span>'
          : `<span class="streak-prize">${c.pearls >= 3 ? `${ICON_PEARL}${c.pearls}` : fmt(c.coins)}</span>`}
      </div>`).join('');

    const today = cycle.find((c) => c.state === 'today')!;
    const toSeventh = 7 - today.day;

    this.panelShell(tt('Daily streak'), `
      <div class="streak">
        <div class="streak-count"><b>${s.streak}</b><span>${tt('days in a row')}</span></div>
        <div class="streak-strip">${cells}</div>
        <p class="streak-note">${toSeventh > 0
          ? tt('{n} more days until the rare egg reward', { n: toSeventh })
          : tt('Seventh day — the big reward is today')}</p>
        <div class="streak-best">${tt('Best streak')}<b>${s.bestStreak} ${tt('days')}</b></div>
      </div>`);
  }

  /** Minutes as a duration a person would say out loud: "4h 12m", not "252 minutes". */
  private awayLabel(mins: number): string {
    if (mins < 60) return tt('{n}m', { n: mins });
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 24) return m ? tt('{h}h {m}m', { h, m }) : tt('{h}h', { h });
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh ? tt('{d}d {h}h', { d, h: rh }) : tt('{d}d', { d });
  }

  /**
   * The return receipt. Offline earnings and the daily gift used to arrive as a
   * stack of sentences; they are the same event — what happened while you were gone —
   * so they read as one itemised slip instead.
   */
  private showWelcome(): void {
    const o = this.game.offline;
    if (o.minutes < 3 && !o.dailyGift) return;
    const s = this.game.save;

    const row = (label: string, value: string) =>
      `<div class="receipt-row"><span>${label}</span><b>${value}</b></div>`;

    let body = '';
    if (o.minutes >= 3) {
      body += `<div class="receipt-lede">${tt('You were away')} <b>${this.awayLabel(o.minutes)}</b></div>`;
      if (o.income > 0) body += row(tt('Your fish produced'), `${ICON_COIN}${fmt(o.income)}`);
      if (o.grown > 0) body += row(tt('Grew up'), String(o.grown));
      const hungry = this.game.fishes.filter((f) => f.isSad).length;
      if (hungry > 0) body += row(tt('Hungry now'), String(hungry));
    }

    if (o.dailyGift) {
      const streakLine = s.streak > 1
        ? `<small>${tt('{n} day streak', { n: s.streak })}${s.streak % 7 === 0 ? ` · ${tt('seventh day bonus')}` : ''}</small>`
        : '';
      body += `
        <div class="receipt-gift">
          <div class="receipt-gift-head"><span>${tt('Daily gift')}</span>${streakLine}</div>
          <div class="receipt-gift-value">
            ${ICON_COIN}<b>+${fmt(o.giftCoins)}</b>
            ${o.giftPearls > 0 ? `${ICON_PEARL}<b>+${o.giftPearls}</b>` : ''}
          </div>
        </div>`;
    }

    const el = this.panelShell(tt('Welcome back'), `
      <div class="receipt">${body}
      <button class="buy-btn welcome-ok">${tt('Dive in')}</button></div>`);
    el.querySelector('.welcome-ok')!.addEventListener('click', () => {
      audio.click(); this.dismissPanel();
    });
  }

  /** Mandatory step-by-step tutorial on first launch: can't be dismissed by tapping outside, advances via "Next". */
  private runTutorial(): void {
    const s = this.game.save;
    if (s.tutorialDone) return;
    const steps: { title: string; body: string }[] = [
      { title: tt('🌊 Welcome to Reefy!'), body: tt('This reef is now yours. Grow your fish, complete your collection, and build your own reef.') },
      { title: tt('🍤 Learn to feed'), body: tt('Tap "Feed" in the bottom menu, pick a feed, then tap the water to feed. Quality feed boosts sale price!') },
      { title: tt('🐟 Sell and grow'), body: tt('Tap adult fish to sell them, then use your earnings to buy new species and grow your reef.') },
      { title: tt('📋 Daily quests'), body: tt('Complete daily quests, place decorations, and grow your tank to make room for more fish!') },
    ];
    let i = 0;
    const wrap = document.createElement('div');
    wrap.className = 'tutorial-backdrop';
    const render = (): void => {
      const last = i === steps.length - 1;
      wrap.innerHTML = `
        <div class="tutorial-card">
          <h2>${steps[i].title}</h2>
          <p>${steps[i].body}</p>
          <div class="tutorial-dots">${steps.map((_, k) => `<span class="dot ${k === i ? 'active' : ''}"></span>`).join('')}</div>
          <button class="buy-btn tutorial-next">${last ? tt("Let's dive in! 🎉") : tt('Next')}</button>
        </div>`;
      wrap.querySelector('.tutorial-next')!.addEventListener('click', () => {
        audio.click();
        if (last) {
          s.tutorialDone = true;
          this.game.syncSave();
          wrap.remove();
        } else {
          i++;
          render();
        }
      });
    };
    render();
    this.root.appendChild(wrap);
  }
}

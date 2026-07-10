import { audio } from './audio';
import { APP_VERSION } from './version';
import { DECOR, DECOR_BOOST, DecorDef, MAX_PLACED, decorById } from './decor';
import type { Fish } from './fish';
import type { Game } from './game';
import { ACHIEVEMENTS } from './quests';
import { EggTier, PITY_LIMIT, RARITY_INCOME, RARITY_INFO, Rarity, SPECIES, Species } from './species';
import { BIOME_INFO, TankDef } from './tanks';

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

/** Tür için mini SVG önizlemesi (mağaza/koleksiyon kartları). */
export function fishSVG(sp: Species, size = 84, silhouette = false): string {
  const c = silhouette
    ? { body: '#a9b8c2', belly: '#c3cfd8', fin: '#93a5b1', accent: '#c3cfd8' }
    : { body: hex(sp.colors.body), belly: hex(sp.colors.belly), fin: hex(sp.colors.fin), accent: hex(sp.colors.accent) };
  const H = 100 * (sp.bodyH ?? 0.48);
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
  return `<svg viewBox="-105 -70 210 140" width="${size}" height="${(size * 140) / 210}" xmlns="http://www.w3.org/2000/svg">
    ${glow}
    <path d="M -48 0 L ${-48 - 34 * FS} ${-H * 0.45 * FS} Q ${-48 - 20 * FS} 0 ${-48 - 34 * FS} ${H * 0.45 * FS} Z" fill="${c.fin}"/>
    <path d="M -15 ${-H / 2 + 2} L 5 ${-H / 2 - H * 0.45 * FS} L 22 ${-H / 2 + 2} Z" fill="${c.fin}" opacity="0.95"/>
    <clipPath id="b-${uid}"><ellipse cx="0" cy="0" rx="50" ry="${H / 2}"/></clipPath>
    <ellipse cx="0" cy="0" rx="50" ry="${H / 2}" fill="${c.body}"/>
    <g clip-path="url(#b-${uid})">
      <ellipse cx="2" cy="${H * 0.16}" rx="40" ry="${H * 0.32}" fill="${c.belly}"/>
      ${pattern}
    </g>
    <circle cx="30" cy="${-H * 0.08}" r="5.2" fill="${silhouette ? '#e6edf2' : '#ffffff'}"/>
    <circle cx="31.5" cy="${-H * 0.08}" r="2.6" fill="${silhouette ? '#8a99a5' : '#26262e'}"/>
  </svg>`;
}

/** Dekor için mini SVG önizlemesi. */
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
  return `<span class="chip" style="background:${info.color}">${info.name}</span>`;
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
  private hudXpBar!: HTMLElement;
  private hudCap!: HTMLElement;
  private hudTank!: HTMLElement;
  private panelHost!: HTMLElement;
  private toastHost!: HTMLElement;
  private fishInfoTimer: number | null = null;

  constructor(game: Game) {
    this.game = game;
  }

  mount(root: HTMLElement): void {
    this.root = root;
    root.innerHTML = `
      <div id="hud">
        <div class="hud-chip">🪙 <b id="hud-coins"></b></div>
        <div class="hud-chip">🦪 <b id="hud-pearls"></b></div>
        <div class="hud-chip hud-level">
          <span id="hud-level"></span>
          <span class="xpbar"><span id="hud-xp"></span></span>
        </div>
        <div class="hud-chip">🐟 <span id="hud-cap"></span></div>
        <div class="hud-chip hud-tank" id="hud-tank" title="Akvaryum değiştir"></div>
      </div>
      <div id="bottombar">
        <button data-act="feed">🍤<span>Besle</span></button>
        <button data-act="shop">🛒<span>Mağaza</span></button>
        <button data-act="inventory">🎒<span>Envanter</span></button>
        <button data-act="social">🏆<span>Sosyal</span></button>
        <button data-act="more">☰<span>Daha</span></button>
      </div>
      <button id="collect-btn" class="hidden">🪙 <b id="collect-amount">0</b><span id="collect-rate"></span></button>
      <div id="panel-host"></div>
      <div id="toasts"></div>
    `;
    this.hudCoins = root.querySelector('#hud-coins')!;
    this.hudPearls = root.querySelector('#hud-pearls')!;
    this.hudLevel = root.querySelector('#hud-level')!;
    this.hudXpBar = root.querySelector('#hud-xp')!;
    this.hudCap = root.querySelector('#hud-cap')!;
    this.hudTank = root.querySelector('#hud-tank')!;
    this.panelHost = root.querySelector('#panel-host')!;
    this.toastHost = root.querySelector('#toasts')!;

    root.querySelectorAll<HTMLButtonElement>('#bottombar button').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        const act = btn.dataset.act!;
        if (act === 'feed') this.game.feed();
        else if (act === 'shop') this.renderShop('fish');
        else if (act === 'inventory') this.renderInventory('decor');
        else if (act === 'social') this.renderSocial('leaderboard');
        else if (act === 'more') this.renderMore();
      });
    });
    this.hudTank.addEventListener('click', () => {
      audio.click();
      this.renderInventory('tanks');
    });
    root.querySelector('#collect-btn')!.addEventListener('click', () => {
      const res = this.game.collectIncome();
      this.toast(res.msg);
    });

    this.refreshHUD();
    this.showWelcome();
    this.runTutorial();
  }

  refreshHUD(): void {
    const s = this.game.save;
    this.hudCoins.textContent = fmt(s.coins);
    this.hudPearls.textContent = fmt(s.pearls);
    this.hudLevel.textContent = `Sv ${s.level}`;
    this.hudXpBar.style.width = `${Math.min(100, (100 * s.xp) / this.game.xpNeed(s.level))}%`;
    this.hudCap.textContent = `${this.game.fishes.length}/${this.game.capacity}`;
    const t = this.game.activeTank;
    const boost = Math.round((this.game.growthMult - 1) * 100);
    this.hudTank.innerHTML = `${BIOME_INFO[t.biome].emoji} ${t.name}${boost > 0 ? ` <b class="boost">+%${boost}</b>` : ''}`;
  }

  /** Pasif gelir butonunu günceller (oyun döngüsünden ~saniyede 2 kez çağrılır). */
  updateIncome(pot: number, ratePerHour: number): void {
    if (!this.root) return;
    const btn = this.root.querySelector<HTMLElement>('#collect-btn');
    if (!btn) return;
    // Üretim varsa buton her zaman görünür (birikim 0 olsa bile keşfedilebilir olsun)
    if (pot < 1 && ratePerHour <= 0) {
      btn.classList.add('hidden');
      return;
    }
    btn.classList.remove('hidden');
    btn.classList.toggle('empty', pot < 1);
    this.root.querySelector('#collect-amount')!.textContent = fmt(pot);
    this.root.querySelector('#collect-rate')!.textContent = ratePerHour > 0 ? `${fmt(ratePerHour)}/sa` : '';
  }

  toast(msg: string): void {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.toastHost.appendChild(t);
    setTimeout(() => t.classList.add('show'), 20);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, 3400);
  }

  // ---------- panel çatısı ----------

  private closePanel(): void {
    if (this.fishInfoTimer !== null) {
      clearInterval(this.fishInfoTimer);
      this.fishInfoTimer = null;
    }
    this.panelHost.innerHTML = '';
  }

  private panelShell(title: string, bodyHTML: string, tabs?: { id: string; label: string; active: boolean }[]): HTMLElement {
    this.closePanel();
    const wrap = document.createElement('div');
    wrap.className = 'panel-backdrop';
    const tabHTML = tabs
      ? `<div class="tabs">${tabs.map((t) => `<button class="tab ${t.active ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>`
      : '';
    wrap.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>${title}</h2><button class="close-btn">✕</button></div>
        ${tabHTML}
        <div class="panel-body">${bodyHTML}</div>
      </div>`;
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) { audio.click(); this.closePanel(); }
    });
    wrap.querySelector('.close-btn')!.addEventListener('click', () => {
      audio.click(); this.closePanel();
    });
    this.panelHost.appendChild(wrap);
    return wrap;
  }

  // ---------- MAĞAZA ----------

  private shopTabs(active: string) {
    return [
      { id: 'fish', label: '🐟 Balık', active: active === 'fish' },
      { id: 'eggs', label: '🥚 Yumurta', active: active === 'eggs' },
      { id: 'decor', label: '🪸 Dekor', active: active === 'decor' },
      { id: 'tanks', label: '🏝️ Akvaryum', active: active === 'tanks' },
      { id: 'pearls', label: '💎 İnci', active: active === 'pearls' },
    ];
  }

  private bindShopTabs(el: HTMLElement): void {
    el.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        this.renderShop(btn.dataset.tab as 'fish' | 'eggs' | 'decor' | 'tanks' | 'pearls');
      });
    });
  }

  renderShop(tab: 'fish' | 'eggs' | 'decor' | 'tanks' | 'pearls', keepScroll = 0): void {
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
            <div class="card-name">${locked ? '🔒 ' + sp.name : sp.name}</div>
            ${rarityChip(sp.rarity)}
            <div class="card-meta">Satış: 🪙 ${fmt(sp.sellPrice)} • ${Math.round(sp.growthMs / 60000)} dk${locked ? ` • Sv ${sp.unlockLevel}` : ''}</div>
            <button class="buy-btn" data-sp="${sp.id}" ${locked ? 'disabled' : ''}>${price}</button>
          </div>`;
      }).join('')}</div>`;
    } else if (tab === 'eggs') {
      body = `<div class="grid">${this.game.eggList().map((egg) => {
        const odds = (Object.entries(egg.odds) as [Rarity, number][])
          .map(([r, p]) => `<div class="odd-row"><span style="color:${RARITY_INFO[r].color}">●</span> ${RARITY_INFO[r].name} <b>%${p}</b></div>`)
          .join('');
        const cur = egg.currency === 'coins' ? '🪙' : '🦪';
        const pity = egg.id === 'altin'
          ? `<div class="pity">Efsanevi garanti: ${s.pityCounter}/${PITY_LIMIT}</div>` : '';
        return `
          <div class="card">
            <div class="egg-emoji">${egg.emoji}</div>
            <div class="card-name">${egg.name}</div>
            <div class="card-desc">${egg.desc}</div>
            <div class="odds">${odds}</div>
            ${pity}
            <button class="buy-btn" data-egg="${egg.id}">${cur} ${fmt(egg.cost)}</button>
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
            <div class="card-name">${d.name}</div>
            ${rarityChip(d.rarity)}
            <div class="card-meta">+%${DECOR_BOOST[d.rarity]} büyüme & gelir${owned ? ` • 🎒 ${owned}` : ''}</div>
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
            <div class="card-name">${BIOME_INFO[t.biome].emoji} ${t.name}</div>
            ${rarityChip(t.rarity)}
            <div class="card-desc">${t.desc}</div>
            <div class="card-meta">+%${t.growthBonus} büyüme & gelir${locked ? ` • Sv ${t.unlockLevel}` : ''}</div>
            ${ownedT
              ? '<button class="buy-btn owned" disabled>Sahipsin ✓</button>'
              : `<button class="buy-btn" data-tank="${t.id}" ${locked ? 'disabled' : ''}>${t.price === 0 ? 'Ücretsiz' : `${cur} ${fmt(t.price)}`}</button>`}
          </div>`;
      }).join('')}</div>`;
    } else {
      const packs = this.game.services.iap.packs();
      body = `
        <p class="dex-info">💎 İnci paketleri gerçek parayla satın alınır. <b>${this.game.services.iap.storeLabel}</b> modundasın — satın alma, Google Play / App Store sürümünde etkinleşir. İnciyi görevlerden, seviye ve set ödüllerinden de kazanabilirsin.</p>
        <div class="grid">${packs.map((p) => `
          <div class="card">
            <div class="egg-emoji">${p.emoji}</div>
            <div class="card-name">${p.name}</div>
            <div class="card-desc">🦪 ${p.pearls} inci ${p.bonus ? `<br/><b>${p.bonus}</b>` : ''}</div>
            <button class="buy-btn iap" data-iap="${p.id}">${p.priceLabel}</button>
          </div>`).join('')}</div>`;
    }

    const el = this.panelShell('🛒 Mağaza', body, this.shopTabs(tab));
    this.bindShopTabs(el);
    const bodyEl = el.querySelector<HTMLElement>('.panel-body')!;
    if (keepScroll > 0) bodyEl.scrollTop = keepScroll;

    el.querySelectorAll<HTMLButtonElement>('.buy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = bodyEl.scrollTop; // toplu alımlarda kaydırma konumunu koru
        if (btn.dataset.sp) {
          const res = this.game.buyFish(btn.dataset.sp);
          if (!res.ok) audio.error();
          this.toast(res.msg);
          if (res.ok) this.renderShop('fish', st);
        } else if (btn.dataset.egg) {
          const egg = this.game.eggList().find((e) => e.id === btn.dataset.egg)!;
          const res = this.game.hatchEgg(egg);
          if (!res.ok) { audio.error(); this.toast(res.msg); return; }
          this.showEggReveal(egg, res.species!);
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
            if (res.ok && res.grantPearls) {
              this.game.save.pearls += res.grantPearls;
              if (res.grantCoins) this.game.save.coins += res.grantCoins;
              this.game.syncSave();
              this.refreshHUD();
            }
            this.toast(res.msg);
          });
        }
      });
    });
  }

  // ---------- ENVANTER ----------

  renderInventory(tab: 'decor' | 'tanks'): void {
    const s = this.game.save;
    const tabs = [
      { id: 'decor', label: '🪸 Dekorlarım', active: tab === 'decor' },
      { id: 'tanks', label: '🏝️ Akvaryumlarım', active: tab === 'tanks' },
    ];
    let body = '';

    if (tab === 'decor') {
      const placed = s.decorPlaced[s.activeTank] ?? [];
      const ownedIds = Object.keys(s.decorOwned).filter((id) => (s.decorOwned[id] ?? 0) > 0);
      const placedHTML = placed.length
        ? placed.map((p, i) => {
            const d = decorById(p.def);
            return `
              <div class="inv-row">
                <span class="inv-art">${decorSVG(d, 44)}</span>
                <span class="inv-name">${d.name} ${rarityChip(d.rarity)}</span>
                <button class="tgl danger" data-remove="${i}">Kaldır</button>
              </div>`;
          }).join('')
        : '<p class="empty">Bu akvaryumda henüz dekor yok.</p>';
      const ownedHTML = ownedIds.length
        ? ownedIds.map((id) => {
            const d = decorById(id);
            return `
              <div class="inv-row">
                <span class="inv-art">${decorSVG(d, 44)}</span>
                <span class="inv-name">${d.name} <b>×${s.decorOwned[id]}</b> ${rarityChip(d.rarity)}</span>
                <button class="tgl on" data-place="${id}">Yerleştir</button>
              </div>`;
          }).join('')
        : '<p class="empty">Çantanda dekor yok — Mağaza → Dekor sekmesine göz at! 🛒</p>';
      body = `
        <h3 class="inv-head">Bu akvaryumda (${placed.length}/${MAX_PLACED})</h3>${placedHTML}
        <h3 class="inv-head">Çantanda</h3>${ownedHTML}`;
    } else {
      body = `<div class="grid tanks-grid">${this.game.tankList()
        .filter((t) => s.tanksOwned.includes(t.id))
        .map((t) => {
          const active = t.id === s.activeTank;
          const count = this.game.tankFishCount(t.id);
          return `
            <div class="card ${active ? 'active-tank' : ''}">
              ${tankSwatch(t)}
              <div class="card-name">${BIOME_INFO[t.biome].emoji} ${t.name}</div>
              <div class="card-meta">🐟 ${count} balık • +%${this.game.tankBoostPct(t.id)} büyüme & gelir</div>
              ${active
                ? '<button class="buy-btn owned" disabled>Buradasın 📍</button>'
                : `<button class="buy-btn" data-switch="${t.id}">Geç</button>`}
            </div>`;
        }).join('')}</div>
        <p class="dex-info">Yeni akvaryumlar Mağaza → Akvaryum sekmesinde! 🛒</p>`;
    }

    const el = this.panelShell('🎒 Envanter', body, tabs);
    el.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        this.renderInventory(btn.dataset.tab as 'decor' | 'tanks');
      });
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

  // ---------- SOSYAL ----------

  renderSocial(tab: 'leaderboard' | 'friends'): void {
    const s = this.game.save;
    const tabs = [
      { id: 'leaderboard', label: '🏆 Liderlik', active: tab === 'leaderboard' },
      { id: 'friends', label: '👥 Arkadaşlar', active: tab === 'friends' },
    ];
    let body = '';

    if (tab === 'leaderboard') {
      const rows = this.game.services.social.leaderboard(s);
      body = `
        <p class="dex-info">Toplam kazanca göre sıralama. <i>${this.game.services.social.label}</i></p>
        <div class="lb">${rows.map((r) => `
          <div class="lb-row ${r.isPlayer ? 'me' : ''}">
            <span class="lb-rank">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : '#' + r.rank}</span>
            <span class="lb-name">${r.name}</span>
            <span class="lb-score">🪙 ${fmt(r.score)}</span>
          </div>`).join('')}</div>`;
    } else {
      const friendRows = s.friends.length
        ? s.friends.map((f) => `
            <div class="inv-row">
              <span class="inv-name">👤 ${f.name} <span class="lb-code">${f.code}</span></span>
              <span class="pending">eşleşme bekliyor ⏳</span>
            </div>`).join('')
        : '<p class="empty">Henüz arkadaş eklemedin.</p>';
      body = `
        <div class="friend-code-box">
          <span>Senin kodun:</span> <b id="my-code">${s.friendCode}</b>
          <button class="tgl" id="copy-code">Kopyala</button>
        </div>
        <div class="friend-add">
          <input id="friend-input" placeholder="REEF-XXXXX" maxlength="10" autocomplete="off"/>
          <button class="buy-btn" id="friend-add-btn">Ekle</button>
        </div>
        <h3 class="inv-head">Arkadaşların</h3>
        ${friendRows}
        <p class="dex-info">Arkadaş kodları kaydedilir; çevrimiçi sürüm bağlandığında otomatik eşleşir ve birbirinizin akvaryumlarını ziyaret edebilirsiniz. 🤝</p>`;
    }

    const el = this.panelShell('🏆 Sosyal', body, tabs);
    el.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        this.renderSocial(btn.dataset.tab as 'leaderboard' | 'friends');
      });
    });
    el.querySelector('#copy-code')?.addEventListener('click', () => {
      void navigator.clipboard?.writeText(s.friendCode);
      this.toast('Kod kopyalandı! Arkadaşlarınla paylaş 📋');
    });
    el.querySelector('#friend-add-btn')?.addEventListener('click', () => {
      const input = el.querySelector<HTMLInputElement>('#friend-input')!;
      const res = this.game.services.social.addFriend(s, input.value);
      if (!res.ok) audio.error(); else { audio.click(); this.game.syncSave(); }
      this.toast(res.msg);
      if (res.ok) this.renderSocial('friends');
    });
  }

  // ---------- DAHA / GÖREVLER / KOLEKSİYON / AYARLAR ----------

  private renderMore(): void {
    const el = this.panelShell('☰ Menü', `
      <div class="more-grid">
        <button class="more-btn" data-go="quests">📋<span>Görevler</span></button>
        <button class="more-btn" data-go="collection">📖<span>Koleksiyon</span></button>
        <button class="more-btn" data-go="settings">⚙️<span>Ayarlar</span></button>
      </div>`);
    el.querySelectorAll<HTMLButtonElement>('.more-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        const go = btn.dataset.go!;
        if (go === 'quests') this.renderQuests();
        else if (go === 'collection') this.renderCollection();
        else this.renderSettings();
      });
    });
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
            <div class="q-name">${q.name}</div>
            <div class="bar"><div style="width:${(100 * cur) / q.target}%"></div></div>
            <div class="q-meta">${cur}/${q.target} • 🪙 ${coins}${q.rewardPearls ? ` + 🦪 ${q.rewardPearls}` : ''}</div>
          </div>
          ${claimed ? '<span class="q-done">✓</span>'
            : done ? `<button class="buy-btn" data-claim="${q.id}">Al</button>`
            : ''}
        </div>`;
    }).join('');

    const achHTML = ACHIEVEMENTS.map((a) => {
      const cur = Math.min(a.target, a.check(s));
      const claimed = s.achievementsClaimed.includes(a.id);
      const done = cur >= a.target;
      return `
        <div class="quest-row ${claimed ? 'claimed' : ''}">
          <span class="q-emoji">${a.emoji}</span>
          <div class="q-mid">
            <div class="q-name">${a.name} — <span class="q-desc">${a.desc}</span></div>
            <div class="bar"><div style="width:${(100 * cur) / a.target}%"></div></div>
            <div class="q-meta">${cur}/${a.target} • 🪙 ${a.rewardCoins}${a.rewardPearls ? ` + 🦪 ${a.rewardPearls}` : ''}</div>
          </div>
          ${claimed ? '<span class="q-done">✓</span>'
            : done ? `<button class="buy-btn" data-ach="${a.id}">Al</button>`
            : ''}
        </div>`;
    }).join('');

    const el = this.panelShell('📋 Görevler', `
      <h3 class="inv-head">Günlük görevler 🔥 Seri: ${s.streak} gün</h3>
      ${dailyHTML}
      <h3 class="inv-head">Başarımlar</h3>
      ${achHTML}`);
    el.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = daily.find((x) => x.id === btn.dataset.claim)!;
        const res = this.game.claimQuest(q);
        this.toast(res.msg);
        if (res.ok) this.renderQuests();
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-ach]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.game.claimAchievement(btn.dataset.ach!);
        this.toast(res.msg);
        if (res.ok) this.renderQuests();
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
            <div class="dex-name">${has ? sp.name : '???'}</div>
          </div>`;
      }).join('');
      return `
        <div class="dex-group">
          <div class="dex-head">
            <span class="chip" style="background:${info.color}">${info.name}</span>
            <span class="dex-count">${got}/${list.length} ${done ? '✅ +%5 satış bonusu' : ''}</span>
          </div>
          <div class="dex-row">${cards}</div>
        </div>`;
    }).join('');
    const bonus = Math.round((this.game.sellMult - 1) * 100);
    this.panelShell('📖 Koleksiyon', `
      <p class="dex-info">${s.collection.length}/100 tür toplandı. Bir türü ilk kez yetişkinliğe ulaştırdığında koleksiyona eklenir.
      Tamamlanan her set kalıcı <b>+%5 satış bonusu</b> verir. Şu anki bonus: <b>+%${bonus}</b></p>
      ${groups}`);
  }

  private renderSettings(): void {
    const s = this.game.save;
    const identity = this.game.services.auth.current();
    const el = this.panelShell('⚙️ Ayarlar', `
      <div class="set-row"><span>👤 Oyuncu adı</span>
        <span class="name-edit"><input id="name-input" value="${s.playerName}" maxlength="16"/><button class="tgl" id="name-save">Kaydet</button></span></div>
      <div class="set-row"><span>🎮 Hesap</span>
        <button class="tgl" id="auth-btn">${identity ? this.game.services.auth.platformLabel : 'Giriş yap'}</button></div>
      <hr/>
      <div class="set-row"><span>🎵 Müzik</span><button class="tgl ${s.music ? 'on' : ''}" data-t="music">${s.music ? 'Açık' : 'Kapalı'}</button></div>
      <div class="set-row"><span>🔊 Ses Efektleri</span><button class="tgl ${s.sfx ? 'on' : ''}" data-t="sfx">${s.sfx ? 'Açık' : 'Kapalı'}</button></div>
      <div class="set-row"><span>📤 Arkadaşlarına anlat</span><button class="tgl" data-t="share">Paylaş</button></div>
      <hr/>
      <div class="set-links">
        <a href="https://reefy.games" target="_blank" rel="noopener">🌐 reefy.games</a>
        <a href="mailto:destek@reefy.games">✉️ destek@reefy.games</a>
      </div>
      <hr/>
      <div class="set-row"><span>🗑️ Tüm ilerlemeyi sil</span><button class="tgl danger" data-t="reset">Sıfırla</button></div>
      <p class="version">Reefy v${APP_VERSION} — sevgiyle yapıldı 🐠</p>
    `);
    el.querySelector('#name-save')!.addEventListener('click', () => {
      const input = el.querySelector<HTMLInputElement>('#name-input')!;
      const name = input.value.trim();
      if (name.length < 3) { this.toast('İsim en az 3 karakter olmalı'); return; }
      s.playerName = name;
      this.game.syncSave();
      audio.click();
      this.toast('İsim güncellendi: ' + name);
    });
    el.querySelector('#auth-btn')!.addEventListener('click', () => {
      void this.game.services.auth.signIn().then((res) => this.toast(res.msg));
    });
    el.querySelectorAll<HTMLButtonElement>('.tgl[data-t]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.t!;
        if (t === 'music') {
          s.music = !s.music; audio.setMusic(s.music); this.game.syncSave(); this.renderSettings();
        } else if (t === 'sfx') {
          s.sfx = !s.sfx; audio.setSfx(s.sfx); audio.click(); this.game.syncSave(); this.renderSettings();
        } else if (t === 'share') {
          const data = { title: 'Reefy', text: 'Akvaryumuma bir bak! 🐠', url: 'https://reefy.games' };
          if (navigator.share) void navigator.share(data).catch(() => undefined);
          else {
            void navigator.clipboard?.writeText(data.url);
            this.toast('Bağlantı kopyalandı! 📋');
          }
        } else if (t === 'reset') {
          if (confirm('Tüm ilerleme silinecek. Emin misin?')) this.game.resetAll();
        }
      });
    });
  }

  // ---------- modallar ----------

  private showEggReveal(egg: EggTier, sp: Species): void {
    const info = RARITY_INFO[sp.rarity];
    const el = this.panelShell('', `
      <div class="reveal">
        <div class="reveal-egg">${egg.emoji}</div>
        <div class="reveal-fish" style="--glow:${info.color}">
          ${fishSVG(sp, 150)}
          <div class="card-name big">${sp.name}</div>
          ${rarityChip(sp.rarity)}
          <p class="card-desc">${sp.desc}</p>
          <button class="buy-btn reveal-ok">Harika! 🎉</button>
        </div>
      </div>`);
    setTimeout(() => el.querySelector('.reveal')!.classList.add('hatched'), 1100);
    el.querySelector('.reveal-ok')!.addEventListener('click', () => {
      audio.click(); this.closePanel();
    });
  }

  showFishInfo(f: Fish): void {
    audio.click();
    const gain = Math.round(f.sp.sellPrice * this.game.sellMult);
    const el = this.panelShell(`${f.name}`, `
      <div class="fish-info">
        <div class="card-art">${fishSVG(f.sp, 120)}</div>
        <div class="card-name">${f.sp.name} ${rarityChip(f.sp.rarity)}</div>
        <p class="card-desc">${f.sp.desc}</p>
        <div class="bar-row"><span>Büyüme (${f.stageName})</span>
          <div class="bar"><div id="fi-grow" style="width:${Math.min(100, f.progress * 100)}%"></div></div></div>
        <div class="bar-row"><span>Tokluk ${f.isSad ? '😢 aç!' : ''}</span>
          <div class="bar"><div id="fi-hunger" class="hunger" style="width:${f.hunger * 100}%"></div></div></div>
        <div class="card-meta">Üretim: 🪙 ${RARITY_INCOME[f.sp.rarity]}/saat ${f.isAdult ? '(aktif)' : '(yetişkin olunca)'}</div>
        ${f.isAdult
          ? `<button class="buy-btn sell">🪙 ${fmt(gain)} karşılığında sat</button>`
          : `<p class="growing">Büyüyor… satmak için yetişkin olmasını bekle 🌱</p>`}
      </div>`);
    const sellBtn = el.querySelector<HTMLButtonElement>('.sell');
    if (sellBtn) {
      sellBtn.addEventListener('click', () => {
        const res = this.game.sellFish(f);
        this.toast(res.msg);
        this.closePanel();
      });
    }
    this.fishInfoTimer = window.setInterval(() => {
      const g = el.querySelector<HTMLElement>('#fi-grow');
      const h = el.querySelector<HTMLElement>('#fi-hunger');
      if (!g || !h) return;
      g.style.width = `${Math.min(100, f.progress * 100)}%`;
      h.style.width = `${f.hunger * 100}%`;
    }, 500);
  }

  private showWelcome(): void {
    const o = this.game.offline;
    if (o.minutes < 3 && !o.dailyGift) return;
    const parts: string[] = [];
    if (o.minutes >= 3) {
      parts.push(`Sen yokken <b>${o.minutes} dakika</b> geçti — balıkların büyümeye devam etti.`);
      if (o.grown > 0) parts.push(`🎉 <b>${o.grown} balık</b> yetişkin oldu, satılmaya hazır!`);
      if (o.income > 0) parts.push(`🪙 Balıkların senin için <b>${fmt(o.income)} altın</b> üretti — toplamayı unutma!`);
    }
    if (o.dailyGift) {
      parts.push(`🎁 Günlük hediyen: <b>+${o.giftCoins} altın, +${o.giftPearls} inci</b>`);
      if (this.game.save.streak > 1) parts.push(`🔥 Seri: <b>${this.game.save.streak} gün</b> — devam ettikçe hediyeler büyüyor!`);
    }
    const el = this.panelShell('🌊 Tekrar hoş geldin!', `
      <div class="welcome">${parts.map((p) => `<p>${p}</p>`).join('')}
      <button class="buy-btn welcome-ok">Akvaryuma dal 🐠</button></div>`);
    el.querySelector('.welcome-ok')!.addEventListener('click', () => {
      audio.click(); this.closePanel();
    });
  }

  private runTutorial(): void {
    const s = this.game.save;
    if (s.tutorialDone) return;
    s.tutorialDone = true;
    this.game.syncSave();
    setTimeout(() => this.toast('🌊 Reefy\'ye hoş geldin! Bu resif artık senin.'), 1200);
    setTimeout(() => this.toast('🍤 "Besle" ile balıklarını doyur — tok balık hızlı büyür.'), 5200);
    setTimeout(() => this.toast('🐟 Yetişkin balıklara dokunup satabilir, kazancınla yeni türler alabilirsin.'), 9600);
    setTimeout(() => this.toast('📋 Günlük görevleri tamamla, dekor yerleştir, akvaryumunu büyüt!'), 14200);
  }
}

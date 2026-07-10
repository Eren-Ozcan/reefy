import { audio } from './audio';
import type { Fish } from './fish';
import type { Game } from './game';
import { EggTier, RARITY_INFO, Rarity, SPECIES, Species } from './species';

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
  return `<svg viewBox="-105 -70 210 140" width="${size}" height="${(size * 140) / 210}" xmlns="http://www.w3.org/2000/svg">
    ${glow}
    <path d="M -48 0 L ${-48 - 34 * FS} ${-H * 0.45 * FS} Q ${-48 - 20 * FS} 0 ${-48 - 34 * FS} ${H * 0.45 * FS} Z" fill="${c.fin}"/>
    <path d="M -15 ${-H / 2 + 2} L 5 ${-H / 2 - H * 0.45 * FS} L 22 ${-H / 2 + 2} Z" fill="${c.fin}" opacity="0.95"/>
    <clipPath id="b-${sp.id}${silhouette ? '-s' : ''}"><ellipse cx="0" cy="0" rx="50" ry="${H / 2}"/></clipPath>
    <ellipse cx="0" cy="0" rx="50" ry="${H / 2}" fill="${c.body}"/>
    <g clip-path="url(#b-${sp.id}${silhouette ? '-s' : ''})">
      <ellipse cx="2" cy="${H * 0.16}" rx="40" ry="${H * 0.32}" fill="${c.belly}"/>
      ${pattern}
    </g>
    <circle cx="30" cy="${-H * 0.08}" r="5.2" fill="${silhouette ? '#e6edf2' : '#ffffff'}"/>
    <circle cx="31.5" cy="${-H * 0.08}" r="2.6" fill="${silhouette ? '#8a99a5' : '#26262e'}"/>
  </svg>`;
}

function rarityChip(r: Rarity): string {
  const info = RARITY_INFO[r];
  return `<span class="chip" style="background:${info.color}">${info.name}</span>`;
}

export class UI {
  private game: Game;
  private root!: HTMLElement;
  private hudCoins!: HTMLElement;
  private hudPearls!: HTMLElement;
  private hudLevel!: HTMLElement;
  private hudXpBar!: HTMLElement;
  private hudCap!: HTMLElement;
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
      </div>
      <div id="bottombar">
        <button data-act="feed">🍤<span>Besle</span></button>
        <button data-act="shop">🛒<span>Mağaza</span></button>
        <button data-act="eggs">🥚<span>Yumurta</span></button>
        <button data-act="collection">📖<span>Koleksiyon</span></button>
        <button data-act="settings">⚙️<span>Ayarlar</span></button>
      </div>
      <div id="panel-host"></div>
      <div id="toasts"></div>
    `;
    this.hudCoins = root.querySelector('#hud-coins')!;
    this.hudPearls = root.querySelector('#hud-pearls')!;
    this.hudLevel = root.querySelector('#hud-level')!;
    this.hudXpBar = root.querySelector('#hud-xp')!;
    this.hudCap = root.querySelector('#hud-cap')!;
    this.panelHost = root.querySelector('#panel-host')!;
    this.toastHost = root.querySelector('#toasts')!;

    root.querySelectorAll<HTMLButtonElement>('#bottombar button').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.click();
        const act = btn.dataset.act!;
        if (act === 'feed') this.game.feed();
        else this.openPanel(act);
      });
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

  // ---------- paneller ----------

  private closePanel(): void {
    if (this.fishInfoTimer !== null) {
      clearInterval(this.fishInfoTimer);
      this.fishInfoTimer = null;
    }
    this.panelHost.innerHTML = '';
  }

  private panelShell(title: string, bodyHTML: string): HTMLElement {
    this.closePanel();
    const wrap = document.createElement('div');
    wrap.className = 'panel-backdrop';
    wrap.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>${title}</h2><button class="close-btn">✕</button></div>
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

  private openPanel(name: string): void {
    if (name === 'shop') this.renderShop();
    else if (name === 'eggs') this.renderEggs();
    else if (name === 'collection') this.renderCollection();
    else if (name === 'settings') this.renderSettings();
  }

  private renderShop(): void {
    const s = this.game.save;
    const cards = this.game.shopList().map((sp) => {
      const locked = !sp.pearlPrice && s.level < sp.unlockLevel;
      const price = sp.pearlPrice ? `🦪 ${fmt(sp.pearlPrice)}` : `🪙 ${fmt(sp.buyPrice)}`;
      return `
        <div class="card ${locked ? 'locked' : ''}">
          <div class="card-art">${fishSVG(sp, 92, locked)}</div>
          <div class="card-name">${locked ? '🔒 ' + sp.name : sp.name}</div>
          ${rarityChip(sp.rarity)}
          <div class="card-desc">${locked ? `Seviye ${sp.unlockLevel}'de açılır` : sp.desc}</div>
          <div class="card-meta">Satış: 🪙 ${fmt(sp.sellPrice)} • ${Math.round(sp.growthMs / 60000)} dk</div>
          <button class="buy-btn" data-sp="${sp.id}" ${locked ? 'disabled' : ''}>${price}</button>
        </div>`;
    }).join('');
    const el = this.panelShell('🛒 Mağaza', `<div class="grid">${cards}</div>`);
    el.querySelectorAll<HTMLButtonElement>('.buy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.game.buyFish(btn.dataset.sp!);
        if (!res.ok) audio.error();
        this.toast(res.msg);
        if (res.ok) this.renderShop();
      });
    });
  }

  private renderEggs(): void {
    const cards = this.game.eggList().map((egg) => {
      const odds = (Object.entries(egg.odds) as [Rarity, number][])
        .map(([r, p]) => `<div class="odd-row"><span style="color:${RARITY_INFO[r].color}">●</span> ${RARITY_INFO[r].name} <b>%${p}</b></div>`)
        .join('');
      const cur = egg.currency === 'coins' ? '🪙' : '🦪';
      return `
        <div class="card">
          <div class="egg-emoji">${egg.emoji}</div>
          <div class="card-name">${egg.name}</div>
          <div class="card-desc">${egg.desc}</div>
          <div class="odds">${odds}</div>
          <button class="buy-btn" data-egg="${egg.id}">${cur} ${fmt(egg.cost)}</button>
        </div>`;
    }).join('');
    const el = this.panelShell('🥚 Sürpriz Yumurtalar', `<div class="grid">${cards}</div>`);
    el.querySelectorAll<HTMLButtonElement>('.buy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const egg = this.game.eggList().find((e) => e.id === btn.dataset.egg)!;
        const res = this.game.hatchEgg(egg);
        if (!res.ok) { audio.error(); this.toast(res.msg); return; }
        this.showEggReveal(egg, res.species!);
      });
    });
  }

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
            ${fishSVG(sp, 66, !has)}
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
      <p class="dex-info">Bir türü ilk kez yetişkinliğe ulaştırdığında koleksiyona eklenir.
      Tamamlanan her set kalıcı <b>+%5 satış bonusu</b> verir. Şu anki bonus: <b>+%${bonus}</b></p>
      ${groups}`);
  }

  private renderSettings(): void {
    const s = this.game.save;
    const el = this.panelShell('⚙️ Ayarlar', `
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
      <p class="version">Reefy v0.1.0 — sevgiyle yapıldı 🐠</p>
    `);
    el.querySelectorAll<HTMLButtonElement>('.tgl').forEach((btn) => {
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

  showFishInfo(f: Fish): void {
    audio.click();
    const render = () => {
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
    };
    render();
  }

  private showWelcome(): void {
    const o = this.game.offline;
    if (o.minutes < 3 && !o.dailyGift) return;
    const parts: string[] = [];
    if (o.minutes >= 3) {
      parts.push(`Sen yokken <b>${o.minutes} dakika</b> geçti — balıkların büyümeye devam etti.`);
      if (o.grown > 0) parts.push(`🎉 <b>${o.grown} balık</b> yetişkin oldu, satılmaya hazır!`);
    }
    if (o.dailyGift) parts.push(`🎁 Günlük hediyen: <b>+200 altın, +1 inci</b>`);
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
  }
}

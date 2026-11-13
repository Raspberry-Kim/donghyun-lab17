/* 동현항 · 규칙 — 세계 지도 항해, 보급, 항구(교역소 · 여관 · 도크 · 보급), 적 함대와의 만남. 화면을 모른다(node에서 그대로 돈다).
 *
 * 하루 = 한 걸음(stepDay). 바다에 있을 때만 날이 간다.
 *   이동   하루에 가장 느린 배의 빠르기만큼 칸을 간다. 뱃길(찍은 곳까지 길 찾기)을 따르거나 키(방향키)가 가리키는 쪽으로 간다.
 *   보급   하루에 식량과 물을 선원 수만큼 쓴다. 모자라면 그날 선원의 10%(적어도 1명)가 준다. 식량과 물이 다 없으면 두 번 준다.
 *   입항   뱃길의 끝이 항구면 그 항구에, 키로 가다가 정박 칸에 닿으면 그 항구에 든다. 항구에서는 날이 멎는다.
 *   교역소 10개씩 사고판다. 사면 그 값으로 치르고 값이 한 단(그 항구 처음 값의 3%) 오른다. 팔면 값이 먼저 한 단 내리고 그 값에서 수수료 10%를 뗀다.
 *          날이 갈 때마다 값은 그 항구의 처음 값 쪽으로 차이의 10%씩, 재고는 5씩 되돌아온다.
 *   여관   선원을 5명씩 모은다(한 명에 금 10) · 선장이 수련한다(금 300에 무력 +1, 100까지).
 *   도크   선체를 고친다(1마다 금 2) · 배를 산다(세 척까지) · 포를 보강한다(금 400에 +2문, 배마다 +8문까지) ·
 *          배를 다른 배로 바꾼다(기함도 된다. 헌 배는 처음 값의 50%를 쳐준다) · 배를 판다(마지막 한 척은 못 판다).
 *   보급   식량 10일분을 산다(한 사람 하루치 금 0.1) · 물은 값 없이 채운다. 식량은 120일분, 물은 60일분까지 싣는다.
 *   만남   항구를 떠나 3일이 지나면 날마다 5% 확률로 해적을 만난다. 만나면 셋 가운데 고른다(meetInfo):
 *          싸운다 → 해전(hang-battle.js) → settleBattle()로 결과를 반영한다. 이기면 선장의 무력이 1 오른다(일기토로 이겼으면 2 더).
 *          달아난다 → 우리 함대가 더 빠르면 그냥 따돌리고, 아니면 짐의 절반을 버린다.   통행료 → 자금의 20%(적어도 금 100)를 내고 지나간다.
 *   무적   rules.invincible이 1이면(동현랭 설정 15) 금을 내지 않고, 식량과 물이 줄지 않고, 해전에서 우리 배가 다치지 않고, 선장이 일기토에서 지지 않는다.
 *          자료에 cheat로 적힌 배는 이때만 고를 수 있다(샘플 자료에는 없다).
 * 저장: toJSON()이 탐험에서 바뀌는 것만 적고, Voyage.restore()가 자료에 비춰 검사한 뒤 되살린다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};

  const RULES = {
    lot: 10,                                                                   // 한 번에 사고파는 수량
    price: { stepPct: 3, maxPct: 300, minPct: 30, feePct: 10, driftPct: 10, restock: 5 },
    supply: { lotDays: 10, foodMax: 120, waterMax: 60, perGold: 10, lossPct: 10 },   // perGold: 금 1로 사는 식량(한 사람 하루치의 수)
    inn: { lot: 5, gold: 10, train: 300, trainGain: 1 },                        // train: 선장 수련 한 번의 값 · trainGain: 그때 오르는 무력
    dock: { repair: 2, maxShips: 3, tradePct: 50, gunStep: 2, gunMax: 8, gunGold: 400 },   // tradePct: 헌 배를 쳐주는 값(처음 값의 %) · 포 보강 한 번에 gunStep문, 배마다 gunMax문까지
    encounter: { percent: 5, grace: 3, tollPct: 20, tollMin: 100 },             // 통행료 = 자금의 tollPct%(적어도 tollMin)
    grow: { win: 1, duel: 2, max: 100 },                                        // 해전에서 이기면 선장 무력 +win, 일기토로 이겼으면 +duel 더. max까지
    invincible: 0,                                                              // 1이면 무적 모드
    defeat: { goldPct: 50, hullPct: 25, crewMin: 5 }, flee: { cargoPct: 50 }
  };
  const SHIP_NAMES = ['흰구름호', '새벽별호', '물보라호'];
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const NO = why => ({ ok: false, why });
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

  class Voyage {
    /** @param world DH.Hang.parse()의 결과
     *  @param {{rng?:DH.RNG, state?:object}} o state는 DH.Hang.newState()로 만든 globalState다(동현랭 설정이 덮어쓴 값). 없으면 이 파일의 RULES와 자료 값을 쓴다. */
    constructor(world, o = {}) {
      const st = o.state || null, f = world.fleets.get('player'), s = (st && st.start) || {};
      this.world = world; this.rng = o.rng || new DH.RNG(1); this.state = st;
      this.rules = st && st.rules ? st.rules : RULES; this.seaRules = st && st.sea ? st.sea : null;
      this.stage = { gold: 0, days: 0, ...(st && st.stage ? st.stage : {}) };
      this.grid = new DH.SquareGrid(world.map.cols, world.map.rows, 1, { wrapX: world.map.wrapX, diagonal: true });
      this.name = f.name; this.captain = { ...f.captain, war: s.war ?? f.captain.war };
      this.ships = f.ships.map((sh, i) => { const type = i === 0 && s.ship ? s.ship : sh.type; return { id: sh.id, type, name: sh.name, hull: world.shipTypes.get(type).hull, plus: 0 }; });   // plus: 보강한 포
      this.cargo = new Map();                                                   // 교역품 id → {qty, paid(한 개에 치른 값)}
      for (const sh of f.ships) for (const h of sh.hold) this.load(h.good, h.qty, h.paid);
      for (const [good, qty] of (st && st.cargo) || []) { this.cargo.delete(good); if (qty > 0) this.load(good, qty, 0); }
      this.gold = s.gold ?? f.gold; this.crew = s.crew ?? Math.min(this.maxCrew, Math.max(this.minCrew, f.crew));      // 시작 기함을 바꿨으면 그 배의 정원 안으로 맞춘다
      this.food = (s.food ?? f.food) * this.crew; this.water = (s.water ?? f.water) * this.crew;      // 한 사람 하루치의 수로 센다
      this.x = f.x; this.y = f.y; this.port = f.port; this.lastPort = f.port;
      this.rivals = new Map([...world.rivals.values()].map(v => [v.id, { ...v, captain: { ...v.captain } }]));
      for (const [id, war] of (st && st.rivals) || []) { const v = this.rivals.get(id); if (v) v.captain.war = war; }
      this.markets = new Map([...world.ports.values()].map(p => [p.id, new Map(p.market.map(e => [e.good, { good: e.good, price: e.price, ref: e.price, stock: e.stock, refStock: e.stock }]))]));
      this.day = 0; this.sinceLand = 0; this.path = []; this.dest = null; this.heading = null; this.over = null; this.overWhy = null;
      this.checkStage();
    }
    // ───────── 지금 형편 ─────────
    T(sh) { return this.world.shipTypes.get(sh.type); }
    get speed() { return Math.min(...this.ships.map(sh => this.T(sh).speed)); }        // 가장 느린 배에 맞춘다
    get cargoCap() { return this.ships.reduce((n, sh) => n + this.T(sh).cargo, 0); }
    get cargoUsed() { let n = 0; for (const h of this.cargo.values()) n += h.qty; return n; }
    get maxCrew() { return this.ships.reduce((n, sh) => n + this.T(sh).maxCrew, 0); }
    get minCrew() { return this.ships.reduce((n, sh) => n + this.T(sh).minCrew, 0); }
    get inv() { return !!this.rules.invincible; }                                // 무적 모드
    /** 치를 값. 무적 모드에서는 금을 내지 않는다. */
    fee(n) { return this.inv ? 0 : n; }
    paid(n) { return this.inv ? '값 없이(무적 모드)' : `금 −${fmt(n)}`; }             // 기록에 적는 값
    /** 금으로 살 수 있는 수(값 한 개에 unit). 무적 모드에서는 금이 막지 않는다. */
    buyable(unit) { return this.inv ? 1e9 : Math.floor(this.gold / unit); }
    gunsOf(sh) { return this.T(sh).guns + (sh.plus || 0); }
    get foodDays() { return this.crew > 0 ? Math.floor(this.food / this.crew) : 0; }
    get waterDays() { return this.crew > 0 ? Math.floor(this.water / this.crew) : 0; }
    get damage() { return this.ships.reduce((n, sh) => n + this.T(sh).hull - sh.hull, 0); }
    get moving() { return !this.port && !this.over && (this.path.length > 0 || this.heading !== null); }
    get here() { return this.port ? this.world.ports.get(this.port) : null; }
    held(good) { const h = this.cargo.get(good); return h ? h.qty : 0; }
    load(good, qty, price) { const h = this.cargo.get(good) || { qty: 0, paid: 0 }; h.paid = Math.round((h.paid * h.qty + price * qty) / (h.qty + qty)); h.qty += qty; this.cargo.set(good, h); }
    has(fac) { return !!this.here && this.here.facilities.includes(fac); }
    /** 스테이지 조건: 자금을 목표만큼 모으면 이기고, 기한(일)이 지나면 진다. 조건이 없으면(0) 끝없이 다닌다. */
    checkStage() {
      if (this.over) return;
      if (this.stage.gold > 0 && this.gold >= this.stage.gold) { this.over = 'won'; this.overWhy = 'gold'; }
      else if (this.stage.days > 0 && this.day >= this.stage.days) { this.over = 'lost'; this.overWhy = 'time'; }
    }

    // ───────── 항해 ─────────
    /** 뱃길을 잡는다. target은 항구 id 또는 바다 칸 [c, r]. 항구에 있었다면 닻을 올린다. */
    sailTo(target) {
      if (this.over) return NO('탐험이 끝났다');
      const w = this.world, p = typeof target === 'string' ? w.ports.get(target) : null, to = p ? p.anchor : [this.grid.normC(target[0]), target[1]];
      if (typeof target === 'string' && !p) return NO('그런 항구는 없다');
      if (!w.map.isSea(to[0], to[1])) return NO('뭍으로는 갈 수 없다');
      if (to[0] === this.x && to[1] === this.y) return NO(p ? `이미 ${p.name} 앞이다` : '이미 그 자리다');
      const path = DH.findPath(this.grid, [this.x, this.y], to, w.map.isSea);
      if (!path) return NO(`${p ? p.name : '그곳'}까지 뱃길을 찾지 못했다`);
      const from = this.here ? this.here.name : '바다';
      const end = p || this.anchorAt(to[0], to[1]);                              // 찍은 바다가 정박 칸이면 그 항구에 든다
      this.leave(); this.path = path; this.dest = end ? end.id : null; this.heading = null;
      return { ok: true, len: path.length, days: Math.ceil(path.length / this.speed), text: `${from} → ${end ? end.name : '찍은 바다'} · ${path.length}칸 · 하루 ${this.speed}칸` };
    }
    /** 키를 잡는다(방향키). dir: 'left' | 'right' | 'up' | 'down'. 그쪽이 뭍이면 못 간다. */
    steer(dir) {
      const d = DIRS[dir]; if (!d) return NO('모르는 방향이다');
      if (this.over) return NO('탐험이 끝났다');
      if (!this.world.map.isSea(this.x + d[0], this.y + d[1])) return NO('그쪽은 뭍이다');
      this.leave(); this.path = []; this.dest = null; this.heading = dir;
      return { ok: true, text: `키를 ${{ left: '서', right: '동', up: '북', down: '남' }[dir]}쪽으로 잡았다` };
    }
    stop() { this.path = []; this.dest = null; this.heading = null; }
    leave() { if (this.port) { this.lastPort = this.port; this.port = null; this.sinceLand = 0; } }
    enter(pid) { const p = this.world.ports.get(pid); this.stop(); this.port = pid; this.lastPort = pid; this.x = p.anchor[0]; this.y = p.anchor[1]; this.sinceLand = 0; }
    anchorAt(c, r) { for (const p of this.world.ports.values()) if (p.anchor[0] === c && p.anchor[1] === r) return p; return null; }

    /** 하루를 보낸다(바다에서만). 이동 → 보급 → 시세 → 입항 → 만남 순서다.
     *  @returns {{ok:boolean, from:[number,number], moved:number, events:string[], arrived:string|null, encounter:object|null}} */
    stepDay() {
      if (this.port || this.over) return { ok: false, from: [this.x, this.y], moved: 0, events: [], arrived: null, encounter: null };
      const R = this.rules, ev = [], from = [this.x, this.y]; let moved = 0, arrived = null;
      this.day++; this.sinceLand++;
      for (let i = 0; i < this.speed; i++) {                                    // ① 이동
        if (this.path.length) { [this.x, this.y] = this.path.shift(); moved++; }
        else if (this.heading) {
          const d = DIRS[this.heading], nx = this.grid.normC(this.x + d[0]), ny = this.y + d[1];
          if (!this.world.map.isSea(nx, ny)) { this.heading = null; ev.push('뭍에 막혀 닻을 내렸다'); break; }
          this.x = nx; this.y = ny; moved++;
          const p = this.anchorAt(nx, ny); if (p) { arrived = p.id; break; }                          // 키로 가다 정박 칸에 닿으면 든다
        } else break;
      }
      for (const [key, name] of this.inv ? [] : [['food', '식량'], ['water', '물']]) {            // ② 보급(무적 모드에서는 줄지 않는다)
        if (this[key] >= this.crew) { this[key] -= this.crew; if (this[key] < this.crew) ev.push(`${name}이 떨어졌다`); continue; }
        const lost = Math.min(this.crew, Math.max(1, Math.ceil(this.crew * R.supply.lossPct / 100)));
        this[key] = 0; this.crew -= lost; ev.push(`${name}이 없어 선원 ${lost}명을 잃었다`);
      }
      this.driftMarkets();                                                     // ③ 시세
      if (this.crew <= 0) { this.crew = 0; this.stop(); this.over = 'lost'; this.overWhy = 'crew'; ev.push('선원을 모두 잃었다'); return { ok: true, from, moved, events: ev, arrived: null, encounter: null }; }
      if (!arrived && this.dest && !this.path.length) arrived = this.dest;      // ④ 입항
      if (arrived) { this.enter(arrived); ev.push(`${this.here.name}에 닿았다`); }
      else if (!this.path.length && !this.heading && moved) ev.push('찍은 바다에 닿아 닻을 내렸다');
      this.checkStage();
      let encounter = null;                                                    // ⑤ 만남
      if (!arrived && !this.over && this.rivals.size && this.sinceLand > R.encounter.grace && R.encounter.percent > 0 && this.rng.next() * 100 < R.encounter.percent) {
        encounter = this.rng.pick([...this.rivals.values()]); this.sinceLand = 0; ev.push(`해적 출현 · ${DH.josa(encounter.name, '과', '와')} 마주쳤다`);
      }
      return { ok: true, from, moved, events: ev, arrived, encounter };
    }
    driftMarkets() {
      const P = this.rules.price;
      for (const m of this.markets.values()) for (const e of m.values()) {
        if (e.price !== e.ref) { const d = e.ref - e.price, s = Math.max(1, Math.ceil(Math.abs(d) * P.driftPct / 100)); e.price += Math.sign(d) * Math.min(Math.abs(d), s); }
        if (e.stock !== e.refStock) { const d = e.refStock - e.stock; e.stock += Math.sign(d) * Math.min(Math.abs(d), P.restock); }
      }
    }

    // ───────── 교역소 ─────────
    entry(good) { return this.here ? this.markets.get(this.port).get(good) : null; }
    priceStep(e) { return Math.max(1, Math.round(e.ref * this.rules.price.stepPct / 100)); }
    /** 지금 사면 몇 개를 얼마에, 팔면 몇 개를 얼마에. 못 하면 why가 있다. */
    quote(good) {
      const e = this.entry(good), P = this.rules.price, g = this.world.goods.get(good);
      if (!e || !g) return { buy: NO('여기서는 거래할 수 없다'), sell: NO('여기서는 거래할 수 없다') };
      const room = this.cargoCap - this.cargoUsed, n = Math.min(this.rules.lot, e.stock, room, this.buyable(e.price));
      const buy = !this.has('market') ? NO('교역소가 없다') : e.refStock <= 0 ? NO('이 항구에서는 팔지 않는다') : e.stock <= 0 ? NO('재고가 떨어졌다') : room <= 0 ? NO('배에 실을 자리가 없다') : n <= 0 ? NO('금이 모자란다') : { ok: true, qty: n, price: e.price, cost: this.fee(e.price * n) };
      const m = Math.min(this.rules.lot, this.held(good)), down = Math.max(Math.max(1, Math.round(e.ref * P.minPct / 100)), e.price - this.priceStep(e)), unit = Math.floor(down * (100 - P.feePct) / 100);
      const sell = !this.has('market') ? NO('교역소가 없다') : m <= 0 ? NO('실은 것이 없다') : { ok: true, qty: m, price: down, unit, income: unit * m };
      return { good, name: g.name, price: e.price, ref: e.ref, stock: e.stock, sells: e.refStock > 0, held: this.held(good), paid: this.cargo.get(good)?.paid ?? 0, buy, sell };
    }
    /** 산다: 지금 값으로 치르고, 재고가 줄고, 값이 한 단 오른다. */
    buy(good) {
      if (this.over) return NO('탐험이 끝났다');
      const q = this.quote(good); if (!q.buy.ok) return q.buy;
      const e = this.entry(good), b = q.buy;
      this.gold -= b.cost; e.stock -= b.qty; this.load(good, b.qty, b.price);
      e.price = Math.min(Math.round(e.ref * this.rules.price.maxPct / 100), e.price + this.priceStep(e));
      return { ok: true, type: 'buy', good, qty: b.qty, cost: b.cost, text: `${q.name} ${b.qty}개를 샀다 · ${this.paid(b.cost)} · 값 ${b.price} → ${e.price}` };
    }
    /** 판다: 값이 먼저 한 단 내리고, 그 값에서 수수료를 뗀 만큼 받는다. */
    sell(good) {
      if (this.over) return NO('탐험이 끝났다');
      const q = this.quote(good); if (!q.sell.ok) return q.sell;
      const e = this.entry(good), s = q.sell, h = this.cargo.get(good), before = e.price;
      e.price = s.price; this.gold += s.income; h.qty -= s.qty; if (h.qty <= 0) this.cargo.delete(good);
      if (e.refStock > 0) e.stock += s.qty;
      this.checkStage();
      return { ok: true, type: 'sell', good, qty: s.qty, income: s.income, text: `${q.name} ${s.qty}개를 팔았다 · 금 +${fmt(s.income)} · 값 ${before} → ${e.price}` };
    }

    // ───────── 여관 · 도크 · 보급 ─────────
    /** 항구에서 할 수 있는 일인지. {ok:true, …미리 보기} 또는 {ok:false, why} */
    can(what, arg, arg2) {
      const R = this.rules, p = this.here;
      if (this.over) return NO('탐험이 끝났다');
      if (!p) return NO('항구에 있을 때만 된다');
      if (what === 'hire') {
        if (!this.has('lodge')) return NO('이 항구에는 여관이 없다');
        const n = Math.min(R.inn.lot, this.maxCrew - this.crew, this.buyable(R.inn.gold));
        return this.crew >= this.maxCrew ? NO('배에 더 태울 수 없다') : n <= 0 ? NO('금이 모자란다') : { ok: true, qty: n, cost: this.fee(n * R.inn.gold) };
      }
      if (what === 'train') {
        if (!this.has('lodge')) return NO('이 항구에는 여관이 없다');
        const cost = this.fee(R.inn.train), to = Math.min(R.grow.max, this.captain.war + R.inn.trainGain);
        return this.captain.war >= R.grow.max ? NO(`선장의 무력은 ${R.grow.max}까지다`) : this.gold < cost ? NO('금이 모자란다') : { ok: true, gain: to - this.captain.war, to, cost };
      }
      if (what === 'repair') {
        if (!this.has('shipyard')) return NO('이 항구에는 도크가 없다');
        const n = Math.min(this.damage, this.buyable(R.dock.repair));
        return this.damage <= 0 ? NO('고칠 데가 없다') : n <= 0 ? NO('금이 모자란다') : { ok: true, qty: n, cost: this.fee(n * R.dock.repair) };
      }
      if (what === 'gun' || what === 'swap' || what === 'sell') {
        const sh = this.ships.find(x => x.id === arg), D = R.dock;
        if (!this.has('shipyard')) return NO('이 항구에는 도크가 없다');
        if (!sh) return NO('그런 배는 없다');
        const old = this.T(sh), trade = Math.floor(old.price * D.tradePct / 100);
        if (what === 'gun') {
          const n = Math.min(D.gunStep, D.gunMax - (sh.plus || 0)), cost = this.fee(D.gunGold);
          return n <= 0 ? NO(`포는 배마다 ${D.gunMax}문까지 더 단다`) : this.gold < cost ? NO('금이 모자란다') : { ok: true, qty: n, guns: this.gunsOf(sh) + n, cost };
        }
        const t = what === 'swap' ? this.world.shipTypes.get(arg2) : null;
        if (what === 'swap' && !t) return NO('그런 배는 없다');
        if (what === 'swap' && t.id === sh.type) return NO('지금 타는 배와 같다');
        if (what === 'swap' && t.cheat && !this.inv) return NO('무적 모드에서만 고를 수 있다');
        if (what === 'sell' && this.ships.length <= 1) return NO('마지막 한 척은 팔 수 없다');
        const cap = this.cargoCap - old.cargo + (t ? t.cargo : 0), seats = this.maxCrew - old.maxCrew + (t ? t.maxCrew : 0), off = Math.max(0, this.crew - seats);
        if (this.cargoUsed > cap) return NO(`짐이 다 실리지 않는다(남는 적재량 ${fmt(cap)})`);
        if (what === 'sell') return { ok: true, income: trade, off };
        const net = t.price - trade, cost = this.fee(Math.max(0, net)), back = Math.max(0, -net);
        return this.gold < cost ? NO('금이 모자란다') : { ok: true, cost, back, trade, off };
      }
      if (what === 'ship') {
        const t = this.world.shipTypes.get(arg);
        if (!this.has('shipyard')) return NO('이 항구에는 도크가 없다');
        if (!t) return NO('그런 배는 없다');
        if (t.cheat && !this.inv) return NO('무적 모드에서만 고를 수 있다');
        return this.ships.length >= R.dock.maxShips ? NO(`배는 ${R.dock.maxShips}척까지다`) : this.gold < this.fee(t.price) ? NO('금이 모자란다') : { ok: true, cost: this.fee(t.price) };
      }
      if (what === 'food') {
        const room = this.crew * R.supply.foodMax - this.food, want = Math.min(room, this.crew * R.supply.lotDays), n = this.inv ? want : Math.min(want, this.gold * R.supply.perGold);
        return room < this.crew ? NO(`식량은 ${R.supply.foodMax}일분까지 싣는다`) : n < this.crew ? NO('금이 모자란다') : { ok: true, qty: n, days: Math.floor(n / this.crew), cost: this.fee(Math.ceil(n / R.supply.perGold)) };
      }
      if (what === 'water') return this.water >= this.crew * R.supply.waterMax ? NO('물통이 가득 찼다') : { ok: true, days: R.supply.waterMax, cost: 0 };
      return NO('모르는 일이다');
    }
    hire() { const c = this.can('hire'); if (!c.ok) return c; this.gold -= c.cost; this.crew += c.qty; return { ok: true, type: 'hire', ...c, text: `선원 ${c.qty}명을 모았다 · ${this.paid(c.cost)} · 선원 ${this.crew}명` }; }
    repair() {
      const c = this.can('repair'); if (!c.ok) return c; let left = c.qty;
      for (const sh of this.ships) { const d = Math.min(left, this.T(sh).hull - sh.hull); sh.hull += d; left -= d; }
      this.gold -= c.cost; return { ok: true, type: 'repair', ...c, text: `선체를 ${c.qty}만큼 고쳤다 · ${this.paid(c.cost)}` };
    }
    buyShip(type) {
      const c = this.can('ship', type); if (!c.ok) return c; const t = this.world.shipTypes.get(type);
      const name = SHIP_NAMES.find(n => !this.ships.some(sh => sh.name === n)) || `${this.ships.length + 1}번함`;
      let i = this.ships.length + 1; while (this.ships.some(sh => sh.id === 's' + i)) i++;
      this.ships.push({ id: 's' + i, type, name, hull: t.hull, plus: 0 }); this.gold -= c.cost;
      return { ok: true, type: 'ship', ...c, text: `${t.name} ${DH.josa(name, '을', '를')} 샀다 · ${this.paid(c.cost)} · 배 ${this.ships.length}척` };
    }
    /** 선장 수련(여관): 금을 내고 무력을 올린다. */
    train() { const c = this.can('train'); if (!c.ok) return c; const from = this.captain.war; this.gold -= c.cost; this.captain.war = c.to; return { ok: true, type: 'train', ...c, text: `${DH.josa(this.captain.name, '이', '가')} 수련했다 · ${this.paid(c.cost)} · 무력 ${from} → ${c.to}` }; }
    /** 포 보강(도크): 그 배에 포를 더 단다. */
    addGuns(id) { const c = this.can('gun', id); if (!c.ok) return c; const sh = this.ships.find(x => x.id === id); this.gold -= c.cost; sh.plus = (sh.plus || 0) + c.qty; return { ok: true, type: 'gun', ...c, text: `${sh.name}에 포 ${c.qty}문을 더 달았다 · ${this.paid(c.cost)} · 포 ${c.guns}문` }; }
    /** 배 바꾸기(도크): 그 배를 다른 종류로 바꾼다. 기함도 된다. 선체는 새것이 되고, 더 단 포는 헌 배에 딸려 가서 새 배는 보강 0문부터다. 자리가 줄면 선원이 내린다. */
    swapShip(id, type) {
      const c = this.can('swap', id, type); if (!c.ok) return c; const sh = this.ships.find(x => x.id === id), old = this.T(sh), t = this.world.shipTypes.get(type);
      sh.type = type; sh.hull = t.hull; sh.plus = 0; this.gold += c.back - c.cost; if (c.off) this.setCrew(this.crew - c.off);
      this.checkStage();
      return { ok: true, type: 'swap', ...c, text: `${DH.josa(sh.name, '을', '를')} ${old.name}에서 ${DH.ro(t.name)} 바꿨다 · 헌 배 값 금 ${fmt(c.trade)} · ${c.back ? '금 +' + fmt(c.back) : this.paid(c.cost)}${c.off ? ` · 선원 ${c.off}명이 내렸다` : ''}` };
    }
    /** 배 팔기(도크): 처음 값의 절반을 받는다. 기함을 팔면 다음 배가 기함이 된다. */
    sellShip(id) {
      const c = this.can('sell', id); if (!c.ok) return c; const sh = this.ships.find(x => x.id === id);
      this.ships = this.ships.filter(x => x !== sh); this.gold += c.income; if (c.off) this.setCrew(this.crew - c.off);
      this.checkStage();
      return { ok: true, type: 'sell-ship', ...c, text: `${this.T(sh).name} ${DH.josa(sh.name, '을', '를')} 팔았다 · 금 +${fmt(c.income)} · 배 ${this.ships.length}척${c.off ? ` · 선원 ${c.off}명이 내렸다` : ''}` };
    }
    buyFood() { const c = this.can('food'); if (!c.ok) return c; this.gold -= c.cost; this.food += c.qty; return { ok: true, type: 'food', ...c, text: `식량 ${c.days}일분을 실었다 · ${this.paid(c.cost)} · 식량 ${this.foodDays}일` }; }
    fillWater() { const c = this.can('water'); if (!c.ok) return c; this.water = this.crew * this.rules.supply.waterMax; return { ok: true, type: 'water', ...c, text: `물을 가득 채웠다 · 물 ${this.waterDays}일` }; }

    // ───────── 해적과의 만남 ─────────
    /** 만난 해적 앞에서 고를 수 있는 길을 미리 본다. fast: 우리 함대가 더 빨라 그냥 따돌린다 · drop: 달아날 때 버릴 짐 · toll: 통행료 */
    meetInfo(rival) {
      const E = this.rules.encounter, their = Math.min(...rival.ships.map(id => this.world.shipTypes.get(id).speed)), fast = this.speed > their;
      const drop = fast ? 0 : this.cargoUsed - Math.floor(this.cargoUsed * (100 - this.rules.flee.cargoPct) / 100);
      const toll = this.fee(Math.max(E.tollMin, Math.ceil(this.gold * E.tollPct / 100)));
      return { fast, speed: this.speed, their, drop, toll, pay: this.gold >= toll ? { ok: true, cost: toll } : NO('금이 모자란다') };
    }
    /** 싸우지 않고 달아난다. 우리가 더 빠르면 잃는 것이 없고, 아니면 짐의 절반을 버린다. */
    evade(rival) {
      const m = this.meetInfo(rival), cut = m.drop ? this.trimCargo(this.cargoUsed - m.drop) : 0; this.sinceLand = 0;
      return { ok: true, type: 'evade', fast: m.fast, cut, text: m.fast ? `하루 ${m.speed}칸으로 달려 ${DH.josa(rival.name, '을', '를')} 따돌렸다(해적은 하루 ${m.their}칸)` : `짐 ${fmt(cut)}개를 버리고 ${rival.name}에게서 달아났다` };
    }
    /** 통행료를 내고 지나간다. */
    payToll(rival) {
      const m = this.meetInfo(rival); if (!m.pay.ok) return m.pay; this.gold -= m.toll; this.sinceLand = 0;
      return { ok: true, type: 'toll', cost: m.toll, text: m.toll > 0 ? `${rival.name}에게 통행료 금 ${DH.josa(fmt(m.toll), '을', '를')} 내고 지나갔다` : `${DH.josa(rival.name, '이', '가')} 통행료 없이 길을 비켰다(무적 모드)` };
    }

    // ───────── 해전 ─────────
    /** 만난 적 함대와의 해전을 연다. 우리 선원은 배의 정원에 맞춰 나눠 탄다. */
    /** 해전에서 배마다 타는 선원: {mine 우리 배 형, mc 우리 배마다 선원, theirs 해적 배 형, tc 해적 배마다 선원}. 정원에 비례해 나누고 남는 선원은 앞 배부터 채운다. */
    crewSplit(rival) {
      const T = id => this.world.shipTypes.get(id), split = (total, types) => { const cap = types.reduce((n, t) => n + t.maxCrew, 0); let left = total;
        const out = types.map(t => { const n = Math.min(t.maxCrew, Math.floor(total * t.maxCrew / cap)); left -= n; return n; }); for (let i = 0; left > 0 && i < out.length; i++) { const add = Math.min(left, types[i].maxCrew - out[i]); out[i] += add; left -= add; } return out; };
      const mine = this.ships.map(sh => T(sh.type)), theirs = rival.ships.map(T);
      return { mine, mc: split(this.crew, mine), theirs, tc: split(rival.crew, theirs) };
    }
    /** 해적 기함이 우리 기함에 올라타면 한 번에 잃는 선원: {ours 우리 기함 선원, theirs 해적 기함 선원, hit 잃는 선원, taken 한 번에 빼앗기는지}. 해전의 백병전 식 그대로다. */
    flagRisk(rival) {
      const S = { ...DH.Hang.SEA, ...(this.seaRules || {}) }, { mc, tc } = this.crewSplit(rival);
      const hit = this.inv ? 0 : Math.min(mc[0], Math.floor(tc[0] * S.boardPct * rival.captain.war / (100 * S.warBase)));
      return { ours: mc[0], theirs: tc[0], hit, taken: !this.inv && hit >= mc[0] };
    }
    openBattle(rival) {
      const { mine, mc, theirs, tc } = this.crewSplit(rival);
      return new DH.Hang.SeaBattle({ seed: (this.day * 131 + this.x * 17 + this.y) >>> 0, rng: this.rng, rules: this.seaRules, place: `${this.day}일째 바다`,
        me: { name: this.name, captain: this.captain, invincible: this.inv, ships: this.ships.map((sh, i) => ({ ref: sh.id, type: sh.type, name: sh.name, kind: mine[i].name, hull: sh.hull, maxHull: mine[i].hull, crew: mc[i], maxCrew: mine[i].maxCrew, guns: this.gunsOf(sh) })) },
        foe: { id: rival.id, name: rival.name, captain: rival.captain, gold: rival.gold, ships: theirs.map((t, i) => ({ ref: 'f' + i, type: t.id, name: i === 0 ? '기함' : `${i + 1}번함`, kind: t.name, hull: t.hull, maxHull: t.hull, crew: tc[i], maxCrew: t.maxCrew, guns: t.guns })) } });
    }
    /** 해전의 결과를 탐험대에 반영한다. res는 SeaBattle.result().
     *  이기면 적의 금을 얻고 선장의 무력이 오른다. 달아나면 짐의 절반을 버린다. 지면 금 절반과 짐을 모두 빼앗기고 기함만 남아 마지막 항구로 떠밀려 온다. */
    settleBattle(res) {
      const D = this.rules.defeat, before = this.crew; let text;
      const alive = res.me.ships.filter(s => !s.out);
      if (res.winner === 'foe' && !res.fled) {
        const flag = this.ships[0], lostGold = this.fee(Math.floor(this.gold * D.goldPct / 100)), keep = res.me.ships[0];
        this.ships = [flag]; flag.hull = Math.max(keep.out ? 0 : keep.hull, Math.ceil(this.T(flag).hull * D.hullPct / 100));
        this.setCrew(Math.max(D.crewMin, alive.reduce((n, s) => n + s.crew, 0))); this.gold -= lostGold; this.cargo.clear();
        const back = this.lastPort || [...this.world.ports.keys()][0]; this.enter(back);
        text = `해전에서 졌다 · 금 ${DH.josa(fmt(lostGold), '과', '와')} 짐을 모두 빼앗기고 ${DH.ro(this.here.name)} 떠밀려 왔다 · 선원 ${before} → ${this.crew}명`;
      } else {
        this.ships = this.ships.filter(sh => alive.some(s => s.ref === sh.id));
        for (const sh of this.ships) sh.hull = alive.find(s => s.ref === sh.id).hull;
        this.setCrew(alive.reduce((n, s) => n + s.crew, 0)); this.sinceLand = 0;
        if (res.winner === 'me') {
          const G = this.rules.grow, was = this.captain.war, up = Math.min(G.max, was + G.win + (res.duel && res.duel.winner === 'me' ? G.duel : 0));
          this.gold += res.loot; this.captain.war = Math.max(was, up);
          text = `해전에서 이겼다 · 금 +${fmt(res.loot)} · 선원 ${before} → ${this.crew}명` + (this.captain.war > was ? ` · 선장 무력 ${was} → ${this.captain.war}` : '');
        }
        else if (res.fled) { const cut = this.trimCargo(Math.floor(this.cargoUsed * (100 - this.rules.flee.cargoPct) / 100)); text = `짐 ${fmt(cut)}개를 버리고 달아났다 · 선원 ${before} → ${this.crew}명`; }
        else text = `승부가 나지 않아 두 함대가 갈라졌다 · 선원 ${before} → ${this.crew}명`;
        const over = this.trimCargo(this.cargoCap); if (over) text += ` · 배를 잃어 짐 ${fmt(over)}개가 가라앉았다`;
      }
      this.checkStage();
      return { ok: true, winner: res.winner, fled: !!res.fled, text };
    }
    /** 선원 수를 바꾼다. 식량과 물은 실은 양 그대로다(사람이 줄면 날 수가 는다). 정한 양보다 넘치면 잘라 낸다. */
    setCrew(n) { this.crew = n; const S = this.rules.supply; this.food = Math.min(this.food, n * S.foodMax); this.water = Math.min(this.water, n * S.waterMax); }
    /** 짐을 keep개까지만 남긴다(뒤에 실은 것부터 버린다). @returns 버린 수 */
    trimCargo(keep) {
      let drop = this.cargoUsed - keep, cut = 0; if (drop <= 0) return 0;
      for (const [good, h] of [...this.cargo].reverse()) { const d = Math.min(drop, h.qty); h.qty -= d; drop -= d; cut += d; if (h.qty <= 0) this.cargo.delete(good); if (drop <= 0) break; }
      return cut;
    }

    // ───────── 저장과 불러오기 ─────────
    /** 탐험에서 바뀌는 것만 적는다(항구 · 배 종류 · 적 함대는 자료와 설정에 있다). 설정(globalState)과 난수는 장면이 따로 적는다. */
    toJSON() {
      const { gold, crew, food, water, x, y, port, lastPort, day, sinceLand, dest, heading, over, overWhy } = this;
      return { gold, crew, food, water, x, y, port, lastPort, day, sinceLand, path: this.path.map(p => [p[0], p[1]]), dest, heading, over, overWhy, war: this.captain.war,
        ships: this.ships.map(sh => ({ id: sh.id, type: sh.type, name: sh.name, hull: sh.hull, ...(sh.plus ? { plus: sh.plus } : {}) })),      // plus(보강한 포)는 있을 때만 적는다
        cargo: [...this.cargo].map(([good, h]) => [good, h.qty, h.paid]),                       // 실은 순서를 지킨다(버릴 때 뒤에서부터 버린다)
        markets: [...this.markets].map(([pid, m]) => [pid, [...m.values()].map(e => [e.good, e.price, e.stock])]) };
    }
    /** toJSON()이 적은 것으로 탐험을 되살린다. 자료와 맞지 않으면 까닭을 담아 던진다(아무것도 바꾸지 않는다).
     *  @param world 자료 @param d toJSON()의 결과 @param {{rng?:DH.RNG, state?:object}} o */
    static restore(world, d, o = {}) {
      const need = (ok, why) => { if (!ok) throw new Error(why); }, I = (v, min = 0, max = 1e12) => Number.isInteger(v) && v >= min && v <= max;
      const w = world, port = id => id === null || (typeof id === 'string' && w.ports.has(id)), cell = p => Array.isArray(p) && p.length === 2 && I(p[0], 0, w.map.cols - 1) && I(p[1], 0, w.map.rows - 1) && w.map.isSea(p[0], p[1]);
      need(d && typeof d === 'object' && Array.isArray(d.ships) && Array.isArray(d.cargo) && Array.isArray(d.markets) && Array.isArray(d.path), '탐험 정보가 없다.');
      need(I(d.gold) && I(d.crew, 0, 1e6) && I(d.food) && I(d.water) && I(d.day, 0, 1e7) && I(d.sinceLand, 0, 1e7), '탐험대 정보가 맞지 않는다.');
      need([null, 'won', 'lost'].includes(d.over) && [null, 'gold', 'time', 'crew'].includes(d.overWhy) && (d.over === null) === (d.overWhy === null) && (d.over !== null || d.crew > 0), '진행 정보가 맞지 않는다.');
      need(cell([d.x, d.y]) && port(d.port) && port(d.lastPort) && port(d.dest) && (d.heading === null || Object.hasOwn(DIRS, d.heading)) && d.path.length <= 4000 && d.path.every(cell), '배의 자리가 지도와 맞지 않는다.');
      if (d.port) { const a = w.ports.get(d.port).anchor; need(a[0] === d.x && a[1] === d.y && !d.path.length && d.heading === null && d.dest === null, '배의 자리가 지도와 맞지 않는다.'); }
      need(d.ships.length >= 1 && d.ships.length <= 12 && new Set(d.ships.map(sh => sh && sh.id)).size === d.ships.length && d.ships.every(sh => sh && typeof sh.id === 'string' && sh.id.length <= 12 && typeof sh.name === 'string' && sh.name.length <= 24 && w.shipTypes.has(sh.type) && I(sh.hull, 0, w.shipTypes.get(sh.type).hull) && (sh.plus === undefined || I(sh.plus, 0, RULES.dock.gunMax))), '배 정보가 자료와 맞지 않는다.');
      need(d.war === undefined || I(d.war, 1, 100), '선장 정보가 맞지 않는다.');                // v0.07까지의 저장에는 war · plus가 없다(그때는 설정 값 · 0)
      need(new Set(d.cargo.map(h => h && h[0])).size === d.cargo.length && d.cargo.every(h => Array.isArray(h) && h.length === 3 && w.goods.has(h[0]) && I(h[1], 1, 1e6) && I(h[2], 0, 1e9)), '짐 정보가 자료와 맞지 않는다.');
      need(d.markets.length === w.ports.size && new Set(d.markets.map(m => m && m[0])).size === d.markets.length && d.markets.every(m => { const p = Array.isArray(m) && m.length === 2 && w.ports.get(m[0]), list = p && m[1];
        return p && Array.isArray(list) && list.length === p.market.length && list.every((e, i) => Array.isArray(e) && e.length === 3 && e[0] === p.market[i].good && I(e[1], 1, 1e9) && I(e[2], 0, 1e9)); }), '시세 정보가 자료와 맞지 않는다.');
      const v = new Voyage(world, o);
      Object.assign(v, { gold: d.gold, crew: d.crew, food: d.food, water: d.water, x: d.x, y: d.y, port: d.port, lastPort: d.lastPort, day: d.day, sinceLand: d.sinceLand, path: d.path.map(p => [p[0], p[1]]), dest: d.dest, heading: d.heading, over: d.over, overWhy: d.overWhy });
      v.ships = d.ships.map(sh => ({ id: sh.id, type: sh.type, name: sh.name, hull: sh.hull, plus: sh.plus || 0 }));
      if (d.war !== undefined) v.captain.war = d.war;
      v.cargo = new Map(d.cargo.map(([good, qty, paid]) => [good, { qty, paid }]));
      for (const [pid, list] of d.markets) for (const [good, price, stock] of list) Object.assign(v.markets.get(pid).get(good), { price, stock });
      return v;
    }
  }

  DH.Hang = Object.assign(DH.Hang || {}, { Voyage, RULES });
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* 동현항 v1.00 · 상업 지분과 작위. 실제 포르투갈 제도 재현이 아닌 게임 규칙.
 * 바다·전투 난수를 쓰지 않는다. 모든 비용과 표시를 같은 함수로 계산한다. */
(function (root) {
  'use strict';
  const H = root.DH.Hang, NO = why => ({ ok: false, why }), fmt = n => n.toLocaleString('ko-KR');
  const GROWTH = {
    capital: 5000, maxInvestment: 50000, cooperative: 50,
    ranks: [
      { name: '남작', fame: 0, ports: 0, allies: 0 },
      { name: '자작', fame: 100, ports: 3, allies: 1 },
      { name: '백작', fame: 350, ports: 8, allies: 2 },
      { name: '후작', fame: 800, ports: 15, allies: 4 },
      { name: '공작', fame: 1600, ports: 23, allies: 6 },
      { name: '대공', fame: 2800, ports: 30, allies: 8 }
    ],
    // 대부분의 항구는 남작부터 열린다. 원거리의 일부만 작위로 해금한다.
    ports: { capetown: 1, ceylon: 1, java: 2, hongkong: 2, butuan: 2, cebu: 2,
      ternate: 3, ambon: 3, sulu: 3, guatemala: 4 },
    ships: { caravel: 0, carrack: 1, panok: 1, turtle: 2, aegis: 4 }
  };
  Object.assign(H.Voyage.prototype, {
    initGrowth() {
      this.growth = { rank: 0, profit: 0, battle: 0, explored: [], investments: [], savings: 0, legacyAccess: false, founded: false };
      this.dialogue = { advice: true, quotes: true, quoteIndex: 0, lastQuoteDay: -30 };
      if (this.port) this.growth.explored.push(this.port);
    },
    getRank() { return GROWTH.ranks[this.growth.rank]; },
    address() { return this.growth.rank >= 3 ? '전하' : '각하'; },
    fame() {
      return { trade: Math.floor(this.growth.profit / 100), battle: this.growth.battle,
        explore: Math.max(0, this.growth.explored.length - 1) * 20 };
    },
    totalFame() { const f = this.fame(); return f.trade + f.battle + f.explore; },
    recordProfit(n) { if (!this.inv) this.growth.profit = Math.min(1e12, this.growth.profit + Math.max(0, Math.floor(n))); },
    recordVisit(pid) { if (!this.growth.explored.includes(pid)) this.growth.explored.push(pid); },
    investment(pid = this.port) { return this.growth.investments.find(e => e[0] === pid)?.[1] || 0; },
    share(pid = this.port) { const n = this.investment(pid); return n ? 100 * n / (n + GROWTH.capital) : 0; },
    cooperative(pid = this.port) { return this.share(pid) >= GROWTH.cooperative; },
    allies() { return this.growth.investments.filter(([p]) => this.cooperative(p)).length; },
    marketFee(pid = this.port) {
      return this.rules.price.feePct * (this.cooperative(pid) ? 1 - this.share(pid) / 100 : 1);
    },
    buyUnit(e, pid = this.port) {
      // 옛 판은 매수 수수료가 없었다. 옛 저장은 그 거래 규칙도 유지한다.
      return this.growth.legacyAccess ? e.price : Math.ceil(e.price * (1 + this.marketFee(pid) / 100));
    },
    sellUnit(e, pid = this.port) {
      const down = Math.max(Math.max(1, Math.round(e.ref * this.rules.price.minPct / 100)), e.price - this.priceStep(e));
      return Math.floor(down * (100 - this.marketFee(pid)) / 100);
    },
    stockTarget(pid, e) { return Math.floor(e.refStock * (this.cooperative(pid) ? 1 + this.share(pid) / 100 : 1)); },
    foodFactor() { return this.cooperative() ? 1 - this.share() / 200 : 1; },
    canInvest(amount) {
      if (this.over) return NO('탐험이 끝났다');
      if (!this.port) return NO('항구에서 투자한다');
      if (![1000, 5000, 10000].includes(amount)) return NO('투자는 1,000·5,000·10,000 단위다');
      if (this.investment() + amount > GROWTH.maxInvestment) return NO('한 항구에는 50,000까지 투자한다');
      // 투자 자본은 무적 모드에서도 실제 자금을 사용한다.
      if (this.gold < amount) return NO('투자할 자금이 모자란다');
      return { ok: true, cost: amount, share: 100 * (this.investment() + amount) / (this.investment() + amount + GROWTH.capital) };
    },
    invest(amount) {
      const c = this.canInvest(amount); if (!c.ok) return c;
      const row = this.growth.investments.find(e => e[0] === this.port);
      if (row) row[1] += amount; else this.growth.investments.push([this.port, amount]);
      this.gold -= amount;
      return { ok: true, type: 'invest', text: `${this.address()}, ${this.here.name}에 금 ${fmt(amount)}을 투자했습니다. 지분은 ${this.share().toFixed(1)}%입니다.${this.cooperative() ? ' 협력항 혜택을 받으실 수 있습니다.' : ''}` };
    },
    portRank(pid) { return GROWTH.ports[pid] || 0; },
    canPort(pid) {
      if (!this.world.ports.has(pid)) return NO('그런 항구는 없다');
      return this.growth.legacyAccess || this.inv || this.growth.rank >= this.portRank(pid) || this.growth.explored.includes(pid)
        ? { ok: true } : NO(`${GROWTH.ranks[this.portRank(pid)].name}부터 입항한다`);
    },
    canShip(type) {
      const n = GROWTH.ships[type] || 0;
      return this.growth.legacyAccess || this.inv || this.growth.rank >= n ? { ok: true } : NO(`${GROWTH.ranks[n].name}부터 구입·교환한다`);
    },
    promotion() {
      if (this.over) return NO('탐험이 끝났다');
      if (this.port !== 'lisbon') return NO('리스본 왕궁에서 승작한다');
      const next = GROWTH.ranks[this.growth.rank + 1]; if (!next) return NO('이미 대공이다');
      const lacks = [];
      if (this.totalFame() < next.fame) lacks.push(`명성 ${next.fame - this.totalFame()}`);
      if (this.growth.explored.length < next.ports) lacks.push(`첫 방문 ${next.ports - this.growth.explored.length}항구`);
      if (this.allies() < next.allies) lacks.push(`협력항 ${next.allies - this.allies()}곳`);
      return lacks.length ? NO(`${next.name}까지 ${lacks.join(' · ')} 부족`) : { ok: true, next: next.name };
    },
    promote() {
      const c = this.promotion(); if (!c.ok) return c;
      this.growth.rank++;
      if (this.growth.rank === 5) this.growth.founded = true;
      this.checkStage();
      return { ok: true, type: 'promote', text: `${this.address()}, ${c.next}에 오르셨습니다.${this.growth.founded ? ' 협력항 연합의 공국을 세우셨습니다. 축하드립니다.' : ' 새로 열린 항구·선박·왕실 의뢰를 확인해 보시겠습니까?'}` };
    },
    advice() {
      if (!this.port) return null;
      let best = null;
      const market = this.markets.get(this.port);
      for (const e of market.values()) {
        if (!e.refStock || !e.stock) continue;
        const buy = this.buyUnit(e);
        for (const [pid, m] of this.markets) {
          if (pid === this.port || !this.canPort(pid).ok) continue;
          const unit = this.sellUnit(m.get(e.good), pid), pct = Math.floor((unit / buy - 1) * 100);
          if (pct > 0 && (!best || pct > best.pct)) best = { good: e.good, to: pid, buy, unit, pct };
        }
      }
      return best ? { ...best, text: `${this.address()}, ${DH.josa(this.world.goods.get(best.good).name, '은', '는')} 이곳 매수 ${fmt(best.buy)} → ${this.world.ports.get(best.to).name} 순매각 ${fmt(best.unit)} 기준으로 ${best.pct}% 높습니다. 지금 시세 기준이며 항해비·추가 가격 변동은 별도입니다.` } : { text: `${this.address()}, 지금 열린 항구에는 수수료를 뺀 유리한 교역 차익이 없습니다. 의뢰와 처음 방문하실 항구를 살펴보시는 것을 권합니다.` };
    },
    royalOffers(pid, round, ordinary) {
      const rank = this.growth.rank;
      if (!rank || !ordinary.length) return [];
      const base = ordinary[rank % ordinary.length], qty = 30 + rank * 10;
      return [{ ...base, id: `${pid}-${round}-royal${rank}`, qty, reward: Math.round(qty * this.markets.get(base.to).get(base.good).ref * (1.3 + rank * .1)), royal: rank }];
    },
    growthJSON() { return { growth: JSON.parse(JSON.stringify(this.growth)), dialogue: { ...this.dialogue }, stage: { ...this.stage } }; },
    restoreGrowth(d) {
      const need = (v, why) => { if (!v) throw new Error(why); }, I = (n, max = 1e12) => Number.isInteger(n) && n >= 0 && n <= max;
      if (d.growth === undefined) {
        this.growth.legacyAccess = true;
        this.growth.explored = [...this.visits.keys()];
        this.stage = { ...(this.state?.stage || { gold: 0, days: 0 }) };
        // 옛 무목표 판은 공국 건국으로 이어가되 기존 자금·날짜는 건드리지 않는다.
        this.stage.ending = this.stage.gold ? (this.stage.days ? 2 : 1) : 3;
        return;
      }
      const g = d.growth, q = d.dialogue, st = d.stage;
      need(g && I(g.rank, 5) && I(g.profit) && I(g.battle) && I(g.savings) &&
        typeof g.legacyAccess === 'boolean' && typeof g.founded === 'boolean' && g.founded === (g.rank === 5), '성장 정보가 맞지 않는다.');
      need(Array.isArray(g.explored) && g.explored.length <= this.world.ports.size && new Set(g.explored).size === g.explored.length && g.explored.every(p => this.world.ports.has(p)), '탐험 명성이 맞지 않는다.');
      need(Array.isArray(g.investments) && g.investments.length <= this.world.ports.size &&
        new Set(g.investments.map(e => e?.[0])).size === g.investments.length && g.investments.every(e => Array.isArray(e) && e.length === 2 && this.world.ports.has(e[0]) && I(e[1], GROWTH.maxInvestment) && e[1] % 1000 === 0), '투자 정보가 맞지 않는다.');
      need(q && typeof q.advice === 'boolean' && typeof q.quotes === 'boolean' && I(q.quoteIndex, 1e9) &&
        Number.isInteger(q.lastQuoteDay) && q.lastQuoteDay >= -30 && q.lastQuoteDay <= d.day, '대화 설정이 맞지 않는다.');
      need(st && [1, 2, 3].includes(st.ending) && I(st.gold, 9999999) && I(st.days, 36500) &&
        (st.ending === 3 || st.gold > 0) && (st.ending !== 2 || st.days > 0), '엔딩 조건이 맞지 않는다.');
      this.growth = JSON.parse(JSON.stringify(g)); this.dialogue = { ...q }; this.stage = { ...st };
      need(d.overWhy !== 'duchy' || (g.founded && d.over === 'won'), '공국 엔딩이 맞지 않는다.');
      need(d.overWhy !== 'gold' || (d.over === 'won' && st.ending !== 3 && d.gold >= st.gold), '자금 엔딩이 맞지 않는다.');
      need(d.overWhy !== 'time' || (d.over === 'lost' && st.ending === 2 && d.day >= st.days), '기한 엔딩이 맞지 않는다.');
      need(d.overWhy !== 'crew' || (d.over === 'lost' && d.crew === 0), '선원 엔딩이 맞지 않는다.');
    }
  });
  H.GROWTH = GROWTH;
})(globalThis);

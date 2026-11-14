/* 동현항 · 해전 — 8×8 육각 바다에서 두 함대가 차례로 싸운다. 화면을 모른다(node에서 그대로 돈다).
 *
 * 차례: 우리 함대 → 적 함대 → 다음 턴. 배마다 한 턴에 한 번 움직이고(이동력 3) 한 번 일한다(포격 · 백병전 · 대기).
 *   포격     사거리 3칸 안의 적에게 쏜다.  선체 피해 = 포 × 3 × 선원 ÷ 정원,  선원 피해 = 포 × 선원 ÷ 정원 ÷ 2   (소수점은 버린다)
 *   백병전   맞닿은 적 배에 올라탄다(기함에도 된다).  적 선원 −(우리 선원의 40% × 우리 선장 무력 ÷ 70) → 살아남은 적이 되받아친다: 우리 선원 −(남은 적 선원의 30% × 적 선장 무력 ÷ 70)
 *   일기토   기함이 적 기함과 맞닿으면 선장이 일기토를 신청할 수 있다(해전마다 쪽마다 한 번). 받아들이면 선장끼리 겨룬다.
 *            기력 100에서, 번갈아 무력 × (20~50%)만큼 깎는다. 먼저 0이 되면 지고, 진 쪽이 해전을 진다. 물리치면 싸움은 그대로 이어진다.
 *            AI는 무력이 10 넘게 앞설 때 신청하고, 신청을 받으면 15까지 뒤져도 받는다. 우리 쪽이 신청을 받으면 answer()로 답한다(화면이 묻는다).
 *            맡겨 둔 싸움(auto)에서 우리 쪽은 우리 선장의 무력이 적 선장 이상일 때만 받는다.
 *   무적     fleet.invincible이면 그 쪽 배는 선체와 선원이 줄지 않고, 선장은 일기토에서 기력이 줄지 않는다.
 *   선체가 0이 되면 가라앉고, 선원이 0이 되면 배를 빼앗긴다. 기함을 잃은 쪽이 진다. 20턴이 지나면 승부 없이 갈라진다.
 * 암초(네 칸)에는 들어갈 수 없다. 자리는 시드로 정해진다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};

  const SEA = { cols: 8, rows: 8, hex: 27, mp: 3, range: 3, gunHull: 3, gunCrewDiv: 2, boardPct: 40, backPct: 30, warBase: 70, turns: 20, rocks: 4,
    duel: { hp: 100, minPct: 20, maxPct: 50, rounds: 40, dare: 10, accept: 15 } };      // warBase: 백병전의 기준 무력 · dare: AI가 신청하는 무력 차 · accept: AI가 받아 주는 무력 차
  const SPOT = { me: [[1, 4], [0, 2], [0, 6]], foe: [[6, 3], [7, 1], [7, 5]] };
  const OTHER = { me: 'foe', foe: 'me' };

  /** 시드로 암초 자리를 정한다. 가운데 네 줄(2~5열)에만 놓는다. */
  function makeSea(seed, n = SEA.rocks) {
    const rng = new DH.RNG((seed >>> 0) * 2654435761 + 97), rocks = new Set();
    for (let i = 0; i < 200 && rocks.size < n; i++) rocks.add((2 + rng.int(4)) + ',' + rng.int(SEA.rows));
    return rocks;
  }

  class SeaBattle {
    /** @param {{seed:number, rng:DH.RNG, rules?:object, place?:string, me:Fleet, foe:Fleet}} o
     *  Fleet = {name, captain:{name, war}, gold?, invincible?, ships:[{ref, type?, name, kind, hull, maxHull, crew, maxCrew, guns}]}  첫 배가 기함이다(세 척까지)
     *  o.rules를 주면 그 값으로 싸운다(동현랭 설정). 없으면 이 파일의 SEA. */
    constructor(o) {
      this.S = { ...SEA, ...(o.rules || {}), duel: { ...SEA.duel, ...((o.rules && o.rules.duel) || {}) } };
      this.rng = o.rng || new DH.RNG(o.seed || 1); this.place = o.place || '바다';
      this.grid = new DH.HexGrid(SEA.cols, SEA.rows, SEA.hex); this.rocks = makeSea(o.seed || 0, this.S.rocks);
      this.fleets = { me: { name: o.me.name, captain: { ...o.me.captain }, gold: o.me.gold || 0, invincible: !!o.me.invincible }, foe: { name: o.foe.name, captain: { ...o.foe.captain }, gold: o.foe.gold || 0, invincible: !!o.foe.invincible } };
      this.units = [];
      for (const side of ['me', 'foe']) o[side].ships.slice(0, 3).forEach((s, i) => this.units.push({ id: side + i, side, ref: s.ref, type: s.type || null, name: s.name, kind: s.kind, flag: i === 0,
        hull: s.hull, maxHull: s.maxHull, crew: s.crew, maxCrew: s.maxCrew, guns: s.guns, c: SPOT[side][i][0], r: SPOT[side][i][1], moved: false, done: false, out: null }));
      for (const u of this.units) this.rocks.delete(u.c + ',' + u.r);
      this.side = 'me'; this.turn = 1; this.winner = null; this.ended = false; this.fled = null; this.reason = ''; this.duel = null; this.log = [];
      this.asked = { me: false, foe: false }; this.pending = null;              // 일기토를 이미 신청했는지 · 답을 기다리는 신청 {unit, target}
    }
    isRock(c, r) { return this.rocks.has(c + ',' + r); }
    at(c, r) { return this.isRock(c, r) ? 'rock' : 'sea'; }
    unitAt(c, r) { return this.units.find(u => !u.out && u.c === c && u.r === r) || null; }
    alive(side) { return this.units.filter(u => u.side === side && !u.out); }
    flag(side) { return this.units.find(u => u.side === side && u.flag); }
    crewOf(side) { return this.alive(side).reduce((n, u) => n + u.crew, 0); }
    hullOf(side) { return this.alive(side).reduce((n, u) => n + u.hull, 0); }
    dist(a, b) { return this.grid.distance(a.c, a.r, b.c, b.r); }
    label(u) { return `${this.fleets[u.side].name} ${u.name}`; }
    safe(u) { return this.fleets[u.side].invincible; }                          // 무적인 쪽의 배
    war(side) { return this.fleets[side].captain.war; }

    /** 이 배가 지금 갈 수 있는 칸. Map<'c,r',{c,r,cost}>. 암초와 다른 배가 선 칸은 뺀다. 제자리는 들어 있다. */
    range(u) {
      const mp = u.done || u.moved || u.out ? 0 : this.S.mp;
      const all = DH.moveRange(this.grid, [u.c, u.r], mp, (c, r) => (this.isRock(c, r) || (this.unitAt(c, r) && this.unitAt(c, r) !== u) ? Infinity : 1));
      return all;
    }
    can(u) { return !this.ended && !u.out && !u.done && u.side === this.side; }
    /** (c,r)에 선다면 쏠 수 있는 적 · 올라탈 수 있는 적 */
    fireTargets(u, c = u.c, r = u.r) { return this.can(u) && u.guns > 0 ? this.alive(OTHER[u.side]).filter(t => this.grid.distance(c, r, t.c, t.r) <= this.S.range) : []; }
    boardTargets(u, c = u.c, r = u.r) { return this.can(u) ? this.alive(OTHER[u.side]).filter(t => this.grid.distance(c, r, t.c, t.r) === 1) : []; }
    /** 일기토를 신청할 수 있는 적 기함(우리 기함이 맞닿아 있고, 이 해전에서 아직 신청하지 않았을 때) */
    duelTargets(u) { return u.flag && !this.asked[u.side] && !this.pending ? this.boardTargets(u).filter(t => t.flag) : []; }
    /** 올라타면 어떻게 되는지: {hit 맞선 배가 잃는 선원, left 그 뒤 남는 선원, back 되받아 올라탄 배가 잃는 선원} */
    boardPreview(u, t) {
      const S = this.S, hit = this.safe(t) ? 0 : Math.min(t.crew, Math.floor(u.crew * S.boardPct * this.war(u.side) / (100 * S.warBase))), left = t.crew - hit;
      const back = left > 0 && !this.safe(u) ? Math.min(u.crew, Math.floor(left * S.backPct * this.war(t.side) / (100 * S.warBase))) : 0;
      return { hit, left, back };
    }
    /** 포격 한 번의 피해: {hull, crew} */
    shot(u) { return { hull: Math.floor(u.guns * this.S.gunHull * u.crew / u.maxCrew), crew: Math.floor(u.guns * u.crew / u.maxCrew / this.S.gunCrewDiv) }; }

    move(u, c, r) {
      if (!this.can(u) || u.moved) return false;
      if (!this.range(u).has(c + ',' + r) || (u.c === c && u.r === r)) return false;
      u.c = c; u.r = r; u.moved = true; return true;
    }
    /** 배가 싸움에서 빠진다: 'sunk' 가라앉음 · 'taken' 빼앗김. 기함이면 그 쪽이 진다. */
    knock(u, how) {
      u.out = how; if (how === 'sunk') { u.hull = 0; u.crew = 0; } else u.crew = 0;
      if (u.flag) this.finish(OTHER[u.side], `${this.fleets[u.side].name}의 기함이 ${how === 'sunk' ? '가라앉았다' : '넘어갔다'}`);
      else if (!this.alive(u.side).length) this.finish(OTHER[u.side], `${this.fleets[u.side].name}의 배가 모두 사라졌다`);
    }
    fire(u, t) {
      if (!this.fireTargets(u).includes(t)) return null;
      const s = this.shot(u), safe = this.safe(t), hull = safe ? 0 : Math.min(t.hull, s.hull), crew = safe ? 0 : Math.min(t.crew, s.crew);
      t.hull -= hull; t.crew -= crew; u.done = true;
      const end = t.hull <= 0 ? 'sunk' : t.crew <= 0 ? 'taken' : null;
      const rec = { type: 'fire', unit: u.id, target: t.id, hull, crew, out: end, text: `${DH.josa(this.label(u), '이', '가')} ${this.label(t)}에 포를 쐈다 · 선체 −${hull} · 선원 −${crew}${end === 'sunk' ? ' · 가라앉았다' : end === 'taken' ? ' · 선원을 모두 잃었다' : ''}` };
      this.log.push(rec.text); if (end) this.knock(t, end);
      return rec;
    }
    /** 백병전. 선장의 무력이 기준(70)보다 높으면 그만큼 세다. 기함에 올라타도 선원끼리 싸운다(일기토는 challenge로 따로 신청한다). */
    board(u, t) {
      if (!this.boardTargets(u).includes(t)) return null;
      u.done = true;
      const { hit, back } = this.boardPreview(u, t); t.crew -= hit; u.crew -= back;
      const end = t.crew <= 0 ? 'taken' : null, lost = u.crew <= 0 ? 'taken' : null;
      const rec = { type: 'board', unit: u.id, target: t.id, hit, back, out: end, lost, text: `${DH.josa(this.label(u), '이', '가')} ${this.label(t)}에 올라탔다 · 맞선 배 선원 −${hit} · 올라탄 배 선원 −${back}${end ? ' · 배를 빼앗았다' : lost ? ' · 되레 배를 빼앗겼다' : ''}` };
      this.log.push(rec.text);
      if (end) this.knock(t, end); else if (lost) this.knock(u, lost);
      return rec;
    }
    /** 신청을 받은 쪽(side)이 받아들일지(AI의 답 · 맡겨 둔 싸움의 답). 무적이면 늘 받는다.
     *  적은 무력이 accept(15)까지 뒤져도 받고, 우리 쪽은 무력이 적 선장 이상일 때만 받는다(지면 해전을 지므로). */
    accepts(side) {
      const mine = this.war(side), theirs = this.war(OTHER[side]);
      return this.fleets[side].invincible || (side === 'me' ? mine >= theirs : mine >= theirs - this.S.duel.accept);
    }
    /** 일기토를 신청한다(사람이 고른 것). 적 선장이 받아들이면 바로 겨루고, 물리치면 그 배는 이어서 다른 일을 할 수 있다. 해전마다 한 번만 신청한다. */
    challenge(u, t) {
      if (!this.can(u) || !this.duelTargets(u).includes(t)) return null;
      this.asked[u.side] = true;
      if (!this.accepts(t.side)) return this.refuse(u, t);
      u.done = true; return this.duelOf(u, t);
    }
    refuse(u, t) {
      const A = this.fleets[u.side].captain, B = this.fleets[t.side].captain;
      const rec = { type: 'refuse', unit: u.id, target: t.id, text: `${DH.josa(B.name, '이', '가')} ${A.name}의 일기토 신청을 물리쳤다` };
      this.log.push(rec.text); return rec;
    }
    /** 기다리는 신청(pending)에 답한다. 받으면 겨루고, 물리치면 신청한 배가 이어서 움직인다. */
    answer(accept) {
      const p = this.pending; if (!p || this.ended) return null; this.pending = null;
      const u = this.units.find(x => x.id === p.unit), t = this.units.find(x => x.id === p.target);
      if (!accept) return this.refuse(u, t);
      u.done = true; return this.duelOf(u, t);
    }
    /** 기함 선장끼리의 일기토. 신청한 쪽이 먼저 친다. 무적인 선장은 기력이 줄지 않는다. */
    duelOf(u, t) {
      const D = this.S.duel, A = this.fleets[u.side].captain, B = this.fleets[t.side].captain, hp = { a: D.hp, b: D.hp }, rounds = [];
      const swing = (war, safe) => (safe ? 0 : Math.floor(war * (D.minPct + this.rng.int(D.maxPct - D.minPct + 1)) / 100));
      for (let i = 0; i < D.rounds && hp.a > 0 && hp.b > 0; i++) {
        const x = swing(A.war, this.safe(t)); hp.b = Math.max(0, hp.b - x); let y = 0;
        if (hp.b > 0) { y = swing(B.war, this.safe(u)); hp.a = Math.max(0, hp.a - y); }
        rounds.push([x, y, hp.a, hp.b]);
      }
      const aWins = hp.b <= 0 || (hp.a > 0 && hp.a >= hp.b), win = aWins ? u : t, lose = aWins ? t : u, wn = aWins ? A : B, ln = aWins ? B : A;
      this.duel = { a: { name: A.name, war: A.war, side: u.side, hp: hp.a }, b: { name: B.name, war: B.war, side: t.side, hp: hp.b }, rounds, winner: win.side };
      const rec = { type: 'duel', unit: u.id, target: t.id, winner: win.side, rounds: rounds.length, text: `일기토: ${A.name}(무력 ${A.war}) 대 ${B.name}(무력 ${B.war}) · ${rounds.length}합 만에 ${DH.josa(wn.name, '이', '가')} 이겼다(남은 기력 ${aWins ? hp.a : hp.b})` };
      this.log.push(rec.text);
      lose.out = 'taken'; lose.crew = 0; this.finish(win.side, `${DH.josa(wn.name, '이', '가')} 일기토에서 ${DH.josa(ln.name, '을', '를')} 꺾었다`);
      return rec;
    }
    wait(u) { if (this.can(u)) u.done = true; }
    /** 지금 쪽의 차례를 마친다. 적 함대까지 마치면 턴이 간다. */
    endSide() {
      if (this.ended) return;
      if (this.side === 'foe') { if (this.turn >= this.S.turns) return this.finish(null, `${this.S.turns}턴이 지나 두 함대가 갈라졌다`); this.turn++; }
      this.side = OTHER[this.side];
      for (const u of this.units) if (u.side === this.side) { u.moved = false; u.done = false; }
    }
    /** 달아난다(짐을 버리고 빠져나온다). 승패는 없다. */
    flee(side) { if (!this.ended) { this.fled = side; this.finish(null, `${DH.josa(this.fleets[side].name, '이', '가')} 달아났다`); } }
    finish(winner, reason) { if (this.ended) return; this.ended = true; this.winner = winner; this.reason = reason; this.log.push(reason); }
    result() {
      const pack = side => ({ crew: this.crewOf(side), ships: this.units.filter(u => u.side === side).map(u => ({ ref: u.ref, type: u.type, name: u.name, hull: u.hull, crew: u.crew, out: u.out })) });
      return { winner: this.winner, fled: this.fled, reason: this.reason, turns: this.turn, loot: this.winner === 'me' ? this.fleets.foe.gold : 0, duel: this.duel, me: pack('me'), foe: pack('foe') };
    }

    /** 지금 쪽의 배 하나를 AI가 움직인다. 움직일 배가 없으면 null(그러면 endSide를 부른다).
     *  ① 기함끼리 맞닿을 수 있고 우리 선장이 10 넘게 세면 일기토를 신청한다(한 번만). 그러면 pending이 서고, answer()로 답해야 한다.
     *     답 없이 aiAct를 또 부르면 accepts()대로 답한다. ② 선원이 곱절이면 올라탄다.
     *  ③ 쏠 수 있는 자리로 가서 쏜다(가라앉힐 수 있는 배 · 기함 먼저, 되도록 떨어져서). ④ 못 쏘면 가장 가까운 적 쪽으로 간다. */
    aiAct() {
      if (this.ended) return null;
      if (this.pending) { const p = this.pending, t = this.units.find(x => x.id === p.target); return { type: 'move', unit: p.unit, ...this.answer(this.accepts(t.side)) }; }
      const u = this.units.find(x => x.side === this.side && !x.out && !x.done); if (!u) return null;
      const g = this.grid, reach = [...this.range(u).values()], foes = this.alive(OTHER[u.side]), rec = { type: 'move', unit: u.id, from: [u.c, u.r], to: [u.c, u.r] };
      const go = v => { if (v.c !== u.c || v.r !== u.r) this.move(u, v.c, v.r); rec.to = [u.c, u.r]; };
      const mine = this.fleets[u.side].captain.war, theirs = this.fleets[OTHER[u.side]].captain.war;
      let best = null;
      for (const v of reach) for (const t of foes) {
        const d = g.distance(v.c, v.r, t.c, t.r);
        if (d === 1 && u.flag && t.flag && !this.asked[u.side] && mine >= theirs + this.S.duel.dare) { const s = 1000 - v.cost; if (!best || s > best.s) best = { s, v, t, act: 'dare' }; }
        else if (d === 1 && u.crew >= t.crew * 2 && t.crew > 0 && !this.safe(t)) { const s = 600 + (t.flag ? 100 : 0) - v.cost; if (!best || s > best.s) best = { s, v, t, act: 'board' }; }
        if (d <= this.S.range && u.guns > 0) { const sh = this.shot(u), s = Math.min(t.hull, sh.hull) + (sh.hull >= t.hull || sh.crew >= t.crew ? 200 : 0) + (t.flag ? 30 : 0) + d * 2 - v.cost; if (!best || s > best.s) best = { s, v, t, act: 'fire' }; }
      }
      if (best && best.act === 'dare') {
        go(best.v); this.asked[u.side] = true; this.pending = { unit: u.id, target: best.t.id };
        const A = this.fleets[u.side].captain, B = this.fleets[best.t.side].captain, text = `${A.name}(무력 ${A.war})${DH.josa(A.name, '이', '가').slice(A.name.length)} ${B.name}(무력 ${B.war})에게 일기토를 신청했다`;
        this.log.push(text); return { ...rec, type: 'challenge', target: best.t.id, text };
      }
      if (best) { go(best.v); const a = best.act === 'board' ? this.board(u, best.t) : this.fire(u, best.t); return { ...rec, ...a }; }
      const near = foes.map(f => ({ f, d: this.dist(u, f) })).sort((a, b) => a.d - b.d || (b.f.flag - a.f.flag))[0];
      if (near) { let pick = null; for (const v of reach) { const d = g.distance(v.c, v.r, near.f.c, near.f.r), s = d * 10 + v.cost; if (d < near.d && (!pick || s < pick.s)) pick = { s, v }; } if (pick) go(pick.v); }
      u.done = true; return rec;
    }
    /** AI끼리 끝까지 싸운다. @returns result() */
    auto() { for (let n = 0; !this.ended && n < 5000; n++) if (!this.aiAct()) this.endSide(); if (!this.ended) this.finish(null, '끝이 나지 않았다'); return this.result(); }
  }

  DH.Hang = Object.assign(DH.Hang || {}, { SeaBattle, SEA, makeSea });
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* 동현항 · 해전 장면 — hang-battle.js의 해전을 캔버스에 그리고 손으로 싸운다. 바다 장면 위에 얹는다(engine.pushScene).
 *   우리 배를 찍는다 → 갈 수 있는 칸이 노랗게 → 칸을 찍어 옮긴다 → 붉은 테의 적(사거리 안)을 찍으면 포를 쏜다.
 *   적과 맞닿아 있으면 조작 창에 '올라타기'(기함끼리는 '일기토') 단추가 뜬다.
 *   조작 창: 대기 · 차례 넘기기 · 맡기기(남은 싸움을 AI에게) · 달아나기(한 번 더 묻는다) · 올라타기(맞닿은 적이 있을 때 뒤에 붙는다).
 * 키보드: 방향키 칸 커서 · Enter 커서가 놓인 칸 찍기(손으로 찍는 것과 같다) · Space 아직 일을 마치지 않은 다음 우리 배 ·
 *   숫자 키 조작 창의 단추 · Esc 고른 배 놓기. 결과 카드와 달아나기를 되묻는 창에서는 Enter가 노란 단추를 누른다.
 * 끝나면 결과 카드를 보이고, 바다로 돌아가면서 onDone(result)를 부른다. 결과는 바다 쪽(Voyage.settleBattle)이 반영한다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const WATER = '#9fc4d9', WATER2 = '#a6c9dc', INK = '#26211c', ACCENT = '#f2b705', RED = '#c0321f', STEP = 18, FX = 54;
  const LOOK = { me: { hull: '#6b4a2f', sail: '#fbf7ef' }, foe: { hull: '#3c3226', sail: '#c8402f' } };
  const SIDE = { me: '우리', foe: '적' };
  const ARROW = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const digit = code => { const m = /^(?:Digit|Numpad)([1-9])$/.exec(code); return m ? Number(m[1]) : 0; };

  /** 배 한 척(직접 그린 도형). (x,y)가 가운데, k가 배율. flag면 돛대 끝에 노란 깃발을 단다. */
  function drawShip(g, x, y, k, look = LOOK.me, flag = false) {
    g.save(); g.translate(x, y); g.scale(k, k); g.lineJoin = 'round'; g.lineWidth = 1; g.strokeStyle = INK;
    g.beginPath(); g.moveTo(-6, 1); g.lineTo(6, 1); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fillStyle = look.hull; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 0); g.lineTo(0, 0); g.closePath(); g.fillStyle = look.sail; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, -8); g.lineTo(0, 1); g.stroke();
    if (flag) { g.beginPath(); g.moveTo(0, -8); g.lineTo(-4.5, -9.5); g.lineTo(0, -11); g.closePath(); g.fillStyle = ACCENT; g.fill(); g.lineWidth = 0.7; g.stroke(); }
    g.restore();
  }

  class HangBattleScene extends DH.MapScene {
    /** @param {{onDone:(result)=>void}} o 사람은 언제나 'me' 쪽이다 */
    constructor(engine, layout, battle, o) {
      super(engine); this.layout = layout; this.b = battle; this.me = 'me'; this.onDone = o.onDone;
      this.sel = null; this.reach = new Map(); this.look = null; this.fx = []; this.wait = 30; this.idle = 0; this.auto = false; this.ask = false; this.mode = 'fight'; this.res = null;
      this.cur = null; this.curX = 0;                // 키보드 커서 칸과, 위아래로 갈 때 지키는 가로 자리. 키를 쓰기 전에는 보이지 않는다
    }
    enter() {
      const b = this.b, F = b.fleets;
      this.setupMap({ grid: b.grid, tileAt: (c, r) => ((c + (r >> 1)) % 3 === 0 ? 'sea2' : 'sea'), styles: { sea: { fill: WATER }, sea2: { fill: WATER2 } }, line: 'rgba(38,33,28,.16)', minZoom: 1, maxZoom: 1 });
      this.layout.log(`해전이 벌어졌다 · ${F.me.name} ${b.alive('me').length}척 대 ${F.foe.name} ${b.alive('foe').length}척`);
      this.refresh();
    }
    onDrag() {} onWheel() {}                       // 바다는 한 화면에 다 들어온다
    onKey(code, ev) {
      if (ev && (ev.ctrlKey || ev.metaKey || ev.altKey)) return;
      const d = ARROW[code], n = digit(code), used = () => { if (ev) ev.preventDefault(); };
      if (code === 'Escape') { this.select(null); this.ask = false; return this.refresh(); }
      if (d) { used(); return this.moveCursor(d); }
      if (ev && ev.repeat) return;                                 // 누르고 있어도 한 번만 누른 것으로 친다
      if (n) { used(); this.layout.press(n); }
      else if (code === 'Enter' || code === 'NumpadEnter') {
        used();
        if (this.mode === 'result') { if (this.engine.tick - this.doneAt > 30) this.command('back'); }
        else if (this.ask) this.layout.pressPrimary();
        else if (!this.cur) this.nextUnit(1);                      // 커서가 아직 없으면 우리 배부터 잡는다
        else if (this.myTurn) this.tapCell(this.cur);
      }
      else if (code === 'Space') { used(); this.nextUnit(ev && ev.shiftKey ? -1 : 1); }
    }
    /** 커서를 한 칸 옮긴다. 위아래는 엇갈린 줄에서 가로 자리가 가장 가까운 칸으로 간다. */
    moveCursor(d) {
      if (!this.myTurn) return;
      const g = this.grid, b = this.b;
      if (!this.cur) { const u = this.sel || b.alive(this.me).find(x => !x.done) || b.alive(this.me)[0]; this.cur = u ? { c: u.c, r: u.r } : { c: g.cols >> 1, r: g.rows >> 1 }; this.curX = g.center(this.cur.c, this.cur.r).x; return this.peek(); }
      let { c, r } = this.cur;
      if (d[0]) { c = Math.min(g.cols - 1, Math.max(0, c + d[0])); this.curX = g.center(c, r).x; }
      else {
        const nr = r + d[1]; if (nr < 0 || nr >= g.rows) return;
        const opts = (r & 1 ? [c, c + 1] : [c - 1, c]).filter(x => x >= 0 && x < g.cols);
        c = opts.sort((a, z) => Math.abs(g.center(a, nr).x - this.curX) - Math.abs(g.center(z, nr).x - this.curX))[0]; r = nr;
      }
      this.cur = { c, r }; this.peek();
    }
    /** 커서가 놓인 칸의 사정을 조작 창에 보인다(고른 배가 없을 때). */
    peek() { if (!this.sel && this.mode === 'fight') this.look = this.cur; this.refresh(); }
    /** Space: 아직 일을 마치지 않은 우리 배를 차례로 고르고 커서를 그리로 옮긴다. */
    nextUnit(dir = 1) {
      if (!this.myTurn) return;
      const list = this.b.alive(this.me).filter(u => !u.done); if (!list.length) return;
      const i = list.indexOf(this.sel), u = list[i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length];
      this.ask = false; this.select(u); this.cur = { c: u.c, r: u.r }; this.curX = this.grid.center(u.c, u.r).x; this.sfx('tick'); this.refresh();
    }
    get myTurn() { return this.mode === 'fight' && !this.auto && !this.b.ended && this.b.side === this.me; }
    unit(id) { return this.b.units.find(u => u.id === id); }

    select(u) { this.sel = u; this.reach = u ? this.b.range(u) : new Map(); this.look = null; }
    /** 한 일을 화면에 남긴다: 지나온 자취 · 포탄 줄 · 떠오르는 피해 숫자 · 기록 */
    show(rec) {
      if (!rec) return;
      const g = this.grid, t = this.engine.tick, at = u => g.center(u.c, u.r), hit = (u, text, dy = 0) => { const p = at(u); this.fx.push({ kind: 'hit', x: p.x, y: p.y + dy, text, t0: t }); };
      if (rec.from && rec.to && (rec.from[0] !== rec.to[0] || rec.from[1] !== rec.to[1])) this.fx.push({ kind: 'trail', a: g.center(rec.from[0], rec.from[1]), b: g.center(rec.to[0], rec.to[1]), t0: t });
      const u = rec.unit && this.unit(rec.unit), x = rec.target && this.unit(rec.target);
      if (rec.type === 'fire') { this.fx.push({ kind: 'shot', a: at(u), b: at(x), t0: t }); hit(x, `선체 −${rec.hull}`); }
      else if (rec.type === 'board') { hit(x, `선원 −${rec.hit}`); if (rec.back) hit(u, `선원 −${rec.back}`); }
      else if (rec.type === 'duel') hit(rec.winner === u.side ? x : u, '일기토 패');
      if (rec.text) this.layout.log(rec.text);
      if (rec.type === 'fire') this.sfx('cannon'); else if (rec.type === 'board') this.sfx('clash'); else if (rec.type === 'duel') { this.sfx('clash'); this.sfx('clash', 0.4); }
      else if (rec.from && rec.to && (rec.from[0] !== rec.to[0] || rec.from[1] !== rec.to[1])) this.sfx('ship');
      if (rec.out === 'sunk') this.sfx('explode', 0.35); else if (rec.out) this.sfx('fall', 0.35);
    }
    endSide() {
      const b = this.b; b.endSide(); this.sel = null; this.reach = new Map(); this.ask = false; this.idle = 0; this.wait = STEP;
      if (b.ended) return this.finish();
      this.layout.log(`${b.turn}턴 · ${b.fleets[b.side].name} 차례`); this.refresh();
    }
    finish() {
      if (this.mode === 'result') return;
      this.mode = 'result'; this.res = this.b.result(); this.doneAt = this.engine.tick; this.sel = null; this.reach = new Map(); this.ask = false;
      this.layout.log(`해전이 끝났다 · ${this.res.reason}`); this.sfx(this.res.fled ? 'swish' : this.res.winner === 'me' ? 'win' : 'lose', 0.5); this.refresh();
    }

    update() {
      const b = this.b, t = this.engine.tick;
      if (this.fx.length) this.fx = this.fx.filter(f => t - f.t0 < FX);
      if (this.mode !== 'fight') return;
      if (b.ended) return this.finish();
      if (this.myTurn) {                                           // 우리 배가 모두 일을 마치면 차례를 넘긴다
        if (b.alive(this.me).some(u => !u.done)) this.idle = 0; else if (++this.idle > 24) this.endSide();
        return;
      }
      if (--this.wait > 0) return;
      const rec = b.aiAct();
      if (!rec) return this.endSide();
      this.show(rec); this.wait = STEP;
      if (b.ended) this.finish(); else this.refresh();
    }

    onTap(x, y) {
      const b = this.b;
      if (this.mode === 'result') { if (this.engine.tick - this.doneAt > 30) this.command('back'); return; }      // 싸우던 손이 그대로 카드를 넘기지 않게 반 초 둔다
      if (!this.myTurn) return;
      this.cur = null;                                             // 손으로 찍으면 키보드 커서는 숨는다
      this.tapCell(this.cellAt(x, y));
    }
    /** 칸 하나를 찍는다(손가락 · 마우스 · 키보드 Enter가 같이 쓴다). */
    tapCell(cell) {
      const b = this.b; this.ask = false;
      if (!cell) { this.select(null); return this.refresh(); }
      const u = b.unitAt(cell.c, cell.r), s = this.sel, k = cell.c + ',' + cell.r;
      if (s && u && u.side !== this.me && b.fireTargets(s).includes(u)) { this.show(b.fire(s, u)); this.select(null); }
      else if (s && !u && !s.moved && this.reach.has(k)) {
        const from = [s.c, s.r]; b.move(s, cell.c, cell.r); this.show({ type: 'move', from, to: [s.c, s.r] });
        if (b.fireTargets(s).length) this.select(s); else { b.wait(s); this.select(null); }      // 쏠 적이 없으면 그 턴 일을 마친다
      }
      else if (u && u.side === this.me && !u.done && u !== s) { this.select(u); this.sfx('tick'); }
      else { this.select(null); this.look = cell; }
      if (b.ended) this.finish(); else this.refresh();
    }
    command(id) {
      const b = this.b, [key, arg] = id.split(':');
      if (id === 'back') { if (this.mode !== 'result') return; this.engine.popScene(); return this.onDone(this.res); }
      if (!this.myTurn) return;
      if (id === 'wait' && this.sel) { b.wait(this.sel); this.select(null); }
      else if (key === 'board' && this.sel) { const t = this.unit(arg); if (t && b.boardTargets(this.sel).includes(t)) { this.show(b.board(this.sel, t)); this.select(null); if (b.ended) return this.finish(); } }
      else if (id === 'end') return this.endSide();
      else if (id === 'auto') { this.auto = true; this.select(null); this.wait = 6; this.layout.log('남은 싸움을 선원들에게 맡겼다'); }
      else if (id === 'flee') this.ask = true;
      else if (id === 'no') this.ask = false;
      else if (id === 'yes') { b.flee(this.me); return this.finish(); }
      this.refresh();
    }
    /** 올라타면 어떻게 되는지 미리 본 글 */
    boardText(s, t) {
      const b = this.b, F = b.fleets;
      if (s.flag && t.flag) return `일기토 · ${F[s.side].captain.name}(무력 ${F[s.side].captain.war}) 대 ${F[t.side].captain.name}(무력 ${F[t.side].captain.war})`;
      const hit = Math.min(t.crew, Math.floor(s.crew * b.S.boardPct / 100)), left = t.crew - hit, back = left > 0 ? Math.min(s.crew, Math.floor(left * b.S.backPct / 100)) : 0;
      return `적 선원 −${hit}${left <= 0 ? '(배를 빼앗는다)' : ` → 되받아 우리 선원 −${back}`}`;
    }
    title() { const r = this.res; return !r ? '해전' : r.fled ? '달아났다' : r.winner === 'me' ? '이겼다' : r.winner === 'foe' ? '졌다' : '갈라졌다'; }

    refresh() {
      const b = this.b, L = this.layout, F = b.fleets, s = this.sel, S = b.S;
      L.setInfo([{ label: '곳', value: b.place }, { label: '턴', value: `${b.turn}/${S.turns}` }, { label: '차례', value: this.mode === 'result' ? '끝' : `${SIDE[b.side]} 함대` },
        { label: '우리', value: `선체 ${b.hullOf('me')} · ${b.crewOf('me')}명` }, { label: '적', value: `선체 ${b.hullOf('foe')} · ${b.crewOf('foe')}명` }]);
      const ship = u => (u.out ? (u.out === 'sunk' ? '가라앉았다' : '빼앗겼다') : `${u.kind} · 선체 ${u.hull}/${u.maxHull} · 선원 ${u.crew}/${u.maxCrew} · 포 ${u.guns}`);
      const rows = [['우리 선장', `${F.me.captain.name} · 무력 ${F.me.captain.war}`], ...b.units.filter(u => u.side === 'me').map(u => [`우리 ${u.name}${u.flag ? '(기함)' : ''}`, ship(u)]),
        ['적 선장', `${F.foe.captain.name} · 무력 ${F.foe.captain.war}`], ...b.units.filter(u => u.side === 'foe').map(u => [`적 ${u.name}`, ship(u)])];
      let note;
      if (this.mode === 'result') {
        const r = this.res; rows.push(['결과', `${this.title()} · ${r.reason}`]); if (r.loot) rows.push(['얻은 금', fmt(r.loot)]);
        note = '바다로 돌아가면 결과가 반영된다.';
      } else if (s) {
        const sh = b.shot(s); rows.push(['고른 배', `${s.name} · 포격 한 번에 선체 −${sh.hull} · 선원 −${sh.crew}`]);
        for (const t of b.boardTargets(s)) rows.push([`${t.name}에 백병전`, this.boardText(s, t)]);
        note = (s.moved ? '붉은 테의 적을 찍으면 포를 쏜다.' : '노란 칸을 찍으면 옮긴다. 붉은 테의 적은 바로 쏠 수 있다.') + ` 포격 = 포 ${s.guns} × ${S.gunHull} × 선원 ${s.crew} ÷ 정원 ${s.maxCrew}.` + (b.boardTargets(s).length ? ' 맞닿은 적에는 아래 단추로 올라탄다.' : ' 적과 맞닿으면 올라탈 수 있다.');
      } else if (this.look) {
        const u = b.unitAt(this.look.c, this.look.r); rows.push(['찍은 칸', b.isRock(this.look.c, this.look.r) ? '암초 · 들어갈 수 없다' : '바다']);
        if (u) rows.push(['그 배', `${SIDE[u.side]} ${u.name} · ${ship(u)}`]);
        note = '우리 배를 찍으면 갈 수 있는 칸이 보인다.';
      } else note = this.auto ? '선원들이 알아서 싸우는 중이다.' : this.myTurn ? `우리 배를 찍으면 갈 수 있는 칸이 보인다. 한 턴에 ${S.mp}칸을 가고, ${S.range}칸 안의 적에게 포를 쏜다. 적의 기함을 가라앉히거나 빼앗으면 이긴다. ${S.turns}턴이 지나면 승부 없이 갈라진다.` : '적 함대가 움직이는 중이다.';
      L.setDetail({ title: this.mode === 'result' ? `해전 · ${this.title()}` : `${DH.josa(F.foe.name, '과', '와')}의 해전`, rows, note });
      const off = !this.myTurn, pick = id => this.command(id);
      if (this.mode === 'result') L.setMenu([{ id: 'back', label: '바다로 돌아가기', primary: true }], pick);
      else if (this.ask) L.setMenu([{ id: 'yes', label: '정말 달아난다', hint: '짐의 절반을 버리고 빠져나간다' }, { id: 'no', label: '돌아가기', primary: true }], pick);
      else L.setMenu([{ id: 'wait', label: '대기', disabled: off || !s, hint: '고른 배가 그 턴 일을 마친다' }, { id: 'end', label: '차례 넘기기', primary: true, disabled: off },      // 1~4는 늘 같은 자리, 올라타기는 5부터
        { id: 'auto', label: '맡기기', disabled: off, hint: '남은 싸움을 AI가 대신 싸운다' }, { id: 'flee', label: '달아나기', disabled: off, hint: '짐의 절반을 버리고 빠져나간다' },
        ...(s && !off ? b.boardTargets(s).map(t => ({ id: 'board:' + t.id, label: s.flag && t.flag ? `${DH.josa(F.foe.captain.name, '과', '와')} 일기토` : `${t.name}에 올라타기` })) : [])], pick);
    }

    render(g) {
      g.fillStyle = WATER; g.fillRect(0, 0, this.engine.width, this.engine.height);      // 아래 바다 장면을 가린다
      super.render(g);
      if (this.mode === 'result') this.drawCard(g);
    }
    drawOver(g) {
      const b = this.b, grid = this.grid, t = this.engine.tick, S = grid.size, s = this.sel;
      // 잔물결 · 암초
      g.lineCap = 'round';
      for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
        const p = grid.center(c, r);
        if (b.isRock(c, r)) {
          g.beginPath(); g.moveTo(p.x - 15, p.y + 9); g.lineTo(p.x - 9, p.y - 6); g.lineTo(p.x - 2, p.y + 1); g.lineTo(p.x + 5, p.y - 10); g.lineTo(p.x + 15, p.y + 9); g.closePath(); g.fillStyle = '#6f6a62'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke();
          g.beginPath(); g.moveTo(p.x - 17, p.y + 11); g.quadraticCurveTo(p.x, p.y + 6, p.x + 17, p.y + 11); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.6; g.stroke();
        } else if ((c * 7 + r * 3) % 4 === 0) { g.beginPath(); g.moveTo(p.x - 8, p.y + 14); g.quadraticCurveTo(p.x - 4, p.y + 11, p.x, p.y + 14); g.quadraticCurveTo(p.x + 4, p.y + 17, p.x + 8, p.y + 14); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2; g.stroke(); }
      }
      // 갈 수 있는 칸
      if (s && this.myTurn && !s.moved) {
        g.beginPath(); for (const v of this.reach.values()) if (v.c !== s.c || v.r !== s.r) grid.trace(g, v.c, v.r);
        g.fillStyle = 'rgba(242,183,5,.42)'; g.fill(); g.strokeStyle = '#a77915'; g.lineWidth = 1.2; g.stroke();
      }
      // 자취 · 포탄 줄
      for (const f of this.fx) {
        const a = 1 - (t - f.t0) / FX;
        if (f.kind === 'trail') { g.beginPath(); g.moveTo(f.a.x, f.a.y); g.lineTo(f.b.x, f.b.y); g.strokeStyle = `rgba(38,33,28,${(0.5 * a).toFixed(3)})`; g.lineWidth = 3; g.setLineDash([5, 5]); g.stroke(); g.setLineDash([]); }
        else if (f.kind === 'shot') { const q = Math.min(1, (t - f.t0) / 14), x = f.a.x + (f.b.x - f.a.x) * q, y = f.a.y + (f.b.y - f.a.y) * q - Math.sin(q * Math.PI) * 14;
          g.beginPath(); g.moveTo(f.a.x, f.a.y - 4); g.lineTo(f.b.x, f.b.y - 4); g.strokeStyle = `rgba(38,33,28,${(0.35 * a).toFixed(3)})`; g.lineWidth = 1.4; g.stroke();
          if (q < 1) { g.beginPath(); g.arc(x, y - 4, 3, 0, Math.PI * 2); g.fillStyle = INK; g.fill(); } }
      }
      // 배: 그림 아래에 선체 · 선원
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      for (const u of b.units) {
        if (u.out) continue;
        const p = grid.center(u.c, u.r), dim = this.mode === 'fight' && u.side === b.side && u.done;
        g.globalAlpha = dim ? 0.6 : 1;
        if (u === s) { g.beginPath(); grid.trace(g, u.c, u.r); g.strokeStyle = ACCENT; g.lineWidth = 3; g.stroke(); }
        drawShip(g, p.x, p.y - 4, 2.1, LOOK[u.side], u.flag);
        const label = `${u.hull}·${u.crew}`; g.font = `800 10px ${FONT}`; g.lineWidth = 3; g.strokeStyle = 'rgba(251,247,239,.95)'; g.strokeText(label, p.x, p.y + 15); g.fillStyle = u.side === 'me' ? INK : '#8a2416'; g.fillText(label, p.x, p.y + 15);
        g.globalAlpha = 1;
      }
      if (s && this.myTurn) for (const x of b.fireTargets(s)) { const p = grid.center(x.c, x.r), pulse = 1 + 0.06 * Math.sin(t / 6); g.beginPath(); g.arc(p.x, p.y, S * 0.84 * pulse, 0, Math.PI * 2); g.strokeStyle = RED; g.lineWidth = 3; g.stroke(); }
      // 키보드 커서
      if (this.cur && this.mode === 'fight') { g.beginPath(); grid.trace(g, this.cur.c, this.cur.r); g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.lineWidth = 4.6; g.stroke(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); }
      // 떠오르는 피해 숫자
      for (const f of this.fx) if (f.kind === 'hit') {
        const q = (t - f.t0) / FX, y = f.y - 22 - q * 16; g.globalAlpha = Math.min(1, 2.2 * (1 - q)); g.font = `800 13px ${FONT}`;
        g.lineWidth = 3.5; g.strokeStyle = '#fff'; g.strokeText(f.text, f.x, y); g.fillStyle = RED; g.fillText(f.text, f.x, y); g.globalAlpha = 1;
      }
    }
    drawCard(g) {
      const W = this.engine.width, H = this.engine.height, r = this.res, b = this.b, won = r.winner === 'me', w = 320, h = r.duel ? 156 : 134, x = (W - w) / 2, y = (H - h) / 2;
      g.fillStyle = 'rgba(38,33,28,.45)'; g.fillRect(0, 0, W, H);
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = won ? ACCENT : '#8d8477'; g.fillRect(x + 1, y + 1, w - 2, 6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
      g.font = `800 22px ${FONT}`; g.fillText(this.title(), W / 2, y + 36);
      g.font = `600 13px ${FONT}`; g.fillText(r.reason, W / 2, y + 66, w - 24);
      g.font = `500 12px ${FONT}`; g.fillStyle = '#6e6356'; let yy = y + 88;
      if (r.duel) { g.fillText(`일기토 ${r.duel.rounds.length}합 · ${r.duel.a.name} 기력 ${r.duel.a.hp} · ${r.duel.b.name} 기력 ${r.duel.b.hp}`, W / 2, yy, w - 24); yy += 22; }
      g.fillText(`남은 선원 · 우리 ${b.crewOf('me')}명 · 적 ${b.crewOf('foe')}명` + (r.loot ? ` · 금 +${fmt(r.loot)}` : ''), W / 2, yy, w - 24);
      g.fillText('여기를 찍거나 ‘바다로 돌아가기’를 누른다', W / 2, yy + 22);
    }
    save() { return { turn: this.b.turn, side: this.b.side }; }
  }

  DH.Hang = Object.assign(DH.Hang || {}, { HangBattleScene, drawShip });
})(typeof globalThis !== 'undefined' ? globalThis : this);

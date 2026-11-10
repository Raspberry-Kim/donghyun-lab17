/* 동현항 · 바다 장면 — 사각 세계 지도 위에서 항해하고, 항구에 들어가 교역 · 선원 · 배 · 보급을 챙긴다. 규칙은 hang-rules.js에 있다.
 *   항구   조작 창이 교역소 · 여관 · 도크 · 보급 · 출항으로 바뀐다. 지도에서 갈 항구나 바다를 찍고 출항한다.
 *   바다   방향키로 키를 잡거나 지도의 바다를 찍으면 그리로 간다. 항구를 찍으면 시세가 보이고 '○○로 항해' 단추가 뜬다.
 *          배가 움직이는 동안에만 날이 간다(하루 = 한 걸음). 정박 칸에 닿으면 그 항구에 든다.
 *   만남   적 함대를 만나면 해전 화면(hang-battle-scene.js)으로 넘어가고, 끝나면 결과를 반영해 이 지도로 돌아온다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const TILE = 4, INK = '#26211c', ACCENT = '#f2b705';
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }, WIND = { left: '서', right: '동', up: '북', down: '남' };
  const VIEW = [{ id: 'follow', label: '배 따라가기' }, { id: 'zin', label: '확대' }, { id: 'zout', label: '축소' }];
  const TABS = { market: '교역소', inn: '여관', dock: '도크', supply: '보급' }, NEED = { market: 'market', inn: 'lodge', dock: 'shipyard' };

  class HangSeaScene extends DH.MapScene {
    constructor(engine, world, layout) {
      super(engine); this.world = world; this.layout = layout;
      this.state = DH.Hang.newState();                            // globalState: 기본값. 동현랭 설정이 오면 새로 지어 덮어쓴다
      this.selected = null; this.spot = null; this.tab = null; this.route = null; this.follow = true; this.leg = 0;
      this.voyage = this.newVoyage(); this.from = [this.voyage.x, this.voyage.y];
    }
    newVoyage() {
      if (this.state.start.seed != null) this.engine.rng.state = this.state.start.seed >>> 0;      // 씨앗을 정했으면 판마다 같은 수가 나온다
      return new DH.Hang.Voyage(this.world, { rng: this.engine.rng, state: this.state });
    }
    /** 동현랭 설정을 받아 globalState를 새로 짓고 탐험을 다시 연다. 오류가 있으면 지금 탐험을 그대로 둔다.
     *  @returns 보고서 {ok, empty, settings, errors, applied} */
    applyDonghyunLang(scriptText) {
      const st = DH.Hang.newState(), rep = DH.Hang.applyDonghyunLang(scriptText, st, { world: this.world });
      if (!rep.ok) return rep;
      this.state = st;
      while (this.engine.scene && this.engine.scene !== this) this.engine.popScene();          // 해전 중이었으면 접는다
      this.layout.log(rep.empty ? '동현랭 설정이 없다. 기본값으로 새 탐험을 연다' : `동현랭 설정 ${rep.settings.length}개를 적용했다: ${rep.applied.join(' · ')}`);
      this.restart();
      return rep;
    }
    /** 새 탐험. 날짜와 탐험대를 처음으로 돌린다. */
    restart() {
      const s = this.world.meta.start, c = this.engine.clock;
      Object.assign(c, { year: s.year, month: s.month || 1, day: s.day || 1, serial: 0, _acc: 0, running: false });
      this.voyage = this.newVoyage(); this.from = [this.voyage.x, this.voyage.y];
      this.selected = null; this.spot = null; this.tab = null; this.route = null; this.follow = true; this.leg = 0;
      this.centerOnFleet(); this.hello(); this.refresh();
    }
    hello() {
      const v = this.voyage, st = v.stage;
      this.layout.log(`${v.here ? v.here.name : '바다'}에 닻을 내리고 있다. 채비를 하고 지도에서 갈 곳을 찍어 출항한다`);
      if (st.gold) this.layout.log(`이기는 조건: 자금 ${DH.josa(fmt(st.gold), '을', '를')} 모은다` + (st.days ? ` · 바다에서 ${st.days}일 안에` : ''));
      else if (st.days) this.layout.log(`기한: 바다에서 ${st.days}일을 보내면 탐험이 끝난다`);
    }
    enter() {
      const w = this.world, e = this.engine;
      const grid = new DH.SquareGrid(w.map.cols, w.map.rows, TILE, { wrapX: true, diagonal: true });
      this.setupMap({ grid, tileAt: (c, r) => w.map.at(c, r), styles: { sea: { fill: '#a9cbe0' }, land: { fill: '#eadfc3' } }, minZoom: e.height / grid.height, maxZoom: 5 });
      this.cam.zoom = 2; this.centerOnFleet();
      this._off = [e.on('clock:day', () => this.onDay())];
      this.hello(); this.refresh();
    }
    exit() { this._off.forEach(f => f()); }
    get mode() { const v = this.voyage; return v.over ? 'over' : v.port ? 'port' : 'sea'; }
    get at() { return [this.voyage.x, this.voyage.y]; }
    centerOnFleet() { const p = this.shipPx(); this.cam.centerOn(p.x, p.y); this.cam.clampTo(this.grid); }
    /** 배의 세계 좌표. 항해 중에는 하루 안에서 어제 자리 → 오늘 자리로 미끄러진다. */
    shipPx() {
      const g = this.grid, a = g.center(this.from[0], this.from[1]), b = g.center(this.voyage.x, this.voyage.y), t = this.engine.clock.running ? this.engine.clock.progress : 1;
      const bx = g.nearX(b.x, a.x);
      return { x: a.x + (bx - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    /** 하루가 갔다: 규칙을 한 걸음 돌리고, 생긴 일을 기록하고, 적을 만났으면 해전을 연다. */
    onDay() {
      const v = this.voyage, c = this.engine.clock, L = this.layout;
      if (!v.moving) { c.running = false; return; }
      const r = v.stepDay(); this.from = r.from; this.leg++;
      for (const e of r.events) L.log(r.arrived && e.endsWith('닿았다') ? `${e} · ${this.leg}일 걸렸다` : e);
      if (!v.moving) { c.running = false; this.spot = null; }
      if (r.arrived) { this.selected = null; this.spot = null; this.tab = null; this.route = null; this.from = [v.x, v.y]; }
      if (r.encounter) { c.running = false; return this.openBattle(r.encounter); }
      this.settled();
    }
    /** 해전 화면을 얹는다. 끝나면 결과를 탐험대에 반영하고 돌아온다. */
    openBattle(rival) {
      const v = this.voyage, b = v.openBattle(rival); this.refresh();
      this.engine.pushScene(new DH.Hang.HangBattleScene(this.engine, this.layout, b, { onDone: res => {
        const out = v.settleBattle(res); this.layout.log(out.text);
        this.from = [v.x, v.y]; if (v.port) { this.selected = null; this.spot = null; this.tab = null; this.route = null; }
        this.follow = true; this.centerOnFleet(); this.settled();
      } }));
    }
    settled() { const v = this.voyage; if (v.over && !this._told) { this._told = true; this.engine.clock.running = false; this.layout.log(this.overTitle()); } if (!v.over) this._told = false; this.refresh(); }
    overTitle() { const v = this.voyage; return v.overWhy === 'gold' ? '목표한 자금을 모았다' : v.overWhy === 'time' ? '기한이 다 되었다' : '선원을 모두 잃었다'; }
    update() { if (this.follow && this.engine.clock.running) this.centerOnFleet(); if (this.engine.tick % 6 === 0) this.refreshInfo(); }

    /** 뱃길을 잡고 떠난다. target: 항구 id 또는 바다 칸 [c, r] */
    sail(target) {
      const v = this.voyage, r = v.sailTo(target);
      if (!r.ok) { this.layout.log(r.why); return this.refresh(); }
      this.layout.log(`${r.text} · 약 ${r.days}일`); this.leg = 0; this.tab = null; this.follow = true; this.selected = null; this.route = null; if (!Array.isArray(target)) this.spot = null; this.from = [v.x, v.y]; this.engine.clock.running = true;
      this.refresh();
    }
    /** 항구를 골랐을 때 거기까지의 뱃길(칸 수)을 한 번 재어 둔다. */
    pick(pid) {
      const v = this.voyage, p = this.world.ports.get(pid); this.selected = pid; this.spot = null; this.tab = null;
      const path = pid === v.port ? [] : DH.findPath(v.grid, [v.x, v.y], p.anchor, this.world.map.isSea);
      this.route = { id: pid, len: path ? path.length : null };
    }
    onTap(x, y) {
      if (this.mode === 'over') return;
      const w = this.world, wpt = this.cam.toWorld(x, y), g = this.grid; let best = null, bd = 14 / this.cam.zoom + TILE;
      for (const p of w.ports.values()) { const c = g.center(p.x, p.y), d = Math.hypot(g.nearX(c.x, wpt.x) - wpt.x, c.y - wpt.y); if (d < bd) { bd = d; best = p.id; } }
      if (best) { this.pick(best); return this.refresh(); }
      const cell = this.cellAt(x, y), sea = cell && w.map.isSea(cell.c, cell.r);
      this.selected = null; this.route = null; this.tab = null; this.spot = sea ? [cell.c, cell.r] : null;
      if (sea && this.mode === 'sea') return this.sail(this.spot);                // 바다에서는 찍은 곳으로 바로 간다
      this.refresh();
    }
    onKey(code, ev) {
      const v = this.voyage, c = this.engine.clock, dir = KEYS[code];
      if (dir && this.mode === 'sea') {                                           // 바다에서는 방향키가 키다(항구에서는 지도를 옮긴다)
        if (ev) ev.preventDefault();
        if (v.heading === dir && c.running) return;
        const r = v.steer(dir); this.layout.log(r.ok ? r.text : r.why);
        if (r.ok) { this.spot = null; this.follow = true; this.from = [v.x, v.y]; c.running = true; }
        return this.refresh();
      }
      if (code === 'Space' && this.mode === 'sea' && v.moving) { if (ev) ev.preventDefault(); return this.command('pause'); }
      super.onKey(code, ev);
    }
    say(r) { this.layout.log(r.ok ? r.text : r.why); }
    command(id) {
      const v = this.voyage, c = this.engine.clock, [key, arg] = id.split(':');
      if (id === 'zin') return this.zoomBy(1.25);
      if (id === 'zout') return this.zoomBy(0.8);
      if (id === 'follow') { this.follow = true; return this.centerOnFleet(); }
      if (this.mode === 'over') { if (id === 'again') this.restart(); return; }
      if (id === 'sail') {
        const target = this.selected && this.selected !== v.port ? this.selected : this.spot;
        if (target) return this.sail(target);
        if (v.port) { v.leave(); this.tab = null; this.layout.log('닻을 올렸다. 방향키로 키를 잡거나 지도의 바다를 찍어 뱃길을 잡는다'); }
      }
      else if (id === 'enter') { const p = v.anchorAt(v.x, v.y); if (p && !v.port && !c.running) { v.enter(p.id); this.selected = null; this.spot = null; this.route = null; this.layout.log(`${p.name}에 들어왔다`); } }
      else if (id === 'pause') { if (v.moving) { c.running = !c.running; if (!c.running) this.from = [v.x, v.y]; } }
      else if (id === 'speed') c.speed = c.speed === 1 ? 2 : c.speed === 2 ? 4 : 1;
      else if (id === 'back') this.tab = null;
      else if (key === 'tab' && v.port && TABS[arg]) { this.tab = arg; this.selected = null; this.spot = null; this.route = null; }
      else if (v.port) {
        if (key === 'buy') this.say(v.buy(arg)); else if (key === 'sell') this.say(v.sell(arg));
        else if (id === 'hire') this.say(v.hire()); else if (id === 'repair') this.say(v.repair()); else if (key === 'ship') this.say(v.buyShip(arg));
        else if (id === 'food') this.say(v.buyFood()); else if (id === 'water') this.say(v.fillWater());
        return this.settled();
      }
      this.refresh();
    }

    refreshInfo() {
      const v = this.voyage;
      this.layout.setInfo([{ label: '날짜', value: this.engine.clock.label }, { label: '자금', value: fmt(v.gold) }, { label: '식량', value: v.foodDays + '일' }, { label: '물', value: v.waterDays + '일' },
        { label: '선원', value: `${v.crew}/${v.maxCrew}명` }, { label: '짐', value: `${v.cargoUsed}/${v.cargoCap}` }]);
    }
    refresh() { this.refreshInfo(); this.layout.setDetail(this.detail()); this.layout.setMenu(this.menu(), id => this.command(id)); }
    /** 지금 못 하는 일과 그 까닭(단추가 흐려진 까닭을 글로 적는다) */
    whyNot(list) { const no = list.filter(([, r]) => !r.ok).map(([n, r]) => `${n}: ${r.why}`); return no.length ? ' 지금 못 하는 것 — ' + no.join(' · ') : ''; }
    cargoText() { const v = this.voyage, w = this.world; return [...v.cargo].map(([g, h]) => `${w.goods.get(g).name} ${h.qty}`).join(' · ') || '없음'; }
    goalText() { const v = this.voyage, st = v.stage; return [st.gold ? `자금 ${fmt(st.gold)}` : '', st.days ? `${st.days}일 안에(${Math.max(0, st.days - v.day)}일 남음)` : ''].filter(Boolean).join(' · '); }

    detail() {
      const w = this.world, v = this.voyage, R = v.rules, mode = this.mode, here = v.here, gname = id => w.goods.get(id).name;
      const ships = () => v.ships.map(sh => `${sh.name}(${v.T(sh).name}) 선체 ${sh.hull}/${v.T(sh).hull}`).join(' · ');
      if (mode === 'over') return { title: this.overTitle(), rows: [['바다에서 보낸 날', `${v.day}일`], ['자금', fmt(v.gold)], ['선원', `${v.crew}명`], ...(this.goalText() ? [['목표', this.goalText()]] : [])],
        note: (v.overWhy === 'gold' ? `${v.day}일 만에 자금 ${DH.josa(fmt(v.stage.gold), '을', '를')} 모았다.` : v.overWhy === 'time' ? `${v.stage.days}일이 지났다.` : '배를 몰 사람이 남지 않았다.') + ' 다시 하려면 아래 단추를 누른다.' };
      if (mode === 'port' && this.tab === 'market') {
        const m = [...v.markets.get(v.port).values()], sold = m.filter(e => e.refStock > 0), rows = sold.map(e => [`${gname(e.good)} 사기`, `값 ${e.price} · 재고 ${e.stock}`]);
        for (const [g, h] of v.cargo) { const q = v.quote(g); rows.push([`${gname(g)} ${h.qty}개`, `산 값 ${h.paid} · 여기서 팔면 개당 ${q.sell.ok ? q.sell.unit : '-'}`]); }
        return { title: `${here.name} 교역소`, rows, note: `${R.lot}개씩 사고판다. 사면 값이 오르고 팔면 내린다. 팔 때 수수료 ${R.price.feePct}%를 뗀다. 값은 날이 가면 제자리로 돌아온다.` + this.whyNot(sold.map(e => [gname(e.good) + ' 사기', v.quote(e.good).buy])) };
      }
      if (mode === 'port' && this.tab === 'inn') return { title: `${here.name} 여관`, rows: [['선원', `${v.crew}/${v.maxCrew}명`], ['한 명에', `금 ${R.inn.gold}`], ['하루 보급', `식량 ${v.crew} · 물 ${v.crew}`]],
        note: `선원을 ${R.inn.lot}명씩 모은다. 선원이 많으면 포격과 백병전이 세지고, 식량과 물이 빨리 준다.` + this.whyNot([['선원 모으기', v.can('hire')]]) };
      if (mode === 'port' && this.tab === 'dock') return { title: `${here.name} 도크`, rows: [...v.ships.map(sh => [sh.name, `${v.T(sh).name} · 선체 ${sh.hull}/${v.T(sh).hull} · 포 ${v.T(sh).guns} · 짐 ${v.T(sh).cargo}`]),
        ...[...w.shipTypes.values()].map(t => [`${t.name} 값`, `금 ${fmt(t.price)} · 선체 ${t.hull} · 포 ${t.guns} · 짐 ${t.cargo} · 하루 ${t.speed}칸`])],
        note: `선체는 1마다 금 ${R.dock.repair}에 고친다. 배는 ${R.dock.maxShips}척까지 거느린다. 함대는 가장 느린 배에 맞춰 간다.` + this.whyNot([['선체 고치기', v.can('repair')], ...[...w.shipTypes.values()].map(t => [t.name + ' 사기', v.can('ship', t.id)])]) };
      if (mode === 'port' && this.tab === 'supply') return { title: `${here.name} 보급`, rows: [['식량', `${v.foodDays}일분(${R.supply.foodMax}일분까지)`], ['물', `${v.waterDays}일분(${R.supply.waterMax}일분까지)`], ['하루에', `선원 ${v.crew}명이 식량 ${v.crew} · 물 ${v.crew}`]],
        note: `식량은 ${R.supply.lotDays}일분씩 산다. 물은 값이 없다. 바다에서 식량이나 물이 떨어지면 날마다 선원의 ${R.supply.lossPct}%를 잃는다.` + this.whyNot([['식량 사기', v.can('food')], ['물 채우기', v.can('water')]]) };
      const sel = w.ports.get(this.selected);
      if (sel) {
        const m = [...v.markets.get(sel.id).values()], sells = m.filter(e => e.refStock > 0), wants = m.filter(e => e.refStock <= 0).sort((a, b) => b.price / w.goods.get(b.good).base - a.price / w.goods.get(a.good).base).slice(0, 3);
        const mine = [...v.cargo].map(([g, h]) => { const e = v.markets.get(sel.id).get(g); return e ? `${gname(g)} ${e.price}(산 값 ${h.paid})` : null; }).filter(Boolean);
        const len = this.route && this.route.id === sel.id ? this.route.len : null;
        return { title: sel.name, rows: [['시설', sel.facilities.map(id => w.facilities[id]).join(' · ')], ['파는 것', sells.map(e => `${gname(e.good)} ${e.price}`).join(' · ') || '없음'], ['값이 좋은 것', wants.map(e => `${gname(e.good)} ${e.price}`).join(' · ')],
          ...(mine.length ? [['실은 짐의 시세', mine.join(' · ')]] : []), ['뱃길', sel.id === v.port ? '지금 있는 항구다' : len === null ? '찾지 못했다' : `${len}칸 · 약 ${Math.ceil(len / v.speed)}일`],
          ['위치', `${Math.abs(sel.lat).toFixed(1)}°${sel.lat >= 0 ? 'N' : 'S'} ${Math.abs(sel.lon).toFixed(1)}°${sel.lon >= 0 ? 'E' : 'W'}`]],
          note: sel.id === v.port ? '아래에서 교역소 · 여관 · 도크 · 보급을 고른다.' : mode === 'port' ? '출항을 누르면 이 항구로 떠난다.' : '항해 단추를 누르면 이 항구로 뱃길을 잡는다.' };
      }
      const where = here ? here.name : v.dest ? `${DH.ro(w.ports.get(v.dest).name)} 가는 바다` : v.path.length ? '찍은 곳으로 가는 바다' : v.heading ? `${WIND[v.heading]}쪽으로 가는 바다` : '바다(닻을 내렸다)';
      return { title: v.name, rows: [['있는 곳', where], ['선장', `${v.captain.name} · 무력 ${v.captain.war}`], ['배', ships()], ['짐', this.cargoText()], ['바다에서 보낸 날', `${v.day}일`], ...(this.goalText() ? [['목표', this.goalText()]] : [])],
        note: mode === 'port' ? (this.spot ? '출항을 누르면 찍은 바다로 떠난다.' : '교역소 · 여관 · 도크 · 보급에서 채비를 하고, 지도에서 갈 항구나 바다를 찍은 뒤 출항한다. 항구에서는 날이 가지 않는다.')
          : `방향키로 키를 잡거나 지도의 바다를 찍으면 그리로 간다. 항구를 찍으면 시세가 보인다. 하루에 ${v.speed}칸을 가고 식량과 물이 선원 수만큼 든다.` };
    }
    menu() {
      const w = this.world, v = this.voyage, c = this.engine.clock, R = v.rules, mode = this.mode, back = { id: 'back', label: '돌아가기' }, gname = id => w.goods.get(id).name;
      const btn = (id, r, on, off) => ({ id, label: r.ok ? on(r) : off, disabled: !r.ok, hint: r.ok ? '' : r.why });
      if (mode === 'over') return [{ id: 'again', label: '다시 하기', primary: true }, ...VIEW];
      const sel = w.ports.get(this.selected);
      if (mode === 'port') {
        if (this.tab === 'market') {
          const m = [...v.markets.get(v.port).values()].filter(e => e.refStock > 0);
          return [...m.map(e => btn('buy:' + e.good, v.quote(e.good).buy, r => `${gname(e.good)} 사기 ${r.qty} · 금 ${fmt(r.cost)}`, `${gname(e.good)} 사기`)),
            ...[...v.cargo.keys()].map(g => btn('sell:' + g, v.quote(g).sell, r => `${gname(g)} 팔기 ${r.qty} · 금 +${fmt(r.income)}`, `${gname(g)} 팔기`)), back];
        }
        if (this.tab === 'inn') return [btn('hire', v.can('hire'), r => `선원 모으기 +${r.qty} · 금 ${fmt(r.cost)}`, '선원 모으기'), back];
        if (this.tab === 'dock') return [btn('repair', v.can('repair'), r => `선체 고치기 ${r.qty} · 금 ${fmt(r.cost)}`, '선체 고치기'),
          ...[...w.shipTypes.values()].map(t => btn('ship:' + t.id, v.can('ship', t.id), r => `${t.name} 사기 · 금 ${fmt(r.cost)}`, `${t.name} 사기`)), back];
        if (this.tab === 'supply') return [btn('food', v.can('food'), r => `식량 ${r.days}일분 · 금 ${fmt(r.cost)}`, '식량 사기'), btn('water', v.can('water'), () => '물 가득 채우기', '물 채우기'), back];
        const tabs = Object.keys(TABS).map(k => { const ok = !NEED[k] || v.has(NEED[k]); return { id: 'tab:' + k, label: TABS[k], disabled: !ok, hint: ok ? '' : `이 항구에는 ${DH.josa(TABS[k], '이', '가')} 없다` }; });
        const to = sel && sel.id !== v.port ? `${DH.ro(sel.name)} 출항` : this.spot ? '찍은 바다로 출항' : '출항';
        return [...tabs, { id: 'sail', label: to, primary: true, hint: '닻을 올린다. 갈 곳을 찍지 않았으면 항구 앞바다에 선다' }, ...VIEW];
      }
      const dock = !c.running ? v.anchorAt(v.x, v.y) : null;
      return [...(dock ? [{ id: 'enter', label: `${dock.name}에 입항`, primary: !sel }] : []), ...(sel ? [{ id: 'sail', label: `${DH.ro(sel.name)} 항해`, primary: true }] : []),
        { id: 'pause', label: c.running ? '멈춤' : '계속', disabled: !v.moving, hint: v.moving ? '' : '방향키를 누르거나 지도를 찍으면 움직인다' }, { id: 'speed', label: `빠르기 ×${c.speed}` }, ...VIEW];
    }

    render(g) { super.render(g); if (this.mode === 'over') this.drawCard(g); }
    drawOver(g) {
      const w = this.world, v = this.voyage, grid = this.grid, z = this.cam.zoom, mid = this.cam.x + this.cam.viewW / z / 2;
      const X = x => grid.nearX(x, mid);
      // 남은 뱃길
      if (v.path.length) {
        g.beginPath(); const prev = this.shipPx(); g.moveTo(X(prev.x), prev.y); let px = X(prev.x);
        for (const [c, r] of v.path) { const p = grid.center(c, r), x = X(p.x); if (Math.abs(x - px) > grid.width / 2) g.moveTo(x, p.y); else g.lineTo(x, p.y); px = x; }
        g.setLineDash([3 / z, 3 / z]); g.lineWidth = 1.4 / z; g.strokeStyle = INK; g.stroke(); g.setLineDash([]);
      }
      // 찍은 바다
      if (this.spot) { const p = grid.center(this.spot[0], this.spot[1]), x = X(p.x), k = 4 / z; g.beginPath(); g.moveTo(x - k, p.y - k); g.lineTo(x + k, p.y + k); g.moveTo(x + k, p.y - k); g.lineTo(x - k, p.y + k); g.lineWidth = 1.8 / z; g.strokeStyle = INK; g.stroke(); }
      // 항구
      const fs = 9 / z; g.font = `700 ${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top'; g.lineJoin = 'round';
      for (const p of w.ports.values()) {
        const c = grid.center(p.x, p.y), x = X(c.x), hot = p.id === this.selected || p.id === v.dest || p.id === v.port, r = (hot ? 4.2 : 3.2) / z;
        g.beginPath(); g.arc(x, c.y, r, 0, Math.PI * 2); g.fillStyle = hot ? ACCENT : '#c8402f'; g.fill(); g.lineWidth = 1 / z; g.strokeStyle = INK; g.stroke();
        if (z >= 1.5 || hot) { g.lineWidth = 2.4 / z; g.strokeStyle = 'rgba(251,247,239,.92)'; g.strokeText(p.name, x, c.y + 4.5 / z); g.fillStyle = INK; g.fillText(p.name, x, c.y + 4.5 / z); }
      }
      // 배
      const s = this.shipPx(); DH.Hang.drawShip(g, X(s.x), s.y, 1 / z, undefined, true);
    }
    drawCard(g) {
      const W = this.engine.width, H = this.engine.height, v = this.voyage, won = v.over === 'won', w = 300, h = 96, x = (W - w) / 2, y = (H - h) / 2;
      g.fillStyle = 'rgba(38,33,28,.4)'; g.fillRect(0, 0, W, H);
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = won ? ACCENT : '#8d8477'; g.fillRect(x + 1, y + 1, w - 2, 6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.font = `800 20px ${FONT}`; g.fillText(this.overTitle(), W / 2, y + 40);
      g.font = `500 12px ${FONT}`; g.fillStyle = '#6e6356'; g.fillText(`바다에서 ${v.day}일 · 자금 ${fmt(v.gold)} · ‘다시 하기’를 누른다`, W / 2, y + 68);
    }
    save() { const v = this.voyage; return { at: this.at, day: v.day, gold: v.gold, crew: v.crew, port: v.port, dest: v.dest, selected: this.selected }; }
  }

  /** 자료를 읽어 동현항을 띄운다. host: 화면을 지을 자리. opt.script는 동현랭 설정이다. */
  async function boot(host, src, opt = {}) {
    const world = DH.Hang.parse(await DH.Data.load(src));
    const W = 480, H = 360;
    const layout = new DH.Layout(host, { title: '동현항', width: W, height: H });
    const engine = new DH.Engine({ canvas: layout.canvas, width: W, height: H, seed: opt.seed ?? 1, background: '#a9cbe0', clock: { unit: 'day', start: world.meta.start, ticksPerUnit: 20 } });
    const scene = new HangSeaScene(engine, world, layout); engine.setScene(scene);
    if (opt.script) scene.applyDonghyunLang(opt.script);                      // 동현랭 설정을 주면 그 값으로 연다
    if (opt.autostart !== false) engine.start();
    return { engine, layout, scene, world, get voyage() { return scene.voyage; }, lang: DH.Hang.lang, examples: DH.Hang.examples(world), convention: DH.Hang.lang.describe(DH.Hang.newState()),
      get state() { return scene.state; }, applyDonghyunLang: text => scene.applyDonghyunLang(text) };
  }

  DH.Hang = Object.assign(DH.Hang || {}, { HangSeaScene, boot });
})(typeof globalThis !== 'undefined' ? globalThis : this);

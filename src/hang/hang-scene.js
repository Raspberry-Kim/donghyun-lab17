/* 동현항 · 바다 장면 — 사각 세계 지도 위에서 항해하고, 항구에 들어가 교역 · 선원 · 배 · 보급을 챙긴다. 규칙은 hang-rules.js에 있다.
 *   항구   조작 창이 교역소 · 여관 · 도크 · 보급 · 조합 · 짐칸 · 출항으로 바뀐다(짐칸은 바다에서도 연다). 항구 표식은 나라 깃발(drawFlag)이다. 지도에서 갈 항구나 바다를 찍고 출항한다.
 *   바다   방향키로 키를 잡거나 지도의 바다를 찍으면 그리로 간다. 항구를 찍으면 시세가 보이고 '○○로 항해' 단추가 뜬다.
 *          배가 움직이는 동안에만 날이 간다(하루 = 한 걸음). 정박 칸에 닿으면 그 항구에 든다.
 *   만남   해적을 만나면 배가 멎고 '해적 출현' 카드가 뜬다. 싸운다 · 달아난다 · 통행료 · 짐으로 치른다 · 위협한다 가운데 고른다.
 *          사로잡은 배가 있으면 해전 뒤 '빼앗은 배' 카드가 떠서 함대에 넣거나 판다.
 *          싸우면 해전 화면(hang-battle-scene.js)으로 넘어가고, 끝나면 결과를 반영해 이 지도로 돌아온다.
 *   도크   배를 고르면(○○ 손보기) 그 배에 포를 더 달거나, 다른 배로 바꾸거나, 판다. 여관에서는 선장이 수련해 무력을 올린다.
 * 키보드(지도를 한 번 누른 뒤): 바다에서 방향키는 키 · 항구에서 방향키는 그쪽 항구 고르기 · Space 바다에서 멈춤·계속(그 밖에는 가까운 항구부터 차례로) ·
 *   Q E 가까운 항구 차례로(앞 · 뒤) · 숫자 키 조작 창의 단추 · Enter 노란 단추 · Esc 그만두기 · Shift+방향키(또는 W A S D) 지도 옮기기 · + − 확대와 축소.
 * 저장: saveGame()이 설정 목록 · 날짜 · 난수 · 탐험을 한 묶음으로 내고, loadGame()이 검사한 뒤 되살린다. 해전 중과 해적 출현 카드가 떠 있는 동안에는 저장하지 않는다.
 *   불러온 탐험은 멈춘 채로 돌아온다(잡아 둔 뱃길과 키는 그대로여서 '계속'을 누르면 이어 간다). */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const TILE = 4, INK = '#26211c', ACCENT = '#f2b705';
  const MAP = { shallow: '#b5d6e2', sea: '#9fc4d9', deep: '#93bcd4', m: '#ece2c7', t: '#e2dfb6', p: '#ecebe3', rim: '#c9b48a' };   // 지도 기본 색(동현삼과 같은 바다) · 뭍은 온대(m) · 열대(t) · 한대(p)
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }, WIND = { left: '서', right: '동', up: '북', down: '남' };
  const VIEW = [{ id: 'follow', label: '배 따라가기' }, { id: 'zin', label: '확대', key: '+' }, { id: 'zout', label: '축소', key: '−' }, { id: 'traffic', label: '지나는 배', key: 'T' }];
  const CIVIL = {
    fishing: { name: '연안 고깃배', region: '이 고장의 어민', text: '작은 돛과 그물을 실은 주민의 고깃배다.', more: '해안 가까이에서 천천히 고기를 잡는다.' },
    junk: { name: '동아시아 정크 상선', region: '동아시아 바다', text: '가로 살이 들어간 돛을 펼친 목조 상선이다.', more: '동아시아 정크의 선형을 작게 줄여 그렸다.' },
    dhow: { name: '인도양 다우 상선', region: '아라비아·인도양', text: '비스듬한 활대에 삼각 돛을 단 상선이다.', more: '교역과 어업에 쓰인 다우에서 모양을 빌렸다.' },
    canoe: { name: '섬마을 돛단배', region: '섬과 섬 사이', text: '노와 작은 돛으로 움직이는 가벼운 배다.', more: '연안과 섬 사이를 다니던 배를 단순화했다.' },
    merchant: { name: '유럽 캐럭 상선', region: '유럽·대서양 항로', text: '둥근 선체와 넓은 돛에 화물을 싣는 상선이다.', more: '15~16세기 캐럭을 바탕으로 작게 그렸다.' },
    explorer: { name: '대양의 캐러벨 탐험선', region: '먼바다의 탐험가', text: '먼 수평선을 향해 항해하는 작은 범선이다.', more: '초기 대서양 탐험에 쓰인 캐러벨에서 따왔다.' }
  };
  const ARROW = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }, PAN = { KeyA: 'ArrowLeft', KeyD: 'ArrowRight', KeyW: 'ArrowUp', KeyS: 'ArrowDown' };
  const digit = code => { const m = /^(?:Digit|Numpad)([1-9])$/.exec(code); return m ? Number(m[1]) : 0; };
  const TABS = { market: '교역소', inn: '여관', dock: '도크', supply: '보급', guild: '조합', hold: '짐칸' }, NEED = { market: 'market', guild: 'guild', inn: 'lodge', dock: 'shipyard' };
  const AT_SEA = { hold: true };                                  // 바다에서도 여는 창
  const SAVE = { format: 'donghyunhang-save', version: 1, name: '동현항', slot: 'donghyunhang:slot', file: 'donghyunhang', word: '탐험' };
  const NO = why => ({ ok: false, why });

  class HangSeaScene extends DH.MapScene {
    constructor(engine, world, layout) {
      super(engine); this.world = world; this.layout = layout;
      this.state = DH.Hang.newState();                            // globalState: 기본값. 동현랭 설정이 오면 새로 지어 덮어쓴다
      this.selected = null; this.spot = null; this.tab = null; this.route = null; this.follow = true; this.leg = 0;
      this.meet = null; this.dockShip = null;                     // 마주친 해적(카드가 떠 있는 동안) · 도크에서 손보려고 고른 배 id
      this.civil = []; this.civilKey = null; this.civilCard = null;
      this.voyage = this.newVoyage(); this.from = [this.voyage.x, this.voyage.y];
      this.settings = [];                                          // 지금 탐험에 적용된 동현랭 설정 [[번호, 값…]] (저장할 때 함께 적는다)
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
      this.state = st; this.settings = rep.settings.map(x => [x.n, ...x.values]);
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
      this.selected = null; this.spot = null; this.tab = null; this.route = null; this.follow = true; this.leg = 0; this.meet = null; this.dockShip = null;
      this.civil = []; this.civilKey = null; this.civilCard = null;
      this.centerOnFleet(); this.hello(); this.refresh();
    }
    hello() {
      const v = this.voyage, st = v.stage;
      this.layout.log(`${v.here ? v.here.name : '바다'}에 닻을 내리고 있다. 채비를 하고 지도에서 갈 곳을 찍어 출항한다`);
      if (v.inv) this.layout.log('무적 모드: 금을 내지 않고, 식량과 물이 줄지 않고, 해전에서 우리 배가 다치지 않고, 선장이 일기토에서 지지 않는다');
      if (st.gold) this.layout.log(`이기는 조건: 자금 ${DH.josa(fmt(st.gold), '을', '를')} 모은다` + (st.days ? ` · 바다에서 ${st.days}일 안에` : ''));
      else if (st.days) this.layout.log(`기한: 바다에서 ${st.days}일을 보내면 탐험이 끝난다`);
    }
    enter() {
      const w = this.world, e = this.engine;
      const grid = new DH.SquareGrid(w.map.cols, w.map.rows, TILE, { wrapX: true, diagonal: true });
      this.setupMap({ grid, ...this.palette(grid), minZoom: e.height / grid.height, maxZoom: 5 });
      this.cam.zoom = 2; this.centerOnFleet();
      this._off = [e.on('clock:day', () => this.onDay())];
      this.hello(); this.refresh();
    }
    exit() { this._off.forEach(f => f()); }
    /** 지도 색(레트로 픽셀 지도처럼 몇 가지 평평한 색만 쓴다). 바다는 뭍에서 멀수록 짙어지는 세 단(얕은 물 · 연안 · 대양).
     *  뭍은 위도대로 세 가지(열대 · 온대 · 한대)이고, 바다에 닿은 칸은 조금 짙게 해 해안선을 세운다. 지도는 바뀌지 않으므로 한 번만 정한다. */
    palette(grid) {
      const m = this.world.map, o = (m.origin && m.origin.lat) ?? 72, step = m.degPerTile || 1, land = (c, r) => !m.isSea(c, r), depth = DH.shoreDistance(grid, land);
      const kind = Array.from({ length: grid.rows }, (_, r) => {
        const lat = Math.abs(o - (r + 0.5) * step), belt = lat >= 58 ? 'p' : lat <= 23.5 ? 't' : 'm';
        return Array.from({ length: grid.cols }, (_, c) => { const d = depth[r * grid.cols + c]; return d > 0 ? (d <= 1 ? 's1' : d <= 4 ? 's2' : 's3') : belt + (grid.neighbors(c, r).some(([nc, nr]) => !land(nc, nr)) ? 'c' : ''); });
      });
      const styles = { s1: { fill: MAP.shallow }, s2: { fill: MAP.sea }, s3: { fill: MAP.deep }, default: { fill: MAP.m } };
      this.depth = depth;
      for (const b of ['p', 'm', 't']) { styles[b] = { fill: MAP[b] }; styles[b + 'c'] = { fill: DH.mixColor(MAP[b], MAP.rim, 0.3) }; }
      return { styles, tileAt: (c, r) => kind[r][c] };
    }
    get mode() { const v = this.voyage; return v.over ? 'over' : this.meet ? 'meet' : v.prizes.length ? 'prize' : v.port ? 'port' : 'sea'; }
    get at() { return [this.voyage.x, this.voyage.y]; }
    centerOnFleet() { const p = this.shipPx(); this.cam.centerOn(p.x, p.y); this.cam.clampTo(this.grid); }
    /** 배의 세계 좌표. 항해 중에는 하루 안에서 어제 자리 → 오늘 자리로 미끄러진다. */
    shipPx() {
      const g = this.grid, a = g.center(this.from[0], this.from[1]), b = g.center(this.voyage.x, this.voyage.y), t = this.engine.clock.running ? this.engine.clock.progress : 1;
      const bx = g.nearX(b.x, a.x);
      return { x: a.x + (bx - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    /** 하루가 갔다: 규칙을 한 걸음 돌리고, 생긴 일을 기록하고, 해적을 만났으면 배를 세우고 어떻게 할지 묻는다. */
    onDay() {
      const v = this.voyage, c = this.engine.clock, L = this.layout;
      if (!v.moving) { c.running = false; return; }
      const r = v.stepDay(); this.from = r.from; this.leg++;
      for (const e of r.events) L.log(r.arrived && e.endsWith('닿았다') ? `${e} · ${this.leg}일 걸렸다` : e);
      if (!v.moving) { c.running = false; this.spot = null; }
      if (r.arrived) { this.sfx('zone'); this.selected = null; this.spot = null; this.tab = null; this.route = null; this.from = [v.x, v.y]; }
      if (r.encounter) { c.running = false; this.meet = r.encounter; this.selected = null; this.spot = null; this.route = null; this.follow = true; this.centerOnFleet(); this.sfx('alert'); return this.refresh(); }
      this.settled();
    }
    /** 해전 화면을 얹는다. 끝나면 결과를 탐험대에 반영하고 돌아온다. */
    openBattle(rival) {
      const v = this.voyage, b = v.openBattle(rival); this.sfx('alert'); this.refresh();
      this.engine.pushScene(new DH.Hang.HangBattleScene(this.engine, this.layout, b, { artSeed: this.pirateSeed(rival), salvage: v.rules.salvage, onDone: res => {
        const out = v.settleBattle(res); this.layout.log(out.text);
        this.from = [v.x, v.y]; if (v.port) { this.selected = null; this.spot = null; this.tab = null; this.route = null; }
        this.follow = true; this.centerOnFleet(); this.settled();
      } }));
    }
    settled() { const v = this.voyage; if (v.over && !this._told) { this._told = true; this.engine.clock.running = false; this.layout.log(this.overTitle()); this.sfx(v.overWhy === 'gold' ? 'win' : 'lose', 0.6); } if (!v.over) this._told = false; this.refresh(); }
    overTitle() { const v = this.voyage; return v.overWhy === 'gold' ? '목표한 자금을 모았다' : v.overWhy === 'time' ? '기한이 다 되었다' : '선원을 모두 잃었다'; }
    update() { if (this.follow && this.engine.clock.running) this.centerOnFleet(); if (!this.civilCard) this.updateCivil(); if (this.engine.tick % 6 === 0) this.refreshInfo(); }
    pirateSeed(rival) { return DH.Hang.artHash(`${rival.id}:${this.voyage.day}:${this.voyage.x}:${this.voyage.y}`); }
    /** 별도 장식 경로. 바다 칸만 잇고 게임 난수·경로·충돌에는 손대지 않는다. */
    updateCivil() {
      if (!this.grid || this.mode === 'meet' || this.mode === 'prize' || this.mode === 'over') return;
      const g = this.grid, z = this.cam.zoom, cx = this.cam.x + this.engine.width / z / 2, cy = this.cam.y + this.engine.height / z / 2;
      const key = `${Math.floor(cx * z / 80)}:${Math.floor(cy * z / 64)}:${Math.round(z * 2)}`;
      const visible=this.civil.filter(s=>{const p=this.cam.toScreen(g.nearX(s.x,cx),s.y);return p.x>8&&p.x<this.engine.width-8&&p.y>8&&p.y<this.engine.height-8;}).length;
      if (key !== this.civilKey || (this.civil.length>=2&&visible<2)) {
        this.civilKey = key; this.civil = [];
        const seed = DH.Hang.artHash(key), m = this.world.map;
        for (let i = 0; i < 3; i++) {
          const tx = this.cam.x + this.engine.width / z * [.23,.73,.48][i], ty = this.cam.y + this.engine.height / z * [.32,.63,.79][i];
          let best = null, score = Infinity;
          const range = g.range(this.cam.x + 18/z, this.cam.y + 18/z, this.cam.x + (this.engine.width-18)/z, this.cam.y + (this.engine.height-18)/z);
          for (let r=range.r0;r<=range.r1;r++) for(let c=range.c0;c<=range.c1;c++) {
            const nc=g.normC(c); if(!m.isSea(nc,r)) continue;
            const p=g.center(c,r), depth=this.depth[r*g.cols+nc];
            if (this.civil.some(s=>Math.hypot(p.x-s.x,p.y-s.y)<28/z)) continue;
            if ([...this.world.ports.values()].some(q=>Math.hypot(g.nearX(q.x*TILE+TILE/2,p.x)-p.x,q.y*TILE+TILE/2-p.y)<17/z)) continue;
            const d=Math.hypot(p.x-tx,p.y-ty)+(i===0?Math.max(0,depth-2)*8:0);
            if(d<score){score=d;best=[c,r];}
          }
          if(!best) continue;
          const path=[best]; let prev=null;
          for(let j=0;j<14;j++) {
            const [c,r]=path.at(-1), opts=[[c+1,r],[c,r+1],[c-1,r],[c,r-1]].filter(([a,b])=>{
              const p=g.center(a,b),screen=this.cam.toScreen(p.x,p.y);
              return m.isSea(g.normC(a),b)&&(!prev||a!==prev[0]||b!==prev[1])&&Math.abs(a-best[0])<10&&Math.abs(b-best[1])<7&&screen.x>10&&screen.x<this.engine.width-10&&screen.y>10&&screen.y<this.engine.height-10;
            });
            if(!opts.length) break;
            prev=[c,r]; path.push(opts[DH.Hang.artHash(`${seed}:${i}:${j}`)%opts.length]);
          }
          if(path.length<2) continue;
          const norm=g.normC(best[0]), lon=(m.origin?.lon??-180)+(norm+.5)*(m.degPerTile||1), dep=this.depth[best[1]*g.cols+norm];
          const type=i===0&&dep<6?'fishing':dep>12?'explorer':lon>=95&&lon<=145?'junk':lon>=30&&lon<95?'dhow':lon>145||lon < -65?'canoe':'merchant';
          const p=g.center(...best); this.civil.push({id:i,type,path,x:p.x,y:p.y,face:1,t0:this.engine.tick,pace:75+i*23});
        }
      }
      for (const s of this.civil) {
        const end=s.path.length-1, q=((this.engine.tick-s.t0)/s.pace)%(end*2), t=q>end?end*2-q:q, j=Math.min(end-1,Math.floor(t)), f=t-j;
        const a=g.center(...s.path[j]), b=g.center(...s.path[j+1]);s.x=a.x+(b.x-a.x)*f;s.y=a.y+(b.y-a.y)*f;
        if(b.x!==a.x)s.face=Math.sign(b.x-a.x)*(q>end?-1:1);
      }
    }
    openCivil(s) {
      if (!s || this.civilCard || !['port','sea'].includes(this.mode)) return;
      const c=this.engine.clock, gift=this.voyage.greetTraffic(); this.civilCard={...s, ...CIVIL[s.type], gift, resume:c.running}; c.running=false;
      if(gift.gift){this.layout.log(gift.text);this.sfx('bell');}else this.sfx('tick');this.refresh();
    }
    closeCivil() { if(!this.civilCard)return; const resume=this.civilCard.resume;this.civilCard=null;this.engine.clock.running=resume&&this.voyage.moving;this.refresh(); }

    /** 뱃길을 잡고 떠난다. target: 항구 id 또는 바다 칸 [c, r] */
    sail(target) {
      const v = this.voyage, r = v.sailTo(target);
      if (!r.ok) { this.layout.log(r.why); this.sfx('buzz'); return this.refresh(); }
      this.layout.log(`${r.text} · 약 ${r.days}일`); this.sfx('ship'); this.leg = 0; this.tab = null; this.follow = true; this.selected = null; this.route = null; if (!Array.isArray(target)) this.spot = null; this.from = [v.x, v.y]; this.engine.clock.running = true;
      this.refresh();
    }
    /** 항구를 골랐을 때 거기까지의 뱃길(칸 수)을 한 번 재어 둔다. */
    pick(pid) {
      const v = this.voyage, p = this.world.ports.get(pid); if (pid !== this.selected) this.sfx('tick'); this.selected = pid; this.spot = null; this.tab = null;
      const path = pid === v.port ? [] : DH.findPath(v.grid, [v.x, v.y], p.anchor, this.world.map.isSea);
      this.route = { id: pid, len: path ? path.length : null };
    }
    onTap(x, y) {
      if (this.civilCard) { if(x>90&&x<390&&y>240&&y<280)this.closeCivil(); return; }
      if (this.mode === 'over' || this.mode === 'meet' || this.mode === 'prize') return;
      const w = this.world, wpt = this.cam.toWorld(x, y), g = this.grid, z=this.cam.zoom, mid=this.cam.x+this.engine.width/z/2; let best = null, bd = 11 / z;
      for (const p of this.portPositions(z, a=>g.nearX(a,mid))) { const d = Math.hypot(p.x-wpt.x,p.y-wpt.y); if (d < bd) { bd = d; best = p.id; } }
      if (best) { this.pick(best); return this.refresh(); }
      const civilian=this.civil.find(s=>Math.hypot(g.nearX(s.x,wpt.x)-wpt.x,s.y-wpt.y)<9/z);
      if(civilian)return this.openCivil(civilian);
      const cell = this.cellAt(x, y), sea = cell && w.map.isSea(cell.c, cell.r);
      this.selected = null; this.route = null; this.tab = null; this.spot = sea ? [cell.c, cell.r] : null;
      if (sea && this.mode === 'sea') return this.sail(this.spot);                // 바다에서는 찍은 곳으로 바로 간다
      this.refresh();
    }
    /** 키보드. 바다에서는 방향키가 키이고, 항구에서는 방향키로 그쪽 항구를 고른다. 숫자 키와 Enter는 조작 창의 단추를 누른다. */
    onKey(code, ev) {
      if (ev && (ev.ctrlKey || ev.metaKey || ev.altKey)) return;
      if(this.civilCard){if(['Escape','Enter','NumpadEnter','Digit1'].includes(code)){ev&&ev.preventDefault();this.closeCivil();}return;}
      if(code==='KeyT'&&['port','sea'].includes(this.mode)){ev&&ev.preventDefault();return this.command('traffic');}
      const v = this.voyage, c = this.engine.clock, dir = KEYS[code], shift = !!(ev && ev.shiftKey), n = digit(code), used = () => { if (ev) ev.preventDefault(); };
      if (this.mode === 'meet' || this.mode === 'prize') {                        // 해적 출현 카드 · 빼앗은 배 카드: 숫자 키와 Enter로만 고른다
        if (ev && ev.repeat) return;
        if (n) { used(); this.layout.press(n); } else if (code === 'Enter' || code === 'NumpadEnter') { used(); this.layout.pressPrimary(); }
        return;
      }
      if ((dir && shift) || PAN[code]) return super.onKey(PAN[code] || code, ev);              // 지도 옮기기(배 따라가기가 풀린다)
      if (dir && this.mode === 'sea') {                                           // 바다에서는 방향키가 키다
        used();
        if (v.heading === dir && c.running) return;
        const r = v.steer(dir); this.layout.log(r.ok ? r.text : r.why); this.sfx(r.ok ? 'swish' : 'buzz');
        if (r.ok) { this.spot = null; this.follow = true; this.from = [v.x, v.y]; c.running = true; }
        return this.refresh();
      }
      if (dir) { used(); return this.step(ARROW[code]); }                         // 항구에서는 그쪽으로 가장 가까운 항구를 고른다
      if (code === 'Escape') { if (this.tab === 'dock' && this.dockShip) this.dockShip = null; else if (this.tab) this.tab = null; else { this.selected = null; this.route = null; this.spot = null; } return this.refresh(); }
      if (ev && ev.repeat) return;                                                // 누르고 있어도 단추는 한 번만 눌린다
      if (n) { used(); this.layout.press(n); }
      else if (code === 'Enter' || code === 'NumpadEnter') { used(); this.layout.pressPrimary(); }
      else if (code === 'Space') { used(); if (this.mode === 'sea' && v.moving) this.command('pause'); else this.nextPort(shift ? -1 : 1); }
      else if (code === 'KeyQ' || code === 'KeyE') { used(); this.nextPort(code === 'KeyE' ? 1 : -1); }
      else super.onKey(code, ev);                                                 // + − 확대 · 축소
    }
    /** 항구의 세계 좌표(기준 x에 가장 가까운 바퀴) */
    portPx(p, ref) { const q = this.grid.center(p.x, p.y); return { x: ref == null ? q.x : this.grid.nearX(q.x, ref), y: q.y }; }
    /** 방향키 한 번(항구에서). 고른 항구에서, 없으면 배 자리에서 d 방향의 56° 안쪽에 있는 가장 가까운 항구로 간다. 없으면 그쪽 절반에서 찾는다. */
    step(d) {
      if (this.mode === 'over') return;
      const w = this.world, g = this.grid, from = w.ports.get(this.selected), P = from ? g.center(from.x, from.y) : g.center(this.voyage.x, this.voyage.y);
      let best = null, bs = Infinity, wide = null, ws = Infinity;
      for (const q of w.ports.values()) {
        if (q === from || (!from && q.id === this.voyage.port)) continue;
        const Q = this.portPx(q, P.x), vx = Q.x - P.x, vy = Q.y - P.y, along = vx * d[0] + vy * d[1], side = Math.abs(vx * d[1] - vy * d[0]), sc = along + side * 2;
        if (along <= 0.01) continue;
        if (side <= along * 1.5) { if (sc < bs) { bs = sc; best = q.id; } } else if (sc < ws) { ws = sc; wide = q.id; }
      }
      const next = best ?? wide; if (next == null) return;
      this.pick(next); this.reveal(next); this.refresh();
    }
    /** Space · Q · E: 배에서 가까운 항구부터 차례로 고른다(지금 든 항구는 뺀다). */
    nextPort(dir = 1) {
      if (this.mode === 'over') return;
      const v = this.voyage, S = this.grid.center(v.x, v.y);
      const list = [...this.world.ports.values()].filter(p => p.id !== v.port).map(p => { const Q = this.portPx(p, S.x); return { id: p.id, d: Math.hypot(Q.x - S.x, Q.y - S.y) }; }).sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1));
      if (!list.length) return;
      const i = list.findIndex(e => e.id === this.selected), k = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
      this.pick(list[k].id); this.reveal(list[k].id); this.refresh();
    }
    /** 그 항구가 화면 가장자리 밖에 있으면 화면 가운데로 데려온다(배 따라가기가 풀린다). */
    reveal(pid) {
      const e = this.engine, m = 28, mid = this.cam.x + this.cam.viewW / this.cam.zoom / 2, P = this.portPx(this.world.ports.get(pid), mid), q = this.cam.toScreen(P.x, P.y);
      if (q.x < m || q.x > e.width - m || q.y < m || q.y > e.height - m) { this.cam.centerOn(P.x, P.y); this.cam.clampTo(this.grid); this.follow = false; }
    }
    /** 한 일을 기록에 남긴다. 되었으면 그 소리(ok), 안 되었으면 막히는 소리 */
    say(r, ok) { this.layout.log(r.ok ? r.text : r.why); if (!r.ok) this.sfx('buzz'); else if (ok) this.sfx(ok); }
    command(id) {
      const v = this.voyage, c = this.engine.clock, [key, arg] = id.split(':');
      if(this.civilCard){if(id==='civil-close')this.closeCivil();return;}
      if (id === 'zin') return this.zoomBy(1.25);
      if (id === 'zout') return this.zoomBy(0.8);
      if (id === 'follow') { this.follow = true; return this.centerOnFleet(); }
      if (this.mode === 'over') { if (id === 'again') this.restart(); return; }
      if (this.mode === 'meet') {                                                 // 해적 앞에서: 싸운다 · 달아난다 · 통행료
        const rival = this.meet;
        if (id === 'fight') { this.meet = null; return this.openBattle(rival); }
        const r = id === 'evade' ? v.evade(rival) : id === 'toll' ? v.payToll(rival) : id === 'barter' ? v.payCargo(rival) : id === 'scare' ? v.scareOff(rival) : null; if (!r) return;
        this.say(r, id === 'evade' ? 'swish' : id === 'scare' ? 'cannon' : 'coin');
        if (r.ok) { this.meet = null; this.from = [v.x, v.y]; c.running = v.moving; }          // 잡아 둔 뱃길을 그대로 이어 간다
        return this.settled();
      }
      if (this.mode === 'prize') {                                                // 빼앗은 배: 함대에 넣는다 · 판다
        if (key === 'ptake') this.say(v.takePrize(Number(arg)), 'bell'); else if (key === 'psell') this.say(v.sellPrize(Number(arg)), 'coin');
        else if (id === 'psellall') { let r = null; while (v.prizes.length) r = v.sellPrize(0); if (r) this.say(r, 'coin'); }
        return this.settled();
      }
      if(id==='traffic'){this.updateCivil();this.tab='traffic';return this.refresh();}
      if(key==='civil'){this.openCivil(this.civil.find(s=>s.id===Number(arg)));return;}
      if (key === 'tab' && AT_SEA[arg] && !v.port) { this.tab = arg; this.selected = null; this.route = null; return this.refresh(); }
      if (key === 'dump') { this.say(v.dump(arg), 'swish'); return this.refresh(); }
      if (id === 'back' && !v.port) { this.tab = null; return this.refresh(); }
      if (id === 'sail') {
        const target = this.selected && this.selected !== v.port ? this.selected : this.spot;
        if (target) return this.sail(target);
        if (v.port) { v.leave(); this.sfx('ship'); this.tab = null; this.layout.log('닻을 올렸다. 방향키로 키를 잡거나 지도의 바다를 찍어 뱃길을 잡는다'); }
      }
      else if (id === 'enter') { const p = v.anchorAt(v.x, v.y); if (p && !v.port && !c.running) { v.enter(p.id); this.selected = null; this.spot = null; this.route = null; this.layout.log(`${p.name}에 들어왔다`); this.sfx('zone'); } }
      else if (id === 'pause') { if (v.moving) { c.running = !c.running; if (!c.running) this.from = [v.x, v.y]; } }
      else if (id === 'speed') c.speed = c.speed === 1 ? 2 : c.speed === 2 ? 4 : 1;
      else if (id === 'back') { if (this.tab === 'dock' && this.dockShip) this.dockShip = null; else this.tab = null; }
      else if (key === 'tab' && v.port && TABS[arg]) { this.tab = arg; this.dockShip = null; this.selected = null; this.spot = null; this.route = null; }
      else if (key === 'pick' && this.tab === 'dock' && v.ships.some(sh => sh.id === arg)) { this.dockShip = arg; this.sfx('tick'); }
      else if (v.port) {
        if (key === 'buy') this.say(v.buy(arg), 'coin'); else if (key === 'sell') this.say(v.sell(arg), 'coin');
        else if (key === 'buymax') this.say(v.buyMax(arg), 'coin'); else if (key === 'sellall') this.say(v.sellAll(arg), 'coin');
        else if (key === 'accept') this.say(v.accept(arg), 'bell'); else if (key === 'deliver') this.say(v.deliver(arg), 'win');
        else if (id === 'hire') this.say(v.hire(), 'foot'); else if (id === 'train') this.say(v.train(), 'clash'); else if (id === 'repair') this.say(v.repair(), 'thud'); else if (key === 'ship') this.say(v.buyShip(arg), 'bell');
        else if (id === 'gun') this.say(v.addGuns(this.dockShip), 'thud'); else if (key === 'swap') this.say(v.swapShip(this.dockShip, arg), 'bell');
        else if (id === 'sellship') { const r = v.sellShip(this.dockShip); this.say(r, 'coin'); if (r.ok) this.dockShip = null; }
        else if (id === 'food') this.say(v.buyFood(), 'pop'); else if (id === 'water') this.say(v.fillWater(), 'pop');
        return this.settled();
      }
      this.refresh();
    }

    refreshInfo() {
      const v = this.voyage;
      this.layout.setInfo([{ label: '날짜', value: this.engine.clock.label }, { label: '자금', value: v.inv ? `${fmt(v.gold)}(무적)` : fmt(v.gold) }, { label: '식량', value: v.foodDays + '일' }, { label: '물', value: v.waterDays + '일' },
        { label: '선원', value: `${v.crew}/${v.maxCrew}명` }, { label: '짐', value: `${v.cargoUsed}/${v.cargoCap}` }]);
    }
    refresh() { this.refreshInfo(); this.layout.setDetail(this.detail()); this.layout.setMenu(this.menu(), id => this.command(id)); }
    /** 지금 못 하는 일과 그 까닭(단추가 흐려진 까닭을 글로 적는다) */
    whyNot(list) { const no = list.filter(([, r]) => !r.ok).map(([n, r]) => `${n}: ${r.why}`); return no.length ? ' 지금 못 하는 것 — ' + no.join(' · ') : ''; }
    kindName(k) { return this.world.kinds[k] || '기타'; }
    kindOf(g) { return this.kindName(this.world.goods.get(g).kind); }
    /** 실은 짐을 갈래 순서(자료의 kinds 순서) → 이름 순으로 */
    sortedCargo() { const K = Object.keys(this.world.kinds), w = this.world, rank = g => { const i = K.indexOf(w.goods.get(g).kind); return i < 0 ? K.length : i; };
      return [...this.voyage.cargo].sort((a, b) => rank(a[0]) - rank(b[0]) || w.goods.get(a[0]).name.localeCompare(w.goods.get(b[0]).name, 'ko')); }
    roomText() { const v = this.voyage; return `${fmt(v.cargoUsed)}/${fmt(v.cargoCap)} · 남은 자리 ${fmt(v.cargoCap - v.cargoUsed)}`; }
    gainText(d) { return d > 0 ? `개당 +${d} 남는다` : d < 0 ? `개당 ${-d} 밑진다` : '본전'; }
    contractRows() { const v = this.voyage, w = this.world; return v.contracts.map(c => [`받은 의뢰 · ${w.goods.get(c.good).name} ${c.qty}개`, `${DH.ro(w.ports.get(c.to).name)} · 금 ${fmt(c.reward)} · ${Math.max(0, c.due - v.day)}일 남음 · 실은 것 ${v.held(c.good)}개`]); }
    /** 여관에서 듣는 소문: 이 항구 앞바다에 다니는 해적 무리 */
    rumor() { const v = this.voyage, p = v.here, list = v.roamers(p.anchor[0], p.anchor[1]), local = list.filter(r => r.areas), rest = [...v.rivals.values()].filter(r => v.rest.get(r.id) > v.day);
      return (local.length ? `이 바다에는 ${local.map(r => `${r.name}(무력 ${r.captain.war} · ${r.ships.length}척)`).join(' · ')}가 다닌다` : '이 바다에만 다니는 무리는 없다') + ` · 어디서나 ${list.filter(r => !r.areas).length}무리` + (rest.length ? ` · 쉬는 무리: ${rest.map(r => `${r.name} ${v.rest.get(r.id) - v.day}일`).join(' · ')}` : ''); }
    cargoText() { const v = this.voyage, w = this.world; return this.sortedCargo().map(([g, h]) => `${w.goods.get(g).name} ${h.qty}`).join(' · ') || '없음'; }
    goalText() { const v = this.voyage, st = v.stage; return [st.gold ? `자금 ${fmt(st.gold)}` : '', st.days ? `${st.days}일 안에(${Math.max(0, st.days - v.day)}일 남음)` : ''].filter(Boolean).join(' · '); }

    detail() {
      const w = this.world, v = this.voyage, R = v.rules, mode = this.mode, here = v.here, gname = id => w.goods.get(id).name;
      if(this.civilCard){const s=this.civilCard;return {title:s.name,rows:[['바다',s.region],['이 배',s.text],['모양',s.more],['인사',s.gift.text]],note:'싸우거나 부딪히지 않는 작은 배다. 닫으면 하던 항해를 이어 간다.'};}
      if(this.tab==='traffic'&&['port','sea'].includes(mode))return {title:'지나는 배',rows:this.civil.map(s=>[CIVIL[s.type].name,CIVIL[s.type].region]),note:'배를 누르거나 목록에서 골라 이야기를 읽는다. 선물은 10항해일마다 한 번, 25% 확률로 물이나 식량 5일분이다.'};
      const ships = () => v.ships.map(sh => `${sh.name}(${v.T(sh).name}) 선체 ${sh.hull}/${v.T(sh).hull} · 포 ${v.gunsOf(sh)}`).join(' · ');
      const spec = t => `선체 ${t.hull} · 포 ${t.guns} · 짐 ${t.cargo} · 선원 ${t.maxCrew}명까지 · 하루 ${t.speed}칸`, D = R.dock;
      const types = [...w.shipTypes.values()].filter(t => !t.cheat || v.inv);                    // cheat로 적힌 배만 무적 모드에서 보인다(샘플 자료에는 없다)
      if (mode === 'meet') {
        const rv = this.meet, m = v.meetInfo(rv), k = v.flagRisk(rv), cnt = new Map(); for (const id of rv.ships) cnt.set(id, (cnt.get(id) || 0) + 1);
        return { title: `해적 출현 · ${rv.name}`, rows: [['해적 선장', `${rv.captain.name} · 무력 ${rv.captain.war}`], ['해적의 배', [...cnt].map(([id, n]) => `${w.shipTypes.get(id).name} ${n}척`).join(' · ') + ` · 선원 ${rv.crew}명`],
          ['이기면', `금 +${fmt(rv.gold)} · 식량·물 각 ${rv.ships.length>=R.salvage.largeShips?R.salvage.largeDays:R.salvage.smallDays}일분(상한까지) · 선장 무력 +${R.grow.win}(일기토로 +${R.grow.win + R.grow.duel})`], ['우리', `${v.captain.name} · 무력 ${v.captain.war} · 배 ${v.ships.length}척 · 선원 ${v.crew}명${v.inv ? ' · 무적' : ''}`],
          ['해적이 올라타면', v.inv ? '무적 모드라 선원을 잃지 않는다' : k.taken ? `해적 기함(선원 ${k.theirs}명)이 한 번에 우리 기함 선원 ${k.ours}명을 모두 쓰러뜨려 기함을 빼앗는다 · 곧 지는 것이다` : `해적 기함(선원 ${k.theirs}명)이 한 번에 우리 기함 선원 ${k.ours}명 가운데 ${k.hit}명을 쓰러뜨린다`],
          ['달아나면', m.fast ? `우리가 더 빠르다(하루 ${m.speed}칸 대 ${m.their}칸) · 잃는 것이 없다` : `해적이 우리만큼 빠르다(하루 ${m.speed}칸 대 ${m.their}칸) · 짐 ${fmt(m.drop)}개를 버린다`],
          ['통행료', `금 ${fmt(m.toll)}(자금의 ${R.encounter.tollPct}% · 적어도 ${fmt(v.fee(R.encounter.tollMin))})`],
          ['짐으로 치르면', m.barter.ok ? m.barter.take.map(([g, n]) => `${w.goods.get(g).name} ${n}`).join(' · ') + ' (기준 값이 높은 것부터 가져간다)' : m.barter.why],
          ['위협하면', m.scare.ok ? `우리 포 ${v.gunsTotal}문에 해적이 물러난다` : m.scare.why],
          ...(rv.note ? [['이 무리', rv.note]] : [])],
          note: `싸우면 해전이 벌어진다. 이기면 그 무리는 ${R.encounter.rest}일 동안 나오지 않고, 선원을 모두 잃은 해적 배는 빼앗는다. 지면 금 절반과 짐을 모두 빼앗기고 마지막 항구로 떠밀려 간다. 달아나거나 통행료를 내면 가던 길을 그대로 간다.` + this.whyNot([['통행료', m.pay], ['짐으로 치르기', m.barter], ['위협', m.scare]]) };
      }
      if (mode === 'prize') {
        const D = R.dock, rows = v.prizes.map((pz, i) => { const t = w.shipTypes.get(pz.type); return [`${i + 1}. ${t.name}`, `선체 ${pz.hull}/${t.hull} · 포 ${t.guns} · 짐 ${t.cargo} · 하루 ${t.speed}칸 · 팔면 금 ${fmt(Math.floor(t.price * R.prize.pct / 100))}`]; });
        return { title: '빼앗은 배', rows: [...rows, ['우리 함대', `${v.ships.length}/${D.maxShips}척 · 하루 ${v.speed}칸 · 선원 ${v.crew}/${v.maxCrew}명`]],
          note: `함대에 넣으면 짐을 더 싣고 포가 는다. 함대는 가장 느린 배에 맞춰 간다. 배는 ${D.maxShips}척까지다. 팔면 처음 값의 ${R.prize.pct}%를 받는다.` };
      }
      if (mode === 'over') return { title: this.overTitle(), rows: [['바다에서 보낸 날', `${v.day}일`], ['자금', fmt(v.gold)], ['선원', `${v.crew}명`], ...(this.goalText() ? [['목표', this.goalText()]] : [])],
        note: (v.overWhy === 'gold' ? `${v.day}일 만에 자금 ${DH.josa(fmt(v.stage.gold), '을', '를')} 모았다.` : v.overWhy === 'time' ? `${v.stage.days}일이 지났다.` : '배를 몰 사람이 남지 않았다.') + ' 다시 하려면 아래 단추를 누른다.' };
      if (mode === 'port' && this.tab === 'market') {
        const m = [...v.markets.get(v.port).values()], sold = m.filter(e => e.refStock > 0), rows = [['짐', this.roomText()], ...sold.map(e => [`${gname(e.good)} 사기`, `${this.kindOf(e.good)} · 값 ${e.price} · 재고 ${e.stock}`])];
        for (const [g, h] of this.sortedCargo()) { const q = v.quote(g); rows.push([`${gname(g)} ${h.qty}개`, `산 값 ${h.paid} · 여기서 팔면 개당 ${q.sell.ok ? q.sell.unit : '-'}${q.sell.ok ? ` · ${this.gainText(q.sell.unit - h.paid)}` : ''}`]); }
        for (const c of v.contracts.filter(c => c.to === v.port)) rows.push([`의뢰 · ${gname(c.good)} ${c.qty}개`, `넘기면 금 ${fmt(c.reward)} · ${v.canDeliver(c).ok ? '지금 넘길 수 있다' : v.canDeliver(c).why}`]);
        return { title: `${here.name} 교역소`, rows, note: `${R.lot}개씩, 또는 ‘가득 사기’ · ‘모두 팔기’로 한 번에 사고판다. 사면 값이 오르고 팔면 내린다(${R.lot}개마다 한 단). 팔 때 수수료 ${R.price.feePct}%를 뗀다. 값은 날이 가면 제자리로 돌아온다.` + this.whyNot(sold.map(e => [gname(e.good) + ' 사기', v.quote(e.good).buy])) };
      }
      if (mode === 'port' && this.tab === 'guild') {
        const offers = v.offers(), G = R.guild, rows = offers.map(o => [`${gname(o.good)} ${o.qty}개 → ${w.ports.get(o.to).name}`, `보수 금 ${fmt(o.reward)} · ${o.days}일 안에 · 여기 값 ${v.markets.get(v.port).get(o.good).price}`]);
        if (!rows.length) rows.push(['의뢰', `이번 차례 의뢰를 모두 받았다 · ${G.every - (v.day % G.every)}일 뒤에 새 의뢰`]);
        return { title: `${here.name} 조합`, rows: [...rows, ...this.contractRows()],
          note: `조합은 이 항구에서 나는 물건을 그것이 나지 않는 항구로 옮겨 달라고 한다. 보수는 그곳 값의 ${100 + G.bonusPct}%다. 물건은 교역소에서 사서 싣고, 그 항구 교역소에서 넘긴다. 의뢰는 ${G.max}건까지 받고 ${G.every}일마다 바뀐다. 기한을 넘기면 의뢰만 사라진다.` };
      }
      if (this.tab === 'hold' && (mode === 'port' || mode === 'sea')) {
        const byKind = v.cargoByKind(), rows = [['짐', this.roomText()], ...v.ships.map(sh => [sh.name, `${v.T(sh).name} · 짐 ${v.T(sh).cargo}`])];
        if (byKind.size) rows.push(['갈래', [...byKind].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${this.kindName(k)} ${n}`).join(' · ')]);
        for (const [g, h] of this.sortedCargo()) { const e = here ? v.markets.get(v.port).get(g) : null, q = e ? v.quote(g) : null;
          rows.push([`${gname(g)} ${h.qty}개`, `${this.kindOf(g)} · 산 값 ${h.paid}${q && q.sell.ok ? ` · 여기서 팔면 ${q.sell.unit}(${this.gainText(q.sell.unit - h.paid)})` : ''}`]); }
        if (!v.cargo.size) rows.push(['실은 것', '없음']);
        return { title: `${v.name} 짐칸`, rows: [...rows, ...this.contractRows()], note: `짐은 갈래(${Object.values(w.kinds).join(' · ')})대로 묶어 보인다. ‘${R.lot}개 버리기’로 자리를 비운다. 의뢰 물건은 그 항구 교역소에서 넘긴다.` };
      }
      if (mode === 'port' && this.tab === 'inn') return { title: `${here.name} 여관`, rows: [['선원', `${v.crew}/${v.maxCrew}명`], ['한 명에', `금 ${R.inn.gold}`], ['하루 보급', `식량 ${v.crew} · 물 ${v.crew}`], ['해적 소문', this.rumor()],
        ['선장', `${v.captain.name} · 무력 ${v.captain.war}`], ['선장 수련', `금 ${fmt(R.inn.train)}에 무력 +${R.inn.trainGain} · ${R.grow.max}까지`]],
        note: `선원을 ${R.inn.lot}명씩 모은다. 선원이 많으면 포격과 백병전이 세지고, 식량과 물이 빨리 준다. 선장의 무력은 일기토와 백병전에 쓰이고, 해전에서 이길 때마다 ${R.grow.win}씩 오른다.` + this.whyNot([['선원 모으기', v.can('hire')], ['선장 수련', v.can('train')]]) };
      const mine = mode === 'port' && this.tab === 'dock' ? v.ships.find(sh => sh.id === this.dockShip) : null;
      if (mine) {
        const t0 = v.T(mine), others = types.filter(t => t.id !== mine.type), sell = v.can('sell', mine.id);
        return { title: `${here.name} 도크 · ${mine.name}`, rows: [[v.ships[0] === mine ? '기함' : '배', `${t0.name} · 선체 ${mine.hull}/${t0.hull} · 포 ${v.gunsOf(mine)}${mine.plus ? `(보강 +${mine.plus})` : ''} · 짐 ${t0.cargo} · 하루 ${t0.speed}칸`],
          ['포 보강', `한 번에 +${D.gunStep}문 · 금 ${fmt(D.gunGold)} · 배마다 +${D.gunMax}문까지(지금 +${mine.plus || 0})`],
          ...others.map(t => { const c = v.can('swap', mine.id, t.id), net = t.price - Math.floor(t0.price * D.tradePct / 100); return [`${DH.ro(t.name)} 바꾸면`, `${c.ok ? (c.back ? `금 +${fmt(c.back)}` : `금 −${fmt(c.cost)}`) : `금 ${net >= 0 ? '−' + fmt(net) : '+' + fmt(-net)}`} · ${spec(t)}`]; }),
          ['팔면', `금 +${fmt(Math.floor(t0.price * D.tradePct / 100))}`]],
          note: `헌 배는 처음 값의 ${D.tradePct}%를 쳐준다. 바꾼 배는 선체가 새것이다. 더 단 포는 헌 배에 딸려 가니 새 배에는 다시 단다. 기함도 바꿀 수 있다.` + this.whyNot([['포 보강', v.can('gun', mine.id)], ...others.map(t => [`${DH.ro(t.name)} 바꾸기`, v.can('swap', mine.id, t.id)]), ['팔기', sell]]) };
      }
      if (mode === 'port' && this.tab === 'dock') return { title: `${here.name} 도크`, rows: [...v.ships.map(sh => [sh.name, `${v.T(sh).name} · 선체 ${sh.hull}/${v.T(sh).hull} · 포 ${v.gunsOf(sh)}${sh.plus ? `(보강 +${sh.plus})` : ''} · 짐 ${v.T(sh).cargo}`]),
        ...types.map(t => [`${t.name} 값`, `금 ${fmt(t.price)} · ${spec(t)}`])],
        note: `선체는 1마다 금 ${R.dock.repair}에 고친다. 배는 ${R.dock.maxShips}척까지 거느린다. 함대는 가장 느린 배에 맞춰 간다. 배 이름을 누르면 포를 더 달거나 다른 배로 바꾸거나 판다.` + this.whyNot([['선체 고치기', v.can('repair')], ...types.map(t => [t.name + ' 사기', v.can('ship', t.id)])]) };
      if (mode === 'port' && this.tab === 'supply') return { title: `${here.name} 보급`, rows: [['식량', `${v.foodDays}일분(${R.supply.foodMax}일분까지)`], ['물', `${v.waterDays}일분(${R.supply.waterMax}일분까지)`], ['하루에', `선원 ${v.crew}명이 식량 ${v.crew} · 물 ${v.crew}`]],
        note: `식량은 ${R.supply.lotDays}일분씩 산다. 물은 값이 없다. 바다에서 식량이나 물이 떨어지면 날마다 선원의 ${R.supply.lossPct}%를 잃는다.` + this.whyNot([['식량 사기', v.can('food')], ['물 채우기', v.can('water')]]) };
      const sel = w.ports.get(this.selected);
      if (sel) {
        const m = [...v.markets.get(sel.id).values()], sells = m.filter(e => e.refStock > 0), wants = m.filter(e => e.refStock <= 0).sort((a, b) => b.price / w.goods.get(b.good).base - a.price / w.goods.get(a.good).base).slice(0, 3);
        const held = [...v.cargo].map(([g, h]) => { const e = v.markets.get(sel.id).get(g); return e ? `${gname(g)} ${e.price}(산 값 ${h.paid})` : null; }).filter(Boolean);
        const len = this.route && this.route.id === sel.id ? this.route.len : null;
        return { title: sel.name, rows: [['시설', sel.facilities.map(id => w.facilities[id]).join(' · ')], ['파는 것', sells.map(e => `${gname(e.good)} ${e.price}`).join(' · ') || '없음'], ['값이 좋은 것', wants.map(e => `${gname(e.good)} ${e.price}`).join(' · ')],
          ...(held.length ? [['실은 짐의 시세', held.join(' · ')]] : []), ['뱃길', sel.id === v.port ? '지금 있는 항구다' : len === null ? '찾지 못했다' : `${len}칸 · 약 ${Math.ceil(len / v.speed)}일`],
          ['위치', `${Math.abs(sel.lat).toFixed(1)}°${sel.lat >= 0 ? 'N' : 'S'} ${Math.abs(sel.lon).toFixed(1)}°${sel.lon >= 0 ? 'E' : 'W'}`],
          ['방문', this.visitText(sel.id)]],
          note: sel.id === v.port ? '아래에서 교역소 · 여관 · 도크 · 보급을 고른다.' : mode === 'port' ? '출항을 누르면 이 항구로 떠난다.' : '항해 단추를 누르면 이 항구로 뱃길을 잡는다.' };
      }
      const where = here ? here.name : v.dest ? `${DH.ro(w.ports.get(v.dest).name)} 가는 바다` : v.path.length ? '찍은 곳으로 가는 바다' : v.heading ? `${WIND[v.heading]}쪽으로 가는 바다` : '바다(닻을 내렸다)';
      return { title: v.name, rows: [['있는 곳', where], ['선장', `${v.captain.name} · 무력 ${v.captain.war}${v.inv ? ' · 무적 모드' : ''}`], ['배', ships()], ['짐', `${this.roomText()} · ${this.cargoText()}`], ...(v.contracts.length ? [['의뢰', v.contracts.map(c => `${w.goods.get(c.good).name} ${c.qty} → ${w.ports.get(c.to).name}`).join(' · ')]] : []), ['바다에서 보낸 날', `${v.day}일`], ...(this.goalText() ? [['목표', this.goalText()]] : [])],
        note: mode === 'port' ? (this.spot ? '출항을 누르면 찍은 바다로 떠난다.' : '교역소 · 여관 · 도크 · 보급에서 채비를 하고, 지도에서 갈 항구나 바다를 찍은 뒤 출항한다. 항구에서는 날이 가지 않는다.')
          : `방향키로 키를 잡거나 지도의 바다를 찍으면 그리로 간다. 항구를 찍으면 시세가 보인다. 하루에 ${v.speed}칸을 가고 식량과 물이 선원 수만큼 든다.` };
    }
    menu() {
      const w = this.world, v = this.voyage, c = this.engine.clock, R = v.rules, mode = this.mode, back = { id: 'back', label: '돌아가기' }, gname = id => w.goods.get(id).name;
      if(this.civilCard)return [{id:'civil-close',label:'이야기 닫기',primary:true,key:'Esc'}];
      if(this.tab==='traffic'&&['port','sea'].includes(mode))return [...this.civil.map(s=>({id:'civil:'+s.id,label:CIVIL[s.type].name})),back];
      const btn = (id, r, on, off) => ({ id, label: r.ok ? on(r) : off, disabled: !r.ok, hint: r.ok ? '' : r.why });
      if (mode === 'over') return [{ id: 'again', label: '다시 하기', primary: true }, ...VIEW.filter(b=>b.id!=='traffic')];
      if (mode === 'meet') {
        const m = v.meetInfo(this.meet);
        return [{ id: 'fight', label: '싸운다', primary: true, hint: '해전을 벌인다' }, { id: 'evade', label: m.fast ? '달아난다 · 따돌린다' : `달아난다 · 짐 −${fmt(m.drop)}`, hint: m.fast ? '우리 함대가 더 빠르다' : '짐의 절반을 버린다' },
          btn('toll', m.pay, r => `통행료를 낸다 · 금 ${fmt(r.cost)}`, '통행료를 낸다'), btn('barter', m.barter, r => `짐으로 치른다 · 짐 −${fmt(r.qty)}`, '짐으로 치른다'), btn('scare', m.scare, () => '포를 늘어세워 위협한다', '위협한다')];
      }
      if (mode === 'prize') {
        const full = v.ships.length >= R.dock.maxShips;
        return [...v.prizes.flatMap((pz, i) => { const t = w.shipTypes.get(pz.type); return [{ id: 'ptake:' + i, label: `${i + 1}. ${t.name} 함대에 넣기`, disabled: full, hint: full ? `배는 ${R.dock.maxShips}척까지다` : '', primary: i === 0 && !full },
          { id: 'psell:' + i, label: `${i + 1}. ${t.name} 팔기 · 금 +${fmt(Math.floor(t.price * R.prize.pct / 100))}`, primary: i === 0 && full }]; }), ...(v.prizes.length > 1 ? [{ id: 'psellall', label: '모두 판다' }] : [])];
      }
      const holdMenu = () => [...this.sortedCargo().flatMap(([g]) => [...(v.port && v.has('market') ? [btn('sellall:' + g, v.quote(g).sell, () => `${gname(g)} 모두 팔기`, `${gname(g)} 모두 팔기`)] : []),
        { id: 'dump:' + g, label: `${gname(g)} ${R.lot}개 버리기` }]), back];
      if (this.tab === 'hold' && (mode === 'sea' || mode === 'port')) return holdMenu();
      const types = [...w.shipTypes.values()].filter(t => !t.cheat || v.inv);
      const sel = w.ports.get(this.selected);
      if (mode === 'port') {
        if (this.tab === 'market') {
          const m = [...v.markets.get(v.port).values()].filter(e => e.refStock > 0);
          return [...m.flatMap(e => [btn('buy:' + e.good, v.quote(e.good).buy, r => `${gname(e.good)} 사기 ${r.qty} · 금 ${fmt(r.cost)}`, `${gname(e.good)} 사기`), btn('buymax:' + e.good, v.quote(e.good).buy, () => `${gname(e.good)} 가득 사기`, `${gname(e.good)} 가득 사기`)]),
            ...v.contracts.filter(c => c.to === v.port).map(c => btn('deliver:' + c.id, v.canDeliver(c), () => `의뢰 넘기기 · ${gname(c.good)} ${c.qty} · 금 +${fmt(c.reward)}`, `의뢰 넘기기 · ${gname(c.good)}`)),
            ...this.sortedCargo().flatMap(([g]) => [btn('sell:' + g, v.quote(g).sell, r => `${gname(g)} 팔기 ${r.qty} · 금 +${fmt(r.income)}`, `${gname(g)} 팔기`), btn('sellall:' + g, v.quote(g).sell, () => `${gname(g)} 모두 팔기`, `${gname(g)} 모두 팔기`)]), back];
        }
        if (this.tab === 'guild') { const full = v.contracts.length >= R.guild.max;
          return [...v.offers().map(o => ({ id: 'accept:' + o.id, label: `의뢰 받기 · ${gname(o.good)} ${o.qty} → ${w.ports.get(o.to).name}`, disabled: full, hint: full ? `의뢰는 ${R.guild.max}건까지 받는다` : '' })), back]; }
        if (this.tab === 'inn') return [btn('hire', v.can('hire'), r => `선원 모으기 +${r.qty} · 금 ${fmt(r.cost)}`, '선원 모으기'), btn('train', v.can('train'), r => `선장 수련 무력 +${r.gain} · 금 ${fmt(r.cost)}`, '선장 수련'), back];
        const mine = this.tab === 'dock' ? v.ships.find(sh => sh.id === this.dockShip) : null;
        if (mine) return [btn('gun', v.can('gun', mine.id), r => `포 보강 +${r.qty}문 · 금 ${fmt(r.cost)}`, '포 보강'),
          ...types.filter(t => t.id !== mine.type).map(t => btn('swap:' + t.id, v.can('swap', mine.id, t.id), r => `${DH.ro(t.name)} 바꾸기 · 금 ${r.back ? '+' + fmt(r.back) : fmt(r.cost)}`, `${DH.ro(t.name)} 바꾸기`)),
          btn('sellship', v.can('sell', mine.id), r => `팔기 · 금 +${fmt(r.income)}`, '팔기'), back];
        if (this.tab === 'dock') return [btn('repair', v.can('repair'), r => `선체 고치기 ${r.qty} · 금 ${fmt(r.cost)}`, '선체 고치기'),
          ...v.ships.map(sh => ({ id: 'pick:' + sh.id, label: `${sh.name} 손보기`, hint: '포 보강 · 다른 배로 바꾸기 · 팔기' })),
          ...types.map(t => btn('ship:' + t.id, v.can('ship', t.id), r => `${t.name} 사기 · 금 ${fmt(r.cost)}`, `${t.name} 사기`)), back];
        if (this.tab === 'supply') return [btn('food', v.can('food'), r => `식량 ${r.days}일분 · 금 ${fmt(r.cost)}`, '식량 사기'), btn('water', v.can('water'), () => '물 가득 채우기', '물 채우기'), back];
        const tabs = Object.keys(TABS).map(k => { const ok = !NEED[k] || v.has(NEED[k]); return { id: 'tab:' + k, label: TABS[k], disabled: !ok, hint: ok ? '' : `이 항구에는 ${DH.josa(TABS[k], '이', '가')} 없다` }; });
        const to = sel && sel.id !== v.port ? `${DH.ro(sel.name)} 출항` : this.spot ? '찍은 바다로 출항' : '출항';
        return [...tabs, { id: 'sail', label: to, primary: true, hint: '닻을 올린다. 갈 곳을 찍지 않았으면 항구 앞바다에 선다' }, ...VIEW];
      }
      const dock = !c.running ? v.anchorAt(v.x, v.y) : null;
      return [...(dock ? [{ id: 'enter', label: `${dock.name}에 입항`, primary: !sel }] : []), ...(sel ? [{ id: 'sail', label: `${DH.ro(sel.name)} 항해`, primary: true }] : []),
        { id: 'pause', label: c.running ? '멈춤' : '계속', disabled: !v.moving, hint: v.moving ? '' : '방향키를 누르거나 지도를 찍으면 움직인다' }, { id: 'speed', label: `빠르기 ×${c.speed}` }, { id: 'tab:hold', label: '짐칸' }, ...VIEW];
    }

    render(g) { super.render(g); if (this.mode === 'over') this.drawCard(g); else if (this.mode === 'meet') this.drawMeet(g); else if (this.mode === 'prize') this.drawPrize(g); else if(this.civilCard)this.drawCivilCard(g); }
    /** 기존 육지 격자를 그대로 따라 모서리만 깎고 윗면의 빛과 아랫면의 그늘을 얹는다. */
    softCoast(g) {
      const grid=this.grid,z=this.cam.zoom,R=grid.range(this.cam.x,this.cam.y,this.cam.x+this.engine.width/z,this.cam.y+this.engine.height/z),m=this.world.map;
      for(let r=R.r0;r<=R.r1;r++)for(let c=R.c0;c<=R.c1;c++){
        if(m.isSea(grid.normC(c),r))continue;
        const x=c*TILE,y=r*TILE,sea=(a,b)=>b>=0&&b<grid.rows&&m.isSea(grid.normC(a),b),top=sea(c,r-1),bottom=sea(c,r+1),left=sea(c-1,r),right=sea(c+1,r),rad=1.25;
        if(!top&&!bottom&&!left&&!right)continue;
        const color=(this.tiles.styles[this.tiles.tileAt(grid.normC(c),r)]||this.tiles.styles.default).fill;
        for(const [dx,dy,yes,angle] of [[0,0,top&&left,Math.PI],[TILE-rad,0,top&&right,Math.PI*1.5],[TILE-rad,TILE-rad,bottom&&right,0],[0,TILE-rad,bottom&&left,Math.PI*.5]]){
          if(!yes)continue;
          g.fillStyle=MAP.shallow;g.fillRect(x+dx,y+dy,rad,rad);
          const cx=x+(dx===0?rad:TILE-rad),cy=y+(dy===0?rad:TILE-rad);
          g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,rad,angle,angle+Math.PI/2);g.closePath();g.fillStyle=color;g.fill();
        }
        g.lineCap='round';g.lineWidth=.5;
        if(top){g.beginPath();g.moveTo(x+(left?rad:0),y+.4);g.lineTo(x+TILE-(right?rad:0),y+.4);g.strokeStyle='rgba(255,250,226,.74)';g.stroke();}
        if(bottom){g.beginPath();g.moveTo(x+(left?rad:0),y+TILE-.3);g.lineTo(x+TILE-(right?rad:0),y+TILE-.3);g.strokeStyle='rgba(143,116,73,.23)';g.stroke();}
      }
      // 대양의 드문 잔물결. 항로와 지형 판정에는 쓰지 않는다.
      g.lineWidth=.5/z;g.strokeStyle='rgba(244,250,245,.24)';
      for(let r=R.r0;r<=R.r1;r+=1)for(let c=R.c0;c<=R.c1;c+=1){
        if((c*7+r*13)%53!==0||this.depth[r*grid.cols+grid.normC(c)]<5)continue;
        const x=c*TILE,y=r*TILE;g.beginPath();g.moveTo(x-1.8,y);g.quadraticCurveTo(x,y+.8,x+1.8,y);g.stroke();
      }
    }
    visitText(id) { const n=this.voyage.visits.get(id)||0; return n ? `${n}회${n>=3?' · 자주 찾은 항구':''}${!this.voyage.visitsKnown?' (확인된 방문만)':''}` : this.voyage.visitsKnown?'아직 가보지 않았다':'옛 저장에 방문 기록이 없다'; }
    drawCivilCard(g) {
      const s=this.civilCard,x=80,y=73,w=320,h=211;
      g.fillStyle='rgba(38,33,28,.38)';g.fillRect(0,0,this.engine.width,this.engine.height);
      g.beginPath();g.roundRect(x,y,w,h,14);g.fillStyle='#fbf7ef';g.fill();g.lineWidth=1.4;g.strokeStyle=INK;g.stroke();
      g.save();g.beginPath();g.roundRect(x+12,y+12,w-24,69,10);g.clip();g.fillStyle=MAP.sea;g.fillRect(x+12,y+12,w-24,69);
      DH.Hang.drawCivilShip(g,240,y+66,2.6,s.type);g.restore();
      g.textAlign='center';g.textBaseline='middle';g.fillStyle=INK;g.font=`800 16px ${FONT}`;g.fillText(s.name,240,y+99,w-24);
      g.font=`500 11px ${FONT}`;g.fillText(s.text,240,y+123,w-26);g.fillStyle='#706455';g.fillText(s.gift.text,240,y+144,w-26);
      g.beginPath();g.roundRect(99,248,282,25,8);g.fillStyle='#f0dfb4';g.fill();g.fillStyle=INK;g.font=`700 12px ${FONT}`;g.fillText('이야기 닫기 · Enter / Esc',240,261);
    }
    drawOver(g) {
      const w = this.world, v = this.voyage, grid = this.grid, z = this.cam.zoom, mid = this.cam.x + this.cam.viewW / z / 2;
      const X = x => grid.nearX(x, mid);
      this.softCoast(g);
      for(const s of this.civil)DH.Hang.drawCivilShip(g,X(s.x),s.y,.50/z,s.type,s.face);
      // 남은 뱃길
      if (v.path.length) {
        g.beginPath(); const prev = this.shipPx(); g.moveTo(X(prev.x), prev.y); let px = X(prev.x);
        for (const [c, r] of v.path) { const p = grid.center(c, r), x = X(p.x); if (Math.abs(x - px) > grid.width / 2) g.moveTo(x, p.y); else g.lineTo(x, p.y); px = x; }
        g.setLineDash([3 / z, 3 / z]); g.lineWidth = 1.4 / z; g.strokeStyle = INK; g.stroke(); g.setLineDash([]);
      }
      // 찍은 바다
      if (this.spot) { const p = grid.center(this.spot[0], this.spot[1]), x = X(p.x), k = 4 / z; g.beginPath(); g.moveTo(x - k, p.y - k); g.lineTo(x + k, p.y + k); g.moveTo(x + k, p.y - k); g.lineTo(x - k, p.y + k); g.lineWidth = 1.8 / z; g.strokeStyle = INK; g.stroke(); }
      // 항구
      const fs = 9 / z; g.font = `700 ${fs}px ${FONT}`; g.lineJoin = 'round';
      for (const L of this.portMarks(g, z, X)) {
        DH.Hang.drawFlag(g, L.flag, L.x, L.y, L.k, L.hot);
        const n=v.visits.get(L.id)||0,mark=n>=3?'★':n>0?'·':v.visitsKnown?'○':'?';
        g.save();g.font=`800 ${6.5/z}px ${FONT}`;g.textAlign='center';g.textBaseline='middle';
        const bx=L.x+5.4/z,by=L.y-5.2/z;g.beginPath();g.arc(bx,by,3.5/z,0,Math.PI*2);g.fillStyle='#fbf7ef';g.fill();g.fillStyle=n>=3?'#a66b19':'#514a3e';g.fillText(mark,bx,by);g.restore();
        if (!L.text) continue;
        g.textAlign = L.text.align; g.textBaseline = L.text.base; g.lineWidth = 2.4 / z; g.strokeStyle = 'rgba(251,247,239,.92)';
        g.strokeText(L.name, L.text.x, L.text.y); g.fillStyle = INK; g.fillText(L.name, L.text.x, L.text.y);
      }
      // 배
      const s = this.shipPx(), a = grid.center(this.from[0], this.from[1]), b = grid.center(v.x, v.y), dx = grid.nearX(b.x, a.x) - a.x;
      if (Math.abs(dx) > 0.5) this.face = dx < 0 ? -1 : 1;                     // 가는 쪽으로 뱃머리를 돌린다(그림에만 쓰고 저장하지 않는다)
      DH.Hang.drawShip(g, X(s.x), s.y, 1 / z, undefined, true, this.face || 1, v.ships[0].type);
    }
    /** 항구 표식의 자리: 깃발이 겹치면 좌우로 벌리고, 이름은 아래 → 위 → 오른쪽 → 왼쪽 가운데 빈 곳에 둔다(깃발과 우리 배를 피한다). 빈 곳이 없으면 이름을 빼고(고른 항구는 늘 적는다), 확대하면 다시 보인다.
     *  g.font가 정해진 뒤에 부른다. X는 동서로 이어진 지도에서 화면 쪽 x를 고른다. @returns [{name, flag, x, y, k, hot, text: {x, y, align, base} | null}] (그리는 순서) */
    portPositions(z, X = x => x) {
      const v=this.voyage,L=[...this.world.ports.values()].map(p=>{const c=this.grid.center(p.x,p.y),hot=p.id===this.selected||p.id===v.dest||p.id===v.port,k=(hot?1.2:1)/z;
        return {id:p.id,name:p.name,flag:p.flag,x:X(c.x),y:c.y,k,hot,w:14/z,h:14/z,text:null};});
      for(let pass=0;pass<20;pass++)for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){
        const a=L[i],b=L[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),need=23/z;
        if(d>=need)continue;if(d<.001){dx=1;dy=.5;d=Math.hypot(dx,dy);}
        const k=(need-d)/2/d;a.x-=dx*k;a.y-=dy*k;b.x+=dx*k;b.y+=dy*k;
      }
      return L;
    }
    portMarks(g, z, X = x => x) {
      const v = this.voyage, fs = 9 / z, showAll = z >= 1.5;
      const L = this.portPositions(z,X);
      const boxes = L.map(a => [a.x - a.w / 2, a.y - a.h / 2, a.x + a.w / 2, a.y + a.h / 2]);
      const sp = this.shipPx(), sx = X(sp.x), ship = [sx - 8 / z, sp.y - 11 / z, sx + 8 / z, sp.y + 6 / z]; boxes.push(ship);   // 배 그림에도 이름을 얹지 않는다
      const hit = (r, own) => boxes.some((q, i) => i !== own && r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
      const order = L.map((a, i) => i).sort((i, j) => (L[j].hot - L[i].hot) || i - j);
      for (const i of order) {
        const a = L[i]; if (!showAll && !a.hot) continue;
        const tw = g.measureText(a.name).width, hw = tw / 2, gap = 1.4 / z, below = a.y + a.h / 2 + gap * 0.6, above = a.y - a.h / 2 - gap * 0.6;
        const tries = [
          { r: [a.x - hw, below, a.x + hw, below + fs], t: { x: a.x, y: below, align: 'center', base: 'top' } },
          { r: [a.x - hw, above - fs, a.x + hw, above], t: { x: a.x, y: above, align: 'center', base: 'bottom' } },
          { r: [a.x + a.w / 2 + gap, a.y - fs / 2, a.x + a.w / 2 + gap + tw, a.y + fs / 2], t: { x: a.x + a.w / 2 + gap, y: a.y, align: 'left', base: 'middle' } },
          { r: [a.x - a.w / 2 - gap - tw, a.y - fs / 2, a.x - a.w / 2 - gap, a.y + fs / 2], t: { x: a.x - a.w / 2 - gap, y: a.y, align: 'right', base: 'middle' } }];
        const low = Math.max(below, ship[3] + gap * 0.6);                    // 배 밑으로 내린 자리(고른 항구가 다 막혔을 때)
        tries.push({ r: [a.x - hw, low, a.x + hw, low + fs], t: { x: a.x, y: low, align: 'center', base: 'top' } });
        const pick = tries.find(c => !hit(c.r, i)) || (a.hot ? tries[4] : null);
        if (pick) { a.text = pick.t; boxes.push(pick.r); }
      }
      return order.slice().reverse().map(i => L[i]);                         // 고른 항구를 맨 위에 그린다
    }
    /** 해적 출현 카드: 붉은 돛의 해적 배를 척수대로 그리고 이름과 선장을 적는다. 고르는 것은 조작 창의 단추다. */
    drawMeet(g) {
      const W = this.engine.width, H = this.engine.height, rv = this.meet, w = 320, h = 168, x = (W - w) / 2, y = (H - h) / 2, n = rv.ships.length;
      g.fillStyle = 'rgba(38,33,28,.45)'; g.fillRect(0, 0, W, H);
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = '#c8402f'; g.fillRect(x + 1, y + 1, w - 2, 6);
      g.fillStyle = '#9fc4d9'; g.fillRect(x + 14, y + 50, w - 28, 62); g.lineWidth = 1; g.strokeStyle = 'rgba(38,33,28,.35)'; g.strokeRect(x + 14.5, y + 50.5, w - 29, 61);
      rv.ships.forEach((id, i) => DH.Hang.drawShip(g, W / 2 + (i - (n - 1) / 2) * 76, y + 86, 2.1, DH.Hang.LOOK.foe, i === 0, -1, id, (this.pirateSeed(rv)+i)%DH.Hang.PIRATE_NAMES.length));
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
      g.font = `800 20px ${FONT}`; g.fillText('해적 출현', W / 2, y + 30);
      g.font = `700 13px ${FONT}`; g.fillText(`${rv.name} · ${rv.captain.name}(무력 ${rv.captain.war}) · 배 ${n}척 · 선원 ${rv.crew}명`, W / 2, y + 128, w - 24);
      g.font = `500 12px ${FONT}`; g.fillStyle = '#6e6356'; g.fillText('조작 창의 다섯 가지 가운데 하나를 고른다', W / 2, y + 149, w - 24);
    }
    /** 빼앗은 배 카드: 빼앗은 배를 그리고 함대에 넣을지 팔지 묻는다. 고르는 것은 조작 창의 단추다. */
    drawPrize(g) {
      const W = this.engine.width, H = this.engine.height, v = this.voyage, w = 320, h = 150, x = (W - w) / 2, y = (H - h) / 2, n = v.prizes.length;
      g.fillStyle = 'rgba(38,33,28,.45)'; g.fillRect(0, 0, W, H);
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = ACCENT; g.fillRect(x + 1, y + 1, w - 2, 6);
      g.fillStyle = '#9fc4d9'; g.fillRect(x + 14, y + 46, w - 28, 56); g.lineWidth = 1; g.strokeStyle = 'rgba(38,33,28,.35)'; g.strokeRect(x + 14.5, y + 46.5, w - 29, 55);
      v.prizes.forEach((pz, i) => DH.Hang.drawShip(g, W / 2 + (i - (n - 1) / 2) * 76, y + 78, 1.9, undefined, false, 1, pz.type));
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.font = `800 20px ${FONT}`; g.fillText(`해적 배 ${n}척을 빼앗았다`, W / 2, y + 27);
      g.font = `500 12px ${FONT}`; g.fillStyle = '#6e6356'; g.fillText('함대에 넣거나 판다 · 아래 단추에서 고른다', W / 2, y + 126, w - 24);
    }
    drawCard(g) {
      const W = this.engine.width, H = this.engine.height, v = this.voyage, won = v.over === 'won', w = 300, h = 96, x = (W - w) / 2, y = (H - h) / 2;
      g.fillStyle = 'rgba(38,33,28,.4)'; g.fillRect(0, 0, W, H);
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = won ? ACCENT : '#8d8477'; g.fillRect(x + 1, y + 1, w - 2, 6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.font = `800 20px ${FONT}`; g.fillText(this.overTitle(), W / 2, y + 40);
      g.font = `500 12px ${FONT}`; g.fillStyle = '#6e6356'; g.fillText(`바다에서 ${v.day}일 · 자금 ${fmt(v.gold)} · ‘다시 하기’를 누른다`, W / 2, y + 68);
    }
    // ───────── 저장과 불러오기 ─────────
    save() { return { selected: this.selected, spot: this.spot, tab: this.tab, follow: this.follow, leg: this.leg, cam: { x: this.cam.x, y: this.cam.y, zoom: this.cam.zoom } }; }
    /** 지금 저장할 수 있는지. 해전 중에는 안 된다. {ok:true} 또는 {ok:false, why} */
    saveInfo() { return this.engine.scene !== this ? NO('해전이 끝난 뒤에 저장할 수 있다.') : this.meet ? NO('해적과 마주친 동안에는 저장할 수 없다. 먼저 어떻게 할지 고른다.') : { ok: true }; }
    /** 저장 묶음: 머리말 · 한 줄 요약 · 적용된 설정 목록 · 날짜 · 난수 · 탐험. JSON으로 그대로 적을 수 있다. */
    saveGame() {
      const v = this.voyage;
      return { format: SAVE.format, version: SAVE.version, summary: { title: v.here ? v.here.name : '바다', date: this.engine.clock.label, line: `자금 ${fmt(v.gold)} · 선원 ${v.crew}명` },
        settings: this.settings.map(x => [...x]), ...this.engine.snapshot(), game: v.toJSON() };
    }
    /** 저장 묶음으로 탐험을 되살린다. 하나라도 맞지 않으면 하던 탐험을 그대로 둔다. 해전 중이었으면 해전을 접는다.
     *  @returns {{ok:true, text, applied:string[]} | {ok:false, why}} */
    loadGame(d) {
      const e = this.engine, w = this.world; let st, voyage, rep;
      try {
        DH.Save.head(d, SAVE.format, SAVE.version, SAVE.name);
        st = DH.Hang.newState(); rep = DH.Hang.lang.applySettings(d.settings, st, { world: w });
        DH.Save.need(rep.ok, '저장된 설정이 맞지 않는다. ' + rep.errors.join(' '));
        e.checkSnapshot(d);
        DH.Save.need(d.clock.actors.length === 0, '날짜 정보가 맞지 않는다.');
        voyage = DH.Hang.Voyage.restore(w, d.game, { rng: e.rng, state: st });
      } catch (err) { return NO(err.message); }
      while (e.scene && e.scene !== this) e.popScene();
      this.state = st; this.settings = d.settings.map(x => [...x]); this.voyage = voyage; e.restore(d);      // 난수는 판을 지은 뒤에 되돌린다(씨앗 설정이 덮지 않게)
      const v = voyage, s = d.scene || {}, c = s.cam, num = x => typeof x === 'number' && isFinite(x);
      this.from = [v.x, v.y]; this._told = !!v.over; this.selected = null; this.spot = null; this.tab = null; this.route = null; this.meet = null; this.dockShip = null;
      this.civil=[];this.civilKey=null;this.civilCard=null;
      this.follow = s.follow !== false; this.leg = Number.isInteger(s.leg) && s.leg >= 0 ? s.leg : 0;
      if (typeof s.selected === 'string' && w.ports.has(s.selected)) this.pick(s.selected);
      else if ((v.port || AT_SEA[s.tab]) && typeof s.tab === 'string' && Object.hasOwn(TABS, s.tab) && (!NEED[s.tab] || v.has(NEED[s.tab]))) this.tab = s.tab;
      else if (Array.isArray(s.spot) && s.spot.length === 2 && Number.isInteger(s.spot[0]) && Number.isInteger(s.spot[1]) && w.map.isSea(s.spot[0], s.spot[1])) this.spot = [s.spot[0], s.spot[1]];
      if (c && num(c.x) && num(c.y) && num(c.zoom)) { this.cam.zoom = Math.min(this.cam.maxZoom, Math.max(this.cam.minZoom, c.zoom)); this.cam.x = c.x; this.cam.y = c.y; this.cam.clampTo(this.grid); } else this.centerOnFleet();
      const text = `저장한 탐험을 불러왔다 · ${v.here ? v.here.name : '바다'} · ${e.clock.label}` + (v.moving ? ' · ‘계속’을 누르면 이어 간다' : '');
      this.layout.log(text); this.refresh();
      return { ok: true, text, applied: rep.applied };
    }
  }

  /** 자료를 읽어 동현항을 띄운다. host: 화면을 지을 자리. opt.script는 동현랭 설정이다. */
  async function boot(host, src, opt = {}) {
    const world = DH.Hang.parse(await DH.Data.load(src));
    const W = 480, H = 360;
    const layout = new DH.Layout(host, { title: '동현항', width: W, height: H, hotkeys: true });      // 조작 단추에 번호가 붙는다(숫자 키)
    const engine = new DH.Engine({ canvas: layout.canvas, width: W, height: H, seed: opt.seed ?? 1, background: MAP.deep, clock: { unit: 'day', start: world.meta.start, ticksPerUnit: 20 } });
    const scene = new HangSeaScene(engine, world, layout); engine.setScene(scene);
    if (opt.script) scene.applyDonghyunLang(opt.script);                      // 동현랭 설정을 주면 그 값으로 연다
    if (opt.autostart !== false) engine.start();
    return { engine, layout, scene, world, get voyage() { return scene.voyage; }, lang: DH.Hang.lang, examples: DH.Hang.examples(world), convention: DH.Hang.lang.describe(DH.Hang.newState()),
      get state() { return scene.state; }, applyDonghyunLang: text => scene.applyDonghyunLang(text), save: SAVE };
  }

  DH.Hang = Object.assign(DH.Hang || {}, { HangSeaScene, boot, SAVE });
})(typeof globalThis !== 'undefined' ? globalThis : this);

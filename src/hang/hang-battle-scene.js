/* 동현항 · 해전 장면 — hang-battle.js의 해전을 캔버스에 그리고 손으로 싸운다. 바다 장면 위에 얹는다(engine.pushScene).
 *   우리 배를 찍는다 → 갈 수 있는 칸이 노랗게 → 칸을 찍어 옮긴다 → 붉은 테의 적(사거리 안)을 찍으면 포를 쏜다.
 *   적과 맞닿아 있으면 조작 창에 '올라타기' 단추가 뜬다. 우리 기함이 적 기함과 맞닿으면 '일기토 신청' 단추도 뜬다(해전마다 한 번).
 *   적 선장이 일기토를 신청해 오면 싸움이 멎고 '받는다 · 물리친다'를 묻는다. 물리쳐도 잃는 것은 없다.
 *   조작 창: 대기 · 차례 넘기기 · 맡기기(남은 싸움을 AI에게) · 달아나기(한 번 더 묻는다) · 올라타기와 일기토 신청(맞닿은 적이 있을 때 뒤에 붙는다).
 * 키보드: 방향키 칸 커서 · Enter 커서가 놓인 칸 찍기(손으로 찍는 것과 같다) · Space 아직 일을 마치지 않은 다음 우리 배 ·
 *   숫자 키 조작 창의 단추 · Esc 고른 배 놓기. 결과 카드 · 달아나기를 되묻는 창 · 일기토를 묻는 창에서는 Enter가 노란 단추를 누른다.
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

  /* 배 그림(픽셀): 칸 하나가 글자 하나다. o 테두리 · L/H/h 선체 밝은·가운데·어두운 나무 · g 포문 · y 고물 창 · S/s 돛과 그늘 ·
   * m 돛대·활대 · f 깃발과 F 그 테두리(기함만) · w 물보라. 뱃머리가 오른쪽을 본다. 큰 그림은 해전, 작은 그림은 세계 지도에 쓴다. */
  const SHIP_BIG = [
    '............mFFFFF..........',
    '............mffffF..........',
    '............mffFF...........',
    '............mFF.............',
    '........mmmmmmmmm...........',
    '........oSSSmSSSo...........',
    '........oSSSmSSSso..........',
    '........oSSSmSSSso..........',
    '.....m...ossmssso...........',
    '....om....oomooo............',
    '...oSmmmmmmmmmmmmmm....m....',
    '..oSsmoSSSSSmSSSSSo....m....',
    '..oSsmoSSSSSmSSSSSsommmmmmm.',
    '.oSSsmoSSSSSmSSSSSsooSSmSSo.',
    'oSSSsmoSSSSSmSSSSSsooSSmSSso',
    'ossssm.oSSSSmSSSSso.oSSmSSso',
    '.oooomo.osssmsssso...osmssom',
    'oLLLLLLo.ooomoooo.....omoom.',
    'oHHyHyHooooomoooooooooLmLLLo',
    'oLLLLLLLLLLLLLLLLLLLLLLLLLLo',
    'oHHHHHHHHgHHHgHHHgHHHgHHHHHo',
    '.oHHHHHHHHHHHHHHHHHHHHHHHHo.',
    '..ohhhhhhhhhhhhhhhhhhhhhho..',
    '...oohhhhhhhhhhhhhhhhhhoo...',
    '....wwwoooowwwoooowwwoo.....',
  ];
  const SHIP_SMALL = [
    '........mFFFF....',
    '........mfffF....',
    '........mfFF.....',
    '.....mmmmmmm.....',
    '.....oSSmSSo.....',
    '.....ossmsso.....',
    '...mmmmmmmmmm....',
    '..omSSSSmSSSo....',
    '.oSmSSSSmSSSsomo.',
    'oSsmosssmsssoSmSo',
    'ossm.ooomoooosmso',
    'oLLLoooomooooomo.',
    'oLLLLLLLLLLLLLLLo',
    'oHHHHHHHHHHHHHHHo',
    '.oohhhhhhhhhhhoo.',
    '...ooooooooooo...',
    '...ww....ww......',
  ];
  /* 거북선(가장 빠르고 포가 센 배): G/d 등딱지의 판과 그 그늘 · k 등의 쇠못 · D 용머리 · r 용의 입. 나머지 글자는 위와 같다. */
  const TURTLE_BIG = [
    '...........mFFFFF...........',
    '...........mffffF...........',
    '...........mffFF............',
    '...........mFF..............',
    '.......mmmmmmmmm............',
    '.......oSSSmSSSo............',
    '.......oSSSmSSSso...........',
    '.......oSSSmSSSso...........',
    '.......oSSSmSSSso...........',
    '........ossmssso............',
    '.......k.oomoo.k..k.........',
    '......ooooomooooooo.....oo..',
    '....koGGGdGGGdGGGdGok..oDDo.',
    '...oGdGGGdGGGdGGGdGGGooDDoDo',
    '..oGGGdGGGdGGGdGGGdGGGoDDDDo',
    '.oGdGGGdGGGdGGGdGGGdGGGoDDrr',
    'oGGGdGGGdGGGdGGGdGGGdGGoDDo.',
    'oGdGGGdGGGdGGGdGGGdGGGdoDDo.',
    'oLLLLLLLLLLLLLLLLLLLLLLLLLLo',
    'oLLLLLLLLLLLLLLLLLLLLLLLLLLo',
    'oHHHgHHHgHHHgHHHgHHHgHHHgHHo',
    '.oHHHHHHHHHHHHHHHHHHHHHHHHo.',
    '..ohhhhhhhhhhhhhhhhhhhhhho..',
    '...oohhhhhhhhhhhhhhhhhhoo...',
    '....wwwoooowwwoooowwwoo.....',
  ];
  const TURTLE_SMALL = [
    '.......mFFFF.....',
    '.......mfffF.....',
    '.......mfFF......',
    '.....mmmmm.......',
    '....oSSmSSo......',
    '....ossmsso......',
    '.....oomoo.......',
    '....okomoko......',
    '...odGGGdGGo..oo.',
    '.odGGGdGGGdGGoDDo',
    'oGGGdGGGdGGGdoDrr',
    'oGdGGGdGGGdGGoDo.',
    'oLLLLLLLLLLLLLLLo',
    'oHHHHHHHHHHHHHHHo',
    '.oohhhhhhhhhhhoo.',
    '...ooooooooooo...',
    '...ww....ww......',
  ];
  const PX = {
    me: { o: '#2a2119', F: '#2a2119', L: '#c99a5b', H: '#8a5a33', h: '#5e3b22', g: '#2a2119', y: '#f2c75c', S: '#fbf3df', s: '#d9cdb3', m: '#4a3424', f: ACCENT, w: '#eef6fa', G: '#4f7d4a', d: '#2f5a36', k: '#f2c75c', D: '#d99a2b', r: '#c8402f' },
    foe: { o: '#2a2119', F: '#2a2119', L: '#8c6f52', H: '#4a3a2c', h: '#2f251c', g: '#1c1611', y: '#e0a040', S: '#d24a35', s: '#a8342a', m: '#3a2a1e', f: ACCENT, w: '#eef6fa', G: '#5b5a4a', d: '#3a3a30', k: '#e0a040', D: '#a8342a', r: '#f2c75c' },
  };
  LOOK.me.px = PX.me; LOOK.foe.px = PX.foe;
  /** 글자 줄을 같은 색끼리 묶어 둔다: [줄, 시작 칸, 길이, 글자] */
  const runs = rows => { const out = []; rows.forEach((r, y) => { for (let x = 0; x < r.length;) { const ch = r[x]; let n = 1; while (r[x + n] === ch) n++; if (ch !== '.') out.push([y, x, n, ch]); x += n; } }); return out; };
  const sprite = (big, small) => ({ big: { w: big[0].length, h: big.length, runs: runs(big), cell: 0.7, base: 24 }, small: { w: small[0].length, h: small.length, runs: runs(small), cell: 1, base: 16 } });
  const SPRITE = sprite(SHIP_BIG, SHIP_SMALL), SPRITES = { turtle: sprite(TURTLE_BIG, TURTLE_SMALL) };      // 배 종류 id → 그림. 없는 종류는 범선 그림을 쓴다

  /** 배 한 척(픽셀 그림). (x,y)가 가운데, k가 배율(물보라 줄 아래 끝이 y+5k). flag면 돛대 끝에 노란 깃발을 단다.
   *  face가 -1이면 뱃머리가 왼쪽을 본다. k가 작으면(지도) 작은 그림을 칸 하나 1px로 그린다. type은 배 종류 id(거북선은 'turtle').
   *  칸 경계를 기기 픽셀에 맞춰 반올림하므로 어떤 배율에서도 칸 사이에 틈이나 번짐이 없다. */
  function drawShip(g, x, y, k, look = LOOK.me, flag = false, face = 1, type = null, skin = null) {
    if (skin != null) return drawFancyShip(g, x, y, k, skin, face);
    const m = g.getTransform(), set = SPRITES[type] || SPRITE, tiny = k < 1.6, sp = tiny ? set.small : set.big;
    const c = tiny ? k : k * sp.cell, pal = look.px || PX.me;
    const left = x - sp.w * c / 2, top = y + 5 * k - (sp.base + 1) * c;
    const DX = j => Math.round(m.a * (left + (face < 0 ? sp.w - j : j) * c) + m.e), DY = i => Math.round(m.d * (top + i * c) + m.f);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    for (const [r, x0, n, ch] of sp.runs) {
      if ((ch === 'f' || ch === 'F') && !flag) continue;
      const a = DX(x0), b = DX(x0 + n), y0 = DY(r), y1 = DY(r + 1);
      g.fillStyle = pal[ch] || INK; g.fillRect(Math.min(a, b), y0, Math.abs(b - a), y1 - y0);
    }
    g.restore();
  }

  // 동화책처럼 둥근 해적선. 전투 수치·난수·배 종류와 독립인 여섯 가지 그림.
  const PIRATE_NAMES = ['해골 왕관선', '붉은 돛 해적선', '초록 용머리선', '보라 문어선', '복어 풍선선', '통통한 고래선'];
  function drawFancyShip(g, x, y, k, skin, face = 1) {
    const n = ((skin % 6) + 6) % 6, hues = ['#393d50', '#ad4038', '#397b64', '#80557d', '#bc8338', '#397893'], hue = hues[n];
    g.save(); g.translate(x, y); g.scale(k * face, k);
    const path = (points, fill, stroke = INK, lw = .65) => { g.beginPath(); g.moveTo(...points[0]); for (const p of points.slice(1)) g.lineTo(...p); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
    const oval = (cx, cy, rx, ry, fill, stroke = null) => { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = .65; g.stroke(); } };
    const line = (ax, ay, bx, by, color, width = .7) => { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.stroke(); };
    oval(0, 4, 11.7, 1.6, 'rgba(255,255,255,.62)');
    oval(0, 3.2, 9, 1.8, 'rgba(52,88,108,.17)');
    // 돛대와 서로 다른 큰 돛. 전장 셀 안에 들어오는 윤곽을 유지한다.
    line(-2, 1, -2, -17, '#594333', 1.1);
    if (n === 4) {
      oval(-1, -11, 7.4, 6.2, '#e8be65', INK);
      for (let i = -1; i <= 1; i++) line(-1 + i * 2, -16, -1 + i * 3, -6, '#c79044', .5);
      line(-6, -6, -4, -1, '#6d5139', .5); line(5, -6, 3, -1, '#6d5139', .5);
      oval(2, -12, .8, 1, INK); path([[5,-12],[8,-11],[5,-10]], '#fbefc4');
    } else {
      g.beginPath(); g.moveTo(-8, -15); g.quadraticCurveTo(2, -17, 7, -14); g.quadraticCurveTo(10, -9, 7, -5); g.quadraticCurveTo(1, -3, -8, -6); g.quadraticCurveTo(-5, -10, -8, -15);
      g.closePath(); g.fillStyle = n === 0 ? '#ede8d4' : hue; g.fill(); g.lineWidth = .7; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.moveTo(-6,-14); g.quadraticCurveTo(1,-16,6,-13); g.strokeStyle = 'rgba(255,255,255,.42)'; g.stroke();
      if (n === 1) { line(-4,-14,-4,-6,'#f4d1a1',1.4); line(1,-14,1,-5,'#f4d1a1',1.4); }
      const bone = n === 0 ? '#414153' : '#fff1cd';
      oval(0,-10.7,2.5,2.2,bone); path([[-1.6,-9],[1.6,-9],[1.3,-7.7],[-1.3,-7.7]],bone,null);
      oval(-.9,-10.8,.6,.75,n===0?'#ede8d4':hue); oval(.9,-10.8,.6,.75,n===0?'#ede8d4':hue);
      line(-3.8,-7.5,3.8,-5.5,bone,.7); line(-3.8,-5.5,3.8,-7.5,bone,.7);
    }
    // 통통한 선체와 밝은 갑판
    g.beginPath(); g.moveTo(-11,-2); g.quadraticCurveTo(0,0,11,-3); g.quadraticCurveTo(9,6,0,5); g.quadraticCurveTo(-8,5,-11,-2); g.closePath(); g.fillStyle=hue; g.fill(); g.strokeStyle=INK; g.lineWidth=.8; g.stroke();
    line(-9,-1,9,-1,'#e5b66b',1.4); line(-6,3,5,3,'rgba(255,255,255,.25)',.6);
    for (let i=-5;i<=5;i+=5) { oval(i,1,1,1,'#242c39','#d5a860'); }
    if (n === 0) {
      oval(9,-2,3.5,3.6,'#f7ecd1',INK); oval(7.8,-2.7,.85,1.1,INK); oval(10.4,-2.7,.85,1.1,INK);
      for (let j=8;j<11;j++) line(j,.3,j,1.4,INK,.4);
      path([[6,-5],[6,-8],[8,-6],[9,-9],[10,-6],[12,-8],[12,-5]],'#e8b64f');
    } else if (n === 2) {
      path([[7,0],[7,-6],[10,-9],[14,-8],[13,-4],[10,-3],[11,1]],'#5a9a70');
      path([[8,-7],[6,-10],[10,-9],[11,-12],[12,-8]],'#e6bd67');
      oval(11,-7,.7,.8,INK); line(12,-4,14,-4,'#f1dca2',.8);
    } else if (n === 3) {
      for (let i=0;i<4;i++) { g.beginPath(); g.moveTo(6+i,-2); g.quadraticCurveTo(16-i,5+i,10-i,5); g.strokeStyle=hue; g.lineWidth=1.6; g.stroke(); }
      oval(9,-3,4,4,'#b884ac',INK); oval(8,-3,.6,.9,INK); oval(10,-3,.6,.9,INK);
    } else if (n === 5) {
      oval(8,-1,4.8,4,hue,INK); oval(10,-2,.65,.7,'#fff3d8');
      path([[-8,1],[-14,-3],[-12,2],[-15,4],[-9,4]],hue);
      line(7,-5,7,-8,'#d9f3f5',.7); line(7,-8,5,-9,'#d9f3f5',.7); line(7,-8,9,-9,'#d9f3f5',.7);
    } else if (n === 1) {
      path([[-11,-2],[-11,-6],[-7,-6],[-7,-1]],'#664549'); oval(-9,-4,.6,.7,'#f0cf72');
    }
    path([[-2,-18],[4,-18],[2,-16],[-2,-16]],'#242b3a'); oval(0,-17,.65,.6,'#fff2d8');
    g.restore();
  }

  /** 작은 민간 배. 역사의 선형을 단순화한 독자 그림이며 특정 실물 선박의 복원이 아니다. */
  function drawCivilShip(g, x, y, k, type, face = 1) {
    g.save(); g.translate(x,y); g.scale(k*face,k); g.lineJoin='round'; g.lineCap='round';
    const line=(a,b,c,d,col,w=.7)=>{g.beginPath();g.moveTo(a,b);g.lineTo(c,d);g.strokeStyle=col;g.lineWidth=w;g.stroke();};
    const poly=(ps,col)=>{g.beginPath();g.moveTo(...ps[0]);ps.slice(1).forEach(p=>g.lineTo(...p));g.closePath();g.fillStyle=col;g.fill();g.strokeStyle='#544333';g.lineWidth=.6;g.stroke();};
    g.beginPath();g.ellipse(0,3.6,10,1.3,0,0,Math.PI*2);g.fillStyle='rgba(247,251,249,.8)';g.fill();
    if(type==='fishing') {
      line(-2,0,-2,-7,'#75563e',.8);poly([[-2,-7],[4,-2],[-2,-2]],'#e9dcc0');
      line(4,-1,10,-5,'#80664c',.5);line(10,-5,10,2,'#b5ad8b',.4);
      poly([[-5,-1],[-3,-4],[1,-4],[3,-1]],'#c19760');
    } else if(type==='junk') {
      line(-2,1,-2,-13,'#6b513e',1);
      poly([[-6,-12],[3,-14],[7,-10],[6,-3],[-5,-3]],'#d7a26d');
      for(let y=-11;y<=-4;y+=2) line(-5,y,6,y,'#926a49',.5);
    } else if(type==='dhow') {
      line(1,0,1,-13,'#6b513e',1);
      poly([[-8,-12],[8,-4],[-3,-3]],'#f4e5c5');line(-8,-12,9,-4,'#8b6848',.65);
    } else if(type==='canoe') {
      line(-5,-1,-9,4,'#785c41',.7);line(4,-1,9,4,'#785c41',.7);
      poly([[-1,-10],[6,-3],[-1,-3]],'#e3be7f');line(-1,0,-1,-10,'#6b513e',.8);
    } else {
      line(-2,1,-2,-14,'#6b513e',.9);line(5,0,5,-10,'#6b513e',.7);
      poly([[-7,-11],[3,-11],[4,-4],[-6,-4]],'#faf0d6');
      poly([[5,-10],[10,-3],[5,-3]],'#ede0bd');
      line(-2,-13,2,-13,type==='explorer'?'#ba5041':'#4f7d9c',1.4);
    }
    g.beginPath();g.moveTo(-10,-1);g.quadraticCurveTo(0,1,10,-2);g.quadraticCurveTo(7,5,-5,3);g.closePath();g.fillStyle=type==='junk'?'#85563d':'#a97b4c';g.fill();g.lineWidth=.7;g.strokeStyle='#574434';g.stroke();
    line(-7,0,7,0,'#edc588',.9);g.restore();
  }

  class HangBattleScene extends DH.MapScene {
    /** @param {{onDone:(result)=>void}} o 사람은 언제나 'me' 쪽이다 */
    constructor(engine, layout, battle, o) {
      super(engine); this.layout = layout; this.b = battle; this.me = 'me'; this.onDone = o.onDone;
      this.sel = null; this.reach = new Map(); this.look = null; this.fx = []; this.wait = 30; this.idle = 0; this.auto = false; this.ask = false; this.mode = 'fight'; this.res = null;
      this.disp = new Map(); this.banner = null;    // 배를 그리는 자리(칸 사이를 미끄러진다) · 턴이 바뀔 때 지나가는 띠
      this.artSeed = o.artSeed ?? DH.Hang.artHash(b.fleets.foe.name);
      this.salvage = o.salvage || DH.Hang.RULES.salvage;
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
        else if (this.ask || this.dare) this.layout.pressPrimary();
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
    /** 적 선장이 우리에게 신청해 답을 기다리는 일기토(맡겨 둔 싸움에서는 AI가 답한다) */
    get dare() { const p = this.b.pending; return p && this.mode === 'fight' && !this.auto && this.unit(p.target).side === this.me ? p : null; }
    get myTurn() { return this.mode === 'fight' && !this.auto && !this.b.ended && this.b.side === this.me; }
    unit(id) { return this.b.units.find(u => u.id === id); }
    skin(u) { return u.side === 'foe' ? (this.artSeed + Number(u.id.replace('foe', ''))) % PIRATE_NAMES.length : null; }
    get supplyDays() { return this.b.units.filter(u=>u.side==='foe').length>=this.salvage.largeShips?this.salvage.largeDays:this.salvage.smallDays; }

    select(u) { this.sel = u; this.reach = u ? this.b.range(u) : new Map(); this.look = null; }
    /** 한 일을 화면에 남긴다: 지나온 자취 · 포탄 줄 · 떠오르는 피해 숫자 · 기록 */
    show(rec) {
      if (!rec) return;
      const g = this.grid, t = this.engine.tick, at = u => g.center(u.c, u.r), hit = (u, text, dy = 0) => { const p = at(u); this.fx.push({ kind: 'hit', x: p.x, y: p.y + dy, text, t0: t }); };
      if (rec.from && rec.to && (rec.from[0] !== rec.to[0] || rec.from[1] !== rec.to[1])) this.fx.push({ kind: 'trail', a: g.center(rec.from[0], rec.from[1]), b: g.center(rec.to[0], rec.to[1]), t0: t });
      const u = rec.unit && this.unit(rec.unit), x = rec.target && this.unit(rec.target);
      const land = 14;                                             // 포탄이 날아가 닿는 데 걸리는 틱
      if (rec.type === 'fire') {
        const A = at(u), B = at(x), big = Math.min(1, (rec.hull + rec.crew * 2) / 30);
        this.fx.push({ kind: 'smoke', x: A.x, y: A.y, dir: Math.sign(B.x - A.x) || 1, t0: t, life: 40 });
        for (let i = 0; i < 3; i++) this.fx.push({ kind: 'ball', a: A, b: { x: B.x + (i - 1) * 5, y: B.y + (i === 1 ? 0 : 3) }, t0: t + i * 4, life: land + 2 });
        for (let i = 0; i < 3; i++) this.fx.push({ kind: 'splash', x: B.x + [-17, 15, -4][i], y: B.y + [6, 9, 14][i], t0: t + land + i * 3, life: 22 });
        this.fx.push({ kind: 'boom', x: B.x, y: B.y - 6, size: 8 + 10 * big, t0: t + land, life: 22 }); this.fx.push({ kind: 'jolt', id: x.id, t0: t + land, life: 14 });
        this.fx.push({ kind: 'hit', x: B.x, y: B.y, text: `선체 −${rec.hull}`, t0: t + land - 4 });
        this.sfx('cannon', 0.12); this.sfx('bang', 0.25);
      }
      else if (rec.type === 'board') {
        const A = at(u), B = at(x); this.fx.push({ kind: 'grapple', a: A, b: B, t0: t, life: 34 }); this.fx.push({ kind: 'spark', x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 - 6, t0: t + 4, life: 26 });
        this.fx.push({ kind: 'jolt', id: x.id, t0: t + 4, life: 14 }); hit(x, `선원 −${rec.hit}`); if (rec.back) hit(u, `선원 −${rec.back}`); this.sfx('clash', 0.2);
      }
      else if (rec.type === 'duel') { const A = at(u), B = at(x); this.fx.push({ kind: 'spark', x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 - 8, t0: t, life: 40 }); }
      const gone = rec.out ? x : rec.lost ? u : null;
      if (gone) { const P = this.dp(gone); this.fx.push({ kind: rec.out === 'sunk' ? 'sink' : 'taken', x: P.x, y: P.y, type: gone.type, side: gone.side, skin: this.skin(gone), flag: gone.flag, t0: t + (rec.type === 'fire' ? land + 4 : 6), life: 70 }); }
      else if (rec.type === 'duel') hit(rec.winner === u.side ? x : u, '일기토 패');
      else if (rec.type === 'challenge') hit(u, '일기토 신청');
      else if (rec.type === 'refuse') hit(x, '물리쳤다');
      if (rec.text) this.layout.log(rec.text);
      if (rec.type === 'challenge') this.sfx('alert'); else if (rec.type === 'refuse') this.sfx('swish');
      else if (rec.type === 'fire') { this.sfx('cannon'); this.sfx('explode', 0.24); } else if (rec.type === 'board') this.sfx('clash'); else if (rec.type === 'duel') { this.sfx('clash'); this.sfx('clash', 0.4); }
      else if (rec.from && rec.to && (rec.from[0] !== rec.to[0] || rec.from[1] !== rec.to[1])) this.sfx('ship');
      if (rec.out === 'sunk') this.sfx('explode', 0.35); else if (rec.out) this.sfx('fall', 0.35);
    }
    endSide() {
      const b = this.b; b.endSide(); this.sel = null; this.reach = new Map(); this.ask = false; this.idle = 0; this.wait = STEP;
      if (b.ended) return this.finish();
      this.banner = { text: `${b.turn}턴 · ${b.side === this.me ? '우리' : '적'} 차례`, side: b.side, t0: this.engine.tick };
      this.layout.log(`${b.turn}턴 · ${b.fleets[b.side].name} 차례`); this.refresh();
    }
    finish() {
      if (this.mode === 'result') return;
      this.mode = 'result'; this.res = this.b.result(); this.doneAt = this.engine.tick; this.sel = null; this.reach = new Map(); this.ask = false;
      this.layout.log(`해전이 끝났다 · ${this.res.reason}`); this.sfx(this.res.fled ? 'swish' : this.res.winner === 'me' ? 'win' : 'lose', 0.5); this.refresh();
    }

    update() {
      const b = this.b, t = this.engine.tick;
      if (this.fx.length) this.fx = this.fx.filter(f => t - f.t0 < (f.life || FX));
      for (const u of b.units) { const P = this.dp(u), Q = this.grid.center(u.c, u.r); P.x += (Q.x - P.x) * 0.2; P.y += (Q.y - P.y) * 0.2; if (Math.abs(Q.x - P.x) < 0.3 && Math.abs(Q.y - P.y) < 0.3) { P.x = Q.x; P.y = Q.y; } }
      if (this.mode !== 'fight') return;
      if (b.ended) return this.finish();
      if (this.myTurn) {                                           // 우리 배가 모두 일을 마치면 차례를 넘긴다
        if (b.alive(this.me).some(u => !u.done)) this.idle = 0; else if (++this.idle > 24) this.endSide();
        return;
      }
      if (this.dare) return;                                       // 일기토의 답을 기다린다
      if (--this.wait > 0) return;
      const rec = b.aiAct();
      if (!rec) return this.endSide();
      this.show(rec); this.wait = STEP + (rec.type === 'fire' ? 16 : rec.type === 'board' ? 8 : 0);   // 포탄이 닿고 나서 다음 배가 움직인다(그림만 기다린다)
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
      if (id === 'accept' || id === 'refuse') { if (!this.dare) return; this.show(b.answer(id === 'accept')); this.wait = STEP; if (b.ended) return this.finish(); return this.refresh(); }
      if (!this.myTurn) return;
      if (id === 'wait' && this.sel) { b.wait(this.sel); this.select(null); }
      else if (key === 'duel' && this.sel) { const t = this.unit(arg); if (t && b.duelTargets(this.sel).includes(t)) { const s = this.sel; this.show(b.challenge(s, t)); if (b.ended) return this.finish(); this.select(s.done ? null : s); } }
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
      const { hit, left, back } = this.b.boardPreview(s, t);
      return `적 선원 −${hit}${left <= 0 ? (t.flag ? '(기함을 빼앗아 이긴다)' : '(배를 빼앗는다)') : ` → 되받아 우리 선원 −${back}`}`;
    }
    /** 일기토를 미리 본 글: 두 선장의 무력과 한 합에 깎는 기력의 범위 */
    duelText() {
      const b = this.b, F = b.fleets, D = b.S.duel, swing = (side, safe) => (safe ? '0(무적)' : `${Math.floor(b.war(side) * D.minPct / 100)}~${Math.floor(b.war(side) * D.maxPct / 100)}`);
      return `${F.me.captain.name}(무력 ${b.war('me')}) 대 ${F.foe.captain.name}(무력 ${b.war('foe')}) · 기력 ${D.hp}에서 한 합에 우리가 ${swing('me', F.foe.invincible)} · 적이 ${swing('foe', F.me.invincible)}씩 깎는다`;
    }
    title() { const r = this.res; return !r ? '해전' : r.fled ? '달아났다' : r.winner === 'me' ? '이겼다' : r.winner === 'foe' ? '졌다' : '갈라졌다'; }

    refresh() {
      const b = this.b, L = this.layout, F = b.fleets, s = this.sel, S = b.S;
      L.setInfo([{ label: '곳', value: b.place }, { label: '턴', value: `${b.turn}/${S.turns}` }, { label: '차례', value: this.mode === 'result' ? '끝' : `${SIDE[b.side]} 함대` },
        { label: '우리', value: `선체 ${b.hullOf('me')} · ${b.crewOf('me')}명` }, { label: '적', value: `선체 ${b.hullOf('foe')} · ${b.crewOf('foe')}명` }]);
      const ship = u => (u.out ? (u.out === 'sunk' ? '가라앉았다' : '빼앗겼다') : `${u.kind} · 선체 ${u.hull}/${u.maxHull} · 선원 ${u.crew}/${u.maxCrew} · 포 ${u.guns}`);
      const rows = [['우리 선장', `${F.me.captain.name} · 무력 ${F.me.captain.war}${F.me.invincible ? ' · 무적' : ''}`], ...b.units.filter(u => u.side === 'me').map(u => [`우리 ${u.name}${u.flag ? '(기함)' : ''}`, ship(u)]),
        ['적 선장', `${F.foe.captain.name} · 무력 ${F.foe.captain.war}`], ...b.units.filter(u => u.side === 'foe').map(u => [`적 ${u.name}`, ship(u)])];
      let note;
      if (this.mode === 'result') {
        const r = this.res; rows.push(['결과', `${this.title()} · ${r.reason}`]); if (r.loot) rows.push(['얻은 금', fmt(r.loot)]);
        if(r.winner==='me')rows.push(['약탈 보급',`식량·물 각 ${this.supplyDays}일분 · 바다로 돌아갈 때 상한까지 싣는다`]);
        note = '바다로 돌아가면 결과가 반영된다.';
      } else if (this.dare) {
        rows.push(['일기토 신청', `${DH.josa(F.foe.captain.name, '이', '가')} 선장끼리 겨루자고 한다`], ['겨루면', this.duelText()]);
        note = '받으면 선장끼리 겨루고, 진 쪽이 해전을 진다. 물리치면 잃는 것 없이 싸움이 그대로 이어진다.';
      } else if (s) {
        const sh = b.shot(s); rows.push(['고른 배', `${s.name} · 포격 한 번에 선체 −${sh.hull} · 선원 −${sh.crew}`]);
        for (const t of b.boardTargets(s)) rows.push([`${t.name}에 백병전`, this.boardText(s, t)]);
        if (b.duelTargets(s).length) rows.push(['일기토', this.duelText()]);
        note = (s.moved ? '붉은 테의 적을 찍으면 포를 쏜다.' : '노란 칸을 찍으면 옮긴다. 붉은 테의 적은 바로 쏠 수 있다.') + ` 포격 = 포 ${s.guns} × ${S.gunHull} × 선원 ${s.crew} ÷ 정원 ${s.maxCrew}.` + (b.boardTargets(s).length ? ' 맞닿은 적에는 아래 단추로 올라탄다.' : ' 적과 맞닿으면 올라탈 수 있다.')
          + (b.duelTargets(s).length ? ' 일기토는 해전마다 한 번 신청할 수 있고, 적 선장이 물리치면 이 배는 이어서 다른 일을 한다.' : '');
      } else if (this.look) {
        const u = b.unitAt(this.look.c, this.look.r); rows.push(['찍은 칸', b.isRock(this.look.c, this.look.r) ? '암초 · 들어갈 수 없다' : '바다']);
        if (u) rows.push(['그 배', `${SIDE[u.side]} ${u.name} · ${ship(u)}`]);
        note = '우리 배를 찍으면 갈 수 있는 칸이 보인다.';
      } else note = this.auto ? '선원들이 알아서 싸우는 중이다. 적 선장의 일기토 신청은 우리 선장의 무력이 적 선장 이상일 때만 받는다.' : this.myTurn ? `우리 배를 찍으면 갈 수 있는 칸이 보인다. 한 턴에 ${S.mp}칸을 가고, ${S.range}칸 안의 적에게 포를 쏜다. 적의 기함을 가라앉히거나 빼앗으면 이긴다. ${S.turns}턴이 지나면 승부 없이 갈라진다.` : '적 함대가 움직이는 중이다.';
      L.setDetail({ title: this.mode === 'result' ? `해전 · ${this.title()}` : `${DH.josa(F.foe.name, '과', '와')}의 해전`, rows, note });
      const off = !this.myTurn, pick = id => this.command(id);
      if (this.mode === 'result') L.setMenu([{ id: 'back', label: '바다로 돌아가기', primary: true }], pick);
      else if (this.dare) L.setMenu([{ id: 'accept', label: '일기토를 받는다', hint: '선장끼리 겨룬다. 진 쪽이 해전을 진다' }, { id: 'refuse', label: '물리친다', primary: true, hint: '싸움이 그대로 이어진다' }], pick);
      else if (this.ask) L.setMenu([{ id: 'yes', label: '정말 달아난다', hint: '짐의 절반을 버리고 빠져나간다' }, { id: 'no', label: '돌아가기', primary: true }], pick);
      else L.setMenu([{ id: 'wait', label: '대기', disabled: off || !s, hint: '고른 배가 그 턴 일을 마친다' }, { id: 'end', label: '차례 넘기기', primary: true, disabled: off },      // 1~4는 늘 같은 자리, 올라타기는 5부터
        { id: 'auto', label: '맡기기', disabled: off, hint: '남은 싸움을 AI가 대신 싸운다' }, { id: 'flee', label: '달아나기', disabled: off, hint: '짐의 절반을 버리고 빠져나간다' },
        ...(s && !off ? b.boardTargets(s).map(t => ({ id: 'board:' + t.id, label: `${t.name}에 올라타기` })) : []),
        ...(s && !off ? b.duelTargets(s).map(t => ({ id: 'duel:' + t.id, label: `${F.foe.captain.name}에게 일기토 신청`, hint: '받아들이면 선장끼리 겨뤄 진 쪽이 해전을 진다' })) : [])], pick);
    }

    /** 배를 그리는 자리. 칸이 바뀌면 update()가 조금씩 따라가게 해 미끄러져 간다(규칙의 자리는 칸 그대로다). */
    dp(u) { let P = this.disp.get(u.id); if (!P) { const Q = this.grid.center(u.c, u.r); P = { x: Q.x, y: Q.y }; this.disp.set(u.id, P); } return P; }
    /** 포탄이 터지는 동안 화면이 흔들린다(그림만 · 칸은 그대로) */
    shake() { const t = this.engine.tick; let a = 0; for (const f of this.fx) if (f.kind === 'boom') { const q = t - f.t0; if (q >= 0 && q < 10) a += (10 - q) / 10 * f.size / 5; } return Math.min(4, a); }
    render(g) {
      g.fillStyle = WATER; g.fillRect(0, 0, this.engine.width, this.engine.height);      // 아래 바다 장면을 가린다
      const k = this.shake(), t = this.engine.tick;
      if (k > 0.05) { g.save(); g.translate(Math.sin(t * 2.7) * k, Math.cos(t * 3.1) * k * 0.6); super.render(g); g.restore(); } else super.render(g);
      if (this.banner && this.mode === 'fight') this.drawBanner(g);
      if (this.mode === 'result') this.drawCard(g);
    }
    /** 턴이 바뀔 때 화면 가운데를 지나가는 띠(50틱) */
    drawBanner(g) {
      const W = this.engine.width, H = this.engine.height, q = (this.engine.tick - this.banner.t0) / 50; if (q < 0 || q >= 1) return;
      const slide = q < 0.2 ? 1 - q / 0.2 : q > 0.8 ? -(q - 0.8) / 0.2 : 0, x = slide * W, a = q > 0.8 ? 1 - (q - 0.8) / 0.2 : 1, mine = this.banner.side === this.me;
      g.save(); g.globalAlpha = 0.92 * a; g.fillStyle = mine ? '#fbf7ef' : '#3c3226'; g.fillRect(x, H / 2 - 20, W, 40);
      g.fillStyle = mine ? ACCENT : RED; g.fillRect(x, H / 2 - 20, W, 4); g.fillRect(x, H / 2 + 16, W, 4);
      g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 18px ${FONT}`; g.fillStyle = mine ? INK : '#fbf7ef'; g.fillText(this.banner.text, x + W / 2, H / 2 + 1);
      g.restore();
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
        } else if ((c * 7 + r * 3) % 4 === 0) { p.x += Math.sin(t / 40 + c * 1.3 + r) * 3; g.beginPath(); g.moveTo(p.x - 8, p.y + 14); g.quadraticCurveTo(p.x - 4, p.y + 11, p.x, p.y + 14); g.quadraticCurveTo(p.x + 4, p.y + 17, p.x + 8, p.y + 14); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2; g.stroke(); }
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
      }
      this.drawFx(g, 'under');
      // 배: 그림 아래에 선체 · 선원
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      for (const u of b.units) {
        if (u.out) continue;
        const P = this.dp(u), Q = grid.center(u.c, u.r), dim = this.mode === 'fight' && u.side === b.side && u.done, face = u.side === 'foe' ? -1 : 1;
        let jx = 0; for (const f of this.fx) if (f.kind === 'jolt' && f.id === u.id) { const q = t - f.t0; if (q >= 0 && q < 14) jx += Math.sin(q * 2.4) * 2.4 * (1 - q / 14); }
        const bob = Math.sin(t / 16 + Q.x / 40 + Q.y / 30) * 1.1, p = { x: P.x + jx, y: P.y + bob };
        g.globalAlpha = dim ? 0.6 : 1;
        if (u === s) { g.beginPath(); grid.trace(g, u.c, u.r); g.strokeStyle = ACCENT; g.lineWidth = 3; g.stroke(); }
        const sp = Math.hypot(Q.x - P.x, Q.y - P.y);
        if (sp > 1) { const dx = (Q.x - P.x) / sp; g.beginPath(); for (const sd of [-1, 1]) { g.moveTo(p.x - dx * 12, p.y + 8); g.lineTo(p.x - dx * 28, p.y + 9 + sd * 4); } g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.6; g.stroke(); }
        drawShip(g, p.x, p.y - 2, 2.1, LOOK[u.side], u.flag, face, u.type, this.skin(u));   // 서로 마주 본다
        const label = `${u.hull}·${u.crew}`; g.font = `800 10px ${FONT}`; g.lineWidth = 3; g.strokeStyle = 'rgba(251,247,239,.95)'; g.strokeText(label, P.x, P.y + 15); g.fillStyle = u.side === 'me' ? INK : '#8a2416'; g.fillText(label, P.x, P.y + 15);
        g.globalAlpha = 1;
      }
      this.drawFx(g, 'over');
      if (s && this.myTurn) for (const x of b.fireTargets(s)) { const p = grid.center(x.c, x.r), pulse = 1 + 0.06 * Math.sin(t / 6); g.beginPath(); g.arc(p.x, p.y, S * 0.84 * pulse, 0, Math.PI * 2); g.strokeStyle = RED; g.lineWidth = 3; g.stroke(); }
      // 키보드 커서
      if (this.cur && this.mode === 'fight') { g.beginPath(); grid.trace(g, this.cur.c, this.cur.r); g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.lineWidth = 4.6; g.stroke(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); }
      // 떠오르는 피해 숫자
      for (const f of this.fx) if (f.kind === 'hit' && t >= f.t0) {
        const q = (t - f.t0) / FX, y = f.y - 22 - q * 16; g.globalAlpha = Math.min(1, 2.2 * (1 - q)); g.font = `800 13px ${FONT}`;
        g.lineWidth = 3.5; g.strokeStyle = '#fff'; g.strokeText(f.text, f.x, y); g.fillStyle = RED; g.fillText(f.text, f.x, y); g.globalAlpha = 1;
      }
    }
    /** 효과 그림. under: 배 밑(물보라 · 가라앉는 배 · 빼앗긴 배) · over: 배 위(포연 · 포탄 · 폭발 · 갈고리 · 불꽃) */
    drawFx(g, layer) {
      const t = this.engine.tick;
      for (const f of this.fx) {
        const age = t - f.t0, life = f.life || FX; if (age < 0) continue; const q = age / life, a = 1 - q;
        if (layer === 'under') {
          if (f.kind === 'splash') { const h = Math.sin(Math.min(1, q * 1.4) * Math.PI) * 13; g.fillStyle = `rgba(255,255,255,${(0.9 * a).toFixed(3)})`;
            for (const d of [-3, 0, 3]) { g.beginPath(); g.ellipse(f.x + d * (1 + q), f.y - h * (d ? 0.7 : 1), 1.6, 2.4 + h / 5, 0, 0, Math.PI * 2); g.fill(); }
            g.beginPath(); g.ellipse(f.x, f.y + 2, 4 + q * 9, 1.5 + q * 2, 0, 0, Math.PI * 2); g.strokeStyle = `rgba(255,255,255,${(0.7 * a).toFixed(3)})`; g.lineWidth = 1.2; g.stroke(); }
          else if (f.kind === 'sink') { g.save(); g.beginPath(); g.rect(f.x - 40, f.y - 60, 80, 66); g.clip(); g.globalAlpha = Math.max(0, 1 - q * 1.1); g.translate(f.x, f.y + q * 26); g.rotate((f.side === 'foe' ? -1 : 1) * q * 0.5);
            drawShip(g, 0, -2, 2.1, LOOK[f.side], f.flag, f.side === 'foe' ? -1 : 1, f.type, f.skin); g.restore();
            for (let i = 0; i < 5; i++) { const bq = (age / 8 + i * 0.37) % 1; g.beginPath(); g.arc(f.x - 12 + i * 6, f.y + 6 - bq * 18, 1.4 + bq, 0, Math.PI * 2); g.strokeStyle = `rgba(255,255,255,${(0.8 * a).toFixed(3)})`; g.lineWidth = 1; g.stroke(); }
            g.beginPath(); g.ellipse(f.x, f.y + 6, 10 + q * 22, 2 + q * 4, 0, 0, Math.PI * 2); g.strokeStyle = `rgba(255,255,255,${(0.6 * a).toFixed(3)})`; g.lineWidth = 1.5; g.stroke(); }
          else if (f.kind === 'taken') { g.globalAlpha = Math.max(0, 1 - q); drawShip(g, f.x, f.y - 2, 2.1, LOOK[f.side], false, f.side === 'foe' ? -1 : 1, f.type, f.skin); g.globalAlpha = Math.max(0, 1 - q * 0.6);
            const fy = f.y - 34 - Math.min(1, q * 3) * 8; g.fillStyle = INK; g.fillRect(f.x - 1, fy, 1.6, 16); g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.rect(f.x + 0.6, fy, 10, 7); g.fill(); g.stroke(); g.globalAlpha = 1; }
          continue;
        }
        if (f.kind === 'smoke') for (let i = 0; i < 4; i++) { const r = 4 + q * (10 + i * 3), x = f.x + f.dir * (10 + i * 5 + q * 14), y = f.y - 8 - i * 2 - q * 8;
          g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = `rgba(236,232,224,${(0.75 * a * (1 - i * 0.15)).toFixed(3)})`; g.fill(); }
        else if (f.kind === 'ball' && age <= 14) { const k = age / 14, x = f.a.x + (f.b.x - f.a.x) * k, y = f.a.y + (f.b.y - f.a.y) * k - Math.sin(k * Math.PI) * 18 - 6;
          if (age < 3) { g.beginPath(); g.arc(f.a.x + Math.sign(f.b.x - f.a.x) * 12, f.a.y - 8, 6 - age * 1.5, 0, Math.PI * 2); g.fillStyle = '#ffd34d'; g.fill(); }
          g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fillStyle = INK; g.fill(); }
        else if (f.kind === 'boom') { const r = f.size * (0.4 + q * 1.1);
          g.beginPath(); g.arc(f.x, f.y, r, 0, Math.PI * 2); g.fillStyle = `rgba(255,${Math.round(200 - q * 140)},60,${(0.85 * a).toFixed(3)})`; g.fill();
          g.beginPath(); g.arc(f.x, f.y, r * 0.55, 0, Math.PI * 2); g.fillStyle = `rgba(255,246,200,${(0.9 * a).toFixed(3)})`; g.fill();
          for (let i = 0; i < 7; i++) { const an = i * 0.9 + 0.4, d = 4 + q * (16 + (i % 3) * 5); g.fillStyle = `rgba(107,74,47,${a.toFixed(3)})`; g.fillRect(f.x + Math.cos(an) * d - 1.2, f.y + Math.sin(an) * d * 0.7 + q * q * 10 - 1.2, 2.4, 2.4); } }
        else if (f.kind === 'grapple') { g.beginPath(); for (const o of [-6, 0, 6]) { g.moveTo(f.a.x, f.a.y - 10 + o / 2); g.quadraticCurveTo((f.a.x + f.b.x) / 2, (f.a.y + f.b.y) / 2 - 18 + o, f.b.x, f.b.y - 10 - o / 2); }
          g.strokeStyle = `rgba(80,58,36,${(0.9 * a).toFixed(3)})`; g.lineWidth = 1.3; g.stroke(); }
        else if (f.kind === 'spark') for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + age * 0.3, d = 3 + (age % 9) * 1.6;
          g.beginPath(); g.moveTo(f.x + Math.cos(an) * d * 0.4, f.y + Math.sin(an) * d * 0.4); g.lineTo(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d); g.strokeStyle = i % 2 ? `rgba(242,183,5,${a.toFixed(3)})` : `rgba(255,255,255,${a.toFixed(3)})`; g.lineWidth = 1.8; g.stroke(); }
      }
    }
    drawCard(g) {
      const W = this.engine.width, H = this.engine.height, r = this.res, b = this.b, won = r.winner === 'me', w = 320, h = (r.duel ? 156 : 134)+(won?22:0), x = (W - w) / 2, y = (H - h) / 2;
      g.fillStyle = 'rgba(38,33,28,.45)'; g.fillRect(0, 0, W, H);
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = won ? ACCENT : '#8d8477'; g.fillRect(x + 1, y + 1, w - 2, 6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
      g.font = `800 22px ${FONT}`; g.fillText(this.title(), W / 2, y + 36);
      g.font = `600 13px ${FONT}`; g.fillText(r.reason, W / 2, y + 66, w - 24);
      g.font = `500 12px ${FONT}`; g.fillStyle = '#6e6356'; let yy = y + 88;
      if (r.duel) { g.fillText(`일기토 ${r.duel.rounds.length}합 · ${r.duel.a.name} 기력 ${r.duel.a.hp} · ${r.duel.b.name} 기력 ${r.duel.b.hp}`, W / 2, yy, w - 24); yy += 22; }
      g.fillText(`남은 선원 · 우리 ${b.crewOf('me')}명 · 적 ${b.crewOf('foe')}명` + (r.loot ? ` · 금 +${fmt(r.loot)}` : ''), W / 2, yy, w - 24);
      if(won){yy+=22;g.fillStyle='#865d19';g.font=`700 12px ${FONT}`;g.fillText(`식량·물 각 +${this.supplyDays}일분 · 보급 상한까지`,W/2,yy,w-24);g.fillStyle='#6e6356';g.font=`500 12px ${FONT}`;}
      g.fillText('여기를 찍거나 ‘바다로 돌아가기’를 누른다', W / 2, yy + 22);
    }
    save() { return { turn: this.b.turn, side: this.b.side }; }
  }


  /* 항구 깃발: 오늘날 그 땅의 나라 깃발을 9×6 칸 크기로 줄였다(1522년의 나라가 아니다). 별 · 문장 · 글자는 점이나 줄로 바꾸었다.
   * k: 크기 배율(지도 확대에 맞춘다) · hot: 고른 항구(노란 테). 모르는 코드는 붉은 네모다. */
  const FLAGS = {
    PT: f => { f.v(['#046a38', '#da291c'], [2, 3]); f.dot(0.4, 0.5, 0.17, '#ffe900'); },
    ES: f => f.h(['#aa151b', '#f1bf00', '#aa151b'], [1, 2, 1]),
    GB: f => { f.fill('#012169'); f.cross(0.5, 0.5, 0.3, '#fff'); f.cross(0.5, 0.5, 0.16, '#c8102e'); },
    NL: f => f.h(['#ae1c28', '#fff', '#21468b']),
    IT: f => f.v(['#009246', '#fff', '#ce2b37']),
    TR: f => { f.fill('#e30a17'); f.dot(0.4, 0.5, 0.28, '#fff'); f.dot(0.46, 0.5, 0.22, '#e30a17'); f.dot(0.64, 0.5, 0.08, '#fff'); },
    EG: f => { f.h(['#ce1126', '#fff', '#000']); f.dot(0.5, 0.5, 0.1, '#c09300'); },
    GH: f => { f.h(['#ce1126', '#fcd116', '#006b3f']); f.dot(0.5, 0.5, 0.11, '#000'); },
    MZ: f => { f.h(['#007168', '#fff', '#000', '#fff', '#fce100'], [4, 1, 4, 1, 4]); f.tri('#d21034', 0.45); },
    KE: f => f.h(['#000', '#fff', '#bb0000', '#fff', '#006600'], [4, 1, 4, 1, 4]),
    YE: f => f.h(['#ce1126', '#fff', '#000']),
    IR: f => { f.h(['#239f40', '#fff', '#da0000']); f.dot(0.5, 0.5, 0.09, '#da0000'); },
    IN: f => { f.h(['#ff9933', '#fff', '#138808']); f.dot(0.5, 0.5, 0.1, '#000080'); },
    MY: f => { f.h(['#cc0001', '#fff', '#cc0001', '#fff', '#cc0001', '#fff', '#cc0001']); f.box(0, 0, 0.5, 4 / 7, '#010066'); f.dot(0.25, 2 / 7, 0.12, '#fc0'); },
    CN: f => { f.fill('#ee1c25'); f.dot(0.2, 0.3, 0.13, '#ffff00'); f.dot(0.38, 0.14, 0.05, '#ffff00'); f.dot(0.42, 0.34, 0.05, '#ffff00'); },
    HK: f => { f.fill('#de2910'); f.dot(0.5, 0.5, 0.22, '#fff'); f.dot(0.5, 0.5, 0.07, '#de2910'); },
    JP: f => { f.fill('#fff'); f.dot(0.5, 0.5, 0.3, '#bc002d'); },
    KR: f => { f.fill('#fff'); f.half(0.5, 0.5, 0.26, '#cd2e3a', '#0047a0'); for (const [a, b] of [[0.14, 0.2], [0.86, 0.2], [0.14, 0.8], [0.86, 0.8]]) f.box(a - 0.06, b - 0.1, 0.12, 0.2, '#000'); },
    DO: f => { f.box(0, 0, 0.5, 0.5, '#002d62'); f.box(0.5, 0, 0.5, 0.5, '#ce1126'); f.box(0, 0.5, 0.5, 0.5, '#ce1126'); f.box(0.5, 0.5, 0.5, 0.5, '#002d62'); f.cross(0.5, 0.5, 0.18, '#fff'); },
    MX: f => { f.v(['#006847', '#fff', '#ce1126']); f.dot(0.5, 0.5, 0.1, '#8c5a2b'); },
    LK: f => { f.fill('#ffbe29'); f.box(0.06, 0.1, 0.12, 0.8, '#00534e'); f.box(0.18, 0.1, 0.12, 0.8, '#eb7400'); f.box(0.36, 0.1, 0.58, 0.8, '#8d153a'); f.dot(0.65, 0.5, 0.12, '#ffbe29'); },
    GR: f => { f.h(['#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf']); f.box(0, 0, 0.4, 5 / 9, '#0d5eaf'); f.cross(0.2, 2.5 / 9, 0.11, '#fff', 0.4, 5 / 9); },
    NO: f => { f.fill('#ba0c2f'); f.cross(0.36, 0.5, 0.28, '#fff'); f.cross(0.36, 0.5, 0.14, '#00205b'); },
    DK: f => { f.fill('#c8102e'); f.cross(0.36, 0.5, 0.2, '#fff'); },
    DE: f => f.h(['#000', '#dd0000', '#ffce00']),
    LY: f => { f.h(['#e70013', '#000', '#239e46'], [1, 2, 1]); f.dot(0.47, 0.5, 0.17, '#fff'); f.dot(0.52, 0.5, 0.14, '#000'); },
    ID: f => f.h(['#ce1126', '#fff']),
    FR: f => f.v(['#002654', '#fff', '#ce1126']),
    BR: f => { f.fill('#009c3b'); f.diamond('#ffdf00'); f.dot(0.5, 0.5, 0.2, '#002776'); },
    PH: f => { f.h(['#0038a8', '#ce1126']); f.tri('#fff', 0.45); f.dot(0.15, 0.5, 0.09, '#fcd116'); },
    ZA: f => { f.h(['#e03c31', '#fff', '#007749', '#fff', '#001489'], [2, 0.6, 1.6, 0.6, 2]); f.tri('#007749', 0.52); f.tri('#ffb612', 0.36); f.tri('#000', 0.3); },
    SA: f => { f.fill('#006c35'); f.box(0.22, 0.62, 0.56, 0.08, '#fff'); f.box(0.24, 0.3, 0.52, 0.18, 'rgba(255,255,255,.75)'); },
    GT: f => { f.v(['#4997d0', '#fff', '#4997d0']); f.dot(0.5, 0.5, 0.1, '#3a7a3a'); }
  };
  function drawFlag(g, code, x, y, k = 1, hot = false) {
    const W = 13.5 * k, H = 9 * k, x0 = x - W / 2, y0 = y - H / 2, R = 4.5 * k;
    const f = {
      fill: c => { g.fillStyle = c; g.fillRect(x0, y0, W, H); },
      box: (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x0 + a * W, y0 + b * H, w * W, h * H); },
      h: (cs, ws) => { ws = ws || cs.map(() => 1); const t = ws.reduce((a, b) => a + b, 0); let yy = 0; cs.forEach((c, i) => { g.fillStyle = c; g.fillRect(x0, y0 + yy / t * H, W, ws[i] / t * H + 0.02); yy += ws[i]; }); },
      v: (cs, ws) => { ws = ws || cs.map(() => 1); const t = ws.reduce((a, b) => a + b, 0); let xx = 0; cs.forEach((c, i) => { g.fillStyle = c; g.fillRect(x0 + xx / t * W, y0, ws[i] / t * W + 0.02, H); xx += ws[i]; }); },
      dot: (a, b, r, c) => { g.beginPath(); g.arc(x0 + a * W, y0 + b * H, r * H, 0, Math.PI * 2); g.fillStyle = c; g.fill(); },
      half: (a, b, r, top, bot) => { const cx = x0 + a * W, cy = y0 + b * H, R = r * H; g.beginPath(); g.arc(cx, cy, R, Math.PI, 0); g.fillStyle = top; g.fill(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI); g.fillStyle = bot; g.fill(); },
      cross: (a, b, t, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x0, y0 + (b - t / 2) * H, w * W, t * H); g.fillRect(x0 + a * W - t * H / 2, y0, t * H, h * H); },
      tri: (c, d) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + d * W, y0 + H / 2); g.lineTo(x0, y0 + H); g.closePath(); g.fillStyle = c; g.fill(); },
      diamond: c => { g.beginPath(); g.moveTo(x0 + W * 0.5, y0 + H * 0.1); g.lineTo(x0 + W * 0.92, y0 + H / 2); g.lineTo(x0 + W * 0.5, y0 + H * 0.9); g.lineTo(x0 + W * 0.08, y0 + H / 2); g.closePath(); g.fillStyle = c; g.fill(); }
    };
    g.beginPath(); g.ellipse(x, y + 1.1*k, R + .8*k, R + .4*k, 0, 0, Math.PI*2); g.fillStyle='rgba(49,58,57,.18)'; g.fill();
    g.save(); g.beginPath(); g.arc(x, y, R, 0, Math.PI*2); g.clip();
    (FLAGS[code] || (q => q.fill('#c8402f')))(f); g.restore();
    g.beginPath(); g.arc(x,y,R+.7*k,0,Math.PI*2); g.lineWidth=hot?2*k:1.1*k; g.strokeStyle=hot?ACCENT:'#fbf7ef'; g.stroke();
    g.beginPath();g.arc(x,y,R,0,Math.PI*2);g.lineWidth=.55*k;g.strokeStyle=INK;g.stroke();
    g.beginPath();g.arc(x,y,R-1*k,Math.PI*1.12,Math.PI*1.65);g.lineWidth=.7*k;g.strokeStyle='rgba(255,255,255,.65)';g.stroke();
  }

  DH.Hang = Object.assign(DH.Hang || {}, { HangBattleScene, drawShip, drawFlag, drawCivilShip, PIRATE_NAMES, FLAGS, LOOK });
})(typeof globalThis !== 'undefined' ? globalThis : this);

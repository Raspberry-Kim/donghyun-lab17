// 동현항 핵심 시험(공통 엔진 · 자료 · 규칙 · 동현랭). 브라우저 없이 node로 돈다: node qa/core-tests.cjs
const assert = require('assert'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
for (const f of ['src/engine/dh-core.js', 'src/engine/dh-loop.js', 'src/engine/dh-clock.js', 'src/engine/dh-grid.js', 'src/engine/dh-tilemap.js', 'src/engine/dh-layout.js', 'src/engine/dh-engine.js', 'src/engine/dh-lang.js', 'src/hang/hang-parser.js', 'src/hang/hang-rules.js', 'src/hang/hang-battle.js', 'src/hang/hang-lang.js', 'src/hang/hang-battle-scene.js', 'src/hang/hang-scene.js']) require(path.join(root, f));
const DH = globalThis.DH;
const hangJ = () => JSON.parse(fs.readFileSync(path.join(root, 'src/hang/donghyun_hang_data.json'), 'utf8'));
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok ' + name); };
const bad = (fn, re) => assert.throws(fn, e => e instanceof DH.DataError && re.test(e.message), '잡아야 할 오류를 놓쳤다 ' + re);

ok('난수: 같은 씨앗 같은 수 · 상태를 되돌리면 이어서 같다', () => {
  const a = new DH.RNG(7), b = new DH.RNG(7); for (let i = 0; i < 50; i++) assert.strictEqual(a.next(), b.next());
  const st = a.state, x = a.next(); a.state = st; assert.strictEqual(a.next(), x); assert.notStrictEqual(new DH.RNG(8).next(), new DH.RNG(7).next());
});
ok('루프: step(n)은 틱 n번 · 그리기 한 번', () => {
  let u = 0, r = 0; const l = new DH.Loop({ update: () => u++, render: () => r++ }); l.step(60); assert.deepStrictEqual([u, r, l.tick], [60, 1, 60]);
});
ok('루프: 밀린 시간은 한 프레임에 5틱까지만 따라잡는다', () => {
  let u = 0, cb; globalThis.requestAnimationFrame = f => { cb = f; return 1; }; globalThis.cancelAnimationFrame = () => {};
  const l = new DH.Loop({ update: () => u++, render: () => {} }); l.start(); cb(1000); cb(1000 + 1000 / 60 * 3 + 1); assert.strictEqual(u, 3); cb(9000); assert.strictEqual(u, 8); cb(9000 + 17); assert.strictEqual(u, 9); l.stop();
});
ok('달력(턴): 차례 셋이 돌면 한 달 · 12월 다음은 새해', () => {
  const ev = []; const c = new DH.Clock({ unit: 'month', start: { year: 200, month: 11 }, actors: ['a', 'b', 'c'] }); c.bus.on('clock:turn', e => ev.push('t' + e.turn)); c.bus.on('clock:year', e => ev.push('y' + e.year));
  assert.strictEqual(c.endPhase(), 'b'); assert.strictEqual(c.endPhase(), 'c'); assert.strictEqual(c.label, '200년 11월'); assert.strictEqual(c.endPhase(), 'a'); assert.strictEqual(c.label, '200년 12월');
  for (let i = 0; i < 3; i++) c.endPhase(); assert.strictEqual(c.label, '201년 1월'); assert.deepStrictEqual(ev, ['t2', 'y201', 't3']);
  c.update(); assert.strictEqual(c.serial, 2, '턴제는 저절로 흐르지 않는다');
});
ok('달력(일): 20틱에 하루 · 멈추면 안 간다 · 배속 · 달 길이와 윤년', () => {
  const c = new DH.Clock({ unit: 'day', start: { year: 1522, month: 5, day: 30 }, ticksPerUnit: 20 }); for (let i = 0; i < 100; i++) c.update(); assert.strictEqual(c.label, '1522년 5월 30일');
  c.running = true; for (let i = 0; i < 20; i++) c.update(); assert.strictEqual(c.label, '1522년 5월 31일'); for (let i = 0; i < 20; i++) c.update(); assert.strictEqual(c.label, '1522년 6월 1일');
  c.speed = 4; for (let i = 0; i < 20; i++) c.update(); assert.strictEqual(c.label, '1522년 6월 5일');
  assert.strictEqual(DH.Clock.daysIn(1524, 2), 29); assert.strictEqual(DH.Clock.daysIn(1522, 2), 28);
  const s = JSON.parse(JSON.stringify(c)), d = new DH.Clock({ unit: 'day', ticksPerUnit: 20 }); d.load(s); assert.strictEqual(d.label, c.label);
});
ok('사각 격자: 칸↔픽셀 · 이웃 4·8 · 동서 이어짐 · 거리', () => {
  const g = new DH.SquareGrid(10, 6, 8), w = new DH.SquareGrid(10, 6, 8, { wrapX: true, diagonal: true });
  assert.deepStrictEqual(g.fromPixel(...Object.values(g.center(3, 4))), { c: 3, r: 4 }); assert.strictEqual(g.fromPixel(-1, 0), null); assert.strictEqual(g.neighbors(0, 0).length, 2);
  assert.strictEqual(w.neighbors(0, 0).length, 5); assert.ok(w.neighbors(0, 0).some(([c, r]) => c === 9 && r === 1)); assert.strictEqual(w.distance(0, 0, 9, 0), 1); assert.strictEqual(g.distance(0, 0, 9, 0), 9);
  assert.deepStrictEqual(w.fromPixel(-4, 4), { c: 9, r: 0 }); assert.strictEqual(w.nearX(4, 84), 84);
});
ok('육각 격자: 모든 칸의 가운데 ↔ 칸 · 이웃 6 · 이웃끼리 거리 1 · 이웃 가운데 사이가 칸 폭', () => {
  const g = new DH.HexGrid(9, 8, 10);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) { const p = g.center(c, r); assert.deepStrictEqual(g.fromPixel(p.x, p.y), { c, r }); assert.deepStrictEqual(g.fromPixel(p.x + 3, p.y - 3), { c, r }); }
  for (const [c, r] of [[4, 3], [4, 4]]) { const nb = g.neighbors(c, r); assert.strictEqual(nb.length, 6); const p = g.center(c, r);
    for (const [nc, nr] of nb) { assert.strictEqual(g.distance(c, r, nc, nr), 1); const q = g.center(nc, nr); assert.ok(Math.abs(Math.hypot(p.x - q.x, p.y - q.y) - g.w) < 1e-9); assert.ok(g.neighbors(nc, nr).some(([a, b]) => a === c && b === r)); } }
  assert.strictEqual(g.distance(0, 0, 8, 7), 12); assert.strictEqual(g.neighbors(0, 0).length, 2);
});
ok('길 찾기: 사각·육각 같은 함수 · 벽을 돌아간다 · 막히면 null · 동서 이어진 길이 짧으면 그쪽', () => {
  const g = new DH.SquareGrid(7, 5, 1), wall = (c, r) => !(c === 3 && r < 4);
  const p = DH.findPath(g, [0, 0], [6, 0], wall); assert.strictEqual(p.length, 14); assert.deepStrictEqual(p[p.length - 1], [6, 0]); assert.ok(p.every(([c, r]) => wall(c, r)));
  assert.strictEqual(DH.findPath(g, [0, 0], [6, 0], (c) => c !== 3), null);
  const w = new DH.SquareGrid(20, 3, 1, { wrapX: true, diagonal: true }); assert.strictEqual(DH.findPath(w, [1, 1], [18, 1], () => true).length, 3);
  const h = new DH.HexGrid(8, 8, 1); assert.strictEqual(DH.findPath(h, [0, 0], [7, 7], () => true).length, h.distance(0, 0, 7, 7));
});
ok('길 찾기: 대각으로 놓인 벽 사이를 빠져나가지 않는다 · 같은 칸 수면 덜 꺾이는 길', () => {
  const g = new DH.SquareGrid(6, 6, 1, { diagonal: true }), diag = (c, r) => c !== r;                 // (0,0)…(5,5)가 벽: 대각선 한 줄
  assert.strictEqual(DH.findPath(g, [3, 1], [1, 3], diag), null, '대각 벽을 넘었다');
  assert.strictEqual(g.squeezed(2, 1, 1, 2, diag), true); assert.strictEqual(g.squeezed(2, 1, 1, 2, (c, r) => !(c === 1 && r === 1)), false, '한쪽만 막혔으면 간다');
  const gap = (c, r) => c !== r || c === 5, pg = DH.findPath(g, [3, 1], [1, 3], gap).map(String); assert.ok(pg.length === 7 && pg.includes('5,4') && pg.includes('4,5'), '벽 끝이 열렸으면 그 모서리로 돈다 ' + pg.join(' '));
  const w = new DH.SquareGrid(10, 4, 1, { wrapX: true, diagonal: true }), seam = (c, r) => !((c === 0 && r === 1) || (c === 9 && r === 2));
  assert.strictEqual(w.squeezed(9, 1, 0, 2, seam), true, '동서 이음매에서도 같다');
  const o = new DH.SquareGrid(20, 9, 1, { diagonal: true }), p = DH.findPath(o, [0, 4], [16, 6], () => true); assert.strictEqual(p.length, 16);
  assert.ok(p.every(([, r]) => r >= 4 && r <= 6), '위아래로 헛돌지 않는다'); assert.strictEqual(p.filter(([c, r], i) => r !== (i ? p[i - 1][1] : 4)).length, 2, '대각 걸음은 꼭 필요한 두 번');
});
ok('타일 렌더러: 화면에 걸친 칸만 · 사각은 같은 타일을 줄마다 합쳐 그린다 · 육각은 칸마다', () => {
  const calls = { rect: 0, moveTo: 0, fill: 0 }; const g = new Proxy({}, { get: (t, k) => (k in calls ? () => calls[k]++ : () => {}), set: () => true });
  const sq = new DH.SquareGrid(100, 100, 4), cam = new DH.Camera(40, 40), R = new DH.TileMapRenderer({ grid: sq, tileAt: (c) => (c < 5 ? 'a' : 'b'), styles: { a: { fill: '#000' }, b: { fill: '#fff' } } });
  R.render(g, cam); assert.strictEqual(R.drawn, 121); assert.strictEqual(calls.rect, 22); assert.strictEqual(calls.fill, 2);
  const hx = new DH.HexGrid(50, 50, 5), H = new DH.TileMapRenderer({ grid: hx, tileAt: () => 'a', styles: { a: { fill: '#000' } } }); H.render(g, cam); assert.ok(H.drawn > 20 && H.drawn < 80 && calls.moveTo === H.drawn);
  cam.zoomAt(2, 20, 20); assert.deepStrictEqual([cam.zoom, cam.x, cam.y], [2, 10, 10]); cam.x = -50; cam.clampTo(sq); assert.strictEqual(cam.x, 0);
});
ok('엔진: 캔버스 없이 논리만 · 맨 위 장면만 틱 · 장면 쌓기·내리기 · 저장 묶음', () => {
  const log = []; class S extends DH.Scene { constructor(e, n) { super(e); this.n = n; } enter() { log.push('in' + this.n); } exit() { log.push('out' + this.n); } update() { log.push('u' + this.n); } save() { return { n: this.n }; } }
  const e = new DH.Engine({ seed: 3, clock: { unit: 'day', ticksPerUnit: 2, start: { year: 1522, month: 5, day: 1 } } }); e.clock.running = true; const days = []; e.on('clock:day', d => days.push(d.day));
  e.setScene(new S(e, 1)); e.step(4); e.pushScene(new S(e, 2)); e.step(1); e.popScene(); e.step(1);
  assert.deepStrictEqual(log, ['in1', 'u1', 'u1', 'u1', 'u1', 'in2', 'u2', 'out2', 'u1']); assert.deepStrictEqual(days, [2, 3, 4]);
  const s = e.snapshot(); assert.deepStrictEqual([s.tick, s.clock.day, s.scene.n, s.rng], [6, 4, 1, 3]);
});
ok('이동 범위: 지형 값만큼 깎인다 · 못 가는 칸 · 출발 칸 포함 · 온 길을 거슬러 갈 수 있다', () => {
  const g = new DH.HexGrid(10, 10, 1), cost = (c, r) => (c === 3 ? 3 : c === 5 ? 4 : c === 7 ? Infinity : 1), m = DH.moveRange(g, [1, 4], 5, cost);
  assert.strictEqual(m.get('1,4').cost, 0); assert.strictEqual(m.get('2,4').cost, 1); assert.strictEqual(m.get('3,4').cost, 4); assert.strictEqual(m.get('4,4').cost, 5); assert.ok(!m.has('5,4') && !m.has('7,4'));
  for (const v of m.values()) assert.ok(v.cost <= 5); let k = '4,4', n = 0; while (m.get(k).from) { k = m.get(k).from; n++; } assert.deepStrictEqual([k, n], ['1,4', 3]);
  assert.strictEqual(DH.moveRange(g, [1, 4], 0, cost).size, 1); assert.strictEqual(DH.moveRange(g, [4, 4], 3, () => 1).size, 37, '평지에서 3걸음 안은 37칸');
});
ok('동현항 자료: 항구 45 · 교역품 36(갈래 8) · 깃발 · 정박 칸 뱃길 · 탐험대 짐·선원', () => {
  const w = DH.Hang.parse(hangJ(), { ports: 45 }); assert.strictEqual(w.ports.size, 45); assert.strictEqual(w.goods.size, 36); assert.strictEqual(Object.keys(w.kinds).length, 8);
  assert.ok([...w.goods.values()].every(g => g.kind in w.kinds)); assert.ok([...w.goods.values()].every(g => [...w.ports.values()].some(p => p.market.find(e => e.good === g.id).stock > 0)), '산지 없는 교역품');
  for (const p of w.ports.values()) { assert.strictEqual(p.market.length, 36); assert.match(p.flag, /^[A-Z]{2}$/); assert.ok(Math.abs(p.x - 179.5 - p.lon) <= 2.5 && Math.abs(71.5 - p.y - p.lat) <= 1.5, p.name + ' 실제 위치에서 너무 멀다'); }
  const f = w.fleets.get('player'); assert.strictEqual(w.portAt(f.x, f.y).id, 'lisbon'); assert.deepStrictEqual([w.cargoUsed(f), w.cargoCap(f)], [60, 200]);
  const g = new DH.SquareGrid(w.map.cols, w.map.rows, 1, { wrapX: true, diagonal: true }), a = w.ports.get('lisbon').anchor;
  for (const id of ['seville', 'venice', 'istanbul', 'hakata', 'veracruz', 'mecca', 'copenhagen', 'oslo', 'ternate', 'guatemala']) { const p = DH.findPath(g, a, w.ports.get(id).anchor, w.map.isSea); assert.ok(p && p.length > 0 && p.every(([c, r]) => w.map.isSea(c, r)), id); }
  const wine = id => w.ports.get(id).market.find(e => e.good === 'wine'); assert.ok(wine('lisbon').price < wine('london').price && wine('london').price < wine('hakata').price && wine('lisbon').stock > 0 && wine('hakata').stock === 0);
});
ok('동현항 뱃길: 마흔다섯 항구 990쌍 모두 바다로만 · 지협과 반도를 뚫지 않는다', () => {
  const w = DH.Hang.parse(hangJ()), m = w.map, g = new DH.SquareGrid(m.cols, m.rows, 1, { wrapX: true, diagonal: true }), L = [...w.ports.values()], len = {};
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const p = DH.findPath(g, L[i].anchor, L[j].anchor, m.isSea); assert.ok(p && p.length, L[i].name + '→' + L[j].name); len[L[i].id + '>' + L[j].id] = p.length;
    let prev = L[i].anchor; for (const q of p) { assert.ok(m.isSea(q[0], q[1])); assert.ok(!g.squeezed(prev[0], prev[1], q[0], q[1], m.isSea), `${L[i].name}→${L[j].name} 땅 사이로 빠졌다 ${prev}→${q}`); prev = q; }
  }
  assert.ok(len['alexandria>aden'] > 150, '수에즈가 뚫렸다 ' + len['alexandria>aden']);               // 운하가 없던 때: 아프리카를 돈다
  assert.ok(len['hakata>veracruz'] > 200, '파나마가 뚫렸다 ' + len['hakata>veracruz']);                // 태평양을 곧장 건너면 170칸 남짓
  assert.ok(len['goa>malacca'] + len['malacca>canton'] - len['goa>canton'] <= 2, '말라카 해협이 막혔다');   // 인도에서 중국 가는 길목에 말라카가 있다
  assert.ok(len['lisbon>istanbul'] < 50 && len['london>amsterdam'] < 12, '지브롤터·보스포루스·도버');
  assert.ok(len['aden>mecca'] < 20, '바브엘만데브가 막혔다 ' + len['aden>mecca']); assert.ok(len['hamburg>copenhagen'] < 20, '카테가트 ' + len['hamburg>copenhagen']);
});
ok('동현항 파서: 틀린 자료 열두 가지를 잡는다', () => {
  const P = (f, re) => { const j = hangJ(); f(j); bad(() => DH.Hang.parse(j), re); };
  P(j => { j.format = 'x'; }, /format/); bad(() => { const j = hangJ(); j.ports.pop(); DH.Hang.parse(j, { ports: 45 }); }, /길이 45/);
  P(j => { j.ports[0].x = j.ports[0].anchor[0]; j.ports[0].y = j.ports[0].anchor[1]; }, /육지가 아니다/); P(j => { j.ports[0].anchor = [j.ports[0].x + 3, j.ports[0].y]; }, /바로 옆이 아니다|바다가 아니다/);
  P(j => { j.ports[1].market.pop(); }, /pimiento 시세가 빠졌다/); P(j => { j.ports[1].facilities.push('casino'); }, /시설 casino/);
  P(j => { j.fleets[0].crew = 99; }, /선원 99명/); P(j => { j.fleets[0].ships[0].hold[0].qty = 500; }, /적재량 200을 넘는다/);
  P(j => { j.ports[2].flag = 'gb'; }, /대문자 두 글자/); P(j => { j.goods[3].kind = 'toy'; }, /갈래 toy/); P(j => { j.rivals[3].areas = [[10, 0, 5, 9]]; }, /서경, 남위/);
  P(j => { const r = j.map.rle; const p = j.ports.find(q => q.id === 'venice'); j.map.rle = r.map((s, i) => s); const [ax, ay] = p.anchor;   // 베네치아 정박 칸 둘레를 육지로 막는다
    const dec = DH.Data.rleDecode(r, 360).map(s => s.split('')); for (let y = ay - 1; y <= ay + 1; y++) for (let x = ax - 1; x <= ax + 1; x++) if (!(x === ax && y === ay)) dec[y][x] = '#'; j.map.rle = dec.map(s => s.join('')); }, /뱃길이 닿지 않는다/);
});
// ───────── 동현랭 연동 ─────────
const A = DH.DonghyunLangAdapter, DL = require(path.join(root, 'src/lang/donghyun.js')), HEAD = '나는 동현이냐?\n', TAIL = '\n동현이구나';
const put = (...ns) => HEAD + ns.map(v => A.print(v)).join('\n') + TAIL;
ok('동현랭 실행기: 시리즈와 같은 파일(1.55) · 정수 출력 · 틀린 코드는 문장 번호와 함께 던진다', () => {
  const crypto = require('crypto'); assert.strictEqual(crypto.createHash('md5').update(fs.readFileSync(path.join(root, 'src/lang/donghyun.js'))).digest('hex'), '5dab512e9f35820e567c0e384739b138');
  assert.strictEqual(DL.run(put(3, 3000), {}).output, '3\n3000\n'); assert.strictEqual(DL.run(HEAD + '뿡뿡 도오오옹 도오오옹ㅠ~뿡뿡뿡' + TAIL, {}).output, '6\n', '도오오옹은 3 · 공백은 곱하기 · 붙이면 더하기 · ㅠ는 −1 → 3 × (3 − 1)');
  assert.throws(() => DL.run('뿡뿡 도옹', {}), e => e.name === 'DonghyunError');
});
ok('어댑터: 수를 식 하나 또는 자릿수 쌓기로 적는다(−200~5000과 큰 수를 다시 읽어 같은 값)', () => {
  const t = new A({ name: '시험', commands: { 1: { key: 'v', label: '값', min: -1e15, max: 1e15, path: 'v' } } });
  for (const v of [...Array.from({ length: 5201 }, (_, i) => i - 200), 123457, 2147483646, -2147483646, 999999999989]) { const r = t.parse(t.compose([[1, v]])); assert.ok(r.ok && r.values.v === v, '값 ' + v + ' ' + r.errors); }
  assert.strictEqual(A.expression(0), '도옹ㅠ'); const ten = '도' + '오'.repeat(9) + '옹'; assert.strictEqual(A.expression(3000), ['도오오옹', ten, ten, ten].join(' ')); assert.strictEqual(A.expression(997), null, '큰 소수는 식 하나로 못 적는다');
});
ok('어댑터: 빈 설정은 상태를 건드리지 않는다 · 번호와 값을 읽어 덮어쓴다 · 뒤에 쓴 값이 이긴다 · multi는 쌓인다', () => {
  const t = new A({ name: '시험', commands: { 3: { key: 'gold', label: '금', min: 0, max: 9999, path: 'start.gold' }, 9: { key: 'deep', label: '깊은 곳', min: 1, max: 9, path: 'a.b.c' },
    30: { key: 'off', label: '장수', multi: true, args: [{ label: '번호', min: 1, max: 999 }, { label: '값', min: 1, max: 100 }], set: (st, v) => st.list.push(v), check: ([id]) => (id === 13 ? '13번은 없다' : null) } } });
  const st = { start: { gold: 500 }, list: [] }, same = JSON.stringify(st);
  for (const src of ['', '   \n', null, undefined, HEAD + 'ㅋㅋ 출력 없음' + TAIL]) { const r = t.applyDonghyunLang(src, st); assert.deepStrictEqual([r.ok, r.empty, r.applied], [true, true, []]); assert.strictEqual(JSON.stringify(st), same); }
  const r = t.applyDonghyunLang(put(3, 1000, 30, 7, 90, 3, 2000, 30, 8, 80, 9, 4), st);
  assert.deepStrictEqual([r.ok, r.empty, r.settings.map(x => x.n), r.values], [true, false, [30, 3, 30, 9], { gold: 2000, off: [[7, 90], [8, 80]], deep: 4 }]); assert.deepStrictEqual(st, { start: { gold: 2000 }, list: [[7, 90], [8, 80]], a: { b: { c: 4 } } });
  assert.deepStrictEqual(r.applied, ['장수 7 · 90', '금 2,000', '장수 8 · 80', '깊은 곳 4']); assert.strictEqual(t.parse(put(3, 5)).ok, true, 'parse는 상태 없이도 돈다');
  assert.deepStrictEqual(t.describe(st).map(x => [x.n, x.range, x.now]), [[3, '0~9,999', 2000], [9, '1~9', 4], [30, '번호 1~999 · 값 1~100', undefined]]);
});
ok('어댑터: 오류가 하나라도 있으면 하나도 덮어쓰지 않는다(모르는 번호 · 범위 · 값 모자람 · 글자 출력 · 자료 검사 · 동현랭 오류)', () => {
  const t = new A({ name: '시험', commands: { 3: { key: 'gold', label: '금', min: 0, max: 9999, step: 100, path: 'gold' }, 30: { key: 'off', label: '장수', multi: true, args: [{ label: '번호', min: 1, max: 999 }, { label: '값', min: 1, max: 100 }], set: (st, v) => st.list.push(v), check: ([id]) => (id === 13 ? '13번은 없다' : null) } } });
  const st = { gold: 500, list: [] }, same = JSON.stringify(st);
  const E = (src, re) => { const r = t.applyDonghyunLang(src, st); assert.strictEqual(r.ok, false, src); assert.ok(re.test(r.errors[0]), r.errors[0]); assert.deepStrictEqual(r.applied, []); assert.strictEqual(JSON.stringify(st), same, '상태가 바뀌었다'); };
  E(put(3, 1000, 4, 1), /3번째 정수 4은 시험 설정 번호가 아니다\. 쓸 수 있는 번호: 3 · 30/); E(put(3, 20000), /금 값 20,000은 쓸 수 없다\. 0~9,999, 100 단위만 된다/); E(put(3, 250), /100 단위만/);
  E(put(3, 1000, 30, 7), /설정 30\(장수\) 뒤에 값이 2개 있어야 하는데 1개뿐이다/); E(put(3, 1000, 30, 7, 101), /장수의 값 값 101은 쓸 수 없다\. 1~100만 된다/); E(put(3, 1000, 30, 13, 50), /설정 30\(장수\): 13번은 없다/);
  E(HEAD + '뿡뿡뿡 ' + A.expression(65) + TAIL, /1번째 출력 'A'는 정수가 아니다/); E(put(3) + '', /값이 1개 있어야 하는데 0개뿐/); E(HEAD + A.print(3) + '\n포동이 ' + A.expression(1500) + TAIL, /설정 3\(금\)의 값 '1\.500'는 정수가 아니다/); E('뿡뿡 도옹', /^동현랭 오류/); E(HEAD + '동현아 도옹\n몰라요' + TAIL, /^동현랭 오류 \(3번 문장\)/);
  assert.throws(() => new A({ commands: { 1: { key: 'x', label: 'x', min: 5, max: 1, path: 'x' } } }), /범위/); assert.throws(() => new A({ commands: { 1: { key: 'x', label: 'x', min: 0, max: 1 } } }), /path/);
  const none = new A({ name: '시험', runtime: { run: () => { throw new Error('없다'); } }, commands: {} }); assert.strictEqual(none.parse(put(1)).ok, false);
});
// ───────── 동현항 규칙 ─────────
const H = DH.Hang, hw = () => H.parse(hangJ()), cheatW = () => { const j = hangJ(); j.shipTypes.find(x => x.id === 'turtle').cheat = true; return H.parse(j); }, // cheat 배 규칙은 자료가 정한다(샘플 자료에는 없다)
  V = (o = {}) => new H.Voyage(hw(), { rng: new DH.RNG(3), ...o });
const quiet = () => { const st = H.newState(); st.rules.encounter.percent = 0; return st; };      // 적 함대가 나오지 않는 바다
ok('동현항 globalState: 기본값은 RULES · SEA 그대로 · 설정 없는 탐험은 state가 있든 없든 똑같이 흐른다', () => {
  const st = H.newState(); assert.deepStrictEqual(st.rules, H.RULES); assert.notStrictEqual(st.rules, H.RULES); assert.deepStrictEqual(st.sea, H.SEA);
  assert.deepStrictEqual([st.start, st.stage, st.cargo, st.rivals], [{ seed: null, gold: null, food: null, water: null, crew: null, war: null, ship: null }, { gold: 0, days: 0 }, [], []]);
  const st2 = H.newState(), r = H.applyDonghyunLang(HEAD + 'ㅋㅋ 없음' + TAIL, st2, { world: hw() }); assert.ok(r.ok && r.empty); assert.deepStrictEqual(st2, H.newState());
  const run = o => { const v = V(o), log = []; v.sailTo('hakata'); for (let i = 0; i < 120 && !v.port && !v.over; i++) { const d = v.stepDay(); log.push([v.x, v.y, v.crew, v.food, v.water, d.encounter && d.encounter.id]); if (d.encounter) v.settleBattle(v.openBattle(d.encounter).auto()); } return JSON.stringify([log, v.gold, v.port, v.rng.state]); };
  const a = run({}), b = run({ state: H.newState() }), c = run({ state: st2 }); assert.strictEqual(a, b); assert.strictEqual(a, c); assert.ok(a.includes('redsail') || a.includes('blackreef') || a.includes('storm'), '그 사이 적 함대를 만났다');
  const v = V(); assert.deepStrictEqual([v.gold, v.crew, v.foodDays, v.waterDays, v.port, v.speed, v.cargoUsed, v.cargoCap, v.maxCrew, v.captain, v.rules === H.RULES, v.over], [1000, 28, 90, 60, 'lisbon', 2, 60, 200, 40, { name: '포동이', war: 70 }, true, null]);
});
ok('동현항 교역소: 사면 그 값으로 치르고 값이 한 단 오른다 · 팔면 값이 먼저 내리고 수수료 10% · 재고 · 적재량 · 금', () => {
  const v = V(), q = v.quote('wine'); assert.deepStrictEqual([q.price, q.stock, q.held, q.buy, q.sell], [18, 200, 40, { ok: true, qty: 10, price: 18, cost: 180 }, { ok: true, qty: 10, price: 17, unit: 15, income: 150 }]);
  const b = v.buy('wine'); assert.deepStrictEqual([b.ok, b.cost, b.text, v.gold, v.held('wine'), v.entry('wine').price, v.entry('wine').stock], [true, 180, '포도주 10개를 샀다 · 금 −180 · 값 18 → 19', 820, 50, 19, 190]);
  assert.strictEqual(v.buy('wine').cost, 190); const s = v.sell('wine'); assert.deepStrictEqual([s.income, s.text, v.gold, v.held('wine'), v.entry('wine').price, v.entry('wine').stock], [170, '포도주 10개를 팔았다 · 금 +170 · 값 20 → 19', 800, 50, 19, 190]);
  assert.strictEqual(v.buy('pepper').why, '이 항구에서는 팔지 않는다'); assert.strictEqual(v.sell('pepper').why, '실은 것이 없다');
  v.gold = 1e6; let n = 0; while (v.buy('wine').ok) n++; assert.deepStrictEqual([n, v.cargoUsed, v.buy('wine').why], [13, 200, '배에 실을 자리가 없다']); v.gold = 5; v.cargo.clear(); assert.strictEqual(v.buy('wine').why, '금이 모자란다');
  v.gold = 30; const few = v.buy('olive'); assert.deepStrictEqual([few.qty, few.cost], [2, 28], '금이 닿는 만큼만 산다');
  const sea = V(); sea.leave(); assert.strictEqual(sea.buy('wine').why, '여기서는 거래할 수 없다');
});
ok('동현항 시세: 한 항구에서 사서 바로 팔면 언제나 밑진다(마흔다섯 항구의 파는 물건 예순다섯 가지 모두) · 값의 위아래 끝 · 날이 가면 제자리로', () => {
  const w = hw(); let cnt = 0;
  for (const p of w.ports.values()) for (const e of p.market) if (e.stock > 0) { const v = V(); v.enter(p.id); v.cargo.clear(); v.gold = 100000; for (let i = 0; i < 5; i++) assert.ok(v.buy(e.good).ok); for (let i = 0; i < 5; i++) v.sell(e.good); assert.ok(v.gold < 100000, p.name + ' ' + e.good); assert.strictEqual(v.cargoUsed, 0); cnt++; }
  assert.strictEqual(cnt, 65);
  const v = V({ state: quiet() }); v.cargo.clear(); v.load('wine', 120, 18); for (let i = 0; i < 12; i++) v.sell('wine'); const e = v.entry('wine'); assert.deepStrictEqual([e.price, e.stock, Math.round(18 * 0.3)], [6, 320, 5], '기준값의 30%(5) 아래로는 내려가지 않는다'); for (let i = 0; i < 5; i++) { v.load('wine', 10, 0); v.sell('wine'); } assert.strictEqual(e.price, 5);
  v.steer('left'); for (let i = 0; i < 40; i++) v.stepDay(); assert.deepStrictEqual([e.price, e.stock], [18, 200], '40일 뒤에는 값과 재고가 제자리다');
  const lon = V(); lon.enter('london'); assert.deepStrictEqual([lon.quote('wine').price, lon.quote('wine').sell.unit, lon.quote('wine').sells], [34, 29, false], '리스본 18에 산 포도주는 런던에서 개당 29에 팔린다');
});
ok('동현항 항해: 뱃길(항구 · 바다 칸) · 하루에 2칸 · 하루에 식량과 물이 선원 수만큼 · 입항하면 날이 멎는다 · 뭍으로는 못 간다', () => {
  const v = V({ state: quiet() }); let r = v.sailTo('seville'); assert.deepStrictEqual([r.ok, r.len, r.days, r.text, v.port, v.dest, v.moving], [true, 4, 2, '리스본 → 세비야 · 4칸 · 하루 2칸', null, 'seville', true]);
  let d = v.stepDay(); assert.deepStrictEqual([d.ok, d.from, d.moved, d.events, d.arrived, v.day, v.food, v.water], [true, [170, 33], 2, [], null, 1, 28 * 89, 28 * 59]);
  d = v.stepDay(); assert.deepStrictEqual([d.events, d.arrived, v.port, v.moving, v.day, v.foodDays, v.waterDays, [v.x, v.y]], [['세비야에 닿았다'], 'seville', 'seville', false, 2, 88, 58, hw().ports.get('seville').anchor]);
  assert.deepStrictEqual([v.stepDay().ok, v.day], [false, 2], '항구에서는 날이 가지 않는다');
  assert.strictEqual(v.sailTo('seville').why, '이미 세비야 앞이다'); assert.strictEqual(v.sailTo('nowhere').why, '그런 항구는 없다'); assert.strictEqual(v.sailTo([175, 33]).why, '뭍으로는 갈 수 없다'); assert.strictEqual(v.port, 'seville', '못 가면 닻을 올리지 않는다');
  r = v.sailTo([166, 36]); assert.ok(r.ok && /세비야 → 찍은 바다/.test(r.text)); while (v.moving) d = v.stepDay(); assert.deepStrictEqual([[v.x, v.y], v.port, d.events], [[166, 36], null, ['찍은 바다에 닿아 닻을 내렸다']]);
  r = v.sailTo(hw().ports.get('lisbon').anchor); assert.strictEqual(v.dest, 'lisbon', '정박 칸을 찍으면 그 항구로 간다'); while (v.moving) v.stepDay(); assert.strictEqual(v.port, 'lisbon');
  const far = V({ state: quiet() }); r = far.sailTo('hakata'); assert.deepStrictEqual([r.len, r.days], [191, 96]); let days = 0; while (!far.port && !far.over) { far.stepDay(); days++; } assert.deepStrictEqual([far.port, days, far.over, far.overWhy, far.crew], [null, 77, 'lost', 'crew', 0], '물 60일로 96일 길을 쉬지 않고 가면 77일째에 선원을 모두 잃는다 — 가는 길에 항구에 들러야 한다');
  const hop = V({ state: quiet() }); let total = 0; for (const p of ['elmina', 'sofala', 'goa', 'malacca', 'hakata']) { assert.ok(hop.sailTo(p).ok, p); while (!hop.port && !hop.over) { hop.stepDay(); total++; } assert.strictEqual(hop.port, p); hop.fillWater(); while (hop.can('food').ok) hop.buyFood(); } assert.deepStrictEqual([hop.crew, hop.over], [28, null], '항구마다 물과 식량을 채우면 한 명도 잃지 않고 하카타에 닿는다'); assert.ok(total > 96);
});
ok('동현항 키(방향키): 그쪽으로 하루 2칸씩 · 뭍에 막히면 닻 · 정박 칸에 닿으면 입항 · 지도 끝에서 반대편으로 이어진다', () => {
  const v = V({ state: quiet() }); assert.strictEqual(v.steer('right').why, '그쪽은 뭍이다'); assert.strictEqual(v.steer('x').why, '모르는 방향이다'); assert.strictEqual(v.port, 'lisbon');
  assert.deepStrictEqual(v.steer('left'), { ok: true, text: '키를 서쪽으로 잡았다' }); assert.deepStrictEqual([v.port, v.heading, v.moving], [null, 'left', true]);
  let d = v.stepDay(); assert.deepStrictEqual([[v.x, v.y], d.moved, v.day], [[168, 33], 2, 1]); v.steer('right'); d = v.stepDay(); assert.deepStrictEqual([d.arrived, v.port, d.events], ['lisbon', 'lisbon', ['리스본에 닿았다']]);
  v.steer('left'); v.stepDay(); v.steer('right'); v.stop(); assert.strictEqual(v.moving, false); v.heading = 'right'; v.x = 169; d = v.stepDay(); assert.strictEqual(v.port, 'lisbon', '한 칸 앞이 정박 칸이면 거기서 멎는다');
  const m = hw().map; let y = 0; while (!(m.isSea(0, y) && m.isSea(359, y) && m.isSea(1, y))) y++; const e = V({ state: quiet() }); e.leave(); e.x = 1; e.y = y; e.steer('left'); e.stepDay(); assert.deepStrictEqual([e.x, e.y], [359, y]);
  const blocked = V({ state: quiet() }); blocked.leave(); blocked.x = 168; blocked.y = 33; blocked.heading = 'right'; blocked.world.map.isSea = (c, r) => !(c === 169 && r === 33) && m.isSea(c, r); d = blocked.stepDay(); assert.deepStrictEqual([d.moved, d.events, blocked.heading, blocked.moving], [0, ['뭍에 막혀 닻을 내렸다'], null, false]);
});
ok('동현항 보급: 식량이나 물이 0일이면 날마다 선원의 10%(적어도 1명) · 둘 다 없으면 두 번 · 선원이 0이면 탐험이 끝난다', () => {
  const v = V({ state: quiet() }); v.food = 28; v.water = 28 * 3; v.steer('left'); const log = []; for (let i = 0; i < 4; i++) { const d = v.stepDay(); log.push([d.events.join(' / '), v.crew, v.food, v.water]); }
  assert.deepStrictEqual(log, [['식량이 떨어졌다', 28, 0, 56], ['식량이 없어 선원 3명을 잃었다', 25, 0, 31], ['식량이 없어 선원 3명을 잃었다 / 물이 떨어졌다', 22, 0, 9], ['식량이 없어 선원 3명을 잃었다 / 물이 없어 선원 2명을 잃었다', 17, 0, 0]]);
  const s = V({ state: quiet() }); s.food = 0; s.water = 0; s.sailTo('hakata'); let d, n = 0; while (!s.over) { d = s.stepDay(); n++; } assert.deepStrictEqual([n, s.crew, s.over, s.overWhy, s.moving, d.events.at(-1), s.stepDay().ok], [9, 0, 'lost', 'crew', false, '선원을 모두 잃었다', false]);
  const st = quiet(); st.rules.supply.lossPct = 50; const h = V({ state: st }); h.food = 0; h.steer('left'); h.stepDay(); assert.strictEqual(h.crew, 14, '손실 비율은 규칙 값을 따른다');
});
ok('동현항 여관 · 도크 · 보급: 선원 5명씩 · 선체 고치기 · 배 사기(세 척까지 · 가장 느린 배에 맞춘다) · 식량 10일분 · 물은 값 없이 · 작은 항구에는 도크가 없다', () => {
  const v = V(); assert.deepStrictEqual(v.can('hire'), { ok: true, qty: 5, cost: 50 }); const h = v.hire(); assert.deepStrictEqual([h.text, v.crew, v.gold, v.foodDays], ['선원 5명을 모았다 · 금 −50 · 선원 33명', 33, 950, 76], '사람이 늘면 식량 날 수가 준다');
  v.hire(); assert.deepStrictEqual([v.hire().qty, v.crew, v.hire().why], [2, 40, '배에 더 태울 수 없다']);
  assert.strictEqual(v.can('repair').why, '고칠 데가 없다'); v.ships[0].hull = 40; assert.deepStrictEqual(v.can('repair'), { ok: true, qty: 20, cost: 40 }); v.gold = 30; const rp = v.repair(); assert.deepStrictEqual([rp.qty, rp.cost, v.ships[0].hull, v.gold], [15, 30, 55, 0], '금이 닿는 만큼만 고친다');
  assert.strictEqual(v.can('ship', 'caravel').why, '금이 모자란다'); v.gold = 9000; const b1 = v.buyShip('carrack'); assert.deepStrictEqual([b1.text, v.gold, v.speed, v.cargoCap, v.maxCrew, v.ships.map(s => s.id + s.name)], ['캐럭 흰구름호를 샀다 · 금 −5,000 · 배 2척', 4000, 1, 680, 160, ['s1꼬리바람호', 's2흰구름호']]);
  v.buyShip('caravel'); assert.deepStrictEqual([v.ships.length, v.gold, v.can('ship', 'caravel').why, v.can('ship', 'galleon').why], [3, 2000, '배는 3척까지다', '그런 배는 없다']);
  const f = V(); assert.deepStrictEqual(f.can('food'), { ok: true, qty: 280, days: 10, cost: 28 }); f.buyFood(); f.buyFood(); f.buyFood(); assert.deepStrictEqual([f.foodDays, f.gold, f.can('food').why], [120, 916, '식량은 120일분까지 싣는다']);
  assert.strictEqual(f.can('water').why, '물통이 가득 찼다'); f.water = 0; const wt = f.fillWater(); assert.deepStrictEqual([wt.cost, f.waterDays, f.gold], [0, 60, 916]);
  const small = V(); small.enter('elmina'); assert.deepStrictEqual([small.can('repair').why, small.can('ship', 'caravel').why, small.can('hire').ok, small.has('market')], ['이 항구에는 도크가 없다', '이 항구에는 도크가 없다', true, true]);
  small.leave(); assert.strictEqual(small.can('hire').why, '항구에 있을 때만 된다');
});
ok('동현항 만남: 항구를 떠나 3일 동안은 만나지 않는다 · 확률 100%면 4일째마다 · 0%면 끝까지 없다 · 그날 입항하면 만나지 않는다', () => {
  const st = H.newState(); st.rules.encounter.percent = 100; const v = V({ state: st }); v.sailTo('hakata'); const seen = []; for (let i = 0; i < 9; i++) { const d = v.stepDay(); seen.push(d.encounter ? 1 : 0); if (d.encounter) assert.ok(d.events.at(-1).endsWith('마주쳤다') && v.rivals.has(d.encounter.id)); }
  assert.deepStrictEqual(seen, [0, 0, 0, 1, 0, 0, 0, 1, 0]); assert.strictEqual(v.moving, true, '만나도 뱃길은 그대로다');
  const q = V({ state: quiet() }); q.sailTo('hakata'); let met = 0, qd = 0; while (!q.port && !q.over) { if (q.stepDay().encounter) met++; qd++; } assert.deepStrictEqual([met, qd], [0, 77]);
  const near = V({ state: st }); near.sailTo('seville'); assert.deepStrictEqual([near.stepDay().encounter, near.stepDay().encounter, near.port], [null, null, 'seville']);
});
// ───────── 동현항 해전 ─────────
const fight = (id, o = {}) => { const v = V(o); v.leave(); const b = v.openBattle(v.rivals.get(id)); return { v, b, me: b.units.filter(u => u.side === 'me'), foe: b.units.filter(u => u.side === 'foe') }; };
ok('동현항 해전 차림: 8×8 육각 바다 · 암초 넷(가운데 네 줄) · 선원은 배 정원에 맞춰 나눠 탄다 · 한 턴에 3칸 · 암초와 배는 못 지난다', () => {
  const { b, me, foe } = fight('blackreef'); assert.deepStrictEqual([b.grid.cols, b.grid.rows, b.grid.kind, b.rocks.size, b.side, b.turn, b.ended], [8, 8, 'hex', 4, 'me', 1, false]);
  for (const k of b.rocks) { const c = +k.split(',')[0]; assert.ok(c >= 2 && c <= 5, k); }
  assert.deepStrictEqual(b.units.map(u => [u.id, u.name, u.c, u.r, u.hull, u.crew, u.maxCrew, u.guns, u.flag]), [['me0', '꼬리바람호', 1, 4, 60, 28, 40, 8, true], ['foe0', '기함', 6, 3, 60, 28, 40, 8, true], ['foe1', '2번함', 7, 1, 60, 28, 40, 8, false]]);
  const reach = [...b.range(me[0]).values()]; assert.ok(reach.every(x => x.cost <= 3 && !b.isRock(x.c, x.r)) && reach.some(x => x.cost === 3)); assert.strictEqual(b.at(...[...b.rocks][0].split(',').map(Number)), 'rock');
  assert.deepStrictEqual([b.dist(me[0], foe[0]), b.fireTargets(me[0]).length, b.move(me[0], 7, 7), b.move(me[0], 6, 3)], [6, 0, false, false], '사거리 밖 · 너무 먼 칸 · 적이 선 칸');
  assert.strictEqual(b.move(me[0], 3, 4), true); assert.deepStrictEqual([me[0].c, me[0].moved, b.move(me[0], 2, 4), [...b.range(me[0]).keys()]], [3, true, false, ['3,4']], '한 턴에 한 번만 움직인다');
  assert.strictEqual(b.move(foe[0], 5, 3), false, '남의 차례에는 못 움직인다');
  const big = V(); big.gold = 20000; big.buyShip('carrack'); big.buyShip('caravel'); big.crew = 100; const b3 = big.openBattle(big.rivals.get('storm'));
  assert.deepStrictEqual(b3.units.map(u => [u.name, u.kind, u.maxHull, u.crew, u.guns]), [['꼬리바람호', '캐러벨', 60, 20, 8], ['흰구름호', '캐럭', 120, 60, 16], ['새벽별호', '캐러벨', 60, 20, 8], ['기함', '캐럭', 120, 83, 16], ['2번함', '캐러벨', 60, 27, 8]]);
});
ok('동현항 포격: 사거리 3칸 · 선체 피해 = 포 × 3 × 선원 ÷ 정원 · 선원 피해 = 포 × 선원 ÷ 정원 ÷ 2 · 선체 0이면 가라앉고 기함을 잃으면 진다', () => {
  const { b, me, foe } = fight('blackreef'); b.move(me[0], 4, 4); assert.deepStrictEqual([b.dist(me[0], foe[0]), b.fireTargets(me[0]).map(t => t.id), b.shot(me[0])], [3, ['foe0'], { hull: Math.floor(8 * 3 * 28 / 40), crew: Math.floor(8 * 28 / 40 / 2) }]);
  const r = b.fire(me[0], foe[0]); assert.deepStrictEqual([r.hull, r.crew, r.out, foe[0].hull, foe[0].crew, me[0].done, b.fire(me[0], foe[0]), r.text], [16, 2, null, 44, 26, true, null, '포동이 탐험대 꼬리바람호가 검은 암초 해적단 기함에 포를 쐈다 · 선체 −16 · 선원 −2']);
  assert.strictEqual(b.fire(me[0], foe[1]), null, '사거리 밖'); b.endSide(); assert.deepStrictEqual([b.side, b.turn], ['foe', 1]); b.endSide(); assert.deepStrictEqual([b.side, b.turn, me[0].done, me[0].moved], ['me', 2, false, false]);
  me[0].crew = 10; assert.deepStrictEqual(b.shot(me[0]), { hull: 6, crew: 1 }, '선원이 줄면 포격이 약해진다'); me[0].crew = 40; foe[0].hull = 20; const k = b.fire(me[0], foe[0]);
  assert.deepStrictEqual([k.hull, k.out, foe[0].out, foe[0].hull, b.ended, b.winner, b.reason], [20, 'sunk', 'sunk', 0, true, 'me', '검은 암초 해적단의 기함이 가라앉았다']); assert.deepStrictEqual([b.result().loot, b.result().foe.ships.map(s => s.out)], [900, ['sunk', null]]);
  const t = fight('blackreef'), u = t.me[0]; t.b.move(u, 4, 4); t.foe[0].crew = 2; t.foe[0].hull = 60; const c = t.b.fire(u, t.foe[0]); assert.deepStrictEqual([c.crew, c.out, t.foe[0].out, t.b.winner], [2, 'taken', 'taken', 'me'], '선원이 0이 되면 배를 빼앗긴다');
  const st = H.newState(); st.sea.range = 6; st.sea.mp = 1; st.sea.gunHull = 5; const far = fight('redsail', { state: st }); assert.deepStrictEqual([far.b.fireTargets(far.me[0]).length, far.b.shot(far.me[0]).hull, Math.max(...[...far.b.range(far.me[0]).values()].map(x => x.cost))], [1, 28, 1], 'globalState의 사거리 · 이동력 · 포 위력을 쓴다');
});
ok('동현항 백병전: 맞닿은 배에 올라탄다 · 적 선원 −(우리의 40%) → 남은 적이 되받아 우리 −(30%) · 선원이 0이면 배를 빼앗는다', () => {
  const { b, me, foe } = fight('blackreef'); assert.deepStrictEqual(b.boardTargets(me[0]), []); foe[1].c = 2; foe[1].r = 4;
  assert.deepStrictEqual(b.boardTargets(me[0]).map(t => t.id), ['foe1']); const r = b.board(me[0], foe[1]);
  assert.deepStrictEqual([r.type, r.hit, r.back, r.out, me[0].crew, foe[1].crew, me[0].done, b.ended], ['board', Math.floor(28 * 0.4), Math.floor(17 * 0.3), null, 23, 17, true, false]);
  assert.strictEqual(r.text, '포동이 탐험대 꼬리바람호가 검은 암초 해적단 2번함에 올라탔다 · 맞선 배 선원 −11 · 올라탄 배 선원 −5');
  b.endSide(); b.endSide(); foe[1].crew = 6; const k = b.board(me[0], foe[1]); assert.deepStrictEqual([k.hit, k.back, k.out, foe[1].out, foe[1].crew, me[0].crew, b.ended], [6, 0, 'taken', 'taken', 0, 23, false], '기함이 아니면 싸움은 이어진다');
  assert.deepStrictEqual([b.alive('foe').map(u => u.id), b.crewOf('foe'), b.unitAt(2, 4)], [['foe0'], 28, null], '빼앗긴 배는 바다에서 빠진다');
});
ok('동현항 일기토: 기함이 적 기함과 맞닿으면 신청한다 · 받아들이면 선장끼리 겨룬다 · 기력 100 · 한 번에 무력의 20~50% · 신청한 쪽이 먼저 · 진 쪽이 해전을 진다', () => {
  const wins = {}; let first = null;
  for (const id of ['redsail', 'blackreef', 'storm']) { wins[id] = 0;
    for (let s = 1; s <= 200; s++) { const v = new H.Voyage(hw(), { rng: new DH.RNG(s) }); v.leave(); const b = v.openBattle(v.rivals.get(id)), [x, y] = b.units; y.c = 2; y.r = 4; assert.deepStrictEqual(b.duelTargets(x), [y]); const r = b.challenge(x, y), war = [70, v.rivals.get(id).captain.war];
      assert.strictEqual(r.type, 'duel'); assert.ok(b.ended && b.winner === r.winner && b.duel.winner === r.winner); if (r.winner === 'me') wins[id]++; if (!first) first = { r, b, y };
      let ha = 100, hb = 100; for (const [dx, dy, a2, b2] of b.duel.rounds) { assert.ok(dx >= Math.floor(war[0] * 0.2) && dx <= Math.floor(war[0] * 0.5), '우리 선장의 한 번 ' + dx); hb = Math.max(0, hb - dx); if (hb > 0) { assert.ok(dy >= Math.floor(war[1] * 0.2) && dy <= Math.floor(war[1] * 0.5)); ha = Math.max(0, ha - dy); } else assert.strictEqual(dy, 0, '쓰러진 쪽은 되받아치지 못한다'); assert.deepStrictEqual([a2, b2], [ha, hb]); }
      assert.ok((ha === 0) !== (hb === 0)); assert.strictEqual(r.winner, hb === 0 ? 'me' : 'foe'); const lose = r.winner === 'me' ? y : x; assert.deepStrictEqual([lose.out, lose.crew], ['taken', 0]); } }
  assert.deepStrictEqual(wins, { redsail: 192, blackreef: 132, storm: 71 }, '무력 70으로 먼저 걸었을 때 200판 가운데 이긴 판(무력 55 · 72 · 86)');
  assert.strictEqual(first.r.text, '일기토: 포동이(무력 70) 대 붉은수염(무력 55) · 4합 만에 포동이가 이겼다(남은 기력 47)'); assert.strictEqual(first.b.reason, '포동이가 일기토에서 붉은수염을 꺾었다'); assert.strictEqual(first.b.result().loot, 400);
  const st = H.newState(); st.start.war = 100; st.rivals.push(['storm', 1]); const e = fight('storm', { state: st }); e.foe[0].c = 2; e.foe[0].r = 4; assert.deepStrictEqual([e.b.fleets.me.captain.war, e.b.fleets.foe.captain.war, e.b.duelOf(e.me[0], e.foe[0]).winner], [100, 1, 'me'], 'globalState의 무력으로 겨룬다');
});
ok('동현항 해전 AI · 끝: AI끼리 싸우면 언제나 끝난다 · 20턴이 지나면 갈라진다 · 달아나기 · 끝난 뒤에는 아무 일도 못 한다', () => {
  for (const id of ['redsail', 'blackreef', 'storm']) for (let s = 1; s <= 40; s++) { const v = new H.Voyage(hw(), { rng: new DH.RNG(s) }); v.leave(); v.day = s; const b = v.openBattle(v.rivals.get(id)), r = b.auto();
    assert.ok(b.ended && r.turns <= 20 && ['me', 'foe', null].includes(r.winner), id + s); assert.ok(r.reason); for (const u of b.units) { assert.ok(u.hull >= 0 && u.crew >= 0 && u.hull <= u.maxHull && u.crew <= u.maxCrew); if (!u.out) assert.ok(!b.isRock(u.c, u.r) && b.units.every(o => o === u || o.out || o.c !== u.c || o.r !== u.r), '겹쳐 서지 않는다'); }
    if (r.winner) assert.ok(b.flag(r.winner === 'me' ? 'foe' : 'me').out || !b.alive(r.winner === 'me' ? 'foe' : 'me').length); assert.strictEqual(r.loot, r.winner === 'me' ? v.rivals.get(id).gold : 0); }
  const { b, me, foe } = fight('redsail'); let rec = b.aiAct(); assert.deepStrictEqual([rec.unit, rec.from, me[0].done, b.aiAct()], ['me0', [1, 4], true, null], '배 하나씩 움직이고, 다 움직였으면 null');
  const d = fight('redsail'); for (let i = 0; i < 100 && !d.b.ended; i++) d.b.endSide(); assert.deepStrictEqual([d.b.winner, d.b.turn, d.b.reason, d.b.result().loot], [null, 20, '20턴이 지나 두 함대가 갈라졌다', 0]);
  const st = H.newState(); st.sea.turns = 5; const s5 = fight('redsail', { state: st }); for (let i = 0; i < 100 && !s5.b.ended; i++) s5.b.endSide(); assert.strictEqual(s5.b.turn, 5);
  const f = fight('storm'); f.b.flee('me'); const r = f.b.result(); assert.deepStrictEqual([r.winner, r.fled, r.reason, f.b.move(f.me[0], 2, 4), f.b.fire(f.me[0], f.foe[0]), f.b.aiAct()], [null, 'me', '포동이 탐험대가 달아났다', false, null, null]);
});
ok('동현항 해전 뒤: 이기면 적의 금 · 달아나면 짐 절반 · 지면 금 절반과 짐을 잃고 마지막 항구로 · 배를 잃으면 넘치는 짐이 가라앉는다', () => {
  const R = (winner, ships, o = {}) => ({ winner, fled: o.fled || null, reason: '시험', turns: 3, loot: o.loot || 0, duel: null, me: { ships }, foe: { ships: [] } });
  let v = V(); v.sailTo('seville'); v.stepDay(); let out = v.settleBattle(R('me', [{ ref: 's1', hull: 41, crew: 20, out: null }], { loot: 400 }));
  assert.deepStrictEqual([out.text, v.gold, v.crew, v.ships[0].hull, v.cargoUsed, v.port, v.moving, v.sinceLand], ['해전에서 이겼다 · 금 +400 · 선원 28 → 20명 · 선장 무력 70 → 71', 1400, 20, 41, 60, null, true, 0]); assert.strictEqual(v.foodDays, 120, '사람이 줄면 남은 식량의 날 수가 는다(120일분까지)');
  v = V(); v.leave(); out = v.settleBattle(R(null, [{ ref: 's1', hull: 60, crew: 28, out: null }], { fled: 'me' })); assert.deepStrictEqual([out.text, out.fled, [...v.cargo].map(([g, h]) => [g, h.qty]), v.gold], ['짐 30개를 버리고 달아났다 · 선원 28 → 28명', true, [['wine', 30]], 1000]);
  v = V(); v.sailTo('seville'); v.stepDay(); out = v.settleBattle(R('foe', [{ ref: 's1', hull: 0, crew: 0, out: 'sunk' }]));
  assert.deepStrictEqual([out.text, v.gold, v.crew, v.cargoUsed, v.port, v.ships.length, v.ships[0].hull, v.moving, [v.x, v.y]], ['해전에서 졌다 · 금 500과 짐을 모두 빼앗기고 리스본으로 떠밀려 왔다 · 선원 28 → 5명', 500, 5, 0, 'lisbon', 1, 15, false, [170, 33]]);
  v = V(); v.gold = 20000; v.buyShip('carrack'); v.gold = 0; v.cargo.clear(); v.load('wine', 400, 18); v.crew = 100; v.leave(); out = v.settleBattle(R(null, [{ ref: 's1', hull: 30, crew: 25, out: null }, { ref: 's2', hull: 0, crew: 0, out: 'sunk' }]));
  assert.deepStrictEqual([out.text, v.ships.map(s => s.id), v.crew, v.cargoUsed, v.cargoCap], ['승부가 나지 않아 두 함대가 갈라졌다 · 선원 100 → 25명 · 배를 잃어 짐 200개가 가라앉았다', ['s1'], 25, 200, 200]);
  const full = V(); full.sailTo('hakata'); for (let i = 0; i < 5; i++) full.stepDay(); const b = full.openBattle(full.rivals.get('redsail')), res = b.auto(), o2 = full.settleBattle(res); assert.ok(o2.ok && (res.winner !== 'me' || full.gold === 1400), '해전 → 결과 → 탐험대');
});
ok('동현항 선장 수련 · 포 보강: 여관에서 금 300에 무력 +1(100까지) · 도크에서 금 400에 포 +2문(배마다 +8문까지) · 보강한 포가 해전에 실린다', () => {
  let v = V(); assert.deepStrictEqual(v.can('train'), { ok: true, gain: 1, to: 71, cost: 300 }); assert.deepStrictEqual([v.train().text, v.gold, v.captain.war], ['포동이가 수련했다 · 금 −300 · 무력 70 → 71', 700, 71]);
  v.gold = 299; assert.strictEqual(v.train().why, '금이 모자란다'); v.gold = 9999; v.captain.war = 100; assert.strictEqual(v.can('train').why, '선장의 무력은 100까지다');
  v = V(); assert.deepStrictEqual([v.addGuns('s1').text, v.gunsOf(v.ships[0]), v.gold], ['꼬리바람호에 포 2문을 더 달았다 · 금 −400 · 포 10문', 10, 600]);
  v.gold = 9999; for (let i = 0; i < 3; i++) assert.ok(v.addGuns('s1').ok); assert.deepStrictEqual([v.ships[0].plus, v.gunsOf(v.ships[0]), v.can('gun', 's1').why, v.can('gun', 'zz').why, v.gold], [8, 16, '포는 배마다 8문까지 더 단다', '그런 배는 없다', 8799]);
  v.leave(); const b = v.openBattle(v.rivals.get('redsail')), u = b.units[0]; assert.deepStrictEqual([u.guns, u.type, b.shot(u)], [16, 'caravel', { hull: 33, crew: 5 }], '포 16문 × 3 × 선원 28 ÷ 정원 40');
  const far = V(); far.sailTo('seville'); far.stepDay(); assert.ok(!far.can('train').ok && !far.can('gun', 's1').ok && !far.can('swap', 's1', 'carrack').ok, '바다에서는 못 한다');
});
ok('동현항 배 바꾸기 · 팔기: 헌 배는 처음 값의 50% · 기함도 바꾼다 · 선체는 새것 · 보강한 포는 넘어간다 · 자리가 줄면 선원이 내린다 · 짐이 안 실리면 막는다 · 마지막 한 척은 못 판다', () => {
  let v = V(); assert.deepStrictEqual([v.can('swap', 's1', 'carrack').why, v.can('swap', 's1', 'caravel').why, v.can('swap', 's1', 'turtle').why, v.can('swap', 's1', 'ark').why, v.can('swap', 'zz', 'carrack').why, v.can('sell', 's1').why],
    ['금이 모자란다', '지금 타는 배와 같다', '금이 모자란다', '그런 배는 없다', '그런 배는 없다', '마지막 한 척은 팔 수 없다']);
  v.gold = 5000; v.addGuns('s1'); v.ships[0].hull = 20; assert.deepStrictEqual(v.can('swap', 's1', 'carrack'), { ok: true, cost: 4000, back: 0, trade: 1000, off: 0 }, '캐럭 5,000 − 캐러벨의 절반 1,000(다친 배도 같은 값)');
  assert.strictEqual(v.swapShip('s1', 'carrack').text, '꼬리바람호를 캐러벨에서 캐럭으로 바꿨다 · 헌 배 값 금 1,000 · 금 −4,000');
  assert.deepStrictEqual([v.gold, v.ships, v.cargoCap, v.maxCrew, v.minCrew, v.crew, v.speed, v.cargoUsed], [600, [{ id: 's1', type: 'carrack', name: '꼬리바람호', hull: 120, plus: 0 }], 480, 120, 30, 28, 1, 60], '이름과 id는 그대로 · 선체는 새것 · 포 보강은 사라진다');
  v.crew = 100; assert.deepStrictEqual(v.can('swap', 's1', 'caravel'), { ok: true, cost: 0, back: 500, trade: 2500, off: 60 });
  assert.deepStrictEqual([v.swapShip('s1', 'caravel').text, v.gold, v.crew, v.ships[0].hull], ['꼬리바람호를 캐럭에서 캐러벨로 바꿨다 · 헌 배 값 금 2,500 · 금 +500 · 선원 60명이 내렸다', 1100, 40, 60]);
  v = V(); v.gold = 9000; v.swapShip('s1', 'carrack'); v.cargo.clear(); v.load('wine', 260, 18); assert.strictEqual(v.can('swap', 's1', 'caravel').why, '짐이 다 실리지 않는다(남는 적재량 200)');
  v = V(); v.gold = 9000; v.buyShip('carrack'); v.crew = 150; assert.deepStrictEqual(v.can('sell', 's2'), { ok: true, income: 2500, off: 110 });
  assert.deepStrictEqual([v.sellShip('s1').text, v.gold, v.ships.map(sh => sh.id + sh.type), v.crew, v.speed], ['캐러벨 꼬리바람호를 팔았다 · 금 +1,000 · 배 1척 · 선원 30명이 내렸다', 5000, ['s2carrack'], 120, 1], '기함을 팔면 다음 배가 기함이 된다');
  assert.strictEqual(v.buyShip('caravel').ok, true); assert.deepStrictEqual(v.ships.map(sh => sh.id), ['s2', 's3'], '쓰이지 않은 번호를 받는다');
});
ok('동현항 해적과의 만남: 달아난다(더 빠르면 그냥 · 아니면 짐 절반) · 통행료(자금의 20%, 적어도 100) · 만난 뒤 다시 3일은 조용하다', () => {
  let v = V(); v.leave(); const R = id => v.rivals.get(id);
  const pick = m => ({ fast: m.fast, speed: m.speed, their: m.their, drop: m.drop, toll: m.toll, pay: m.pay });
  assert.deepStrictEqual(pick(v.meetInfo(R('redsail'))), { fast: false, speed: 2, their: 2, drop: 30, toll: 200, pay: { ok: true, cost: 200 } }, '속도가 같으면 따돌리지 못한다');
  assert.deepStrictEqual(pick(v.meetInfo(R('storm'))), { fast: true, speed: 2, their: 1, drop: 0, toll: 200, pay: { ok: true, cost: 200 } }, '캐럭이 낀 함대는 하루 1칸이다');
  v.sinceLand = 9; assert.deepStrictEqual([v.evade(R('redsail')), v.cargoUsed, v.sinceLand, v.gold], [{ ok: true, type: 'evade', fast: false, cut: 30, text: '짐 30개를 버리고 붉은 돛 해적단에게서 달아났다' }, 30, 0, 1000]);
  v = V(); v.leave(); v.sinceLand = 9; assert.deepStrictEqual([v.evade(R('storm')).text, v.cargoUsed, v.sinceLand], ['하루 2칸으로 달려 폭풍 사략 함대를 따돌렸다(해적은 하루 1칸)', 60, 0]);
  v = V(); v.leave(); v.sinceLand = 9; assert.deepStrictEqual([v.payToll(R('blackreef')), v.gold, v.sinceLand], [{ ok: true, type: 'toll', cost: 200, text: '검은 암초 해적단에게 통행료 금 200을 내고 지나갔다' }, 800, 0]);
  v.gold = 3333; assert.strictEqual(v.meetInfo(R('storm')).toll, 667, '올림'); v.gold = 300; assert.strictEqual(v.meetInfo(R('storm')).toll, 100, '적어도 100'); v.gold = 99; assert.deepStrictEqual([v.payToll(R('storm')), v.gold], [{ ok: false, why: '금이 모자란다' }, 99]);
  const st = H.newState(); st.rules.encounter.tollPct = 50; st.rules.encounter.percent = 100; v = V({ state: st }); v.leave(); assert.strictEqual(v.meetInfo(R('storm')).toll, 500);
  v.sailTo('hakata'); let d, n = 0; for (let i = 0; i < 4; i++) d = v.stepDay(); assert.ok(d.encounter && d.events.some(t => /^해적 출현 · .+[과와] 마주쳤다$/.test(t)), d.events.join()); v.payToll(d.encounter);
  for (let i = 0; i < 3; i++) { d = v.stepDay(); assert.ok(!d.encounter, '통행료를 낸 뒤 3일'); } assert.ok(v.stepDay().encounter, '그 뒤에는 다시 만난다');
});
ok('동현항 백병전과 선장 무력: 피해 = 선원의 40%(되받기 30%) × 선장 무력 ÷ 70 · 기함에 올라타도 선원끼리 싸운다', () => {
  let e = fight('redsail'); e.foe[0].c = 2; e.foe[0].r = 4; assert.deepStrictEqual([e.b.boardPreview(e.me[0], e.foe[0]), e.b.boardPreview(e.foe[0], e.me[0])], [{ hit: 11, left: 13, back: 3 }, { hit: 7, left: 21, back: 6 }], '28 × 40% × 70 ÷ 70 = 11 · 13 × 30% × 55 ÷ 70 = 3 / 24 × 40% × 55 ÷ 70 = 7 · 21 × 30% = 6');
  const r = e.b.board(e.me[0], e.foe[0]); assert.deepStrictEqual([r.type, r.hit, r.back, e.b.ended, e.b.duel, e.me[0].crew, e.foe[0].crew, r.text], ['board', 11, 3, false, null, 25, 13, '포동이 탐험대 꼬리바람호가 붉은 돛 해적단 기함에 올라탔다 · 맞선 배 선원 −11 · 올라탄 배 선원 −3']);
  const st = H.newState(); st.start.war = 100; e = fight('redsail', { state: st }); e.foe[0].c = 2; e.foe[0].r = 4; assert.deepStrictEqual(e.b.boardPreview(e.me[0], e.foe[0]), { hit: 16, left: 8, back: 1 }, '무력 100이면 28 × 40% × 100 ÷ 70 = 16');
  e = fight('storm'); e.foe[0].c = 2; e.foe[0].r = 4; assert.deepStrictEqual(e.b.boardPreview(e.foe[0], e.me[0]), { hit: 28, left: 0, back: 0 }, '폭풍 제독(무력 86 · 선원 83): 83 × 40% × 86 ÷ 70 = 40 → 우리 28명이 모두 쓰러진다');
});
ok('동현항 일기토 신청: 해전마다 쪽마다 한 번 · 적은 15까지 뒤져도 받고 더 뒤지면 물리친다 · 물리치면 그 배는 이어서 움직인다 · 적은 10 넘게 앞설 때 신청한다 · 우리가 받을지 고른다', () => {
  const st = H.newState(); st.start.war = 100; let e = fight('redsail', { state: st }); assert.deepStrictEqual(e.b.duelTargets(e.me[0]), [], '떨어져 있으면 신청하지 못한다'); e.foe[0].c = 2; e.foe[0].r = 4;
  let r = e.b.challenge(e.me[0], e.foe[0]); assert.deepStrictEqual([r, e.b.ended, e.me[0].done, e.b.duelTargets(e.me[0]), e.b.challenge(e.me[0], e.foe[0])], [{ type: 'refuse', unit: 'me0', target: 'foe0', text: '붉은수염이 포동이의 일기토 신청을 물리쳤다' }, false, false, [], null], '무력 55는 100 − 15보다 낮다 · 한 번뿐이다');
  assert.strictEqual(e.b.board(e.me[0], e.foe[0]).type, 'board', '물리친 뒤에도 올라탈 수 있다');
  st.start.war = 70; assert.deepStrictEqual(['redsail', 'blackreef', 'storm'].map(id => { const q = fight(id); return [q.b.accepts('foe'), q.b.accepts('me')]; }), [[true, true], [true, false], [true, false]], '적은 55 ≥ 70 − 15라 받는다 · 맡겨 둔 우리 쪽은 무력이 같거나 높을 때만 받는다');
  const dare = () => { const q = fight('storm'); for (const u of q.me) q.b.wait(u); q.b.endSide(); q.foe[0].c = 3; q.foe[0].r = 4; return q; };
  e = dare(); r = e.b.aiAct(); assert.deepStrictEqual([r.type, r.unit, r.target, r.to, r.text, e.b.pending, e.b.ended, e.b.asked], ['challenge', 'foe0', 'me0', [2, 4], '폭풍 제독(무력 86)이 포동이(무력 70)에게 일기토를 신청했다', { unit: 'foe0', target: 'me0' }, false, { me: false, foe: true }]);
  assert.deepStrictEqual(e.b.duelTargets(e.me[0]), [], '답을 기다리는 동안에는 새로 신청하지 못한다');
  r = e.b.answer(false); assert.deepStrictEqual([r.type, r.text, e.b.pending, e.b.ended, e.foe[0].done, e.foe[0].moved, e.b.answer(true)], ['refuse', '포동이가 폭풍 제독의 일기토 신청을 물리쳤다', null, false, false, true, null]);
  r = e.b.aiAct(); assert.deepStrictEqual([r.unit, r.type], ['foe0', 'board'], '물리치면 그 배가 이어서 올라탄다');
  e = dare(); e.b.aiAct(); r = e.b.answer(true); assert.deepStrictEqual([r.type, r.winner, e.b.ended, e.b.winner, e.b.reason, e.b.duel.a.name], ['duel', 'foe', true, 'foe', '폭풍 제독이 일기토에서 포동이를 꺾었다', '폭풍 제독'], '신청한 쪽이 먼저 친다');
  e = dare(); e.b.aiAct(); r = e.b.aiAct(); assert.deepStrictEqual([r.type, r.unit, e.b.pending], ['refuse', 'foe0', null], '답 없이 넘기면 맡겨 둔 규칙대로 답한다(70 < 86이라 물리친다)');
  for (const id of ['redsail', 'blackreef']) for (let s = 1; s <= 30; s++) { const v = new H.Voyage(hw(), { rng: new DH.RNG(s) }); v.leave(); const b = v.openBattle(v.rivals.get(id)); b.auto(); assert.ok(!b.log.some(t => /^(붉은수염|외눈 선장)\(무력 \d+\)[이가] /.test(t)), id + s + ': 무력이 10 넘게 앞서지 않는 해적은 신청하지 않는다'); }
});
ok('동현항 선장의 성장: 해전을 이기면 무력 +1 · 일기토로 이겼으면 2 더 · 100까지 · 지거나 갈라지면 그대로', () => {
  const R = (winner, duel) => ({ winner, fled: null, loot: 0, duel, me: { ships: [{ ref: 's1', hull: 60, crew: 28, out: null }] } });
  const v = V(); v.leave(); assert.deepStrictEqual([v.settleBattle(R('me', { winner: 'me' })).text, v.captain.war], ['해전에서 이겼다 · 금 +0 · 선원 28 → 28명 · 선장 무력 70 → 73', 73]);
  assert.deepStrictEqual([v.settleBattle(R(null, null)).text, v.captain.war], ['승부가 나지 않아 두 함대가 갈라졌다 · 선원 28 → 28명', 73]);
  v.captain.war = 99; assert.deepStrictEqual([v.settleBattle(R('me', { winner: 'me' })).text, v.captain.war], ['해전에서 이겼다 · 금 +0 · 선원 28 → 28명 · 선장 무력 99 → 100', 100]);
  assert.deepStrictEqual([v.settleBattle(R('me', null)).text, v.captain.war], ['해전에서 이겼다 · 금 +0 · 선원 28 → 28명', 100]);
  const w = V(); w.sailTo('seville'); w.stepDay(); w.settleBattle(R('foe', { winner: 'foe' })); assert.strictEqual(w.captain.war, 70);
  const full = V(); full.leave(); const b = full.openBattle(full.rivals.get('redsail')); b.units[1].c = 2; b.units[1].r = 4; const d = b.challenge(b.units[0], b.units[1]); assert.strictEqual(d.type, 'duel'); const o = full.settleBattle(b.result());
  assert.strictEqual(full.captain.war, d.winner === 'me' ? 73 : 70); assert.ok(d.winner !== 'me' || / · 선장 무력 70 → 73( · 빼앗은 배 \d척)?$/.test(o.text)); assert.strictEqual(full.openBattle(full.rivals.get('redsail')).fleets.me.captain.war, full.captain.war, '오른 무력으로 다음 해전을 치른다');
});
ok('동현항 거북선: 짐 240 · 선원 10~40 · 속도 3 · 선체 200 · 포 40문 · 값 8,000 · 어느 탐험에서나 사고 바꾼다 · cheat로 적은 자료에서만 무적 모드로 막힌다 · 포 한 번에 선체 −84', () => {
  const t = hw().shipTypes.get('turtle'); assert.deepStrictEqual(t, { id: 'turtle', name: '거북선', cargo: 240, minCrew: 10, maxCrew: 40, speed: 3, hull: 200, guns: 40, price: 8000 });
  const all = [...hw().shipTypes.values()]; assert.deepStrictEqual(all.map(x => x.id), ['caravel', 'carrack', 'turtle']); assert.ok(all.every(x => x.id === 'turtle' || (x.speed < t.speed && x.guns < t.guns && !x.cheat)), '가장 빠르고 포가 가장 많다'); assert.ok(t.cargo > all[0].cargo && t.cargo < all[1].cargo, '짐은 캐러벨과 캐럭 사이');
  let v = V(); assert.deepStrictEqual([v.inv, v.can('ship', 'turtle').why, v.can('swap', 's1', 'turtle').why], [false, '금이 모자란다', '금이 모자란다']);
  v.gold = 7999; assert.strictEqual(v.can('ship', 'turtle').why, '금이 모자란다'); v.gold = 8000; assert.deepStrictEqual([v.can('ship', 'turtle'), v.can('swap', 's1', 'turtle')], [{ ok: true, cost: 8000 }, { ok: true, cost: 7000, back: 0, trade: 1000, off: 0 }], '8,000 · 캐러벨에서 바꾸면 8,000 − 1,000');
  assert.ok(v.swapShip('s1', 'turtle').ok !== false); assert.deepStrictEqual([v.ships[0].type, v.gold, v.speed], ['turtle', 1000, 3], '무적 모드가 아니어도 거북선으로 바꾼다');
  v = new H.Voyage(cheatW(), { rng: new DH.RNG(3) }); v.gold = 99999; assert.deepStrictEqual([v.can('ship', 'turtle').why, v.can('swap', 's1', 'turtle').why], ['무적 모드에서만 고를 수 있다', '무적 모드에서만 고를 수 있다']);
  const st = H.newState(); st.rules.invincible = 1; st.start.ship = 'turtle'; v = V({ state: st }); assert.deepStrictEqual([v.ships[0].type, v.ships[0].hull, v.speed, v.cargoCap, v.maxCrew, v.crew, v.cargoUsed], ['turtle', 200, 3, 240, 40, 28, 60], '설정으로 시작 기함을 바꾼다');
  v.leave(); const b = v.openBattle(v.rivals.get('storm')), u = b.units[0]; assert.deepStrictEqual([u.type, u.guns, u.maxHull, b.shot(u)], ['turtle', 40, 200, { hull: 84, crew: 14 }], '40문 × 3 × 28 ÷ 40 = 84');
  st.start.ship = 'carrack'; v = V({ state: st }); assert.deepStrictEqual([v.ships[0].type, v.crew, v.cargoCap], ['carrack', 30, 480], '캐럭으로 시작하면 선원을 최소 30명으로 맞춘다');
});
ok('동현항 무적 모드: 금을 내지 않는다 · 식량과 물이 줄지 않는다 · 우리 배가 다치지 않는다 · 선장이 일기토에서 지지 않는다 · 해전에서 지지 않는다', () => {
  const st = H.newState(); st.rules.invincible = 1; let v = V({ state: st }); assert.ok(v.inv && !V().inv);
  assert.deepStrictEqual([v.buy('wine').text, v.hire().text, v.train().text, v.addGuns('s1').text, v.buyShip('turtle').text, v.swapShip('s1', 'turtle').text, v.gold],
    ['포도주 10개를 샀다 · 값 없이(무적 모드) · 값 18 → 19', '선원 5명을 모았다 · 값 없이(무적 모드) · 선원 33명', '포동이가 수련했다 · 값 없이(무적 모드) · 무력 70 → 71', '꼬리바람호에 포 2문을 더 달았다 · 값 없이(무적 모드) · 포 10문', '거북선 흰구름호를 샀다 · 값 없이(무적 모드) · 배 2척', '꼬리바람호를 캐러벨에서 거북선으로 바꿨다 · 헌 배 값 금 1,000 · 값 없이(무적 모드)', 1000]);
  v.gold = 0; assert.ok(v.buy('wine').ok && v.train().ok && v.gold === 0, '금이 0이어도 된다'); const sold = v.sell('wine'); assert.ok(sold.ok && v.gold === sold.income, '판 값은 받는다');
  v.sailTo('hakata'); const f0 = v.food, w0 = v.water; for (let i = 0; i < 6; i++) v.stepDay(); assert.deepStrictEqual([v.food, v.water, v.day], [f0, w0, 6]);
  assert.deepStrictEqual([v.meetInfo(v.rivals.get('storm')).toll, v.meetInfo(v.rivals.get('redsail')).fast, v.payToll(v.rivals.get('storm')).text], [0, true, '폭풍 사략 함대가 통행료 없이 길을 비켰다(무적 모드)']);
  let wins = 0, n = 0; for (const id of ['redsail', 'blackreef', 'storm']) for (let s = 1; s <= 25; s++) { const q = new H.Voyage(hw(), { rng: new DH.RNG(s), state: st }); q.leave(); const g0 = q.gold, b = q.openBattle(q.rivals.get(id)); assert.ok(b.fleets.me.invincible && !b.fleets.foe.invincible && b.accepts('me'));
    const res = b.auto(); n++; if (res.winner === 'me') wins++; assert.notStrictEqual(res.winner, 'foe', id + s); for (const u of b.units) if (u.side === 'me') assert.deepStrictEqual([u.hull, u.crew, u.out], [u.maxHull, 28, null]);
    if (b.duel) assert.deepStrictEqual([b.duel.winner, b.duel[b.duel.a.side === 'me' ? 'a' : 'b'].hp], ['me', 100], '기력이 줄지 않는다'); const o = q.settleBattle(res); assert.ok(o.ok && q.crew === 28 && q.gold >= g0); }
  assert.strictEqual(wins, n, '75판을 모두 이긴다');
  const e = fight('storm', { state: st }); for (const u of e.me) e.b.wait(u); e.b.endSide(); e.foe[0].c = 3; e.foe[0].r = 4; assert.strictEqual(e.b.aiAct().type, 'challenge'); const r = e.b.aiAct(); assert.deepStrictEqual([r.type, r.winner, e.b.duel.b.hp], ['duel', 'me', 100], '무적이면 맡겨 둔 싸움에서도 받는다');
  const f = fight('storm', { state: st }); f.b.endSide(); f.foe[0].c = 3; f.foe[0].r = 4; const shot = f.b.fire(f.foe[0], f.me[0]); assert.deepStrictEqual([shot.hull, shot.crew, f.me[0].hull], [0, 0, 60]); assert.deepStrictEqual(f.b.boardPreview(f.foe[1], f.me[0]).hit, 0);
});
// ───────── 동현항 동현랭 ─────────
ok('동현항 설정: 시작 자금 · 식량 · 물 · 선원 · 선장 무력 · 시작 짐 · 교역 단위 · 변동 폭 · 수수료 · 손실 · 만날 확률 · 해전 수치 · 적 선장 무력', () => {
  const w = hw(), st = H.newState(), L = H.lang;
  const r = H.applyDonghyunLang(L.compose([[2, 77], [3, 5000], [4, 30], [5, 20], [6, 40], [7, 95], [8, 1, 80], [8, 2, 0], [8, 7, 10], [10, 20], [11, 10], [12, 0], [13, 50], [14, 100], [22, 9], [23, 5], [24, 4], [30, 1, 40], [30, 3, 99]], '', { world: w }), st, { world: w });
  assert.ok(r.ok, r.errors.join()); assert.strictEqual(r.settings.length, 19); assert.deepStrictEqual(st.start, { seed: 77, gold: 5000, food: 30, water: 20, crew: 40, war: 95, ship: null });
  assert.deepStrictEqual([st.cargo, st.rivals, st.rules.lot, st.rules.price.stepPct, st.rules.price.feePct, st.rules.supply.lossPct, st.rules.encounter.percent, st.sea.turns, st.sea.mp, st.sea.range], [[['wine', 80], ['olive', 0], ['pepper', 10]], [['redsail', 40], ['storm', 99]], 20, 10, 0, 50, 100, 9, 5, 4]);
  assert.ok(r.applied.includes('시작 짐 포도주 80') && r.applied.includes('해적 선장 무력 붉은수염 40') && r.applied.includes('시작 자금 5,000'), r.applied.join());
  assert.deepStrictEqual([H.RULES.lot, H.SEA.mp, H.RULES.encounter.percent], [10, 3, 5], '기본값 표는 그대로다');
  const v = new H.Voyage(w, { rng: new DH.RNG(77), state: st });
  assert.deepStrictEqual([v.gold, v.crew, v.foodDays, v.waterDays, v.captain.war, [...v.cargo].map(([g, h]) => [g, h.qty]), v.rivals.get('redsail').captain.war, v.rivals.get('blackreef').captain.war, v.rivals.get('storm').captain.war], [5000, 40, 30, 20, 95, [['wine', 80], ['pepper', 10]], 40, 72, 99]);
  const b = v.buy('wine'); assert.deepStrictEqual([b.qty, b.cost, v.entry('wine').price], [20, 360, 20], '20개씩 · 한 단은 기준값의 10%(2)'); const s = v.sell('wine'); assert.deepStrictEqual([s.qty, s.income], [20, 360], '수수료 0%');
  v.sailTo('hakata'); let d; for (let i = 0; i < 4; i++) d = v.stepDay(); assert.ok(d.encounter, '4일째에 만난다'); const sb = v.openBattle(d.encounter); assert.deepStrictEqual([sb.S.turns, sb.S.mp, sb.S.range, sb.S.gunHull, sb.fleets.me.captain.war], [9, 5, 4, 3, 95]);
});
ok('동현항 스테이지: 자금을 모으면 이긴다 · 기한(바다에서 보낸 날)이 지나면 진다 · 조건이 없으면 끝나지 않는다', () => {
  const mk = list => { const st = H.newState(), w = hw(), r = H.applyDonghyunLang(H.lang.compose(list, '', { world: w }), st, { world: w }); assert.ok(r.ok, r.errors.join()); return new H.Voyage(w, { rng: new DH.RNG(3), state: st }); };
  let v = mk([[20, 1300], [21, 30], [14, 0]]); assert.deepStrictEqual([v.stage, v.over], [{ gold: 1300, days: 30 }, null]); v.sell('wine'); v.sell('wine'); assert.strictEqual(v.over, null); v.gold = 1290; v.sell('wine');
  assert.deepStrictEqual([v.over, v.overWhy, v.buy('wine').why, v.sailTo('seville').why, v.can('hire').why], ['won', 'gold', '탐험이 끝났다', '탐험이 끝났다', '탐험이 끝났다']);
  v = mk([[20, 9000], [21, 30], [14, 0]]); v.steer('left'); for (let i = 0; i < 29; i++) v.stepDay(); assert.strictEqual(v.over, null); v.stepDay(); assert.deepStrictEqual([v.over, v.overWhy, v.day, v.stepDay().ok], ['lost', 'time', 30, false]);
  v = mk([[20, 500]]); assert.deepStrictEqual([v.over, v.overWhy], ['won', 'gold'], '시작부터 채웠으면 바로 끝난다');
  v = mk([[14, 0]]); v.gold = 9999999; v.sailTo('elmina'); while (!v.port && !v.over) v.stepDay(); assert.deepStrictEqual([v.port, v.over], ['elmina', null]);
  v = mk([[20, 1500], [21, 30]]); v.leave(); v.settleBattle({ winner: 'me', fled: null, loot: 900, me: { ships: [{ ref: 's1', hull: 60, crew: 28, out: null }] } }); assert.deepStrictEqual([v.gold, v.over, v.overWhy], [1900, 'won', 'gold'], '해전에서 얻은 금으로도 이긴다');
});
ok('동현항 설정: 틀린 번호와 값은 까닭을 말하고 globalState를 그대로 둔다 · 시작 짐이 적재량을 넘으면 막는다 · 예제 열이 모두 읽힌다', () => {
  const w = hw(), st = H.newState(), same = JSON.stringify(st), L = H.lang;
  const E = (list, re) => { const r = H.applyDonghyunLang(L.compose(list, '', { world: w }), st, { world: w }); assert.strictEqual(r.ok, false); assert.ok(re.test(r.errors[0]), r.errors[0]); assert.strictEqual(JSON.stringify(st), same); };
  E([[3, 500], [8, 37, 10]], /설정 8\(시작 짐\): 교역품은 36가지뿐이다/); E([[6, 41]], /설정 6\(시작 선원\): 선원 41명은 배의 10~40명 밖이다/); E([[6, 9]], /10~40명 밖/); E([[4, 121]], /시작 식량\(일\) 값 121은 쓸 수 없다\. 0~120만 된다/);
  E([[8, 1, 160], [8, 2, 41]], /시작 짐 201개는 배에 다 실리지 않는다\. 적재량은 200이다\./); E([[8, 3, 141]], /시작 짐 201개는/); E([[30, 9, 50]], /설정 30\(해적 선장 무력\): 해적은 8무리뿐이다/); E([[30, 1, 101]], /무력 값 101은 쓸 수 없다\. 1~100만 된다/);
  E([[23, 7]], /배 이동력 값 7은 쓸 수 없다\. 1~6만 된다/); E([[14, 101]], /0~100만 된다/);
  const r = H.applyDonghyunLang(put(1, 1), st, { world: w }); assert.ok(/1번째 정수 1은 동현항 설정 번호가 아니다/.test(r.errors[0]), r.errors[0]);
  assert.ok(H.applyDonghyunLang(L.compose([[8, 1, 100], [8, 2, 100]], '', { world: w }), H.newState(), { world: w }).ok, '적재량에 꼭 맞으면 된다');
  const ex = H.examples(w); assert.deepStrictEqual(ex.map(e => e.id), ['none', 'rich', 'stage', 'war', 'poor', 'calm', 'hunger', 'guns', 'scale', 'loop', 'turtle', 'pirates']);
  for (const e of ex) { const s2 = H.newState(), q = H.applyDonghyunLang(e.code, s2, { world: w }); assert.ok(q.ok, e.name + q.errors.join()); assert.strictEqual(q.empty, e.id === 'none'); assert.ok(e.code.startsWith('나는 동현이냐?') && e.code.endsWith('동현이구나')); new H.Voyage(hw(), { state: s2 }); }
  assert.strictEqual(L.describe(H.newState()).length, 23); assert.ok(L.describe(H.newState()).every(x => x.now !== undefined && x.now !== null && x.range), '표의 모든 줄에 범위와 기본값이 있다');
  assert.ok(H.lang instanceof A, '공통 어댑터 클래스를 쓴다');
});
ok('동현항 예제: 이름 앞에 번호 01~11 · 예제마다 새 탐험이 열린다 · 09 변수(배율 1~4) · 10 반복문(열두 교역품 · 적재량에 꼭 찬다)', () => {
  const ex = H.examples(hw()), by = id => ex.find(e => e.id === id), run = code => { const st = H.newState(), w = hw(), r = H.applyDonghyunLang(code, st, { world: w }); return { st, r, w }; };
  const voyage = id => { const { st, r, w } = run(by(id).code); assert.ok(r.ok, id + r.errors.join()); return new H.Voyage(w, { rng: new DH.RNG(3), state: st }); }, hold = v => [...v.cargo].map(([k, h]) => k + ' ' + h.qty).join(' · ');
  ex.forEach((e, i) => { assert.ok(e.name.startsWith(String(i + 1).padStart(2, '0') + ' · '), e.name); assert.ok(e.code.split('\n')[1].startsWith('ㅋㅋ '), e.id + ': 둘째 줄이 설명이다');
    for (const l of e.code.split('\n')) if (l.startsWith('ㅋㅋ')) assert.ok(!l.includes('~'), e.id + ': 주석에 ~가 있으면 문장이 갈린다');
    const v = voyage(e.id); assert.ok(v.cargoUsed <= v.cargoCap && v.port === 'lisbon'); });
  const applied = id => run(by(id).code).r.applied;
  assert.deepStrictEqual(applied('poor'), ['시작 자금 300', '시작 식량(일) 30', '시작 물(일) 30', '시작 짐 포도주 0', '시작 짐 올리브유 0', '교역 단위 5']);
  assert.deepStrictEqual(applied('calm'), ['시작 자금 20,000', '해적을 만날 확률(%/일) 0', '교역 단위 40', '시세 변동 폭(%) 1', '교역소 수수료(%) 0']);
  assert.deepStrictEqual(applied('hunger'), ['시작 식량(일) 10', '시작 물(일) 10', '굶을 때 하루 선원 손실(%) 30', '해적을 만날 확률(%/일) 0']);
  assert.deepStrictEqual(applied('guns'), ['해적을 만날 확률(%/일) 60', '포 사거리 6', '배 이동력 1', '해전 기한(턴) 40', '해적 선장 무력 외눈 선장 50', '해적 선장 무력 폭풍 제독 50']);
  let v = voyage('poor'); assert.deepStrictEqual([v.gold, v.cargoUsed, v.foodDays, v.waterDays], [300, 0, 30, 30]);
  v = voyage('hunger'); assert.deepStrictEqual([v.foodDays, v.waterDays], [10, 10]);
  // 09 변수: 대입 한 줄만 바꾸면 세 값이 함께 바뀐다
  const sc = by('scale').code.split('\n'), at = sc.findIndex(l => l.startsWith('동현아 ')), scale = k => run(sc.map((l, i) => i === at ? '동현아 ' + A.expression(k) : l).join('\n'));
  assert.strictEqual(sc.filter(l => l.startsWith('동현아 ')).length, 1); assert.strictEqual(sc[at], '동현아 ' + A.expression(4));
  v = voyage('scale'); assert.deepStrictEqual([v.gold, v.crew, hold(v)], [4000, 40, 'olive 20 · wine 80'], '올리브유 20은 자료 그대로 남는다');
  for (const k of [1, 2, 3, 4]) { const { st, r } = scale(k); assert.ok(r.ok, k + ': ' + r.errors.join()); assert.deepStrictEqual([st.start.gold, st.start.crew, st.cargo], [k * 1000, k * 10, [['wine', k * 20]]]); }
  assert.ok(/시작 선원 값 0은 쓸 수 없다/.test(scale(0).r.errors.join())); assert.ok(/선원 50명은 배의 10~40명 밖이다/.test(scale(5).r.errors.join()));
  // 10 반복문: 되돌아가는 문장 번호가 주석에 적힌 번호와 같다
  const lp = by('loop').code.split('\n'), jump = lp.find(l => l.startsWith('뭉치 ')), back = lp.findIndex(l => l.includes('되돌아오는 자리')) + 1;
  assert.ok(back > 0 && lp.slice(0, back).every(l => !l.includes('~')), '되돌아오는 자리까지는 한 줄이 한 문장이다');
  assert.strictEqual(jump, `뭉치 동현${'ㅠ'.repeat(21)}? 신중동역 ${A.expression(back)}`); assert.ok(lp[back - 1].includes(`${back}번 문장`) && lp.some(l => l.includes(`${back}번 문장으로 돌아간다`)));
  const L = run(by('loop').code); assert.strictEqual(L.r.output.trim().split('\n').length, 60, '정수 예순 개(설정 스무 개 × 세 정수)'); assert.deepStrictEqual(L.st.cargo.map(c => c[1]), Array(20).fill(10));
  v = voyage('loop'); assert.deepStrictEqual([v.cargo.size, v.cargoUsed, v.cargoCap], [20, 200, 200]); assert.deepStrictEqual([...v.cargo.keys()], [...L.w.goods.keys()].slice(0, 20), '교역품 앞 스무 가지가 자료의 차례대로 실린다');
});
ok('동현항 설정 9 · 15~18: 시작 기함 · 무적 모드 · 통행료 · 선장 수련 값 · 포 보강 값 · 거북선은 어느 탐험에서나 · cheat 배는 무적 모드에서만 · 기함에 맞춰 선원과 짐을 검사한다', () => {
  const w = hw(), L = H.lang, run = list => { const st = H.newState(), r = H.applyDonghyunLang(L.compose(list, '', { world: w }), st, { world: w }); return { st, r }; };
  let { st, r } = run([[9, 2], [15, 1], [16, 50], [17, 0], [18, 1000], [6, 100], [8, 1, 300]]); assert.ok(r.ok, r.errors.join());
  assert.deepStrictEqual([st.start.ship, st.rules.invincible, st.rules.encounter.tollPct, st.rules.inn.train, st.rules.dock.gunGold, r.applied], ['carrack', 1, 50, 0, 1000, ['시작 기함 캐럭', '무적 모드 1', '통행료(자금의 %) 50', '선장 수련 값(금) 0', '포 보강 값(금) 1,000', '시작 선원 100', '시작 짐 포도주 300']]);
  assert.deepStrictEqual([H.RULES.invincible, H.RULES.encounter.tollPct, H.RULES.inn.train, H.RULES.dock.gunGold], [0, 20, 300, 400], '기본값 표는 그대로다');
  const v = new H.Voyage(w, { rng: new DH.RNG(3), state: st }); assert.deepStrictEqual([v.ships[0].type, v.crew, v.cargoUsed, v.cargoCap, v.inv], ['carrack', 100, 320, 480, true]);
  ({ st, r } = run([[17, 0], [18, 150]])); assert.ok(r.ok); const q = new H.Voyage(hw(), { rng: new DH.RNG(3), state: st }); assert.deepStrictEqual([q.train().text, q.addGuns('s1').text, q.gold], ['포동이가 수련했다 · 금 −0 · 무력 70 → 71', '꼬리바람호에 포 2문을 더 달았다 · 금 −150 · 포 10문', 850]);
  const E = (list, re) => { const x = run(list); assert.strictEqual(x.r.ok, false, JSON.stringify(list)); assert.ok(re.test(x.r.errors[0]), x.r.errors[0]); assert.deepStrictEqual(x.st, H.newState()); };
  ({ st, r } = run([[9, 3]])); assert.ok(r.ok, r.errors.join()); assert.deepStrictEqual([st.start.ship, st.rules.invincible, new H.Voyage(hw(), { rng: new DH.RNG(3), state: st }).ships[0].type], ['turtle', 0, 'turtle'], '무적 모드 없이 거북선으로 떠난다');
  { const cw = cheatW(), st2 = H.newState(), r2 = H.applyDonghyunLang(L.compose([[9, 3]], '', { world: cw }), st2, { world: cw }); assert.strictEqual(r2.ok, false); assert.ok(/^거북선은 무적 모드에서만 탄다\. 설정 15\(무적 모드\)를 1로 함께 적는다\.$/.test(r2.errors[0]), r2.errors[0]); assert.deepStrictEqual(st2, H.newState()); } E([[9, 4]], /설정 9\(시작 기함\): 배 종류는 3가지뿐이다/);
  E([[9, 2], [6, 29]], /설정 6\(시작 선원\): 선원 29명은 배의 30~120명 밖이다/); E([[9, 2], [8, 1, 461]], /시작 짐 481개는 배에 다 실리지 않는다\. 적재량은 480이다\./); E([[15, 2]], /무적 모드 값 2는 쓸 수 없다\. 0~1만 된다/); E([[16, 0]], /통행료\(자금의 %\) 값 0은 쓸 수 없다/);
  assert.ok(run([[9, 3], [15, 1]]).r.ok && run([[15, 1], [9, 3]]).r.ok, '적는 차례는 상관없다');
  const rows = L.describe(H.newState()); assert.deepStrictEqual(rows.map(x => x.n), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 30]);
});
ok('동현항 예제 11 · 무적 모드: 거북선으로 떠나 금이 줄지 않고 해전마다 이긴다 · 승리 조건은 적지 않는다', () => {
  const w = hw(), ex = H.examples(w).find(e => e.id === 'turtle'), st = H.newState(), r = H.applyDonghyunLang(ex.code, st, { world: w }); assert.ok(r.ok, r.errors.join());
  assert.strictEqual(ex.name, '11 · 무적 모드: 거북선과 끝없는 자금'); assert.deepStrictEqual(r.applied, ['무적 모드 1', '시작 기함 거북선', '해적을 만날 확률(%/일) 40']); assert.deepStrictEqual(st.stage, { gold: 0, days: 0 });
  const v = new H.Voyage(w, { rng: new DH.RNG(5), state: st }); assert.deepStrictEqual([v.ships[0].type, v.speed, v.over], ['turtle', 3, null]); v.sailTo('calicut'); let met = 0;
  for (let i = 0; i < 400 && !v.port; i++) { const d = v.stepDay(); if (d.encounter) { met++; const res = v.openBattle(d.encounter).auto(); assert.strictEqual(res.winner, 'me'); assert.ok(v.settleBattle(res).ok); } }
  assert.ok(met >= 3 && v.port === 'calicut' && v.crew === 28 && v.ships[0].hull === 200 && v.captain.war > 70, `해적 ${met}번 · ${v.port} · 무력 ${v.captain.war}`);
});

/* ---------- 장면을 화면 없이 돌린다(저장 · 불러오기). 조작 창은 가짜로 받아 적는다 ---------- */
function mk(seed = 1, script) {
  const L = { logs: [], items: [], fn: null, log(t) { L.logs.push(t); }, setInfo() {}, setDetail() {}, setMenu(items, fn) { L.items = items; L.fn = fn; }, press() { return false; }, pressPrimary() { return false; } };
  const world = DH.Hang.parse(hangJ()), engine = new DH.Engine({ width: 480, height: 360, seed, clock: { unit: 'day', start: world.meta.start, ticksPerUnit: 20 } });
  const scene = new DH.Hang.HangSeaScene(engine, world, L); engine.setScene(scene);
  if (script !== undefined) assert.ok(scene.applyDonghyunLang(script).ok);
  /** 틱을 흘린다. 해적을 만나면 싸우기로 하고, 해전이 열리면 선원들에게 맡기고 결과 카드를 넘긴다 */
  const run = ticks => { for (let i = 0; i < ticks; i++) { const t = engine.scene; if (t === scene && scene.mode === 'meet') scene.command('fight'); else if (t !== scene) { if (t.mode === 'result') t.command('back'); else if (t.myTurn && !t.auto) t.command('auto'); } engine.step(1); } };
  const sailTo = pid => { scene.pick(pid); scene.command('sail'); };
  return { world, layout: L, engine, scene, run, sailTo };
}
const pack = k => JSON.parse(JSON.stringify(k.scene.saveGame()));          // 파일이나 브라우저 칸을 거친 것처럼 글자로 바꿨다가 되읽는다
const SET = [[3, 5000], [12, 10], [14, 40], [21, 300], [8, 1, 20], [30, 1, 70]];
const J = x => JSON.parse(JSON.stringify(x));

ok('동현항 저장: 탐험을 적었다가 되살리면 똑같다(뱃길 · 짐의 순서 · 마흔다섯 항구의 시세) · 자료에 있는 것은 적지 않는다', () => {
  const k = mk(7), s = k.scene; s.command('tab:market'); s.command('buy:olive'); s.command('buy:olive'); s.command('buy:wine'); k.sailTo('genoa'); k.run(30);
  const v = s.voyage, j = J(v); assert.ok(!v.port && v.moving && j.path.length > 0 && j.dest === 'genoa', '바다 한가운데');
  const h = DH.Hang.Voyage.restore(k.world, j, { rng: new DH.RNG(1), state: s.state });
  assert.deepStrictEqual(J(h), j); assert.deepStrictEqual([h.moving, h.cargoUsed, h.cargoCap, h.maxCrew, h.foodDays, h.speed], [true, v.cargoUsed, v.cargoCap, v.maxCrew, v.foodDays, v.speed]);
  assert.deepStrictEqual(Object.keys(j), ['gold', 'crew', 'food', 'water', 'x', 'y', 'port', 'lastPort', 'day', 'sinceLand', 'path', 'dest', 'heading', 'over', 'overWhy', 'war', 'ships', 'cargo', 'markets', 'rest', 'prizes', 'contracts', 'taken']);
  assert.deepStrictEqual([j.markets.length, j.cargo.map(c => c[0]), Object.keys(j.ships[0])], [45, [...v.cargo.keys()], ['id', 'type', 'name', 'hull']]);
  const lis = j.markets.find(m => m[0] === 'lisbon')[1], base = k.world.ports.get('lisbon').market; assert.ok(lis.some((e, i) => e[1] !== base[i].price) && lis.some((e, i) => e[2] !== base[i].stock), '사고팔아 움직인 값과 재고가 적힌다(날마다 제자리로 돌아가는 중이다)');
  assert.deepStrictEqual([...h.markets.get('lisbon').values()].map(e => [e.good, e.price, e.stock]), lis);
});
ok('동현항 저장: 바다 한가운데서 저장해 불러오면 멈춘 채 열리고, 계속하면 같은 항해가 이어진다(난수 · 날짜 · 해전 포함)', () => {
  const a = mk(11, DH.Hang.lang.compose(SET)); a.sailTo('calicut'); a.run(130);
  const d = pack(a); assert.deepStrictEqual([d.format, d.version, d.settings, d.clock.unit, d.clock.actors, d.summary.title, d.summary.date], ['donghyunhang-save', 1, SET, 'day', [], '바다', a.engine.clock.label]);
  assert.ok(d.clock.acc > 0 && d.game.port === null && d.game.path.length > 0 && /^자금 [\d,]+ · 선원 \d+명$/.test(d.summary.line), '하루의 중간에 저장했다');
  a.run(3000); const battles = a.layout.logs.filter(t => /^해전이 끝났다/.test(t)).length; assert.ok(battles >= 1, '그 뒤에 해전이 있었다');
  const b = mk(99); b.scene.command('tab:market'); b.scene.command('buy:wine'); b.sailTo('london'); b.run(70);                 // 다른 탐험을 하던 화면
  const r = b.scene.loadGame(d); assert.ok(r.ok, r.why); assert.ok(/저장한 탐험을 불러왔다 · 바다 · .* · ‘계속’을 누르면 이어 간다/.test(r.text));
  assert.deepStrictEqual([b.engine.clock.running, b.engine.clock.label, b.engine.rng.state, b.scene.mode, J(b.scene.voyage)], [false, d.clock.label ?? b.engine.clock.label, d.rng, 'sea', d.game]);
  b.run(40); assert.deepStrictEqual(J(b.scene.voyage), d.game, '멈춰 있는 동안에는 날이 가지 않는다');
  b.scene.command('pause'); assert.strictEqual(b.engine.clock.running, true); b.run(3000);
  assert.deepStrictEqual(J(b.scene.voyage), J(a.scene.voyage), '같은 틱 뒤의 탐험이 같다'); assert.deepStrictEqual([b.engine.clock.label, b.engine.rng.state, b.scene.voyage.day], [a.engine.clock.label, a.engine.rng.state, a.scene.voyage.day]);
  assert.strictEqual(b.layout.logs.filter(t => /^해전이 끝났다/.test(t)).length, battles);
});
ok('동현항 저장: 적용된 동현랭 설정이 함께 저장된다 · 불러오면 편집기와 상관없이 그 설정으로 이어진다', () => {
  const a = mk(3, DH.Hang.lang.compose(SET)); a.scene.command('tab:market'); a.scene.command('sell:wine');
  const d = pack(a), b = mk(3, DH.Hang.lang.compose([[12, 50]])); assert.strictEqual(b.scene.state.rules.price.feePct, 50); assert.ok(b.scene.loadGame(d).ok);
  assert.deepStrictEqual(b.scene.state, a.scene.state); assert.deepStrictEqual(b.scene.settings, SET);
  const v = b.scene.voyage; assert.deepStrictEqual([v.rules.price.feePct, v.rules.encounter.percent, v.stage.days, v.gold], [10, 40, 300, a.scene.voyage.gold]); assert.strictEqual([...v.rivals.values()][0].captain.war, 70, '적 선장 무력 설정도 되살아난다');
  const e = mk(3), d0 = pack(e); assert.deepStrictEqual(d0.settings, []); assert.ok(b.scene.loadGame(d0).ok); assert.deepStrictEqual(b.scene.state, DH.Hang.newState(), '설정 없이 저장한 탐험은 기본값으로 돌아온다');
  const direct = DH.Hang.newState(), viaScript = DH.Hang.newState(); DH.Hang.lang.applySettings(SET, direct, { world: a.world }); DH.Hang.applyDonghyunLang(DH.Hang.lang.compose(SET), viaScript, { world: a.world });
  assert.deepStrictEqual(direct, viaScript, '설정 목록으로 지은 값 = 동현랭 코드로 지은 값');
});
ok('동현항 저장: 맞지 않는 묶음은 까닭을 말하고 하던 탐험을 그대로 둔다', () => {
  const k = mk(7), s = k.scene; s.command('tab:market'); s.command('buy:wine'); const good = pack(k); k.sailTo('seville'); k.run(25); const sea = pack(k);
  const v = s.voyage, before = JSON.stringify(v), clock = JSON.stringify(k.engine.clock), rng = k.engine.rng.state, st = s.state;
  const cases = [
    [null, /동현항 저장 파일이 아니다/], [{ format: 'donghyunsam-save', version: 1 }, /동현항 저장 파일이 아니다/], [d => { d.version = 3; }, /지원하지 않는 저장 형식 버전이다\(3\)/],
    [d => { d.settings = 'x'; }, /저장된 설정이 맞지 않는다/], [d => { d.settings = [[14, 101]]; }, /저장된 설정이 맞지 않는다.*만날 확률/], [d => { d.settings = [[8, 1, 9999]]; }, /저장된 설정이 맞지 않는다/],
    [d => { d.clock.unit = 'month'; }, /날짜 정보가 맞지 않는다/], [d => { d.clock.day = 0; }, /날짜 정보/], [d => { d.clock.actors = ['x']; }, /날짜 정보/], [d => { d.clock.speed = 0; }, /날짜 정보/], [d => { d.rng = 'a'; }, /난수 정보가 맞지 않는다/],
    [d => { delete d.game; }, /탐험 정보가 없다/], [d => { d.game.gold = -1; }, /탐험대 정보가 맞지 않는다/], [d => { d.game.crew = 2.5; }, /탐험대 정보/], [d => { d.game.over = 'won'; }, /진행 정보가 맞지 않는다/], [d => { d.game.crew = 0; }, /진행 정보/],
    [d => { d.game.port = 'atlantis'; }, /배의 자리가 지도와 맞지 않는다/], [d => { d.game.x += 1; }, /배의 자리/], [d => { d.game.heading = 'up'; }, /배의 자리/], [d => { d.game.path = [[0, 0], 'x']; }, /배의 자리/],
    [d => { d.game.ships = []; }, /배 정보가 자료와 맞지 않는다/], [d => { d.game.ships[0].type = 'yamato'; }, /배 정보/], [d => { d.game.ships[0].hull = 99999; }, /배 정보/],
    [d => { d.game.cargo.push(['wine', 5, 10]); }, /짐 정보가 자료와 맞지 않는다/], [d => { d.game.cargo[0][1] = 0; }, /짐 정보/], [d => { d.game.cargo[0][0] = 'kimchi'; }, /짐 정보/],
    [d => { d.game.markets.push(d.game.markets[0]); }, /시세 정보가 자료와 맞지 않는다/], [d => { d.game.markets[0][1][0][1] = 0; }, /시세 정보/], [d => { d.game.markets[0][0] = 'atlantis'; }, /시세 정보/],   // v0.13부터 항구 · 교역품이 모자란 것(v0.10 저장)과 순서는 받는다
    [d => { d.game.rest = [['kraken', 9]]; }, /해적 정보가 맞지 않는다/], [d => { d.game.prizes = [{ type: 'caravel', hull: 999 }]; }, /빼앗은 배 정보/], [d => { d.game.contracts = [{ id: 'x', from: 'lisbon', to: 'oslo', good: 'wine', qty: 0, reward: 1, due: 9 }]; }, /의뢰 정보/], [d => { d.game.ships[0].won = 2; }, /배 정보/]];
  for (const [c, re] of cases) {
    const d = typeof c === 'function' ? J(good) : c; if (typeof c === 'function') c(d);
    const r = s.loadGame(d); assert.ok(!r.ok && re.test(r.why), `${re} ← ${r.why}`);
    assert.ok(s.voyage === v && s.state === st && JSON.stringify(v) === before && JSON.stringify(k.engine.clock) === clock && k.engine.rng.state === rng, '하던 탐험이 바뀌었다 ' + re);
  }
  const d2 = J(sea); d2.game.x = 0; d2.game.y = 0; assert.ok(/배의 자리/.test(s.loadGame(d2).why), '뭍 위의 배는 받지 않는다');
  assert.ok(s.loadGame(good).ok, '멀쩡한 묶음은 그 뒤에도 불러진다'); assert.deepStrictEqual([s.voyage.port, s.mode, k.engine.clock.running], ['lisbon', 'port', false]);
});
ok('동현항 저장: 해전 중에는 저장하지 못한다 · 불러오기는 해전 중에도 된다(해전을 접는다) · 끝난 탐험도 저장된다 · 화면 정보가 이상하면 버린다', () => {
  const k = mk(5, DH.Hang.lang.compose([[14, 100]])), s = k.scene; assert.deepStrictEqual(s.saveInfo(), { ok: true }); const d = pack(k);
  k.sailTo('calicut'); for (let i = 0; i < 4000 && s.mode !== 'meet'; i++) k.engine.step(1);
  assert.deepStrictEqual([s.mode, k.engine.clock.running, s.saveInfo()], ['meet', false, { ok: false, why: '해적과 마주친 동안에는 저장할 수 없다. 먼저 어떻게 할지 고른다.' }], '해적 출현 카드가 떠 있는 동안에도 저장하지 못한다');
  s.command('fight'); assert.ok(k.engine.scene instanceof DH.Hang.HangBattleScene); assert.deepStrictEqual(s.saveInfo(), { ok: false, why: '해전이 끝난 뒤에 저장할 수 있다.' });
  const r = s.loadGame(d); assert.ok(r.ok && !/계속/.test(r.text)); assert.ok(k.engine.scene === s && s.mode === 'port' && s.voyage.port === 'lisbon' && s.voyage.day === 0, '해전을 접고 저장한 날로 돌아온다');
  const w = mk(2, DH.Hang.lang.compose([[20, 500]])); w.scene.command('tab:market'); w.scene.command('sell:wine'); assert.deepStrictEqual([w.scene.mode, w.scene.voyage.over, w.scene.saveInfo().ok], ['over', 'won', true]);
  const x = mk(9); assert.ok(x.scene.loadGame(pack(w)).ok); assert.deepStrictEqual([x.scene.mode, x.scene.voyage.overWhy, x.layout.items[0].id], ['over', 'gold', 'again']);
  const t = mk(4); t.scene.command('tab:dock'); const dt = pack(t); assert.deepStrictEqual(Object.keys(dt.scene), ['selected', 'spot', 'tab', 'follow', 'leg', 'cam']); assert.strictEqual(dt.scene.tab, 'dock');
  assert.ok(x.scene.loadGame(dt).ok); assert.strictEqual(x.scene.tab, 'dock', '보던 창구가 그대로 열린다');
  dt.scene = { selected: 'atlantis', tab: 'casino', spot: [0, 0], leg: -3, cam: { x: 'a' } }; assert.ok(x.scene.loadGame(dt).ok); assert.deepStrictEqual([x.scene.selected, x.scene.tab, x.scene.spot, x.scene.leg], [null, null, null, 0]);
});
ok('동현항 저장: 선장 무력과 보강한 포가 적힌다 · v0.07까지의 저장(둘 다 없음)도 열린다 · 틀린 값은 버린다', () => {
  const v = V(); v.addGuns('s1'); v.train(); const j = J(v); assert.deepStrictEqual([j.war, j.ships], [71, [{ id: 's1', type: 'caravel', name: '꼬리바람호', hull: 60, plus: 2 }]]);
  const h = H.Voyage.restore(hw(), j, { rng: new DH.RNG(1) }); assert.deepStrictEqual([h.captain.war, h.gunsOf(h.ships[0]), J(h)], [71, 10, j]);
  const old = J(V()); delete old.war; assert.deepStrictEqual(Object.keys(old.ships[0]), ['id', 'type', 'name', 'hull'], '보강한 포가 없으면 적지 않는다'); const o = H.Voyage.restore(hw(), old, { rng: new DH.RNG(1) }); assert.deepStrictEqual([o.captain.war, o.ships[0].plus, o.gunsOf(o.ships[0])], [70, 0, 8]);
  const st = H.newState(); st.start.war = 95; assert.strictEqual(H.Voyage.restore(hw(), old, { rng: new DH.RNG(1), state: st }).captain.war, 95, '옛 저장은 설정의 무력을 쓴다');
  { const OLD = ['lisbon', 'seville', 'london', 'amsterdam', 'genoa', 'venice', 'istanbul', 'alexandria', 'elmina', 'sofala', 'mombasa', 'aden', 'hormuz', 'goa', 'calicut', 'malacca', 'canton', 'hakata', 'santodomingo', 'veracruz'], G12 = hangJ().goods.slice(0, 12).map(g => g.id);   // v0.10의 항구 20곳 · 교역품 12가지
    const t = V(); t.markets.get('lisbon').get('wine').price = 25; const o10 = J(t); for (const k of ['rest', 'prizes', 'contracts', 'taken']) delete o10[k];
    o10.markets = o10.markets.filter(([pid]) => OLD.includes(pid)).map(([pid, l]) => [pid, l.filter(e => G12.includes(e[0]))]);
    const r10 = H.Voyage.restore(hw(), o10, { rng: new DH.RNG(1) }); assert.deepStrictEqual([r10.markets.size, r10.markets.get('lisbon').get('wine').price, r10.markets.get('nagasaki').get('silver').price, r10.prizes, r10.contracts, r10.cargoCap], [45, 25, hw().ports.get('nagasaki').market.find(e => e.good === 'silver').price, [], [], 200], 'v0.10 저장(항구 20 · 교역품 12)도 열린다 · 없는 항구와 교역품은 처음 시세');
    const dup = J(o10); dup.markets[0][1].push(dup.markets[0][1][0]); assert.throws(() => H.Voyage.restore(hw(), dup, { rng: new DH.RNG(1) }), /시세 정보가 자료와 맞지 않는다/);
    const ghost = J(o10); ghost.markets[0][1][0][0] = 'nothing'; assert.throws(() => H.Voyage.restore(hw(), ghost, { rng: new DH.RNG(1) }), /시세 정보가 자료와 맞지 않는다/); }
  for (const war of [0, 101, 'x', 1.5]) assert.throws(() => H.Voyage.restore(hw(), { ...j, war }, { rng: new DH.RNG(1) }), /선장 정보가 맞지 않는다/);
  for (const plus of [9, -1, 1.5, 'x']) assert.throws(() => { const k = J(j); k.ships[0].plus = plus; H.Voyage.restore(hw(), k, { rng: new DH.RNG(1) }); }, /배 정보가 자료와 맞지 않는다/);
});
ok('동현항 만남: 해적 기함이 올라타면 잃는 선원을 미리 알려 준다 · 해전의 백병전과 같은 값 · 캐러벨 기함은 폭풍 제독에게 한 번에 빼앗기고 캐럭 기함은 버틴다', () => {
  const v = V(), R = id => v.flagRisk(v.rivals.get(id));
  assert.deepStrictEqual([R('redsail'), R('blackreef'), R('storm')], [{ ours: 28, theirs: 24, hit: 7, taken: false }, { ours: 28, theirs: 28, hit: 11, taken: false }, { ours: 28, theirs: 83, hit: 28, taken: true }]);
  for (const id of ['redsail', 'blackreef', 'storm']) { const f = fight(id), p = f.b.boardPreview(f.foe[0], f.me[0]), k = f.v.flagRisk(f.v.rivals.get(id)); assert.deepStrictEqual([p.hit, f.me[0].crew, f.foe[0].crew], [k.hit, k.ours, k.theirs], id); }
  const full = V(); full.gold = 9999; while (full.can('hire').ok) full.hire(); assert.deepStrictEqual(full.flagRisk(full.rivals.get('storm')), { ours: 40, theirs: 83, hit: 40, taken: true }, '선원을 가득 채워도 캐러벨은 한 번에 빼앗긴다');
  const big = V(); big.gold = 99999; big.swapShip('s1', 'carrack'); while (big.can('hire').ok) big.hire(); assert.deepStrictEqual(big.flagRisk(big.rivals.get('storm')), { ours: 120, theirs: 83, hit: 40, taken: false });
  const st = H.newState(); st.rules.invincible = 1; const inv = V({ state: st }); assert.deepStrictEqual(inv.flagRisk(inv.rivals.get('storm')), { ours: 28, theirs: 83, hit: 0, taken: false });
});
ok('동현항 화면: 해적 출현 카드에서 싸운다 · 달아난다 · 통행료를 고른다 · 고르기 전에는 날이 가지 않는다 · 달아나거나 내면 잡아 둔 뱃길을 이어 간다', () => {
  const meet = seed => { const k = mk(seed, DH.Hang.lang.compose([[14, 100]])); k.sailTo('calicut'); for (let i = 0; i < 4000 && k.scene.mode !== 'meet'; i++) k.engine.step(1); assert.strictEqual(k.scene.mode, 'meet'); return k; };
  let k = meet(5), s = k.scene, v = s.voyage; const rv = s.meet, m = v.meetInfo(rv);
  assert.ok(k.layout.logs.some(t => t === `해적 출현 · ${DH.josa(rv.name, '과', '와')} 마주쳤다`), k.layout.logs.slice(-3).join(' / '));
  assert.deepStrictEqual(k.layout.items.map(i => i.id), ['fight', 'evade', 'toll', 'barter', 'scare']);
  assert.deepStrictEqual([k.layout.items[3].label, k.layout.items[4].disabled, k.layout.items[4].hint], [`짐으로 치른다 · 짐 −${m.barter.qty}`, !m.scare.ok, m.scare.ok ? undefined : m.scare.why]); assert.deepStrictEqual([k.layout.items[0].label, k.layout.items[0].primary, k.layout.items[1].label, k.layout.items[2].label], ['싸운다', true, m.fast ? '달아난다 · 따돌린다' : `달아난다 · 짐 −${m.drop}`, `통행료를 낸다 · 금 ${m.toll}`]);
  const day = v.day; k.engine.step(200); assert.deepStrictEqual([v.day, s.mode, k.engine.clock.running], [day, 'meet', false], '고르기 전에는 멈춰 있다'); s.command('sail'); s.command('pause'); s.command('tab:market'); assert.strictEqual(s.mode, 'meet', '다른 단추는 듣지 않는다');
  const g0 = v.gold; s.command('toll'); assert.deepStrictEqual([s.mode, s.meet, v.gold, k.engine.clock.running, v.moving], ['sea', null, g0 - m.toll, true, true]); k.engine.step(20); assert.strictEqual(v.day, day + 1, '뱃길을 이어 간다');
  k = meet(5); s = k.scene; v = s.voyage; const used = v.cargoUsed, mi = v.meetInfo(s.meet); s.command('evade'); assert.deepStrictEqual([s.mode, v.cargoUsed, k.engine.clock.running], ['sea', used - mi.drop, true]);
  k = meet(5); s = k.scene; s.voyage.gold = 50; s.refresh(); assert.deepStrictEqual([k.layout.items[2].disabled, k.layout.items[2].hint, k.layout.items[2].label], [true, '금이 모자란다', '통행료를 낸다']); s.command('toll'); assert.strictEqual(s.mode, 'meet', '못 내면 그대로다');
  const got = []; k.layout.press = n => got.push(n); k.layout.pressPrimary = () => got.push('primary'); for (const code of ['ArrowLeft', 'Space', 'Escape', 'Digit2', 'Enter']) s.onKey(code);
  assert.deepStrictEqual([got, s.mode, s.voyage.heading], [[2, 'primary'], 'meet', v.heading], '숫자 키와 Enter만 듣는다(방향키 · Space · Esc는 듣지 않는다)');
  s.command('fight'); assert.ok(k.engine.scene instanceof DH.Hang.HangBattleScene && s.meet === null);
});
ok('동현항 해적 v0.13: 짐으로 치르기(기준 값이 높은 것부터) · 위협(포 200% · 선원 100%) · 바다마다 다른 해적 · 이긴 무리는 60일 쉰다 · 빼앗은 배', () => {
  let v = V(); v.leave(); const R = id => v.rivals.get(id);
  assert.deepStrictEqual(v.meetInfo(R('redsail')).barter, { ok: true, take: [['wine', 7]], value: 210, qty: 7 }, '포도주 기준 값 30 × 7 = 210 ≥ 통행료 200');
  assert.deepStrictEqual([v.payCargo(R('redsail')).text, v.cargoUsed, v.gold, v.sinceLand], ['붉은 돛 해적단에게 짐으로 통행료를 치렀다 · 포도주 7', 53, 1000, 0]);
  v.cargo.clear(); assert.deepStrictEqual(v.payCargo(R('redsail')), { ok: false, why: '실은 짐이 없다' });
  v.load('olive', 1, 0); assert.ok(/^짐을 모두 쳐도 금 \d+이라 통행료에 못 미친다$/.test(v.meetInfo(R('redsail')).barter.why));
  v = V(); v.leave(); assert.deepStrictEqual(v.scareOff(R('redsail')), { ok: false, why: '포 16문 · 선원 24명은 있어야 물러난다(우리 포 8문 · 선원 28명)' });
  v = V(); v.gold = 99999; v.swapShip('s1', 'turtle'); v.leave(); assert.deepStrictEqual([v.scareOff(R('redsail')).ok, v.meetInfo(R('sulusea')).scare.ok], [true, false], '거북선 포 40문 · 선원 28명: 붉은 돛(포 8 · 선원 24)은 물러나고 술루(선원 30)는 아니다');
  const st = H.newState(); st.rules.invincible = 1; const iv = V({ state: st }); iv.leave(); assert.ok(iv.scareOff(iv.rivals.get('storm')).ok, '무적 모드에서는 늘 물러난다');
  v = V(); assert.deepStrictEqual(v.roamers().map(r => r.id), ['redsail', 'blackreef', 'storm', 'corsair'], '리스본 앞바다: 어디나 다니는 셋과 대서양 사략선');
  for (const r of v.rivals.values()) { const T = id => v.world.shipTypes.get(id); assert.ok(r.captain.war <= 86 && r.crew <= 110 && r.ships.length <= 2, r.id); if (r.areas) assert.ok(r.note && r.areas.every(a => a.length === 4 && a[0] < a[2] && a[1] < a[3]), r.id); }
  v.rest.set('storm', v.day + 60); assert.deepStrictEqual(v.roamers().map(r => r.id), ['redsail', 'blackreef', 'corsair'], '쉬는 무리는 나오지 않는다'); v.day += 60; assert.ok(v.roamers().some(r => r.id === 'storm'), '60일이 지나면 다시 나온다');
  // 빼앗은 배: 이긴 해전의 결과에서 선원을 모두 잃은 적 배
  v = V(); v.leave(); v.fighting = 'redsail';
  const res = { winner: 'me', fled: false, loot: 300, me: { ships: [{ ref: 's1', type: 'caravel', hull: 50, crew: 20, out: null }] }, foe: { ships: [{ ref: 'f0', type: 'caravel', hull: 4, crew: 0, out: 'taken' }, { ref: 'f1', type: 'caravel', hull: 0, crew: 0, out: 'sunk' }] } };
  const o = v.settleBattle(res); assert.deepStrictEqual([o.prizes, v.prizes, v.rest.get('redsail'), / · 빼앗은 배 1척$/.test(o.text)], [1, [{ type: 'caravel', hull: 15 }], 60, true], '선체는 적어도 25%(60의 25% = 15)로 끌고 온다');
  const g0 = v.gold; assert.deepStrictEqual([v.sellPrize(0).income, v.gold - g0, v.prizes.length], [500, 500, 0], '캐러벨 2,000의 25%');
  v.prizes = [{ type: 'caravel', hull: 15 }]; const t = v.takePrize(0); assert.ok(t.ok && /^빼앗은 캐러벨에 .+이?라는 이름을 붙여 함대에 넣었다 · 선체 15\/60 · 배 2척$/.test(t.text), t.text);
  assert.deepStrictEqual([v.ships.length, v.ships[1].won, v.cargoCap, v.prizes.length], [2, 1, 400, 0]);
  v.enter('lisbon'); assert.deepStrictEqual(v.can('sell', v.ships[1].id).income, 500, '도크에서도 빼앗은 배는 25%로 친다');
  const back = H.Voyage.restore(hw(), JSON.parse(JSON.stringify(v))); assert.deepStrictEqual([back.ships[1].won, back.rest.get('redsail')], [1, 60], '저장하고 되살려도 같다');
  v.prizes = [{ type: 'caravel', hull: 15 }, { type: 'caravel', hull: 15 }]; v.ships.push({ id: 's9', type: 'caravel', name: 'x', hull: 60, plus: 0 }); assert.deepStrictEqual(v.takePrize(0), { ok: false, why: '배는 3척까지다' });
});
ok('동현항 교역 v0.13: 가득 사기 · 모두 팔기 · 짐 버리기 · 갈래별 짐 · 조합 의뢰(같은 날이면 늘 같다 · 기한 · 보수 = 받을 항구 기준 값 × 수량 × 130%)', () => {
  let v = V(); v.gold = 1000; const b = v.buyMax('wine'); assert.deepStrictEqual([b.qty, b.cost, v.gold, v.cargoUsed], [50, 1000, 0, 110], '금이 닿는 만큼');
  v.gold = 1e6; const b2 = v.buyMax('wine'); assert.deepStrictEqual([v.cargoUsed, v.cargoCap, b2.ok], [200, 200, true], '자리가 찰 때까지'); assert.strictEqual(v.buyMax('wine').why, '배에 실을 자리가 없다');
  const s = v.sellAll('wine'); assert.deepStrictEqual([s.qty, v.held('wine'), s.income > 0], [180, 0, true]); assert.strictEqual(v.sellAll('wine').why, '실은 것이 없다');
  assert.deepStrictEqual([v.dump('olive').text, v.held('olive'), v.dump('olive', 99).qty, v.held('olive'), v.dump('olive').why], ['올리브유 10개를 버렸다 · 짐 10/200', 10, 10, 0, '실은 것이 없다']);
  v = V(); const k = v.cargoByKind(); assert.deepStrictEqual(JSON.parse(JSON.stringify([...(k instanceof Map ? k : Object.entries(k))].map(([kk, x]) => [kk, x.qty ?? x]))).length > 0, true);
  v = V(); const of = v.offers(); assert.ok(of.length >= 1 && of.length <= 3); assert.deepStrictEqual(V().offers(), of, '같은 날 같은 항구면 늘 같다');
  for (const o of of) { const to = v.markets.get(o.to).get(o.good); assert.ok(to.refStock === 0 && o.reward === Math.round(o.qty * to.ref * 1.3) && o.qty % 10 === 0 && o.qty >= 20 && o.qty <= 60 && o.days === 90, JSON.stringify(o)); }
  const rng = v.rng.state; const a = v.accept(of[0].id); assert.ok(a.ok && v.contracts.length === 1 && v.contracts[0].due === 90 && v.rng.state === rng, '의뢰는 게임의 난수를 쓰지 않는다'); assert.deepStrictEqual(v.accept(of[0].id), { ok: false, why: '그런 의뢰가 없다' });
  const c = v.contracts[0]; assert.ok(/가져가야 한다$/.test(v.canDeliver(c).why)); v.enter(c.to); v.cargo.clear(); assert.ok(/개 모자란다$/.test(v.canDeliver(c).why));
  v.load(c.good, c.qty, 0); const g0 = v.gold, d = v.deliver(c.id); assert.deepStrictEqual([d.ok, v.gold - g0, v.contracts.length, v.held(c.good)], [true, c.reward, 0, 0]);
  v = V(); v.accept(v.offers()[0].id); v.leave(); for (let i = 0; i < 91 && !v.over; i++) { v.food = 1e6; v.water = 1e6; v.stepDay(); } assert.strictEqual(v.contracts.length, 0, '기한이 지나면 사라진다');
});
ok('동현항 화면: 여관의 선장 수련 · 도크에서 배를 골라 포 보강 · 바꾸기 · 팔기 · 거북선은 어느 탐험에서나 보인다', () => {
  let k = mk(3), s = k.scene, v = s.voyage, ids = () => k.layout.items.map(i => i.id), item = id => k.layout.items.find(i => i.id === id);
  s.command('tab:inn'); assert.deepStrictEqual([ids(), item('train').label], [['hire', 'train', 'back'], '선장 수련 무력 +1 · 금 300']); s.command('train'); assert.deepStrictEqual([v.captain.war, v.gold], [71, 700]); s.command('back');
  s.command('tab:dock'); assert.deepStrictEqual([ids(), item('pick:s1').label, item('ship:turtle').disabled], [['repair', 'pick:s1', 'ship:caravel', 'ship:carrack', 'ship:turtle', 'back'], '꼬리바람호 손보기', true]);
  s.command('pick:s1'); assert.deepStrictEqual([ids(), item('gun').label, item('swap:carrack').disabled, item('swap:carrack').hint, item('sellship').hint], [['gun', 'swap:carrack', 'swap:turtle', 'sellship', 'back'], '포 보강 +2문 · 금 400', true, '금이 모자란다', '마지막 한 척은 팔 수 없다']);
  s.command('gun'); assert.deepStrictEqual([v.ships[0].plus, v.gold], [2, 300]); v.gold = 9000; s.refresh(); assert.strictEqual(item('swap:carrack').label, '캐럭으로 바꾸기 · 금 4,000'); s.command('swap:carrack');
  assert.deepStrictEqual([v.ships[0].type, v.gold, ids(), item('swap:caravel').label], ['carrack', 5000, ['gun', 'swap:caravel', 'swap:turtle', 'sellship', 'back'], '캐러벨로 바꾸기 · 금 +500']);
  s.command('back'); assert.deepStrictEqual([s.tab, s.dockShip, ids()[0]], ['dock', null, 'repair'], '돌아가기 한 번에 도크로'); s.command('ship:caravel'); s.command('pick:s2'); s.command('sellship'); assert.deepStrictEqual([v.ships.length, s.dockShip, v.gold, ids()[0]], [1, null, 4000, 'repair']);
  s.command('pick:zz'); assert.strictEqual(s.dockShip, null); s.command('pick:s1'); s.onKey('Escape'); assert.deepStrictEqual([s.tab, s.dockShip], ['dock', null]); s.onKey('Escape'); assert.strictEqual(s.tab, null);
  k = mk(3, DH.Hang.lang.compose([[15, 1], [9, 3]])); s = k.scene; v = s.voyage; assert.ok(k.layout.logs.some(t => /무적 모드/.test(t)), k.layout.logs.join(' / ')); s.command('tab:dock'); assert.deepStrictEqual(ids(), ['repair', 'pick:s1', 'ship:caravel', 'ship:carrack', 'ship:turtle', 'back']);
  s.command('ship:turtle'); assert.deepStrictEqual([v.ships.map(sh => sh.type), v.gold], [['turtle', 'turtle'], 1000]); s.command('pick:s1'); assert.deepStrictEqual(ids(), ['gun', 'swap:caravel', 'swap:carrack', 'sellship', 'back']);
  const d = pack(k); const x = mk(9); assert.ok(x.scene.loadGame(d).ok); assert.deepStrictEqual([x.scene.voyage.inv, x.scene.voyage.ships.map(sh => sh.type), x.scene.tab, x.scene.dockShip], [true, ['turtle', 'turtle'], 'dock', null], '저장에 설정이 함께 담겨 무적 모드와 거북선이 되살아난다');
});
console.log(`핵심 시험 ${n}개 통과`);

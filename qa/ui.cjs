// 동현항 화면 시험(Playwright): node build.cjs 뒤에 node qa/ui.cjs
const { chromium } = require('/home/user/node_modules/playwright'); const assert = require('assert'), fs = require('fs'), path = require('path'), fmt = n => Number(n).toLocaleString('ko-KR');
const url = 'file://' + path.join(__dirname, '..', 'index.html'), shot = path.join(__dirname, 'tmp'); fs.mkdirSync(shot, { recursive: true });
(async () => {
  const b = await chromium.launch(), errs = []; let n = 0; const ok = s => { n++; console.log('ok ' + s); };
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  await p.goto(url); await p.waitForTimeout(500);
  await p.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
  /** 캔버스를 화면 가운데로 올리고, 캔버스 안 (x, y)의 화면 좌표를 준다 */
  const at = (x, y) => p.evaluate(([x, y]) => { const cv = document.querySelector('.dh-canvas'); cv.scrollIntoView({ block: 'center' }); const r = cv.getBoundingClientRect(); return [r.left + x, r.top + y]; }, [x, y]);
  const info = () => p.$$eval('.dh-info-item', a => Object.fromEntries(a.map(e => [e.querySelector('dt').textContent, e.querySelector('dd').textContent])));
  const rows = () => p.$$eval('.dh-rows dt', a => Object.fromEntries(a.map(e => [e.textContent, e.nextElementSibling.textContent])));
  const clickWorld = async (x, y) => { const s = await p.evaluate(([x, y]) => { const cv = document.querySelector('.dh-canvas'); cv.scrollIntoView({ block: 'center' }); const c = __dh.scene.cam.toScreen(x, y), r = cv.getBoundingClientRect(); return { x: r.left + c.x * r.width / 480, y: r.top + c.y * r.height / 360 }; }, [x, y]); await p.mouse.click(s.x, s.y); };
  const ink = () => p.evaluate(() => { const c = document.querySelector('.dh-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, s = new Set(); for (let i = 0; i < d.length; i += 4 * 97) s.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2]); return s.size; });

  // 1) 화면 나누기(데스크톱): 위 띠 · 가운데 캔버스 · 오른쪽 조작 창
  const L = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { top: r('.dh-top'), stage: r('.dh-stage'), panel: r('.dh-panel'), dpr: devicePixelRatio, cw: document.querySelector('.dh-canvas').width }; });
  assert.ok(L.top.bottom <= L.stage.top && L.panel.left >= L.stage.right && Math.abs(L.panel.top - L.stage.top) < 2, '오른쪽 조작 창'); assert.ok(Math.abs(L.stage.width / L.stage.height - 480 / 360) < 0.01); assert.strictEqual(L.cw, 480 * L.dpr);
  ok('화면 나누기: 위 정보 띠 · 가운데 캔버스(4:3) · 오른쪽 조작 창');

  const G = fn => p.evaluate(fn), step = n => p.evaluate(n => __dh.engine.step(n), n), menu = () => p.$$eval('.dh-menu button', a => a.map(e => e.dataset.id + (e.disabled ? '!' : '')));
  const title = () => p.$eval('.dh-detail-title', e => e.textContent), logTop = (k = 1) => p.$$eval('.dh-log li', (a, k) => a.slice(0, k).map(e => e.textContent).join(' / '), k);
  const tapHex = async (c, r) => { const q = await p.evaluate(([c, r]) => { const cv = document.querySelector('.dh-canvas'); cv.scrollIntoView({ block: 'center' }); const s = __dh.engine.scene, P = s.grid.center(c, r), k = s.cam.toScreen(P.x, P.y), R = cv.getBoundingClientRect(); return { x: R.left + k.x * R.width / 480, y: R.top + k.y * R.height / 360 }; }, [c, r]); await p.mouse.click(q.x, q.y); };
  const DHro = w => { const c = w.charCodeAt(w.length - 1), f = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0; return (f === 0 || f === 8 ? '와' : '과') + ' 해전'; };
  const hexDist = (a, b) => { const x1 = a[0] - (a[1] - (a[1] & 1)) / 2, x2 = b[0] - (b[1] - (b[1] & 1)) / 2, dx = x1 - x2, dz = a[1] - b[1]; return Math.max(Math.abs(dx), Math.abs(dz), Math.abs(dx + dz)); };
  const px = (c, r, dx = 0, dy = 0) => p.evaluate(([c, r, dx, dy]) => { const s = __dh.engine.scene, P = s.grid.center(c, r), k = s.cam.toScreen(P.x + dx, P.y + dy), cv = document.querySelector('.dh-canvas'), f = cv.width / 480; return [...cv.getContext('2d').getImageData(Math.round(k.x * f), Math.round(k.y * f), 1, 1).data].slice(0, 3); }, [c, r, dx, dy]);
  const lang = () => p.evaluate(() => { const o = document.querySelector('#result'); return { ex: [...document.querySelectorAll('#example option')].map(x => x.value), nums: [...document.querySelectorAll('#lang-rows tr')].map(tr => tr.children[0].textContent).join(' '), code: document.querySelector('#code').value, out: o.textContent, state: o.dataset.kind || '' }; });
  const setCode = text => p.fill('#code', text), runLang = async () => { await p.click('#run'); return lang(); }, compose = list => p.evaluate(list => __dh.lang.compose(list, '', { world: __dh.world }), list);
  const label = id => p.$eval(`button[data-id="${id}"]`, e => e.textContent), note = () => p.$eval('.dh-note', e => e.textContent);
  let lg;
  // ───────── 동현항 ─────────
  await p.waitForTimeout(400);
  assert.deepStrictEqual(await info(), { 날짜: '1522년 5월 1일', 자금: '1,000', 식량: '90일', 물: '60일', 선원: '28/40명', 짐: '60/120' }); assert.ok(await ink() > 3);
  assert.deepStrictEqual(await G(() => [__dh.scene.grid.kind, __dh.scene.grid.wrapX, __dh.engine.clock.unit, __dh.engine.clock.running, __dh.scene.mode, __dh.voyage.port]), ['square', true, 'day', false, 'port', 'lisbon']);
  assert.strictEqual(await p.$$eval('.dh-canvas', a => a.length), 1, '앞 게임 캔버스가 남았다');
  await p.waitForTimeout(500); assert.strictEqual((await info()).날짜, '1522년 5월 1일', '닻을 내린 동안 날짜가 가지 않는다');
  assert.deepStrictEqual(await menu(), ['tab:market', 'tab:inn', 'tab:dock', 'tab:supply', 'sail', 'follow', 'zin', 'zout']); assert.strictEqual(await title(), '포동이 탐험대'); let hr = await rows();
  assert.deepStrictEqual([hr['있는 곳'], hr.선장, hr.짐, hr.배], ['리스본', '포동이 · 무력 70', '포도주 40 · 올리브유 20', '꼬리바람호(캐러벨) 선체 60/60']);
  await p.focus('.dh-canvas'); const camX = await G(() => __dh.scene.cam.x); await p.keyboard.press('ArrowRight'); assert.ok(await G(() => __dh.scene.cam.x) > camX, '항구에서는 방향키가 지도를 옮긴다'); assert.strictEqual(await G(() => __dh.voyage.port), 'lisbon'); await p.click('button[data-id=follow]');
  lg = await lang(); assert.deepStrictEqual([lg.ex, lg.nums], [['none', 'rich', 'stage', 'war'], '2 3 4 5 6 7 8 10 11 12 13 14 20 21 22 23 24 30']);
  await G(() => __dh.engine.stop()); await step(1); await p.screenshot({ path: shot + '/ui-hang-port.png' });
  ok('동현항: 탭 바꾸기 · 사각 격자(동서 이어짐) · 리스본에 정박(날짜가 멎음) · 항구 메뉴(교역소 · 여관 · 도크 · 보급 · 출항) · 동현랭 칸이 동현항 예제와 번호 표로 바뀐다');

  // 교역소: 사면 값이 오르고 팔면 내린다
  await p.click('button[data-id="tab:market"]'); assert.strictEqual(await title(), '리스본 교역소'); assert.deepStrictEqual(await menu(), ['buy:wine', 'buy:olive', 'sell:wine', 'sell:olive', 'back']);
  assert.deepStrictEqual([await label('buy:wine'), await label('sell:wine'), await label('sell:olive')], ['포도주 사기 10 · 금 180', '포도주 팔기 10 · 금 +150', '올리브유 팔기 10 · 금 +110']);
  hr = await rows(); assert.deepStrictEqual([hr['포도주 사기'], hr['포도주 40개']], ['값 18 · 재고 200', '산 값 18 · 여기서 팔면 개당 15']);
  await p.click('button[data-id="buy:wine"]'); assert.deepStrictEqual([(await info()).자금, (await info()).짐, (await rows())['포도주 사기'], await label('buy:wine')], ['820', '70/120', '값 19 · 재고 190', '포도주 사기 10 · 금 190']); assert.ok((await logTop()).includes('포도주 10개를 샀다 · 금 −180 · 값 18 → 19'));
  await p.click('button[data-id="sell:olive"]'); assert.deepStrictEqual([(await info()).자금, (await info()).짐], ['930', '60/120']); assert.ok((await logTop()).includes('올리브유 10개를 팔았다 · 금 +110'));
  await p.screenshot({ path: shot + '/ui-hang-market.png' });
  await G(() => { __dh.voyage.gold = 5; __dh.scene.refresh(); }); assert.deepStrictEqual((await menu()).slice(0, 2), ['buy:wine!', 'buy:olive!']); assert.ok((await note()).includes('포도주 사기: 금이 모자란다')); await G(() => { __dh.voyage.gold = 930; __dh.scene.refresh(); });
  await p.click('button[data-id=back]'); assert.strictEqual((await menu())[0], 'tab:market');
  ok('동현항 교역소: 포도주 10개 금 180(값 18 → 19) · 올리브유 10개 금 +110 · 금이 모자라면 단추가 흐려지고 까닭이 적힌다');

  // 여관 · 도크 · 보급
  await p.click('button[data-id="tab:inn"]'); assert.strictEqual(await title(), '리스본 여관'); assert.strictEqual(await label('hire'), '선원 모으기 +5 · 금 50'); await p.click('button[data-id=hire]');
  assert.deepStrictEqual([(await info()).선원, (await info()).자금, (await info()).식량, (await info()).물], ['33/40명', '880', '76일', '50일'], '사람이 늘면 식량과 물의 날 수가 준다'); await p.click('button[data-id=back]');
  await p.click('button[data-id="tab:dock"]'); assert.strictEqual(await title(), '리스본 도크'); assert.deepStrictEqual(await menu(), ['repair!', 'ship:caravel!', 'ship:carrack!', 'back']); assert.ok((await note()).includes('선체 고치기: 고칠 데가 없다') && (await note()).includes('캐러벨 사기: 금이 모자란다'));
  await G(() => { __dh.voyage.ships[0].hull = 50; __dh.scene.refresh(); }); assert.strictEqual(await label('repair'), '선체 고치기 10 · 금 20'); await p.click('button[data-id=repair]'); assert.deepStrictEqual([await G(() => __dh.voyage.ships[0].hull), (await info()).자금], [60, '860']); await p.click('button[data-id=back]');
  await p.click('button[data-id="tab:supply"]'); assert.strictEqual(await title(), '리스본 보급'); assert.deepStrictEqual(await menu(), ['food', 'water', 'back']); assert.deepStrictEqual([await label('food'), await label('water')], ['식량 10일분 · 금 33', '물 가득 채우기']);
  await p.click('button[data-id=food]'); await p.click('button[data-id=water]'); assert.deepStrictEqual([(await info()).식량, (await info()).물, (await info()).자금], ['86일', '60일', '827']); assert.deepStrictEqual(await menu(), ['food', 'water!', 'back']); await p.click('button[data-id=back]');
  ok('동현항 여관 · 도크 · 보급: 선원 +5(금 50) · 선체 10 고치기(금 20) · 식량 10일분(금 33) · 물은 값 없이 가득');

  // 항구를 찍고 출항 → 하루에 2칸 → 세비야 입항
  const portXY = id => p.evaluate(id => { const q = __dh.world.ports.get(id); return __dh.scene.grid.center(q.x, q.y); }, id), cellXY = (c, r) => p.evaluate(([c, r]) => __dh.scene.grid.center(c, r), [c, r]);
  const sea = () => G(() => { const s = __dh.scene, v = s.voyage, c = __dh.engine.clock; return { mode: s.mode, run: c.running, port: v.port, dest: v.dest, at: [v.x, v.y], moving: v.moving, heading: v.heading, day: v.day, sel: s.selected, spot: s.spot, n: __dh.engine.scenes.length, over: v.over, why: v.overWhy, gold: v.gold, crew: v.crew, used: v.cargoUsed }; });
  let Q = await portXY('seville'); await clickWorld(Q.x, Q.y); assert.strictEqual(await title(), '세비야'); hr = await rows();
  assert.deepStrictEqual([hr['파는 것'], hr.뱃길, hr['실은 짐의 시세']], ['포도주 18 · 올리브유 14', '4칸 · 약 2일', '포도주 18(산 값 18) · 올리브유 14(산 값 14)']); assert.ok(hr.시설.startsWith('항구 · 교역소'));
  assert.strictEqual(await label('sail'), '세비야로 출항'); await p.click('button[data-id=sail]'); let S = await sea();
  assert.deepStrictEqual([S.mode, S.run, S.dest, S.sel, S.port], ['sea', true, 'seville', null, null]); assert.deepStrictEqual(await menu(), ['pause', 'speed', 'follow', 'zin', 'zout']); assert.ok((await logTop()).includes('리스본 → 세비야 · 4칸 · 하루 2칸 · 약 2일')); assert.strictEqual((await rows())['있는 곳'], '세비야로 가는 바다');
  await step(10); await p.screenshot({ path: shot + '/ui-hang-sail.png' }); await step(10); assert.deepStrictEqual([(await info()).날짜, (await sea()).port], ['1522년 5월 2일', null]);
  await p.click('button[data-id=pause]'); await step(40); assert.strictEqual((await info()).날짜, '1522년 5월 2일', '멈추면 날이 가지 않는다'); assert.strictEqual(await label('pause'), '계속'); await p.click('button[data-id=pause]');
  await p.click('button[data-id=speed]'); assert.strictEqual(await label('speed'), '빠르기 ×2'); await step(10); S = await sea();
  assert.deepStrictEqual([S.port, S.run, S.mode, S.at, (await info()).날짜, (await info()).식량, (await info()).물], ['seville', false, 'port', await G(() => __dh.world.ports.get('seville').anchor), '1522년 5월 3일', '84일', '58일']);
  assert.ok((await logTop(2)).includes('세비야에 닿았다 · 2일 걸렸다')); assert.strictEqual((await menu())[0], 'tab:market'); await G(() => { __dh.engine.clock.speed = 1; });
  ok('동현항 항해: 세비야를 찍으면 시세와 뱃길(4칸 · 약 2일) · 출항 → 하루 2칸 · 멈춤/계속 · 빠르기 ×2 · 이틀 만에 입항(식량 86 → 84일 · 물 60 → 58일) · 입항하면 날짜가 멎는다');

  // 닻만 올리기 · 입항 단추 · 방향키로 키 잡기 · 바다 찍기
  await G(() => { __dh.state.rules.encounter.percent = 0; });          // 이 단계는 키와 찍기만 본다: 적 함대를 끈다(만남은 다음 단계에서 본다)
  await p.click('button[data-id=sail]'); S = await sea(); assert.deepStrictEqual([S.mode, S.run, S.moving, S.port], ['sea', false, false, null]); assert.deepStrictEqual(await menu(), ['enter', 'pause!', 'speed', 'follow', 'zin', 'zout']); assert.strictEqual(await label('enter'), '세비야에 입항'); assert.ok((await logTop()).includes('닻을 올렸다'));
  await p.click('button[data-id=enter]'); assert.strictEqual((await sea()).mode, 'port'); assert.ok((await logTop()).includes('세비야에 들어왔다')); await p.click('button[data-id=sail]');
  await p.focus('.dh-canvas'); await p.keyboard.press('ArrowUp'); assert.ok((await logTop()).includes('그쪽은 뭍이다')); assert.strictEqual((await sea()).run, false);
  await p.keyboard.press('ArrowLeft'); S = await sea(); assert.deepStrictEqual([S.heading, S.run, S.moving], ['left', true, true]); assert.ok((await logTop()).includes('키를 서쪽으로 잡았다')); assert.strictEqual((await rows())['있는 곳'], '서쪽으로 가는 바다'); assert.deepStrictEqual(await menu(), ['pause', 'speed', 'follow', 'zin', 'zout']);
  await step(20); S = await sea(); assert.deepStrictEqual([S.at, (await info()).날짜], [[171, 35], '1522년 5월 4일']);
  await p.keyboard.press('Space'); assert.strictEqual((await sea()).run, false); await p.keyboard.press('Space'); assert.strictEqual((await sea()).run, true);
  await p.keyboard.press('ArrowDown'); assert.strictEqual((await sea()).heading, 'down'); await step(20); S = await sea(); assert.deepStrictEqual(S.at, [171, 37], '남쪽으로 2칸');
  Q = await cellXY(167, 39); assert.ok(await G(() => __dh.world.map.isSea(167, 39))); await clickWorld(Q.x, Q.y); S = await sea(); assert.deepStrictEqual([S.spot, S.heading, S.run], [[167, 39], null, true]); assert.ok(/바다 → 찍은 바다 · \d+칸/.test(await logTop()), await logTop());
  for (let i = 0; i < 10 && (await sea()).moving; i++) await step(20); S = await sea(); assert.deepStrictEqual([S.at, S.moving, S.run, S.spot], [[167, 39], false, false, null]); assert.ok((await logTop()).includes('찍은 바다에 닿아 닻을 내렸다')); assert.ok((await menu()).includes('pause!'));
  Q = await portXY('seville'); await clickWorld(Q.x, Q.y); assert.strictEqual(await title(), '세비야'); assert.strictEqual(await label('sail'), '세비야로 항해'); assert.ok(/^\d+칸 · 약 \d+일$/.test((await rows()).뱃길)); await p.click('button[data-id=sail]');
  for (let i = 0; i < 10 && !(await sea()).port; i++) await step(20); assert.strictEqual((await sea()).port, 'seville');
  ok('동현항 키 · 찍기: 갈 곳 없이 출항하면 항구 앞바다 · 입항 단추 · 방향키(뭍은 막힘 · 서쪽 2칸 · 남쪽 2칸) · Space로 멈춤 · 바다를 찍으면 그리로 · 바다에서 항구를 찍고 ‘세비야로 항해’');

  // 동현랭 설정(날마다 100% 만난다 · 해전 6턴) → 4일째에 해전 → 손으로 옮기고 쏜다 → 달아나기를 되묻는다 → 맡기기 → 결과가 탐험대에 반영된다
  await setCode(await compose([[2, 7], [14, 100], [22, 6]])); lg = await runLang(); assert.strictEqual(lg.state, 'ok'); assert.ok(lg.out.startsWith('설정 3개를 적용하고 새 판을 열었다: 난수 씨앗 7 · 적 함대를 만날 확률(%/일) 100 · 해전 기한(턴) 6'), lg.out);
  assert.deepStrictEqual([(await info()).날짜, (await info()).자금, (await sea()).port, await G(() => __dh.state.rules.encounter.percent)], ['1522년 5월 1일', '1,000', 'lisbon', 100]);
  for (let i = 0; i < 12; i++) await p.click('button[data-id=zout]'); await step(1); Q = await portXY('elmina'); await clickWorld(Q.x, Q.y); assert.strictEqual(await title(), '엘미나'); assert.ok(/^\d+칸 · 약 \d+일$/.test((await rows()).뱃길)); await p.click('button[data-id=sail]');
  await step(60); assert.deepStrictEqual([(await sea()).n, (await sea()).day], [1, 3], '항구를 떠나 사흘은 만나지 않는다'); await step(20);
  const hs = () => G(() => { const s = __dh.engine.scene, b = s.b; return { n: __dh.engine.scenes.length, side: b.side, turn: b.turn, ended: b.ended, winner: b.winner, mode: s.mode, auto: s.auto, sel: s.sel && s.sel.id, foe: b.fleets.foe.name, grid: [b.grid.cols, b.grid.rows, b.grid.kind],
    units: b.units.map(u => ({ id: u.id, side: u.side, c: u.c, r: u.r, hull: u.hull, crew: u.crew, done: u.done, moved: u.moved, out: u.out, flag: u.flag })), reach: [...s.reach.values()].map(v => [v.c, v.r, v.cost]), rocks: [...b.rocks], shot: s.sel ? b.shot(s.sel) : null, fire: s.sel ? b.fireTargets(s.sel).map(t => t.id) : [], turns: b.S.turns, title: s.title(), res: s.res && { winner: s.res.winner, fled: s.res.fled, loot: s.res.loot, reason: s.res.reason } }; });
  let B2 = await hs(); assert.deepStrictEqual([B2.n, B2.side, B2.turn, B2.mode, B2.turns, B2.grid, B2.rocks.length], [2, 'me', 1, 'fight', 6, [8, 8, 'hex'], 4]);
  let hi = await info(); assert.deepStrictEqual([hi.곳, hi.턴, hi.차례, hi.우리], ['4일째 바다', '1/6', '우리 함대', '선체 60 · 28명']); assert.ok((await title()).endsWith('의 해전') && (await title()).startsWith(B2.foe)); assert.deepStrictEqual(await menu(), ['wait!', 'end', 'auto', 'flee']);
  assert.ok((await logTop(2)).includes(`해전이 벌어졌다 · 포동이 탐험대 1척 대 ${B2.foe} ${B2.units.filter(u => u.side === 'foe').length}척`));
  await step(1); const w0 = await px(2, 4); await tapHex(1, 4); B2 = await hs(); await step(1); const w1 = await px(2, 4);
  assert.strictEqual(B2.sel, 'me0'); assert.ok(B2.reach.length > 10 && B2.reach.every(v => v[2] <= 3 && !B2.rocks.includes(v[0] + ',' + v[1])), '이동력 3 안쪽 · 암초는 빼고'); assert.ok(w0[2] > 200 && w1[2] < 170 && w1[0] > w1[2] + 30, `갈 수 있는 칸이 노랗게 ${w0} → ${w1}`);
  assert.ok((await rows())['고른 배'].endsWith('포격 한 번에 선체 −16 · 선원 −2')); await p.screenshot({ path: shot + '/ui-hang-battle.png' });
  let shots = 0, hops = 0;
  for (let guard = 0; guard < 40 && !B2.ended && shots < 1; guard++) {
    if (B2.side !== 'me') { await step(20); B2 = await hs(); continue; }
    const u = B2.units.find(x => x.side === 'me' && !x.out); if (u.done) { await p.click('button[data-id=end]'); B2 = await hs(); continue; }
    if (B2.sel !== u.id) { await tapHex(u.c, u.r); B2 = await hs(); } assert.strictEqual(B2.sel, u.id);
    if (!B2.fire.length && !u.moved) { const f = B2.units.find(x => x.side === 'foe' && x.flag), go = B2.reach.filter(v => v[0] !== u.c || v[1] !== u.r).sort((x, y) => Math.abs(hexDist([x[0], x[1]], [f.c, f.r]) - 3) - Math.abs(hexDist([y[0], y[1]], [f.c, f.r]) - 3))[0];
      await tapHex(go[0], go[1]); B2 = await hs(); const mv = B2.units.find(x => x.id === u.id); assert.deepStrictEqual([mv.c, mv.r, mv.moved], [go[0], go[1], true], '찍은 칸으로 옮겨 갔다'); hops++; }
    if (B2.fire.length) { const t = B2.units.find(x => x.id === B2.fire[0]), sh = B2.shot; await step(1); let red = false; for (const dy of [-20, -21, -22, -23, -24, -25]) { const c = await px(t.c, t.r, 0, dy); if (c[0] > 150 && c[1] < 110) red = true; } assert.ok(red, '쏠 수 있는 적에 붉은 테');
      await tapHex(t.c, t.r); B2 = await hs(); const now = B2.units.find(x => x.id === t.id); assert.deepStrictEqual([now.hull, now.crew], [Math.max(0, t.hull - sh.hull), Math.max(0, t.crew - sh.crew)], '포격 = 선체 −' + sh.hull + ' · 선원 −' + sh.crew); assert.ok(B2.units.find(x => x.id === u.id).done && B2.sel === null); shots++; }
    else assert.ok(B2.units.find(x => x.id === u.id).done, '쏠 적이 없으면 그 턴 일을 마친다');
  }
  assert.ok(shots === 1 && hops >= 1, `옮기기 ${hops} · 포격 ${shots}`); assert.ok(/포를 쐈다 · 선체 −\d+ · 선원 −\d+/.test(await logTop()), await logTop());
  if (!B2.ended) { for (let i = 0; i < 40 && (B2 = await hs()).side !== 'me' && !B2.ended; i++) { if (i === 0) { await p.click('button[data-id=end]'); assert.deepStrictEqual(await menu(), ['wait!', 'end!', 'auto!', 'flee!'], '적 차례에는 손댈 수 없다'); } await step(20); } }
  let asked = false; if (!B2.ended) { asked = true; await p.click('button[data-id=flee]'); assert.deepStrictEqual(await menu(), ['yes', 'no']); await p.click('button[data-id=no]'); assert.deepStrictEqual((await menu()).slice(-3), ['end', 'auto', 'flee']); assert.strictEqual((await hs()).ended, false); await p.click('button[data-id=auto]'); }
  for (let i = 0; i < 200 && (B2 = await hs()).mode !== 'result'; i++) await step(40); assert.strictEqual(B2.mode, 'result'); assert.ok(B2.turn <= 6); assert.ok(asked, '달아나기 되묻기와 맡기기까지 갔다'); assert.deepStrictEqual(await menu(), ['back']); assert.strictEqual((await info()).차례, '끝'); assert.ok((await rows()).결과.startsWith(B2.title + ' · ' + B2.res.reason));
  await step(40); await p.screenshot({ path: shot + '/ui-hang-result.png' }); await p.click('button[data-id=back]'); S = await sea(); assert.strictEqual(S.n, 1);
  const settle = B2.res.winner === 'me' ? [1000 + B2.res.loot, null, '해전에서 이겼다 · 금 +' + fmt(B2.res.loot)] : B2.res.winner === 'foe' ? [500, 'lisbon', '해전에서 졌다 · 금 500과 짐을 모두 빼앗기고 리스본으로 떠밀려 왔다'] : [1000, null, '승부가 나지 않아 두 함대가 갈라졌다'];
  assert.deepStrictEqual([S.gold, S.port], settle.slice(0, 2)); assert.ok((await logTop()).includes(settle[2]), await logTop()); assert.strictEqual((await info()).자금, fmt(settle[0])); assert.strictEqual(S.run, false, '돌아오면 멈춰 있다');
  if (B2.res.winner === 'foe') assert.deepStrictEqual([S.used, S.mode, S.crew >= 5], [0, 'port', true]); else assert.deepStrictEqual([S.mode, await label('pause')], ['sea', '계속']);
  ok(`동현항 해전: 설정(만날 확률 100% · 6턴)으로 4일째에 ${B2.foe}${DHro(B2.foe)} · 8×8 육각 바다 · 배를 찍어 ${hops}번 옮기고 포격 ${shots}번(선체 −16 · 선원 −2) · ${asked ? '달아나기 되묻기 · 맡기기 → ' : ''}${B2.title}(${B2.res.reason}) → ${settle[2]}`);

  // 백병전: 기함끼리 맞닿으면 '일기토' 단추 → 결과 카드 → 금
  await G(() => { const s = __dh.scene; s.applyDonghyunLang(__dh.lang.compose([[2, 1], [14, 0]], '', { world: __dh.world })); s.voyage.leave(); s.openBattle(s.voyage.rivals.get('blackreef')); const b = __dh.engine.scene.b; b.units[2].c = 2; b.units[2].r = 4; __dh.engine.scene.refresh(); });
  await tapHex(1, 4); B2 = await hs(); assert.strictEqual(B2.sel, 'me0'); assert.deepStrictEqual(await menu(), ['board:foe1', 'wait', 'end', 'auto', 'flee']); assert.strictEqual(await label('board:foe1'), '2번함에 올라타기'); assert.strictEqual((await rows())['2번함에 백병전'], '적 선원 −11 → 되받아 우리 선원 −5');
  await p.click('button[data-id="board:foe1"]'); B2 = await hs(); assert.deepStrictEqual([B2.units[0].crew, B2.units[2].crew, B2.units[0].done, B2.ended], [23, 17, true, false]); assert.ok((await logTop()).includes('2번함에 올라탔다 · 맞선 배 선원 −11 · 올라탄 배 선원 −5'));
  await G(() => { const s = __dh.scene; s.applyDonghyunLang(__dh.lang.compose([[2, 1], [14, 0]], '', { world: __dh.world })); s.voyage.leave(); s.openBattle(s.voyage.rivals.get('redsail')); const b = __dh.engine.scene.b; b.units[1].c = 2; b.units[1].r = 4; __dh.engine.scene.refresh(); });
  assert.strictEqual((await hs()).n, 2, '설정을 다시 적용하면 하던 해전은 접힌다'); await tapHex(1, 4); assert.deepStrictEqual(await menu(), ['board:foe0', 'wait', 'end', 'auto', 'flee']); assert.strictEqual(await label('board:foe0'), '붉은수염과 일기토'); assert.strictEqual((await rows())['기함에 백병전'], '일기토 · 포동이(무력 70) 대 붉은수염(무력 55)');
  await p.click('button[data-id="board:foe0"]'); B2 = await hs(); assert.deepStrictEqual([B2.mode, B2.ended, B2.res.winner, B2.res.loot, B2.title], ['result', true, 'me', 400, '이겼다']); assert.ok((await logTop(2)).includes('일기토: 포동이(무력 70) 대 붉은수염(무력 55) · 4합 만에 포동이가 이겼다(남은 기력 47)'), await logTop(2));
  hr = await rows(); assert.deepStrictEqual([hr.결과, hr['얻은 금'], hr['적 기함']], ['이겼다 · 포동이가 일기토에서 붉은수염을 꺾었다', '400', '빼앗겼다']);
  await step(10); await tapHex(4, 4); assert.strictEqual((await hs()).n, 2, '끝난 직후의 손짓은 카드를 넘기지 않는다'); await step(40); await p.screenshot({ path: shot + '/ui-hang-duel.png' }); await tapHex(4, 4); S = await sea();
  assert.deepStrictEqual([S.n, S.gold, S.crew, S.mode], [1, 1400, 28, 'sea']); assert.ok((await logTop()).includes('해전에서 이겼다 · 금 +400 · 선원 28 → 28명'));
  ok('동현항 백병전: 맞닿은 배에 올라타기(적 −11 · 우리 −5) · 기함끼리는 ‘붉은수염과 일기토’ → 4합 만에 이김 → 결과 카드 → 금 +400 · 설정을 다시 적용하면 하던 해전이 접힌다');

  // 스테이지: 자금을 모으면 이기고, 기한이 지나면 진다 · 다시 하기 · 틀린 설정은 하던 탐험을 그대로 둔다
  await setCode(await compose([[20, 1100], [21, 10], [14, 0]])); lg = await runLang(); assert.strictEqual(lg.state, 'ok'); assert.ok((await logTop(3)).includes('이기는 조건: 자금 1,100을 모은다 · 바다에서 10일 안에'), await logTop(3)); assert.strictEqual((await rows()).목표, '자금 1,100 · 10일 안에(10일 남음)');
  await p.click('button[data-id="tab:market"]'); await p.click('button[data-id="sell:wine"]'); S = await sea(); assert.deepStrictEqual([S.gold, S.over, S.why, S.mode], [1150, 'won', 'gold', 'over']); assert.deepStrictEqual(await menu(), ['again', 'follow', 'zin', 'zout']); assert.strictEqual(await title(), '목표한 자금을 모았다'); assert.ok((await logTop()).includes('목표한 자금을 모았다'));
  await step(1); await p.screenshot({ path: shot + '/ui-hang-over.png' }); Q = await portXY('seville'); await clickWorld(Q.x, Q.y); assert.strictEqual(await title(), '목표한 자금을 모았다', '끝난 뒤에는 지도를 찍어도 그대로다');
  await p.click('button[data-id=again]'); S = await sea(); assert.deepStrictEqual([S.gold, S.over, S.mode, S.port, S.day, (await info()).날짜], [1000, null, 'port', 'lisbon', 0, '1522년 5월 1일']); assert.strictEqual((await rows()).목표, '자금 1,100 · 10일 안에(10일 남음)', '다시 해도 설정은 그대로다');
  await p.click('button[data-id=sail]'); await p.focus('.dh-canvas'); await p.keyboard.press('ArrowLeft'); await step(180); S = await sea(); assert.deepStrictEqual([S.day, S.over], [9, null]); assert.strictEqual((await rows()).목표, '자금 1,100 · 10일 안에(1일 남음)');
  await step(20); S = await sea(); assert.deepStrictEqual([S.day, S.over, S.why, S.run, S.mode], [10, 'lost', 'time', false, 'over']); assert.strictEqual(await title(), '기한이 다 되었다'); await step(60); assert.strictEqual((await sea()).day, 10, '끝난 뒤에는 날이 가지 않는다');
  await G(() => { __dh.voyage.__mark = 1; }); await setCode(await compose([[6, 41]])); lg = await runLang(); assert.strictEqual(lg.state, 'error'); assert.ok(/설정 6\(시작 선원\): 선원 41명은 배의 10~40명 밖이다/.test(lg.out) && lg.out.endsWith('하던 판은 그대로 두었다.'), lg.out);
  assert.deepStrictEqual(await G(() => [__dh.voyage.__mark, __dh.voyage.over, __dh.state.stage.gold]), [1, 'lost', 1100]);
  await p.selectOption('#example', 'rich'); lg = await runLang(); assert.strictEqual(lg.state, 'ok'); assert.deepStrictEqual(await info(), { 날짜: '1522년 5월 1일', 자금: '5,000', 식량: '120일', 물: '60일', 선원: '40/40명', 짐: '80/120' }); assert.strictEqual((await rows()).짐, '포도주 80');
  await p.selectOption('#example', 'none'); lg = await runLang(); assert.deepStrictEqual([lg.state, lg.out, (await info()).자금, await G(() => __dh.state.stage.gold)], ['ok', '설정이 없다. 기본값으로 새 판을 열었다.', '1,000', 0]);
  ok('동현항 스테이지 · 동현랭 칸: 자금 1,100을 모으면 승리 카드 · 다시 하기 · 바다에서 10일이 지나면 끝 · 틀린 값(선원 41명)은 하던 탐험을 그대로 둔다 · ‘넉넉한 출항’(금 5,000 · 선원 40 · 포도주 80) · 설정 없음 → 기본값');

  // 먼 뱃길과 동서로 이어진 지도
  const far = await G(() => { const s = __dh.scene, w = __dh.world, v = s.voyage; s.sail('hakata'); const len = v.path.length, sea = v.path.every(([c, r]) => w.map.isSea(c, r)), strait = v.path.some(([c, r]) => c === 283 && r === 70); __dh.engine.step(40); const moved = s.at.join() !== w.ports.get('lisbon').anchor.join();
    s.follow = false; s.cam.zoom = 1; s.cam.x = -200; s.cam.clampTo(s.grid); const x = s.cam.x; __dh.engine.step(1); return { len, sea, strait, moved, x, drawn: s.tiles.drawn, w: s.grid.width }; });
  assert.ok(far.len > 150 && far.sea && far.strait && far.moved, JSON.stringify(far)); assert.strictEqual(far.x, far.w - 200); assert.ok(far.drawn >= 120 * 90);
  ok(`동현항: 하카타까지 ${far.len}칸 모두 바다(아프리카를 돌아 말라카 해협으로) · 날짜 변경선을 넘겨도 지도가 이어 그려진다`);

  // ───────── 페이지: 시리즈 띠 · 탭 · 설명 글 · 편집기 · 화면 전환 ─────────
  const NAME = '동현항', TABS = ['세계 지도', '동현항 출전 규약', '규칙', '엔진과 자료', '모델과 출처'], HEADS = { protocol: ['설정 번호', '예제 넷'], rules: ['놀이 방법', '조작', '동현항 규칙'], engine: ['엔진의 층', '게임이 얹는 법', '동현랭 어댑터', 'JSON 규격', '파일', '돌려 보기'], about: ['상표와 관계', '이 자료가 무엇이고 무엇이 아닌지', '자료 출처'] };
  const band = await p.evaluate(() => ({ n: document.querySelectorAll('.series-item').length, ctx: document.querySelector('.series-context').textContent, here: [...document.querySelectorAll('.series-item[aria-current=page]')].map(a => a.querySelector('.series-name').textContent), hrefs: [...document.querySelectorAll('a.series-item')].map(a => a.getAttribute('href')),
    ed: document.querySelector('.edition').textContent.trim(), foot: document.querySelector('footer').textContent, title: document.title, left: document.documentElement.innerHTML.match(/__[A-Z_]+__|<!--README/g) }));
  assert.deepStrictEqual([band.n, band.here, band.hrefs.length, band.left], [18, [NAME + '™'], 17, null]); assert.ok(band.ctx.includes('열일곱 개의 작은 세계') && band.ed.startsWith('v0.01') && band.foot.includes(NAME + ' v0.01') && band.title.includes(NAME), JSON.stringify([band.ctx, band.ed, band.title]));
  assert.ok(band.hrefs.every(h => /^https:\/\/raspberry-kim\.github\.io\/donghyun-(lang|lab\d+)\/$/.test(h)) && new Set(band.hrefs).size === 17, '띠의 주소 열일곱 개가 서로 다르다');
  ok(`시리즈 띠 18칸(지금 여기: ${NAME}) · 머리글과 바닥글의 판 번호 v0.01 · 빌드 자리표가 남지 않았다`);

  const tabsNow = () => p.evaluate(() => ({ names: [...document.querySelectorAll('.tabs button')].map(b => b.textContent), on: [...document.querySelectorAll('.tabs button[aria-current=page]')].map(b => b.dataset.tab), shown: [...document.querySelectorAll('.tab-panel')].filter(x => !x.hidden).map(x => x.id), sw: document.documentElement.scrollWidth, run: __dh.engine.loop.running }));
  await G(() => __dh.engine.start()); let T = await tabsNow(); assert.deepStrictEqual([T.names, T.on, T.shown, T.run], [TABS, ['play'], ['tab-play'], true]);
  const docs = {};
  for (const [id, heads] of Object.entries(HEADS)) {
    await p.click(`.tabs button[data-tab=${id}]`); T = await tabsNow(); assert.deepStrictEqual([T.on, T.shown, T.run], [[id], ['tab-' + id], false], id + ' 탭 · 설명을 읽는 동안 판이 멎는다'); assert.ok(T.sw <= 1280, id + ' 가로 넘침 ' + T.sw);
    const d = await p.evaluate(id => { const s = document.querySelector('#tab-' + id); return { heads: [...s.querySelectorAll('h2, h3, h4')].map(h => h.textContent), chars: s.textContent.length, tables: s.querySelectorAll('table').length, pre: s.querySelectorAll('pre').length, raw: /(^|\n)#{1,4} |\*\*|\]\(http/.test(s.textContent),
      wide: [...s.querySelectorAll('table, pre, p, li')].filter(e => { const w = e.closest('.table-wrap') || e; return w.getBoundingClientRect().right > innerWidth + 1; }).length }; }, id);
    for (const h of heads) assert.ok(d.heads.some(x => x.includes(h)), `${id} 탭에 ‘${h}’ 제목이 없다: ${d.heads.join(' | ')}`); assert.ok(d.chars > 1500 && !d.raw && d.wide === 0, id + ' ' + JSON.stringify({ chars: d.chars, raw: d.raw, wide: d.wide })); docs[id] = d;
    await p.screenshot({ path: shot + '/ui-tab-' + id + '.png', fullPage: true });
  }
  assert.ok(docs.protocol.tables >= 1 && docs.protocol.pre >= 1 && docs.engine.tables >= 1 && docs.engine.pre >= 1, '규약과 엔진 탭에 표와 코드 상자');
  await p.click('.tabs button[data-tab=play]'); T = await tabsNow(); assert.deepStrictEqual([T.on, T.shown, T.run], [['play'], ['tab-play'], true], '돌아오면 판이 다시 흐른다');
  await G(() => __dh.engine.stop()); await p.click('.tabs button[data-tab=rules]'); await p.click('.brand'); T = await tabsNow(); assert.deepStrictEqual([T.on, T.run], [['play'], false], '멈춰 둔 판은 돌아와도 멈춰 있다 · 머리글 이름을 누르면 첫 탭');
  ok(`탭 다섯: 설명 탭 넷의 글이 README에서 왔다(${Object.entries(docs).map(([k, d]) => k + ' ' + d.chars.toLocaleString('ko-KR') + '자').join(' · ')}) · 마크다운 기호가 남지 않았다 · 설명을 읽는 동안 판이 멎고 돌아오면 흐른다`);

  // 편집기: 줄 번호 · 색 · 미리 읽기 · ⌘/Ctrl+Enter · .dh 저장과 열기 · 설정 번호 표
  const ed = () => p.evaluate(() => { const c = document.querySelector('#code'); return { code: c.value, lines: document.querySelector('#lines').textContent.split('\n').length, count: document.querySelector('#line-count').textContent, spans: document.querySelectorAll('#hl .ln').length, colors: [...new Set([...document.querySelectorAll('#hl .ln span')].map(s => s.className))].sort().join(' '),
    note: document.querySelector('#example-note').textContent, out: document.querySelector('#result').textContent, kind: document.querySelector('#result').dataset.kind || '', status: document.querySelector('#status').textContent }; });
  await p.selectOption('#example', 'stage'); await p.waitForTimeout(400); let E = await ed(); const nl = E.code.split('\n').length;
  assert.deepStrictEqual([E.lines, E.count, E.spans, E.kind], [nl, nl + '줄', nl + 1, '']); assert.ok(E.colors.includes('t-frame') && E.colors.includes('t-cmt') && E.colors.includes('t-out') && E.colors.includes('t-num'), E.colors);
  assert.ok(E.note.length > 5 && /^읽은 설정 \d+개: .+\. 출전을 누르면 이 값으로 새 판이 열린다\.$/.test(E.out), E.out); const mark = await G(() => { __dh.engine.__mark = 1; return __dh.state.stage; });
  await p.fill('#code', '나는 동현이냐?\n뿡뿡 도오오옹\n동현이구나'); await p.waitForTimeout(400); E = await ed(); assert.deepStrictEqual([E.kind, E.lines, E.code.split('\n')[1]], ['error', 3, '  뿡뿡 도오오옹'], '고치는 동안 읽기만 해 본다 · 몸통 줄은 두 칸 들여 쓴다'); assert.ok(E.out.length > 10 && !E.out.includes('그대로 두었다'));
  assert.deepStrictEqual(await G(() => __dh.state.stage), mark, '미리 읽기는 판을 건드리지 않는다');
  await p.focus('#code'); await p.keyboard.press('Control+Enter'); E = await ed(); assert.deepStrictEqual([E.kind, E.status], ['error', '출전하지 못했다']); assert.ok(E.out.endsWith('하던 판은 그대로 두었다.'), E.out);
  await p.selectOption('#example', 'stage'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]); const saved = fs.readFileSync(await dl.path(), 'utf8'); assert.strictEqual(dl.suggestedFilename(), 'sortie.dh'); assert.strictEqual(saved, (await ed()).code + '\n');
  await p.selectOption('#example', 'none'); await p.setInputFiles('#open', { name: 'mine.dh', mimeType: 'text/plain', buffer: Buffer.from(saved.replace(/\n/g, '\r\n')) }); await p.waitForTimeout(400); E = await ed(); assert.strictEqual(E.code + '\n', saved, '.dh를 열면 저장한 그대로'); assert.strictEqual(E.note, '');
  await p.focus('#code'); await p.keyboard.press('Control+Enter'); E = await ed(); assert.strictEqual(E.kind, 'ok'); assert.ok(/^설정 \d+개로 새 판$/.test(E.status) && E.out.startsWith('설정 '), E.status + ' / ' + E.out);
  const rule = await p.evaluate(() => { const d = document.querySelector('.lang-rule'); d.open = true; const t = d.querySelector('table'); return { head: [...t.querySelectorAll('th')].map(x => x.textContent), rows: [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent)), sw: document.documentElement.scrollWidth }; });
  assert.deepStrictEqual(rule.head, ['번호', '설정', '값', '기본값']); assert.strictEqual(rule.rows.length, 18); assert.ok(rule.rows.every(r => r.length === 4 && /^\d+$/.test(r[0]) && r[1] && r[2]) && rule.sw <= 1280, JSON.stringify(rule.rows[0]));
  await p.evaluate(() => document.querySelector('.ed-panel').scrollIntoView({ block: 'center' })); await p.screenshot({ path: shot + '/ui-editor.png' });
  ok(`편집기: 줄 번호와 색 입히기 · 고치는 동안 미리 읽기(판은 그대로) · Ctrl+Enter 출전 · 틀린 코드는 하던 판을 둔다 · sortie.dh 저장 → 열기(줄 끝 CRLF도) → 출전 · 설정 번호 표 ${rule.rows.length}줄`);

  // 화면 전환 · 입력 표식
  const look = () => p.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'light', pressed: document.querySelector('#theme').getAttribute('aria-pressed'), bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color }));
  const light = await look(); await p.click('#theme'); const dark = await look(); assert.deepStrictEqual([dark.theme, dark.pressed], ['dark', 'true']); assert.ok(dark.bg !== light.bg && dark.ink !== light.ink, JSON.stringify([light, dark]));
  await p.evaluate(() => scrollTo(0, 0)); await step(1); await p.screenshot({ path: shot + '/ui-dark.png', fullPage: true }); await p.click('#theme'); assert.deepStrictEqual(await look(), light);
  const marks = await p.evaluate(() => [...document.querySelectorAll('.input-marks .mark')].map(e => [e.getAttribute('aria-label'), e.classList.contains('off'), (e.dataset.tip || '').length > 10])); assert.strictEqual(marks.length, 4); assert.ok(marks.every(k => k[0] && k[2] && k[1] === /없음$/.test(k[0])), JSON.stringify(marks));
  ok(`화면 전환: 어두운 화면과 밝은 화면을 오간다 · 입력 표식 넷(${marks.map(k => k[0]).join(' · ')})`);


  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), m = await ctx.newPage(); m.on('pageerror', e => errs.push('m ' + e.message));
  await m.goto(url); await m.waitForTimeout(500);
  const M = await m.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { stage: r('.dh-stage'), panel: r('.dh-panel'), sw: document.documentElement.scrollWidth, btn: Math.min(...[...document.querySelectorAll('#host button')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().height)), cw: document.querySelector('.dh-canvas').width }; });
  assert.ok(M.panel.top >= M.stage.bottom && M.sw <= 390 && M.btn >= 44 && M.cw === 1440, JSON.stringify(M));
  ok('휴대폰 390px: 조작 창이 캔버스 아래 · 가로 넘침 없음 · 놀이 단추 44px');

  const tapBtn = async id => { const h = await m.$(`button[data-id="${id}"]`); await h.scrollIntoViewIfNeeded(); const r = await h.boundingBox(); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); };
  const tapCell = async (c, r) => { await m.evaluate(() => document.querySelector('.dh-canvas').scrollIntoView({ block: 'center' })); const q = await m.evaluate(([c, r]) => { const s = __dh.engine.scene, P = s.grid.center(c, r), k = s.cam.toScreen(P.x, P.y), R = document.querySelector('.dh-canvas').getBoundingClientRect(); return { x: R.left + k.x * R.width / 480, y: R.top + k.y * R.height / 360 }; }, [c, r]); await m.touchscreen.tap(q.x, q.y); };
  // 11) 휴대폰 동현항: 항구 메뉴 · 교역 · 출항 · 해전 · 동현랭 칸
  const mtap = async sel => { const h = await m.$(sel); await h.scrollIntoViewIfNeeded(); const r = await h.boundingBox(); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); };
  const fit = () => m.evaluate(() => ({ sw: document.documentElement.scrollWidth, btn: Math.min(...[...document.querySelectorAll('#host button')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().height)), right: Math.max(...[...document.querySelectorAll('.dh-menu button, .dh-top, .dh-panel, .ed-panel, #code, .lang-rule, #example, #run')].map(e => e.getBoundingClientRect().right)), top: Math.round(document.querySelector('.dh-top').getBoundingClientRect().height), n: document.querySelectorAll('.dh-menu button').length }));
  const mInfo = () => m.$$eval('.dh-info-item', a => Object.fromEntries(a.map(e => [e.querySelector('dt').textContent, e.querySelector('dd').textContent])));
  await m.evaluate(() => __dh.engine.stop()); await m.evaluate(() => __dh.engine.step(1));
  let F = await fit(); assert.ok(F.sw <= 390 && F.btn >= 44 && F.right <= 390 && F.n === 8, JSON.stringify(F)); assert.deepStrictEqual(Object.keys(await mInfo()), ['날짜', '자금', '식량', '물', '선원', '짐']); await m.screenshot({ path: shot + '/ui-hang-phone-port.png', fullPage: true });
  await tapBtn('tab:market'); await tapBtn('buy:wine'); assert.strictEqual((await mInfo()).자금, '820'); const F2 = await fit(); assert.ok(F2.sw <= 390 && F2.btn >= 44 && F2.right <= 390 && F2.n === 5, JSON.stringify(F2)); await m.screenshot({ path: shot + '/ui-hang-phone-market.png', fullPage: true }); await tapBtn('back');
  await m.evaluate(() => document.querySelector('.dh-canvas').scrollIntoView({ block: 'center' }));
  const sp = await m.evaluate(() => { const s = __dh.scene, q = __dh.world.ports.get('seville'), P = s.grid.center(q.x, q.y), c = s.cam.toScreen(P.x, P.y), r = document.querySelector('.dh-canvas').getBoundingClientRect(); return { x: r.left + c.x * r.width / 480, y: r.top + c.y * r.height / 360 }; });
  await m.touchscreen.tap(sp.x, sp.y); assert.strictEqual(await m.$eval('.dh-detail-title', e => e.textContent), '세비야'); await tapBtn('sail'); await m.evaluate(() => __dh.engine.step(40));
  assert.deepStrictEqual(await m.evaluate(() => [__dh.voyage.port, __dh.voyage.day, __dh.engine.clock.running]), ['seville', 2, false]); assert.strictEqual((await mInfo()).날짜, '1522년 5월 3일');
  await tapBtn('sail'); await m.evaluate(() => document.querySelector('.dh-canvas').scrollIntoView({ block: 'center' }));
  const sq = await m.evaluate(() => { const s = __dh.scene, P = s.grid.center(169, 37), c = s.cam.toScreen(P.x, P.y), r = document.querySelector('.dh-canvas').getBoundingClientRect(); return { x: r.left + c.x * r.width / 480, y: r.top + c.y * r.height / 360, sea: __dh.world.map.isSea(169, 37) }; });
  assert.ok(sq.sea); await m.touchscreen.tap(sq.x, sq.y); assert.deepStrictEqual(await m.evaluate(() => [__dh.scene.spot, __dh.voyage.moving, __dh.engine.clock.running]), [[169, 37], true, true], '바다를 손가락으로 찍으면 그리로 간다');
  await m.evaluate(() => { const s = __dh.scene; __dh.engine.clock.running = false; s.voyage.stop(); s.openBattle(s.voyage.rivals.get('redsail')); });
  await tapCell(1, 4); const hb = await m.evaluate(() => { const s = __dh.engine.scene; __dh.engine.step(1); return { sel: s.sel && s.sel.id, reach: s.reach.size, far: [...s.reach.values()].sort((a, b) => b.c - a.c || a.cost - b.cost)[0] }; }); assert.ok(hb.sel === 'me0' && hb.reach > 10, JSON.stringify(hb));
  await m.screenshot({ path: shot + '/ui-hang-phone-battle.png', fullPage: true }); await tapCell(hb.far.c, hb.far.r); assert.deepStrictEqual(await m.evaluate(() => { const u = __dh.engine.scene.b.units[0]; return [u.c, u.r, u.moved]; }), [hb.far.c, hb.far.r, true]);
  const F3 = await fit(); assert.ok(F3.sw <= 390 && F3.btn >= 44 && F3.right <= 390 && F3.n >= 4, JSON.stringify(F3));
  await m.evaluate(() => { const s = __dh.engine.scene; if (s.b.side !== 'me') throw new Error('우리 차례가 아니다'); }); const used0 = await m.evaluate(() => __dh.voyage.cargoUsed);
  await tapBtn('flee'); await tapBtn('yes'); assert.deepStrictEqual(await m.evaluate(() => [__dh.engine.scene.mode, __dh.engine.scene.title()]), ['result', '달아났다']); await m.evaluate(() => __dh.engine.step(40)); await m.screenshot({ path: shot + '/ui-hang-phone-result.png', fullPage: true }); await tapBtn('back');
  assert.deepStrictEqual(await m.evaluate(() => [__dh.engine.scenes.length, __dh.voyage.cargoUsed]), [1, Math.floor(used0 / 2)], '달아나면 짐의 절반을 버린다');
  await m.selectOption('#example', 'stage'); await mtap('#run'); const mo = await m.evaluate(() => { const o = document.querySelector('#result'); return [o.dataset.kind, o.textContent, __dh.state.stage.gold, __dh.state.stage.days, __dh.voyage.gold]; });
  assert.deepStrictEqual([mo[0], mo[2], mo[3], mo[4]], ['ok', 5000, 300, 1000]); assert.ok(mo[1].startsWith('설정 4개를 적용하고 새 판을 열었다: 난수 씨앗 7 · 승리 조건: 모을 자금 5,000 · 기한(일) 300'), mo[1]);
  await mtap('.lang-rule summary'); const F4 = await fit(), tb = await m.evaluate(() => { const t = document.querySelector('.lang-rule table'); return { rows: document.querySelectorAll('#lang-rows tr').length, open: document.querySelector('.lang-rule').open, cw: t.clientWidth, sw: t.scrollWidth }; });
  assert.ok(F4.sw <= 390 && F4.btn >= 44 && F4.right <= 390, JSON.stringify(F4)); assert.deepStrictEqual([tb.rows, tb.open], [18, true]);
  await m.evaluate(() => document.querySelector('.ed-panel').scrollIntoView()); await m.screenshot({ path: shot + '/ui-hang-phone-lang.png', fullPage: true });
  ok(`휴대폰 동현항: 항구 메뉴 8단추 · 교역소(포도주 사기) · 세비야 찍고 출항(이틀) · 바다 찍기 · 해전에서 배와 칸 찍기 · 달아나기(짐 절반) · 동현랭 칸 ‘스테이지’ 적용 · 설정 번호 표 18줄(표 너비 ${tb.sw}/${tb.cw}) · 가로 넘침 없음 · 놀이 단추 44px`);

  // 휴대폰 페이지: 시리즈 띠 · 탭 다섯 · 편집기가 390px 안에 든다
  await m.evaluate(() => { document.querySelector('.tabs button[data-tab=play]').click(); scrollTo(0, 0); }); await m.evaluate(() => __dh.engine.step(1)); await m.screenshot({ path: shot + '/ui-phone-play.png', fullPage: true });
  const mb = await m.evaluate(() => { const it = [...document.querySelectorAll('.series-item')].map(e => e.getBoundingClientRect()); return { n: it.length, right: Math.max(...it.map(r => r.right)), left: Math.min(...it.map(r => r.left)), h: Math.min(...it.map(r => r.height)), w: [...new Set(it.map(r => Math.round(r.width)))], sw: document.documentElement.scrollWidth,
    ed: ['.ed-panel', '#code', '#example', '#run', '#result', '.file-row', '.lang-rule', '.tabs', '.getting-started'].map(s => [s, Math.round(document.querySelector(s).getBoundingClientRect().right)]).filter(x => x[1] > 390) }; });
  assert.ok(mb.n === 18 && mb.right <= 390 && mb.left >= 0 && mb.h >= 44 && mb.sw <= 390 && mb.ed.length === 0, JSON.stringify(mb)); assert.strictEqual(mb.w.length, 1, '띠 18칸(짝수)은 모두 같은 폭: ' + mb.w);
  const mdocs = [];
  for (const id of ['protocol', 'rules', 'engine', 'about']) {
    const h = await m.$(`.tabs button[data-tab=${id}]`); await h.scrollIntoViewIfNeeded(); const r = await h.boundingBox(); assert.ok(r.height >= 44, id + ' 탭 단추 높이 ' + r.height); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    const d = await m.evaluate(id => { const s = document.querySelector('#tab-' + id); return { shown: !s.hidden, sw: document.documentElement.scrollWidth, wide: [...s.querySelectorAll('h2, h3, h4, p, li, a, pre, .table-wrap, .science-block')].filter(e => e.getBoundingClientRect().right > 391).map(e => e.tagName + ':' + e.textContent.slice(0, 20)), scroll: [...s.querySelectorAll('.table-wrap, pre')].filter(e => e.scrollWidth > e.clientWidth + 1).length }; }, id);
    assert.ok(d.shown && d.sw <= 390 && d.wide.length === 0, id + ' ' + JSON.stringify(d)); mdocs.push(id + (d.scroll ? `(옆으로 미는 표·코드 ${d.scroll})` : '')); await m.screenshot({ path: shot + '/ui-phone-' + id + '.png', fullPage: true });
  }
  ok(`휴대폰 페이지: 시리즈 띠 18칸이 같은 폭(${mb.w[0]}px)으로 390px 안 · 편집기와 저장 줄 넘침 없음 · 설명 탭 넷(${mdocs.join(' · ')}) 가로 넘침 없음`);


  assert.deepStrictEqual(errs, []); console.log(`\n${n} ui tests passed · 콘솔 오류 0`); await b.close();
})().catch(e => { console.error(e); process.exit(1); });

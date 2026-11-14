// 동현항 화면 시험(Playwright): node build.cjs 뒤에 node qa/ui.cjs
const { chromium } = require('/home/user/node_modules/playwright'); const assert = require('assert'), fs = require('fs'), path = require('path'), fmt = n => Number(n).toLocaleString('ko-KR');
const url = 'file://' + path.join(__dirname, '..', 'index.html'), shot = path.join(__dirname, 'tmp'); fs.mkdirSync(shot, { recursive: true });
(async () => {
  const b = await chromium.launch({ env: { ...process.env, LC_ALL: 'C.UTF-8' } }), errs = []; let n = 0; const ok = s => { n++; console.log('ok ' + s); };
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  await p.goto(url); await p.waitForTimeout(500);
  await p.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
  // 0) 시작 카드: 출전을 누르기 전에는 멈춰 있다 · 효과음 단추와 M 키
  { const C = () => p.evaluate(() => ({ w: __dh.waiting(), top: __dh.engine.scenes.at(-1).constructor.name, title: document.querySelector('.dh-detail-title').textContent, menu: [...document.querySelectorAll('.dh-menu button')].map(e => e.textContent.trim()), st: document.querySelector('#status').textContent, snd: document.querySelector('#sound').getAttribute('aria-pressed') }));
    const C0 = await C(); assert.deepStrictEqual([C0.w, C0.top, C0.title, C0.st, C0.snd], [true, 'StartCard', '출전 준비', '출전 준비', 'true']); assert.strictEqual(C0.menu.length, 0, JSON.stringify(C0.menu)); assert.strictEqual(await p.$eval('#full', e => e.disabled), true, '시작 전에는 전체 화면을 막는다');
    assert.ok((await p.$eval('.getting-started', e => e.textContent)).includes('출전을 눌러야') && (await p.$eval('#result', e => e.textContent)).includes('출전을 누르면'));
    await p.click('#game-save'); assert.ok((await p.$eval('#menu-title', e => e.parentElement.textContent)).includes('아직 탐험을 시작하지 않았다')); await p.keyboard.press('Escape');
    await p.click('.dh-canvas'); await p.keyboard.press('KeyM'); assert.strictEqual(await p.$eval('#sound', e => e.getAttribute('aria-pressed')), 'false'); assert.strictEqual(await p.evaluate(() => localStorage.getItem('donghyunhang:sound')), 'off');
    await p.click('#sound'); assert.strictEqual(await p.$eval('#sound', e => e.getAttribute('aria-pressed')), 'true');
    const code0 = await p.$eval('#code', e => e.value); await p.focus('#code'); await p.keyboard.press('End'); await p.keyboard.press('KeyM'); assert.strictEqual(await p.$eval('#sound', e => e.getAttribute('aria-pressed')), 'true', '편집기에서는 M이 글자다'); await p.fill('#code', code0);
    await p.click('.dh-canvas'); for (const k of ['Enter', 'Digit1']) await p.keyboard.press(k); await p.waitForTimeout(200); const C1 = await C(); assert.deepStrictEqual([C1.w, C1.top], [true, 'StartCard'], '카드에서는 Enter · 1로 시작하지 않는다');
    await p.focus('#code'); await p.keyboard.press('Control+Enter'); await p.waitForTimeout(200); assert.deepStrictEqual([await p.evaluate(() => __dh.waiting()), await p.$eval('#full', e => e.disabled)], [false, false], '편집기에서 Ctrl+Enter로 출전 · 전체 화면이 켜진다');
    await p.reload(); await p.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled); assert.strictEqual(await p.evaluate(() => __dh.waiting()), true);
    await p.click('#run'); await p.waitForTimeout(200); assert.deepStrictEqual([await p.evaluate(() => __dh.waiting()), await p.evaluate(() => __dh.engine.scenes.some(s => s.constructor.name === 'StartCard'))], [false, false]); }
  ok('시작 카드: 출전 전에는 멈추고 저장 · 전체 화면을 막는다 · 출전은 편집기 위의 단추와 Ctrl+Enter뿐(카드의 Enter · 1은 듣지 않는다) · 효과음 단추와 M 키(편집기에서는 글자) · 이 브라우저가 기억한다');
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
  const label = id => p.$eval(`button[data-id="${id}"]`, e => [...e.childNodes].filter(n => n.nodeName !== 'KBD').map(n => n.textContent).join('')), note = () => p.$eval('.dh-note', e => e.textContent);
  let lg;
  // ───────── 동현항 ─────────
  await p.waitForTimeout(400);
  assert.deepStrictEqual(await info(), { 날짜: '1522년 5월 1일', 자금: '1,000', 식량: '90일', 물: '60일', 선원: '28/40명', 짐: '60/200' }); assert.ok(await ink() > 3);
  assert.deepStrictEqual(await G(() => [__dh.scene.grid.kind, __dh.scene.grid.wrapX, __dh.engine.clock.unit, __dh.engine.clock.running, __dh.scene.mode, __dh.voyage.port]), ['square', true, 'day', false, 'port', 'lisbon']);
  assert.strictEqual(await p.$$eval('.dh-canvas', a => a.length), 1, '앞 게임 캔버스가 남았다');
  await p.waitForTimeout(500); assert.strictEqual((await info()).날짜, '1522년 5월 1일', '닻을 내린 동안 날짜가 가지 않는다');
  assert.deepStrictEqual(await menu(), ['tab:market', 'tab:inn', 'tab:dock', 'tab:supply', 'tab:guild', 'tab:hold', 'sail', 'follow', 'zin', 'zout', 'traffic']); assert.strictEqual(await title(), '포동이 탐험대'); let hr = await rows();
  assert.deepStrictEqual([hr['있는 곳'], hr.선장, hr.짐, hr.배], ['리스본', '포동이 · 무력 70', '60/200 · 남은 자리 140 · 올리브유 20 · 포도주 40', '꼬리바람호(캐러벨) 선체 60/60 · 포 8']);
  await p.focus('.dh-canvas'); const camX = await G(() => __dh.scene.cam.x); await p.keyboard.press('Shift+ArrowRight'); assert.ok(await G(() => __dh.scene.cam.x) > camX, '항구에서는 Shift+방향키가 지도를 옮긴다'); assert.strictEqual(await G(() => __dh.voyage.port), 'lisbon'); await p.click('button[data-id=follow]');
  assert.deepStrictEqual(await p.$$eval('.dh-menu button', a => a.map(e => (e.querySelector('.dh-key') || {}).textContent || '')), ['1', '2', '3', '4', '5', '6', '7', '8', '+', '−', 'T'], '조작 단추에 번호가 붙는다(확대 · 축소는 + −, 지나는 배는 T)');
  lg = await lang(); assert.deepStrictEqual([lg.ex, lg.nums], [['none', 'rich', 'stage', 'war', 'poor', 'calm', 'hunger', 'guns', 'scale', 'loop', 'turtle', 'pirates'], '2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 20 21 22 23 24 30']);
  const exNames = await p.$$eval('#example option', a => a.map(o => o.textContent)); assert.deepStrictEqual(exNames.map(t => t.slice(0, 5)), ['01 · ', '02 · ', '03 · ', '04 · ', '05 · ', '06 · ', '07 · ', '08 · ', '09 · ', '10 · ', '11 · ', '12 · ']); assert.strictEqual(exNames[1], '02 · 넉넉한 출항');
  await G(() => __dh.engine.stop()); await step(1); await p.screenshot({ path: shot + '/ui-hang-port.png' });
  ok('동현항: 탭 바꾸기 · 사각 격자(동서 이어짐) · 리스본에 정박(날짜가 멎음) · 항구 메뉴(교역소 · 여관 · 도크 · 보급 · 출항) · 동현랭 칸이 동현항 예제 열(이름 앞 번호 01~10)과 번호 표로 바뀐다');

  // 교역소: 사면 값이 오르고 팔면 내린다
  await p.click('button[data-id="tab:market"]'); assert.strictEqual(await title(), '리스본 교역소'); assert.deepStrictEqual(await menu(), ['buy:wine', 'buymax:wine', 'buy:olive', 'buymax:olive', 'sell:olive', 'sellall:olive', 'sell:wine', 'sellall:wine', 'back']);
  assert.deepStrictEqual([await label('buy:wine'), await label('sell:wine'), await label('sell:olive')], ['포도주 사기 10 · 금 180', '포도주 팔기 10 · 금 +150', '올리브유 팔기 10 · 금 +110']);
  hr = await rows(); assert.deepStrictEqual([hr['포도주 사기'], hr['포도주 40개']], ['술·차 · 값 18 · 재고 200', '산 값 18 · 여기서 팔면 개당 15 · 개당 3 밑진다']);
  await p.click('button[data-id="buy:wine"]'); assert.deepStrictEqual([(await info()).자금, (await info()).짐, (await rows())['포도주 사기'], await label('buy:wine')], ['820', '70/200', '술·차 · 값 19 · 재고 190', '포도주 사기 10 · 금 190']); assert.ok((await logTop()).includes('포도주 10개를 샀다 · 금 −180 · 값 18 → 19'));
  await p.click('button[data-id="sell:olive"]'); assert.deepStrictEqual([(await info()).자금, (await info()).짐], ['930', '60/200']); assert.ok((await logTop()).includes('올리브유 10개를 팔았다 · 금 +110'));
  await p.screenshot({ path: shot + '/ui-hang-market.png' });
  await G(() => { __dh.voyage.gold = 5; __dh.scene.refresh(); }); assert.deepStrictEqual((await menu()).slice(0, 2), ['buy:wine!', 'buymax:wine!']); assert.ok((await note()).includes('포도주 사기: 금이 모자란다')); await G(() => { __dh.voyage.gold = 930; __dh.scene.refresh(); });
  await p.click('button[data-id=back]'); assert.strictEqual((await menu())[0], 'tab:market');
  ok('동현항 교역소: 포도주 10개 금 180(값 18 → 19) · 올리브유 10개 금 +110 · 금이 모자라면 단추가 흐려지고 까닭이 적힌다');

  // 여관 · 도크 · 보급
  await p.click('button[data-id="tab:inn"]'); assert.strictEqual(await title(), '리스본 여관'); assert.strictEqual(await label('hire'), '선원 모으기 +5 · 금 50'); await p.click('button[data-id=hire]');
  assert.deepStrictEqual([(await info()).선원, (await info()).자금, (await info()).식량, (await info()).물], ['33/40명', '880', '76일', '50일'], '사람이 늘면 식량과 물의 날 수가 준다'); await p.click('button[data-id=back]');
  await p.click('button[data-id="tab:dock"]'); assert.strictEqual(await title(), '리스본 도크'); assert.deepStrictEqual(await menu(), ['repair!', 'pick:s1', 'ship:caravel!', 'ship:carrack!', 'ship:turtle!', 'back']); assert.ok((await note()).includes('거북선 사기: 금이 모자란다'), await note()); assert.ok((await note()).includes('선체 고치기: 고칠 데가 없다') && (await note()).includes('캐러벨 사기: 금이 모자란다'));
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
  assert.deepStrictEqual([S.mode, S.run, S.dest, S.sel, S.port], ['sea', true, 'seville', null, null]); assert.deepStrictEqual(await menu(), ['pause', 'speed', 'tab:hold', 'follow', 'zin', 'zout', 'traffic']); assert.ok((await logTop()).includes('리스본 → 세비야 · 4칸 · 하루 2칸 · 약 2일')); assert.strictEqual((await rows())['있는 곳'], '세비야로 가는 바다');
  await step(10); await p.screenshot({ path: shot + '/ui-hang-sail.png' }); await step(10); assert.deepStrictEqual([(await info()).날짜, (await sea()).port], ['1522년 5월 2일', null]);
  await p.click('button[data-id=pause]'); await step(40); assert.strictEqual((await info()).날짜, '1522년 5월 2일', '멈추면 날이 가지 않는다'); assert.strictEqual(await label('pause'), '계속'); await p.click('button[data-id=pause]');
  await p.click('button[data-id=speed]'); assert.strictEqual(await label('speed'), '빠르기 ×2'); await step(10); S = await sea();
  assert.deepStrictEqual([S.port, S.run, S.mode, S.at, (await info()).날짜, (await info()).식량, (await info()).물], ['seville', false, 'port', await G(() => __dh.world.ports.get('seville').anchor), '1522년 5월 3일', '84일', '58일']);
  assert.ok((await logTop(2)).includes('세비야에 닿았다 · 2일 걸렸다')); assert.strictEqual((await menu())[0], 'tab:market'); await G(() => { __dh.engine.clock.speed = 1; });
  ok('동현항 항해: 세비야를 찍으면 시세와 뱃길(4칸 · 약 2일) · 출항 → 하루 2칸 · 멈춤/계속 · 빠르기 ×2 · 이틀 만에 입항(식량 86 → 84일 · 물 60 → 58일) · 입항하면 날짜가 멎는다');

  // 닻만 올리기 · 입항 단추 · 방향키로 키 잡기 · 바다 찍기
  await G(() => { __dh.state.rules.encounter.percent = 0; });          // 이 단계는 키와 찍기만 본다: 적 함대를 끈다(만남은 다음 단계에서 본다)
  await p.click('button[data-id=sail]'); S = await sea(); assert.deepStrictEqual([S.mode, S.run, S.moving, S.port], ['sea', false, false, null]); assert.deepStrictEqual(await menu(), ['enter', 'pause!', 'speed', 'tab:hold', 'follow', 'zin', 'zout', 'traffic']); assert.strictEqual(await label('enter'), '세비야에 입항'); assert.ok((await logTop()).includes('닻을 올렸다'));
  await p.click('button[data-id=enter]'); assert.strictEqual((await sea()).mode, 'port'); assert.ok((await logTop()).includes('세비야에 들어왔다')); await p.click('button[data-id=sail]');
  await p.focus('.dh-canvas'); await p.keyboard.press('ArrowUp'); assert.ok((await logTop()).includes('그쪽은 뭍이다')); assert.strictEqual((await sea()).run, false);
  await p.keyboard.press('ArrowLeft'); S = await sea(); assert.deepStrictEqual([S.heading, S.run, S.moving], ['left', true, true]); assert.ok((await logTop()).includes('키를 서쪽으로 잡았다')); assert.strictEqual((await rows())['있는 곳'], '서쪽으로 가는 바다'); assert.deepStrictEqual(await menu(), ['pause', 'speed', 'tab:hold', 'follow', 'zin', 'zout', 'traffic']);
  await step(20); S = await sea(); assert.deepStrictEqual([S.at, (await info()).날짜], [[171, 35], '1522년 5월 4일']);
  await p.keyboard.press('Space'); assert.strictEqual((await sea()).run, false); await p.keyboard.press('Space'); assert.strictEqual((await sea()).run, true);
  await p.keyboard.press('ArrowDown'); assert.strictEqual((await sea()).heading, 'down'); await step(20); S = await sea(); assert.deepStrictEqual(S.at, [171, 37], '남쪽으로 2칸');
  Q = await cellXY(167, 39); assert.ok(await G(() => __dh.world.map.isSea(167, 39))); await clickWorld(Q.x, Q.y); S = await sea(); assert.deepStrictEqual([S.spot, S.heading, S.run], [[167, 39], null, true]); assert.ok(/바다 → 찍은 바다 · \d+칸/.test(await logTop()), await logTop());
  for (let i = 0; i < 10 && (await sea()).moving; i++) await step(20); S = await sea(); assert.deepStrictEqual([S.at, S.moving, S.run, S.spot], [[167, 39], false, false, null]); assert.ok((await logTop()).includes('찍은 바다에 닿아 닻을 내렸다')); assert.ok((await menu()).includes('pause!'));
  Q = await portXY('seville'); await clickWorld(Q.x, Q.y); assert.strictEqual(await title(), '세비야'); assert.strictEqual(await label('sail'), '세비야로 항해'); assert.ok(/^\d+칸 · 약 \d+일$/.test((await rows()).뱃길)); await p.click('button[data-id=sail]');
  for (let i = 0; i < 10 && !(await sea()).port; i++) await step(20); assert.strictEqual((await sea()).port, 'seville');
  ok('동현항 키 · 찍기: 갈 곳 없이 출항하면 항구 앞바다 · 입항 단추 · 방향키(뭍은 막힘 · 서쪽 2칸 · 남쪽 2칸) · Space로 멈춤 · 바다를 찍으면 그리로 · 바다에서 항구를 찍고 ‘세비야로 항해’');

  // 동현랭 설정(날마다 100% 만난다 · 해전 6턴) → 4일째에 해전 → 손으로 옮기고 쏜다 → 달아나기를 되묻는다 → 맡기기 → 결과가 탐험대에 반영된다
  await setCode(await compose([[2, 7], [14, 100], [22, 6]])); lg = await runLang(); assert.strictEqual(lg.state, 'ok'); assert.ok(lg.out.startsWith('설정 3개를 적용하고 새 판을 열었다: 난수 시드 7 · 해적을 만날 확률(%/일) 100 · 해전 기한(턴) 6'), lg.out);
  assert.deepStrictEqual([(await info()).날짜, (await info()).자금, (await sea()).port, await G(() => __dh.state.rules.encounter.percent)], ['1522년 5월 1일', '1,000', 'lisbon', 100]);
  for (let i = 0; i < 12; i++) await p.click('button[data-id=zout]'); await step(1); Q = await portXY('elmina'); await clickWorld(Q.x, Q.y); assert.strictEqual(await title(), '엘미나'); assert.ok(/^\d+칸 · 약 \d+일$/.test((await rows()).뱃길)); await p.click('button[data-id=sail]');
  await step(60); assert.deepStrictEqual([(await sea()).n, (await sea()).day], [1, 3], '항구를 떠나 사흘은 만나지 않는다'); await step(20);
  // 해적 출현 카드: 배가 멎고 싸운다 · 달아난다 · 통행료를 묻는다
  { const M0 = await G(() => { const s = __dh.scene, v = s.voyage, m = v.meetInfo(s.meet); return { mode: s.mode, run: __dh.engine.clock.running, name: s.meet.name, cap: s.meet.captain, m, day: v.day }; });
    assert.deepStrictEqual([M0.mode, M0.run, M0.day, await menu(), await title()], ['meet', false, 4, ['fight', 'evade', 'toll', 'barter', 'scare!'], '해적 출현 · ' + M0.name]); assert.deepStrictEqual([await label('fight'), await label('evade'), await label('toll')], ['싸운다', M0.m.fast ? '달아난다 · 따돌린다' : '달아난다 · 짐 −' + M0.m.drop, '통행료를 낸다 · 금 200']);
    hr = await rows(); assert.strictEqual(hr['해적 선장'], `${M0.cap.name} · 무력 ${M0.cap.war}`); assert.ok((await logTop()).startsWith('해적 출현 · ' + M0.name), await logTop());
    const K0 = await G(() => __dh.scene.voyage.flagRisk(__dh.scene.meet)); assert.strictEqual(hr['해적이 올라타면'], K0.taken ? `해적 기함(선원 ${K0.theirs}명)이 한 번에 우리 기함 선원 ${K0.ours}명을 모두 쓰러뜨려 기함을 빼앗는다 · 곧 지는 것이다` : `해적 기함(선원 ${K0.theirs}명)이 한 번에 우리 기함 선원 ${K0.ours}명 가운데 ${K0.hit}명을 쓰러뜨린다`);
    await step(1); await p.screenshot({ path: shot + '/ui-hang-meet.png' });
    await step(100); assert.deepStrictEqual([(await sea()).day, (await sea()).mode], [4, 'meet'], '고르기 전에는 날이 가지 않는다'); await p.focus('.dh-canvas'); await p.keyboard.press('Space'); await p.keyboard.press('ArrowLeft'); assert.deepStrictEqual([(await sea()).run, (await sea()).mode], [false, 'meet'], 'Space · 방향키는 듣지 않는다');
    await p.click('#game-save'); assert.ok((await p.$eval('#menu-title', e => e.parentElement.textContent)).includes('해적과 마주친 동안에는 저장할 수 없다')); await p.keyboard.press('Escape');
    await p.focus('.dh-canvas'); await p.keyboard.press('Enter'); assert.strictEqual((await sea()).n, 2, 'Enter = 싸운다');
    ok(`동현항 해적 출현: 4일째에 ${M0.name}${DHro(M0.name).slice(0, 1)} 마주치면 배가 멎고 카드가 뜬다 · 싸운다 / ${M0.m.fast ? '달아난다(따돌린다)' : '달아난다(짐 −' + M0.m.drop + ')'} / 통행료 금 200 · 고르기 전에는 날이 가지 않고 저장도 못 한다 · Enter = 싸운다`); }
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
  const settleLog = await logTop(); let prizeGold = 0;
  { const pz = await G(() => __dh.voyage.prizes.map(x => x.type)); if (pz.length) {          // 이겨서 빼앗은 배가 있으면 빼앗은 배 카드가 먼저 뜬다
    assert.deepStrictEqual([S.mode, (await menu())[0], (await menu())[1]], ['prize', 'ptake:0', 'psell:0']); assert.ok(/빼앗은 배 \d척/.test(settleLog), settleLog);
    await step(4); await p.screenshot({ path: shot + '/ui-hang-prize.png' });
    for (const t of pz) { prizeGold += Math.floor(({ caravel: 2000, carrack: 5000 })[t] / 4); await p.click('button[data-id="psell:0"]'); } S = await sea(); } }
  const settle = B2.res.winner === 'me' ? [1000 + B2.res.loot, null, '해전에서 이겼다 · 금 +' + fmt(B2.res.loot)] : B2.res.winner === 'foe' ? [500, 'lisbon', '해전에서 졌다 · 금 500과 짐을 모두 빼앗기고 리스본으로 떠밀려 왔다'] : [1000, null, '승부가 나지 않아 두 함대가 갈라졌다'];
  settle[0] += prizeGold; assert.deepStrictEqual([S.gold, S.port], settle.slice(0, 2)); assert.ok(settleLog.includes(settle[2]), settleLog); assert.strictEqual((await info()).자금, fmt(settle[0])); assert.strictEqual(S.run, false, '돌아오면 멈춰 있다');
  if (B2.res.winner === 'foe') assert.deepStrictEqual([S.used, S.mode, S.crew >= 5], [0, 'port', true]); else assert.deepStrictEqual([S.mode, await label('pause')], ['sea', '계속']);
  ok(`동현항 해전: 설정(만날 확률 100% · 6턴)으로 4일째에 ${B2.foe}${DHro(B2.foe)} · 8×8 육각 바다 · 배를 찍어 ${hops}번 옮기고 포격 ${shots}번(선체 −16 · 선원 −2) · ${asked ? '달아나기 되묻기 · 맡기기 → ' : ''}${B2.title}(${B2.res.reason}) → ${settle[2]}`);

  // 백병전: 기함끼리 맞닿으면 '일기토' 단추 → 결과 카드 → 금
  await G(() => { const s = __dh.scene; s.applyDonghyunLang(__dh.lang.compose([[2, 1], [14, 0]], '', { world: __dh.world })); s.voyage.leave(); s.openBattle(s.voyage.rivals.get('blackreef')); const b = __dh.engine.scene.b; b.units[2].c = 2; b.units[2].r = 4; __dh.engine.scene.refresh(); });
  await tapHex(1, 4); B2 = await hs(); assert.strictEqual(B2.sel, 'me0'); assert.deepStrictEqual(await menu(), ['wait', 'end', 'auto', 'flee', 'board:foe1'], '1~4는 늘 같은 자리, 올라타기는 5'); assert.strictEqual(await label('board:foe1'), '2번함에 올라타기'); assert.strictEqual((await rows())['2번함에 백병전'], '적 선원 −11 → 되받아 우리 선원 −5');
  await p.click('button[data-id="board:foe1"]'); B2 = await hs(); assert.deepStrictEqual([B2.units[0].crew, B2.units[2].crew, B2.units[0].done, B2.ended], [23, 17, true, false]); assert.ok((await logTop()).includes('2번함에 올라탔다 · 맞선 배 선원 −11 · 올라탄 배 선원 −5'));
  await G(() => { const s = __dh.scene; s.applyDonghyunLang(__dh.lang.compose([[2, 1], [14, 0]], '', { world: __dh.world })); s.voyage.leave(); s.openBattle(s.voyage.rivals.get('redsail')); const b = __dh.engine.scene.b; b.units[1].c = 2; b.units[1].r = 4; __dh.engine.scene.refresh(); });
  assert.strictEqual((await hs()).n, 2, '설정을 다시 적용하면 하던 해전은 접힌다'); await tapHex(1, 4); assert.deepStrictEqual(await menu(), ['wait', 'end', 'auto', 'flee', 'board:foe0', 'duel:foe0']); assert.deepStrictEqual([await label('board:foe0'), await label('duel:foe0')], ['기함에 올라타기', '붉은수염에게 일기토 신청']);
  hr = await rows(); assert.deepStrictEqual([hr['기함에 백병전'], hr.일기토], ['적 선원 −11 → 되받아 우리 선원 −3', '포동이(무력 70) 대 붉은수염(무력 55) · 기력 100에서 한 합에 우리가 14~35 · 적이 11~27씩 깎는다']);
  await p.click('button[data-id="duel:foe0"]'); B2 = await hs(); assert.deepStrictEqual([B2.mode, B2.ended, B2.res.winner, B2.res.loot, B2.title], ['result', true, 'me', 400, '이겼다']); assert.ok((await logTop(2)).includes('일기토: 포동이(무력 70) 대 붉은수염(무력 55) · 4합 만에 포동이가 이겼다(남은 기력 47)'), await logTop(2));
  hr = await rows(); assert.deepStrictEqual([hr.결과, hr['얻은 금'], hr['적 기함']], ['이겼다 · 포동이가 일기토에서 붉은수염을 꺾었다', '400', '빼앗겼다']);
  await step(10); await tapHex(4, 4); assert.strictEqual((await hs()).n, 2, '끝난 직후의 손짓은 카드를 넘기지 않는다'); await step(40); await p.screenshot({ path: shot + '/ui-hang-duel.png' }); await tapHex(4, 4); S = await sea();
  assert.deepStrictEqual([S.n, S.gold, S.crew, S.mode], [1, 1400, 28, 'prize']); assert.ok((await logTop()).includes('해전에서 이겼다 · 금 +400 · 식량·물 5일분 약탈(각 보급 상한까지) · 선원 28 → 28명'));
  assert.ok((await logTop()).endsWith(' · 선장 무력 70 → 73 · 빼앗은 배 1척'), await logTop());
  assert.deepStrictEqual([await menu(), await label('psell:0')], [['ptake:0', 'psell:0'], '1. 캐러벨 팔기 · 금 +500'], '일기토에 진 적 기함을 끌고 왔다');
  await p.click('button[data-id="ptake:0"]'); S = await sea(); assert.deepStrictEqual([S.mode, await G(() => __dh.voyage.ships.length), (await info()).짐], ['sea', 2, '60/400']); assert.ok(/^빼앗은 캐러벨에 .+는 이름을 붙여 함대에 넣었다 · 선체 \d+\/60 · 배 2척$/.test(await logTop()), await logTop()); assert.strictEqual((await rows()).선장, '포동이 · 무력 73');
  ok('동현항 백병전 · 일기토 신청: 맞닿은 배에 올라타기(적 −11 · 우리 −5) · 기함끼리 맞닿으면 ‘붉은수염에게 일기토 신청’ → 받아들여 4합 만에 이김 → 결과 카드 → 금 +400 · 선장 무력 70 → 73 · 빼앗은 적 기함을 함대에 넣는다 · 설정을 다시 적용하면 하던 해전이 접힌다');

  // 적 선장의 일기토 신청: 싸움이 멎고 받는다 · 물리친다를 묻는다 → 물리치면 싸움이 이어진다 → 받으면 겨룬다
  const dareSetup = () => G(() => { const s = __dh.scene; s.applyDonghyunLang(__dh.lang.compose([[2, 1], [14, 0]], '', { world: __dh.world })); s.voyage.leave(); s.openBattle(s.voyage.rivals.get('storm')); const t = __dh.engine.scene, b = t.b; b.units[1].c = 4; b.units[1].r = 4; t.command('end'); });
  const dareWait = async () => { for (let i = 0; i < 60 && !(await G(() => !!__dh.engine.scene.dare)); i++) await step(5); return G(() => { const t = __dh.engine.scene; return { dare: !!t.dare, pending: t.b.pending, side: t.b.side, turn: t.b.turn, ended: t.b.ended }; }); };
  await dareSetup(); let DR = await dareWait(); assert.deepStrictEqual([DR.dare, DR.pending, DR.side, DR.ended], [true, { unit: 'foe0', target: 'me0' }, 'foe', false]); assert.deepStrictEqual(await menu(), ['accept', 'refuse']);
  assert.deepStrictEqual([await label('accept'), await label('refuse'), await p.$eval('button[data-id=refuse]', e => e.classList.contains('dh-primary')), await p.$eval('button[data-id=accept]', e => e.classList.contains('dh-primary'))], ['일기토를 받는다', '물리친다', true, false]);
  hr = await rows(); assert.deepStrictEqual([hr['일기토 신청'], hr.겨루면], ['폭풍 제독이 선장끼리 겨루자고 한다', '포동이(무력 70) 대 폭풍 제독(무력 86) · 기력 100에서 한 합에 우리가 14~35 · 적이 17~43씩 깎는다']); assert.ok((await logTop(2)).includes('폭풍 제독(무력 86)이 포동이(무력 70)에게 일기토를 신청했다'), await logTop(2));
  await step(1); await p.screenshot({ path: shot + '/ui-hang-dare.png' }); await step(200); DR = await dareWait(); assert.deepStrictEqual([DR.dare, DR.side, DR.turn], [true, 'foe', 1], '답하기 전에는 싸움이 멎어 있다');
  await p.focus('.dh-canvas'); await p.keyboard.press('Enter'); DR = await G(() => { const t = __dh.engine.scene; return { dare: !!t.dare, pending: t.b.pending, ended: t.b.ended, asked: t.b.asked }; }); assert.deepStrictEqual(DR, { dare: false, pending: null, ended: false, asked: { me: false, foe: true } }, 'Enter = 물리친다(강조된 단추)');
  assert.ok((await logTop(3)).includes('포동이가 폭풍 제독의 일기토 신청을 물리쳤다'), await logTop(3));
  await dareSetup(); DR = await dareWait(); assert.strictEqual(DR.dare, true); await p.click('button[data-id=accept]'); B2 = await hs(); assert.deepStrictEqual([B2.mode, B2.ended, typeof B2.res.winner], ['result', true, 'string']); assert.ok(/^일기토: 폭풍 제독\(무력 86\) 대 포동이\(무력 70\) · \d+합 만에 (폭풍 제독이|포동이가) 이겼다/.test(await G(() => __dh.engine.scene.b.log.find(t => t.startsWith('일기토:')))));
  await step(40); await p.click('button[data-id=back]'); assert.strictEqual((await sea()).n, 1);
  ok('동현항 적의 일기토 신청: 폭풍 제독(무력 86)이 신청하면 싸움이 멎고 ‘일기토를 받는다 · 물리친다’를 묻는다 · Enter = 물리친다(잃는 것 없이 이어진다) · 받으면 선장끼리 겨뤄 결과 카드로');

  // 도크: 배를 골라 포 보강 · 기함 바꾸기 · 팔기 / 여관: 선장 수련
  await G(() => { const s = __dh.scene; s.applyDonghyunLang(__dh.lang.compose([[3, 9000], [14, 0]], '', { world: __dh.world })); });
  await p.click('button[data-id="tab:inn"]'); assert.deepStrictEqual([await menu(), await label('train')], [['hire', 'train', 'back'], '선장 수련 무력 +1 · 금 300']); await p.click('button[data-id=train]'); assert.ok((await logTop()).includes('포동이가 수련했다 · 금 −300 · 무력 70 → 71')); await p.click('button[data-id=back]');
  await p.click('button[data-id="tab:dock"]'); assert.strictEqual(await label('pick:s1'), '꼬리바람호 손보기'); await p.click('button[data-id="pick:s1"]'); assert.deepStrictEqual([await title(), await menu()], ['리스본 도크 · 꼬리바람호', ['gun', 'swap:carrack', 'swap:turtle', 'sellship!', 'back']]); assert.strictEqual(await label('swap:turtle'), '거북선으로 바꾸기 · 금 7,000');
  assert.deepStrictEqual([await label('gun'), await label('swap:carrack')], ['포 보강 +2문 · 금 400', '캐럭으로 바꾸기 · 금 4,000']); await p.click('button[data-id=gun]'); hr = await rows(); assert.ok(hr.기함.includes('포 10(보강 +2)'), hr.기함);
  await p.click('button[data-id="swap:carrack"]'); assert.ok((await logTop()).includes('꼬리바람호를 캐러벨에서 캐럭으로 바꿨다 · 헌 배 값 금 1,000 · 금 −4,000'), await logTop()); hr = await rows(); assert.ok(hr.기함.startsWith('캐럭 · 선체 120/120 · 포 16 · 짐 480'), hr.기함);
  assert.deepStrictEqual([(await info()).자금, (await info()).짐, (await info()).선원, await label('swap:caravel')], ['4,300', '60/480', '28/120명', '캐러벨로 바꾸기 · 금 +500']); await step(1); await p.screenshot({ path: shot + '/ui-hang-dock.png' });
  await p.keyboard.press('Escape'); assert.deepStrictEqual([await title(), (await menu())[1]], ['리스본 도크', 'pick:s1']); await p.click('button[data-id=back]'); assert.ok((await rows()).배.startsWith('꼬리바람호(캐럭) 선체 120/120 · 포 16'));
  ok('동현항 여관 · 도크: 선장 수련(금 300에 무력 +1) · ‘꼬리바람호 손보기’ → 포 보강(+2문 · 금 400) · 기함을 캐럭으로 바꾸기(헌 배 값 1,000을 빼고 금 4,000) · 마지막 한 척은 팔지 못한다');

  // 예제 11 · 무적 모드: 거북선 · 값을 내지 않는다 · 해전에서 다치지 않는다
  await p.selectOption('#example', 'turtle'); lg = await runLang(); assert.strictEqual(lg.state, 'ok'); assert.ok(lg.out.includes('무적 모드 1 · 시작 기함 거북선 · 해적을 만날 확률(%/일) 40'), lg.out);
  hr = await rows(); assert.deepStrictEqual([hr.선장, hr.배, (await info()).자금], ['포동이 · 무력 70 · 무적 모드', '꼬리바람호(거북선) 선체 200/200 · 포 40', '1,000(무적)']); assert.ok((await logTop(3)).includes('무적 모드'), await logTop(3));
  await p.click('button[data-id="tab:dock"]'); assert.deepStrictEqual(await menu(), ['repair!', 'pick:s1', 'ship:caravel', 'ship:carrack', 'ship:turtle', 'back']); assert.strictEqual(await label('ship:turtle'), '거북선 사기 · 금 0'); await p.click('button[data-id=back]');
  await p.click('button[data-id="tab:market"]'); await p.click('button[data-id="buy:wine"]'); assert.strictEqual((await info()).자금, '1,000(무적)'); await p.click('button[data-id=back]');
  await G(() => { const s = __dh.scene; s.voyage.leave(); s.openBattle(s.voyage.rivals.get('storm')); }); await tapHex(1, 4); hr = await rows(); assert.deepStrictEqual([hr['우리 선장'], hr['고른 배']], ['포동이 · 무력 70 · 무적', '꼬리바람호 · 포격 한 번에 선체 −84 · 선원 −14']);
  await step(1); await p.screenshot({ path: shot + '/ui-hang-turtle.png' }); await p.click('button[data-id=auto]'); for (let i = 0; i < 200 && (B2 = await hs()).mode !== 'result'; i++) await step(40);
  assert.deepStrictEqual([B2.res.winner, B2.units[0].hull, B2.units[0].crew], ['me', 200, 28], '무적 모드의 거북선은 다치지 않고 이긴다'); await step(40); await p.click('button[data-id=back]'); assert.strictEqual((await sea()).n, 1);
  ok('동현항 예제 11 · 무적 모드: 거북선(선체 200 · 포 40)으로 시작 · 자금 ‘1,000(무적)’은 사도 줄지 않는다 · 도크에 거북선이 보인다 · 폭풍 사략 함대와 싸워 선체 200 · 선원 28 그대로 이긴다');

  // 스테이지: 자금을 모으면 이기고, 기한이 지나면 진다 · 다시 하기 · 틀린 설정은 하던 탐험을 그대로 둔다
  await setCode(await compose([[20, 1100], [21, 10], [14, 0]])); lg = await runLang(); assert.strictEqual(lg.state, 'ok'); assert.ok((await logTop(3)).includes('이기는 조건: 자금 1,100을 모은다 · 바다에서 10일 안에'), await logTop(3)); assert.strictEqual((await rows()).목표, '자금 1,100 · 10일 안에(10일 남음)');
  await p.click('button[data-id="tab:market"]'); await p.click('button[data-id="sell:wine"]'); S = await sea(); assert.deepStrictEqual([S.gold, S.over, S.why, S.mode], [1150, 'won', 'gold', 'over']); assert.deepStrictEqual(await menu(), ['again', 'follow', 'zin', 'zout']); assert.strictEqual(await title(), '목표한 자금을 모았다'); assert.ok((await logTop()).includes('목표한 자금을 모았다'));
  await step(1); await p.screenshot({ path: shot + '/ui-hang-over.png' }); Q = await portXY('seville'); await clickWorld(Q.x, Q.y); assert.strictEqual(await title(), '목표한 자금을 모았다', '끝난 뒤에는 지도를 찍어도 그대로다');
  await p.click('button[data-id=again]'); S = await sea(); assert.deepStrictEqual([S.gold, S.over, S.mode, S.port, S.day, (await info()).날짜], [1000, null, 'port', 'lisbon', 0, '1522년 5월 1일']); assert.strictEqual((await rows()).목표, '자금 1,100 · 10일 안에(10일 남음)', '다시 해도 설정은 그대로다');
  await p.click('button[data-id=sail]'); await p.focus('.dh-canvas'); await p.keyboard.press('ArrowLeft'); await step(180); S = await sea(); assert.deepStrictEqual([S.day, S.over], [9, null]); assert.strictEqual((await rows()).목표, '자금 1,100 · 10일 안에(1일 남음)');
  await step(20); S = await sea(); assert.deepStrictEqual([S.day, S.over, S.why, S.run, S.mode], [10, 'lost', 'time', false, 'over']); assert.strictEqual(await title(), '기한이 다 되었다'); await step(60); assert.strictEqual((await sea()).day, 10, '끝난 뒤에는 날이 가지 않는다');
  await G(() => { __dh.voyage.__mark = 1; }); await setCode(await compose([[6, 41]])); lg = await runLang(); assert.strictEqual(lg.state, 'error'); assert.ok(/설정 6\(시작 선원\): 선원 41명은 배의 10~40명 밖이다/.test(lg.out) && lg.out.endsWith('하던 판은 그대로 두었다.'), lg.out);
  assert.deepStrictEqual(await G(() => [__dh.voyage.__mark, __dh.voyage.over, __dh.state.stage.gold]), [1, 'lost', 1100]);
  await p.selectOption('#example', 'rich'); lg = await runLang(); assert.strictEqual(lg.state, 'ok'); assert.deepStrictEqual(await info(), { 날짜: '1522년 5월 1일', 자금: '5,000', 식량: '120일', 물: '60일', 선원: '40/40명', 짐: '80/200' }); assert.strictEqual((await rows()).짐, '80/200 · 남은 자리 120 · 포도주 80');
  await p.selectOption('#example', 'none'); lg = await runLang(); assert.deepStrictEqual([lg.state, lg.out, (await info()).자금, await G(() => __dh.state.stage.gold)], ['ok', '설정이 없다. 기본값으로 새 판을 열었다.', '1,000', 0]);
  ok('동현항 스테이지 · 동현랭 칸: 자금 1,100을 모으면 승리 카드 · 다시 하기 · 바다에서 10일이 지나면 끝 · 틀린 값(선원 41명)은 하던 탐험을 그대로 둔다 · ‘넉넉한 출항’(금 5,000 · 선원 40 · 포도주 80) · 설정 없음 → 기본값');

  // 먼 뱃길과 동서로 이어진 지도
  const far = await G(() => { const s = __dh.scene, w = __dh.world, v = s.voyage; s.sail('hakata'); const len = v.path.length, sea = v.path.every(([c, r]) => w.map.isSea(c, r)), strait = v.path.some(([c, r]) => c === 283 && r === 70); __dh.engine.step(40); const moved = s.at.join() !== w.ports.get('lisbon').anchor.join();
    s.follow = false; s.cam.zoom = 1; s.cam.x = -200; s.cam.clampTo(s.grid); const x = s.cam.x; __dh.engine.step(1); return { len, sea, strait, moved, x, drawn: s.tiles.drawn, w: s.grid.width }; });
  assert.ok(far.len > 150 && far.sea && far.strait && far.moved, JSON.stringify(far)); assert.strictEqual(far.x, far.w - 200); assert.ok(far.drawn >= 120 * 90);
  ok(`동현항: 하카타까지 ${far.len}칸 모두 바다(아프리카를 돌아 말라카 해협으로) · 날짜 변경선을 넘겨도 지도가 이어 그려진다`);

  // ───────── 페이지: 시리즈 띠 · 탭 · 설명 글 · 편집기 · 화면 전환 ─────────
  const NAME = '동현항', TABS = ['세계 지도', '동현항 출전 규약', '규칙', '엔진과 자료', '수학적 원리', '모델과 출처'], HEADS = { protocol: ['설정 번호', '예제 열'], rules: ['놀이 방법', '조작', '동현항 규칙'], engine: ['엔진의 층', '게임이 얹는 법', '동현랭 어댑터', 'JSON 규격', '파일', '돌려 보기'], about: ['상표와 관계', '이 자료가 무엇이고 무엇이 아닌지', '자료 출처'] };
  const band = await p.evaluate(() => ({ n: document.querySelectorAll('.series-item').length, ctx: document.querySelector('.series-context').textContent, here: [...document.querySelectorAll('.series-item[aria-current=page]')].map(a => a.querySelector('.series-name').textContent), hrefs: [...document.querySelectorAll('a.series-item')].map(a => a.getAttribute('href')),
    ed: document.querySelector('.edition').textContent.trim(), foot: document.querySelector('footer').textContent, title: document.title, left: document.documentElement.innerHTML.match(/__[A-Z_]+__|<!--README/g) }));
  assert.deepStrictEqual([band.n, band.here, band.hrefs.length, band.left], [19, [NAME + '™'], 18, null]); assert.ok(band.ctx.includes('열여덟 개의 작은 세계') && band.ed.startsWith('v0.19') && band.foot.includes(NAME + ' v0.19') && band.title.includes(NAME), JSON.stringify([band.ctx, band.ed, band.title]));
  assert.ok(band.hrefs.every(h => /^https:\/\/raspberry-kim\.github\.io\/donghyun-(lang|lab\d+)\/$/.test(h)) && new Set(band.hrefs).size === 18, '띠의 주소 열여덟 개가 서로 다르다');
  ok(`시리즈 띠 19칸(지금 여기: ${NAME}) · 머리글과 바닥글의 판 번호 v0.19 · 빌드 자리표가 남지 않았다`);

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
  assert.deepStrictEqual(rule.head, ['번호', '설정', '값', '기본값']); assert.strictEqual(rule.rows.length, 23); assert.ok(rule.rows.every(r => r.length === 4 && /^\d+$/.test(r[0]) && r[1] && r[2]) && rule.sw <= 1280, JSON.stringify(rule.rows[0]));
  await p.evaluate(() => document.querySelector('.ed-panel').scrollIntoView({ block: 'center' })); await p.screenshot({ path: shot + '/ui-editor.png' });
  ok(`편집기: 줄 번호와 색 입히기 · 고치는 동안 미리 읽기(판은 그대로) · Ctrl+Enter 출전 · 틀린 코드는 하던 판을 둔다 · sortie.dh 저장 → 열기(줄 끝 CRLF도) → 출전 · 설정 번호 표 ${rule.rows.length}줄`);

  // 화면 전환 · 입력 표식
  const look = () => p.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'light', pressed: document.querySelector('#theme').getAttribute('aria-pressed'), bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color }));
  const light = await look(); await p.click('#theme'); const dark = await look(); assert.deepStrictEqual([dark.theme, dark.pressed], ['dark', 'true']); assert.ok(dark.bg !== light.bg && dark.ink !== light.ink, JSON.stringify([light, dark]));
  await p.evaluate(() => scrollTo(0, 0)); await step(1); await p.screenshot({ path: shot + '/ui-dark.png', fullPage: true }); await p.click('#theme'); assert.deepStrictEqual(await look(), light);
  const marks = await p.evaluate(() => [...document.querySelectorAll('.input-marks .mark')].map(e => [e.getAttribute('aria-label'), e.classList.contains('off'), (e.dataset.tip || '').length > 10])); assert.strictEqual(marks.length, 4); assert.ok(marks.every(k => k[0] && k[2] && k[1] === /없음$/.test(k[0])), JSON.stringify(marks));
  ok(`화면 전환: 어두운 화면과 밝은 화면을 오간다 · 입력 표식 넷(${marks.map(k => k[0]).join(' · ')})`);

  // 전체 화면(데스크톱): 지도 아래 단추 → 정보 띠 · 지도 · 조작 창이 화면을 채운다 → 닫으면 제자리
  const fsNow = () => p.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; }, cv = document.querySelector('.dh-canvas');
    return { full: __dhFull.isFull(), cls: document.querySelector('#stage-full').className, stage: r('.dh-stage'), panel: r('.dh-panel'), top: r('.dh-top'), exit: !document.querySelector('#exit-full').hidden, exitBox: r('#exit-full'), hint: !document.querySelector('#full-hint').hidden, btn: document.querySelector('#full').textContent, off: document.querySelector('#full').disabled,
      cw: cv.width, iw: innerWidth, ih: innerHeight, focus: document.activeElement === cv, edIn: document.querySelector('#stage-full').contains(document.querySelector('.ed-panel')) }; });
  await p.click('.tabs button[data-tab=play]'); await p.evaluate(() => document.querySelector('#full').scrollIntoView({ block: 'center' })); const FS0 = await fsNow(), inkF0 = await ink();
  assert.deepStrictEqual([FS0.full, FS0.exit, FS0.hint, FS0.btn, FS0.off, FS0.cw, FS0.edIn], [false, false, false, '전체 화면', false, 480 * L.dpr, false], '편집기는 전체 화면에 들지 않는다');
  await p.click('#full'); await p.waitForTimeout(600); const FS1 = await fsNow(); await p.screenshot({ path: shot + '/ui-full-desktop.png' });
  assert.deepStrictEqual([FS1.full, FS1.exit, FS1.hint, FS1.btn, FS1.focus], [true, true, true, '전체 화면 닫기', true], JSON.stringify(FS1.cls)); assert.ok(/\bfs\b/.test(FS1.cls) && !/stack|side/.test(FS1.cls), '넓은 화면: 지도 옆에 조작 창 · ' + FS1.cls);
  assert.ok(FS1.stage.w > FS0.stage.w + 100 && Math.abs(FS1.stage.w / FS1.stage.h - 480 / 360) < 0.01, `전체 화면에서 지도가 커진다(4:3 그대로): ${FS0.stage.w} → ${FS1.stage.w}`);
  assert.ok(FS1.top.b <= FS1.stage.y + 1 && FS1.panel.x >= FS1.stage.r - 1 && FS1.panel.r <= FS1.iw + 1 && FS1.stage.b <= FS1.ih + 1 && FS1.stage.x >= 0, '정보 띠 · 지도 · 조작 창이 모두 화면 안: ' + JSON.stringify([FS1.stage, FS1.panel, FS1.iw, FS1.ih]));
  assert.ok(FS1.exitBox.r <= FS1.iw && FS1.exitBox.b <= FS1.top.y + 1, '닫기 단추는 정보 띠를 가리지 않는다'); assert.ok(FS1.cw >= FS1.stage.w && FS1.cw > FS0.cw && FS1.cw % 480 === 0, `커진 만큼 촘촘히 그린다: 캔버스 ${FS0.cw} → ${FS1.cw}px`); assert.ok(await ink() >= Math.min(inkF0 * 0.8, 16), '전체 화면에서도 지도가 그려진다(칸이 커지면 경계의 섞인 색이 줄어든다)');
  await p.click('#exit-full'); await p.waitForTimeout(500); const FS2 = await fsNow(); assert.deepStrictEqual([FS2.full, FS2.exit, FS2.hint, FS2.btn, FS2.cw, FS2.cls], [false, false, false, '전체 화면', FS0.cw, 'stage-full']); assert.ok(Math.abs(FS2.stage.w - FS0.stage.w) < 2 && Math.abs(FS2.panel.x - FS0.panel.x) < 2, '닫으면 제자리');
  await G(() => __dhFull.setPseudo(true)); await p.waitForTimeout(200); assert.strictEqual((await fsNow()).full, true); await p.keyboard.press('Escape'); await p.waitForTimeout(200); const FS3 = await fsNow(); assert.deepStrictEqual([FS3.full, FS3.cw, Math.abs(FS3.stage.w - FS0.stage.w) < 2], [false, FS0.cw, true], '창을 채우는 방식은 Esc로 닫힌다');
  ok(`전체 화면(데스크톱 ${FS1.iw}×${FS1.ih}): 지도 ${Math.round(FS0.stage.w)} → ${Math.round(FS1.stage.w)}px(4:3) · 캔버스 ${FS0.cw} → ${FS1.cw}px · 오른쪽에 조작 창 · 닫기 단추와 5초 안내 · 닫으면 제자리 · 창을 채우는 방식은 Esc로 닫힌다`);


  { const snd = await p.evaluate(() => [...new Set(__dh.sounds)]); for (const k of ['ship', 'coin', 'zone', 'tick', 'cannon']) assert.ok(snd.includes(k), k + ' 소리 기록 없음: ' + snd.join(' ')); ok('효과음: 놀이 중에 난 소리 ' + snd.length + '가지(' + snd.join(' · ') + ')'); }
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), m = await ctx.newPage(); m.on('pageerror', e => errs.push('m ' + e.message));
  await m.goto(url); await m.waitForTimeout(500);
  await m.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled); await m.evaluate(() => document.querySelector('#run').click());
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
  let F = await fit(); assert.ok(F.sw <= 390 && F.btn >= 44 && F.right <= 390 && F.n === 11, JSON.stringify(F)); assert.deepStrictEqual(Object.keys(await mInfo()), ['날짜', '자금', '식량', '물', '선원', '짐']); await m.screenshot({ path: shot + '/ui-hang-phone-port.png', fullPage: true });
  await tapBtn('tab:market'); await tapBtn('buy:wine'); assert.strictEqual((await mInfo()).자금, '820'); const F2 = await fit(); assert.ok(F2.sw <= 390 && F2.btn >= 44 && F2.right <= 390 && F2.n === 9, JSON.stringify(F2)); await m.screenshot({ path: shot + '/ui-hang-phone-market.png', fullPage: true }); await tapBtn('back');
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
  assert.deepStrictEqual([mo[0], mo[2], mo[3], mo[4]], ['ok', 5000, 300, 1000]); assert.ok(mo[1].startsWith('설정 4개를 적용하고 새 판을 열었다: 난수 시드 7 · 승리 조건: 모을 자금 5,000 · 기한(일) 300'), mo[1]);
  await mtap('.lang-rule summary'); const F4 = await fit(), tb = await m.evaluate(() => { const t = document.querySelector('.lang-rule table'); return { rows: document.querySelectorAll('#lang-rows tr').length, open: document.querySelector('.lang-rule').open, cw: t.clientWidth, sw: t.scrollWidth }; });
  assert.ok(F4.sw <= 390 && F4.btn >= 44 && F4.right <= 390, JSON.stringify(F4)); assert.deepStrictEqual([tb.rows, tb.open], [23, true]);
  await m.evaluate(() => document.querySelector('.ed-panel').scrollIntoView()); await m.screenshot({ path: shot + '/ui-hang-phone-lang.png', fullPage: true });
  ok(`휴대폰 동현항: 항구 메뉴 11단추 · 교역소(포도주 사기) · 세비야 찍고 출항(이틀) · 바다 찍기 · 해전에서 배와 칸 찍기 · 달아나기(짐 절반) · 동현랭 칸 ‘스테이지’ 적용 · 설정 번호 표(표 너비 ${tb.sw}/${tb.cw}) · 가로 넘침 없음 · 놀이 단추 44px`);

  // 휴대폰 페이지: 시리즈 띠 · 탭 다섯 · 편집기가 390px 안에 든다
  await m.evaluate(() => { document.querySelector('.tabs button[data-tab=play]').click(); scrollTo(0, 0); }); await m.evaluate(() => __dh.engine.step(1)); await m.screenshot({ path: shot + '/ui-phone-play.png', fullPage: true });
  const mb = await m.evaluate(() => { const it = [...document.querySelectorAll('.series-item')].map(e => e.getBoundingClientRect()); return { n: it.length, right: Math.max(...it.map(r => r.right)), left: Math.min(...it.map(r => r.left)), h: Math.min(...it.map(r => r.height)), w: [...new Set(it.map(r => Math.round(r.width)))], sw: document.documentElement.scrollWidth,
    ed: ['.ed-panel', '#code', '#example', '#run', '#result', '.file-row', '.lang-rule', '.tabs', '.getting-started'].map(s => [s, Math.round(document.querySelector(s).getBoundingClientRect().right)]).filter(x => x[1] > 390) }; });
  assert.ok(mb.n === 19 && mb.right <= 390 && mb.left >= 0 && mb.h >= 44 && mb.sw <= 390 && mb.ed.length === 0, JSON.stringify(mb)); assert.strictEqual(mb.w.length, 2, '띠 19칸(홀수): 동현랭만 두 칸 폭: ' + mb.w);
  const mdocs = [];
  for (const id of ['protocol', 'rules', 'engine', 'about']) {
    const h = await m.$(`.tabs button[data-tab=${id}]`); await h.scrollIntoViewIfNeeded(); const r = await h.boundingBox(); assert.ok(r.height >= 44, id + ' 탭 단추 높이 ' + r.height); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    const d = await m.evaluate(id => { const s = document.querySelector('#tab-' + id); return { shown: !s.hidden, sw: document.documentElement.scrollWidth, wide: [...s.querySelectorAll('h2, h3, h4, p, li, a, pre, .table-wrap, .science-block')].filter(e => e.getBoundingClientRect().right > 391).map(e => e.tagName + ':' + e.textContent.slice(0, 20)), scroll: [...s.querySelectorAll('.table-wrap, pre')].filter(e => e.scrollWidth > e.clientWidth + 1).length }; }, id);
    assert.ok(d.shown && d.sw <= 390 && d.wide.length === 0, id + ' ' + JSON.stringify(d)); mdocs.push(id + (d.scroll ? `(옆으로 미는 표·코드 ${d.scroll})` : '')); await m.screenshot({ path: shot + '/ui-phone-' + id + '.png', fullPage: true });
  }
  ok(`휴대폰 페이지: 시리즈 띠 19칸, 동현랭 두 칸 폭(${mb.w[0]}px)으로 390px 안 · 편집기와 저장 줄 넘침 없음 · 설명 탭 넷(${mdocs.join(' · ')}) 가로 넘침 없음`);

  // 휴대폰 전체 화면: 세로는 아래로 쌓고, 가로로 눕히면 지도를 왼쪽에 꽉 채운다
  await m.evaluate(() => { document.querySelector('.tabs button[data-tab=play]').click(); document.querySelector('#full').scrollIntoView({ block: 'center' }); });
  const mfs = () => m.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; }, host = document.querySelector('#host');
    return { full: __dhFull.isFull(), cls: document.querySelector('#stage-full').className, stage: r('.dh-stage'), panel: r('.dh-panel'), top: r('.dh-top'), exit: r('#exit-full'), shown: !document.querySelector('#exit-full').hidden, cw: document.querySelector('.dh-canvas').width, iw: innerWidth, ih: innerHeight, sw: host.scrollWidth - host.clientWidth, btn: Math.min(...[...document.querySelectorAll('#host button')].map(e => e.getBoundingClientRect().height)) }; });
  const P0 = await mfs(); { const h = await m.$('#full'), r = await h.boundingBox(); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); } await m.waitForTimeout(600); const P1 = await mfs(); await m.evaluate(() => __dh.engine.step(1)); await m.screenshot({ path: shot + '/ui-full-phone.png' });
  assert.ok(P1.full && P1.shown && /\bstack\b/.test(P1.cls), '세로 화면은 아래로 쌓는다: ' + P1.cls); assert.ok(P1.stage.x >= 0 && P1.stage.r <= P1.iw + 1 && P1.stage.w >= 360 && P1.sw <= 1 && P1.panel.y >= P1.stage.b - 1 && P1.top.b <= P1.stage.y + 1 && P1.exit.b <= P1.top.y + 1 && P1.btn >= 44, JSON.stringify(P1));
  await m.setViewportSize({ width: 844, height: 390 }); await m.waitForTimeout(400); const P2 = await mfs(); await m.evaluate(() => __dh.engine.step(1)); await m.screenshot({ path: shot + '/ui-full-phone-land.png' });
  assert.ok(P2.full && /\bside\b/.test(P2.cls), '눕히면 지도를 왼쪽에 꽉 채운다: ' + P2.cls); assert.ok(P2.stage.h >= P2.ih - 40 && P2.stage.b <= P2.ih + 1 && P2.panel.x >= P2.stage.r - 1 && P2.top.x >= P2.stage.r - 1 && P2.panel.r <= P2.iw + 1 && P2.top.y >= P2.exit.b - 1 && P2.sw <= 1, JSON.stringify(P2));
  await m.setViewportSize({ width: 390, height: 844 }); await m.waitForTimeout(300); { const h = await m.$('#exit-full'), r = await h.boundingBox(); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); } await m.waitForTimeout(400); const P3 = await mfs();
  assert.deepStrictEqual([P3.full, P3.shown, P3.cls, P3.cw, Math.abs(P3.stage.w - P0.stage.w) < 2], [false, false, 'stage-full', P0.cw, true], '닫으면 제자리'); assert.ok(await m.evaluate(() => document.documentElement.scrollWidth) <= 390);
  ok(`휴대폰 전체 화면: 세로 ${P1.iw}×${P1.ih}는 아래로 쌓기(지도 ${Math.round(P1.stage.w)}px) · 가로 ${P2.iw}×${P2.ih}는 지도 왼쪽 가득(높이 ${Math.round(P2.stage.h)}px) + 오른쪽에 정보 띠와 조작 창 · 닫기 단추가 정보 띠를 가리지 않는다 · 닫으면 제자리`);

  // ───────── v0.03: 저장과 불러오기 · 단추를 누른 뒤의 키보드 ─────────
  { // 새 창에서 본다(브라우저 칸이 빈 채로 시작한다). 내려받은 파일은 qa/tmp에 둔다
  const cx = await b.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true }), s = await cx.newPage(), SLOT = 'donghyunhang:slot';
  s.on('pageerror', e => errs.push(e.message)); s.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  const open = async pg => { await pg.goto(url); await pg.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled); await pg.click('#run'); await pg.evaluate(() => __dh.engine.stop()); }; await open(s);
  const wa = w => { const c = w.charCodeAt(w.length - 1), f = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0; return f === 0 ? '와' : '과'; };      // 받침에 맞춘 와/과
  const S = fn => s.evaluate(fn), sStep = (n, pg) => (pg || s).evaluate(n => __dh.engine.step(n), n), sInfo = () => s.$$eval('.dh-info-item', a => Object.fromEntries(a.map(e => [e.querySelector('dt').textContent, e.querySelector('dd').textContent])));
  const sMenu = pg => (pg || s).$$eval('.dh-menu button', a => a.map(e => e.dataset.id + (e.disabled ? '!' : ''))), status = () => s.$eval('#status', e => [e.textContent, e.dataset.kind || '']), sLabel = (id, pg) => (pg || s).$eval(`button[data-id="${id}"]`, e => [...e.childNodes].filter(n => n.nodeName !== 'KBD').map(n => n.textContent).join('')), sLog = () => s.$$eval('.dh-log li', a => a[0].textContent);
  /** 떠 있는 저장 메뉴: 제목 · 안내 글 · 단추(흐린 단추는 !) · 칸의 한 줄 · 초점 */
  const gm = pg => (pg || s).evaluate(() => { const back = document.querySelector('#menu-back'); if (back.hidden) return null; const m = document.querySelector('#menu'), t = m.querySelector('.menu-text'), a = document.activeElement;
    return { title: m.querySelector('h4').textContent, text: t ? t.textContent : '', items: [...m.querySelectorAll('.mi')].map(x => x.querySelector('span').textContent + (x.disabled ? '!' : '')), notes: [...m.querySelectorAll('.mi small')].map(x => x.textContent), focus: a && a.classList.contains('mi') ? a.querySelector('span').textContent : null }; });
  const pick = (label, pg) => (pg || s).click(`#menu .mi:has(span:text-is("${label}"))`), slot = n => s.evaluate(k => JSON.parse(localStorage.getItem(k)), SLOT + n), onMap = pg => (pg || s).evaluate(() => document.activeElement === document.querySelector('.dh-canvas'));
  const whole = pg => (pg || s).evaluate(() => JSON.stringify([__dh.voyage.toJSON(), __dh.engine.clock.toJSON(), __dh.engine.rng.state]));
  const sSea = pg => (pg || s).evaluate(() => { const z = __dh.scene, v = z.voyage, c = __dh.engine.clock; return { mode: z.mode, run: c.running, port: v.port, dest: v.dest, moving: v.moving, heading: v.heading, day: v.day, n: __dh.engine.scenes.length, gold: v.gold }; });
  const tapPort = async id => { const q = await s.evaluate(id => { const cv = document.querySelector('.dh-canvas'); cv.scrollIntoView({ block: 'center' }); const z = __dh.scene, w = __dh.world.ports.get(id), P = z.grid.center(w.x, w.y), c = z.cam.toScreen(P.x, P.y), r = cv.getBoundingClientRect(); return { x: r.left + c.x * r.width / 480, y: r.top + c.y * r.height / 360 }; }, id); await s.mouse.click(q.x, q.y); };
  const loadSlot = async n => { await s.click('#game-load'); await pick('브라우저 칸 ' + n); await pick('불러온다'); };

  // 저장 메뉴: 칸 셋 · 파일 · 지우기 → 칸 1에 저장 → 덮어쓰기는 되묻는다
  assert.deepStrictEqual(await S(() => ['#game-save', '#game-load'].map(q => { const e = document.querySelector(q); return [e.textContent, e.disabled, e.getBoundingClientRect().height >= 28]; })), [['저장', false, true], ['불러오기', false, true]]);
  await S(() => __dh.engine.start()); await s.click('#game-save'); let M = await gm();
  assert.deepStrictEqual([M.title, M.items, M.notes, M.focus], ['저장', ['브라우저 칸 1', '브라우저 칸 2', '브라우저 칸 3', '파일로 내려받기', '칸 지우기', '돌아가기'], ['비어 있음', '비어 있음', '비어 있음', '.dhsave'], '브라우저 칸 1']); assert.ok(M.text.includes('이 기기의 이 브라우저에만'));
  assert.strictEqual(await S(() => __dh.engine.loop.running), false, '메뉴가 떠 있는 동안 판은 멎는다'); await s.screenshot({ path: shot + '/ui-save-menu.png' });
  await s.keyboard.press('ArrowDown'); assert.strictEqual((await gm()).focus, '브라우저 칸 2'); await s.keyboard.press('ArrowUp'); await s.keyboard.press('ArrowUp'); assert.strictEqual((await gm()).focus, '돌아가기'); await s.keyboard.press('Tab'); assert.strictEqual((await gm()).focus, '브라우저 칸 1');
  await s.keyboard.press('Escape'); assert.strictEqual(await gm(), null); assert.deepStrictEqual([await S(() => __dh.engine.loop.running), await onMap()], [true, true], 'Esc로 닫으면 판이 다시 돌고 키보드는 지도에 듣는다');
  await s.click('#game-save'); await s.mouse.click(12, 12); assert.strictEqual(await gm(), null, '메뉴 바깥을 누르면 닫힌다'); await S(() => __dh.engine.stop());
  await s.click('#game-save'); await s.keyboard.press('Enter'); assert.strictEqual(await gm(), null); assert.deepStrictEqual(await status(), ['브라우저 칸 1에 저장했다 · 리스본 · 1522년 5월 1일', '']);
  let d1 = await slot(1); assert.deepStrictEqual([d1.format, d1.version, d1.lab, d1.summary, d1.settings, d1.game.gold, d1.game.port], ['donghyunhang-save', 1, '0.19', { title: '리스본', date: '1522년 5월 1일', line: '자금 1,000 · 선원 28명' }, [], 1000, 'lisbon']); assert.ok(!isNaN(new Date(d1.savedAt)));
  await s.click('button[data-id="tab:market"]'); await s.click('button[data-id="buy:wine"]'); assert.strictEqual((await sInfo()).자금, '820'); assert.ok(await onMap(), '단추를 누른 뒤에도 키보드는 지도에 듣는다');
  await s.click('#game-save'); M = await gm(); assert.ok(/^리스본 · 1522년 5월 1일 · 자금 1,000 · 선원 28명 · \d+\/\d+ \d\d:\d\d 저장$/.test(M.notes[0]), M.notes[0]); await pick('브라우저 칸 1'); M = await gm(); assert.deepStrictEqual([M.title, M.items], ['칸 1에 덮어쓸까?', ['덮어쓴다', '그만둔다']]);
  await pick('그만둔다'); assert.strictEqual((await gm()).title, '저장'); assert.strictEqual((await slot(1)).game.gold, 1000, '그만두면 칸은 그대로다');
  await pick('브라우저 칸 1'); await s.keyboard.press('Escape'); assert.strictEqual((await gm()).title, '저장', '되묻는 창에서 Esc는 앞 메뉴로 돌아간다'); await pick('브라우저 칸 1'); await pick('덮어쓴다'); assert.strictEqual(await gm(), null);
  const bought = await whole(); d1 = await slot(1); assert.strictEqual(JSON.stringify([d1.game, d1.clock, d1.rng]), bought, '덮어쓴 칸은 지금 탐험이다'); assert.strictEqual(d1.scene.tab, 'market');
  ok('저장 메뉴: 칸 셋 · 파일 · 지우기 · ↑↓ · Tab · Esc · 바깥 누르기 · 떠 있는 동안 날짜가 멎는다 · 칸 1 저장 · 덮어쓰기는 되묻는다 · 단추를 누른 뒤 초점은 지도');

  // 바다 위에서 저장 → 세비야에 닿는다 → 칸 2를 불러오면 바다 위에 멈춘 채로 돌아온다 → 계속을 누르면 같은 날 같은 값으로 닿는다
  await s.click('button[data-id=back]'); await tapPort('seville'); assert.strictEqual(await sLabel('sail'), '세비야로 출항'); await s.click('button[data-id=sail]'); await sStep(30); let V = await sSea(); assert.deepStrictEqual([V.mode, V.run, V.port, V.dest, V.day], ['sea', true, null, 'seville', 1]);
  await s.click('#game-save'); await pick('브라우저 칸 2'); assert.deepStrictEqual(await status(), ['브라우저 칸 2에 저장했다 · 바다 · 1522년 5월 2일', '']); const atSea = await whole(); assert.strictEqual((await sSea()).run, true, '저장한 뒤에도 배는 간다');
  let ticks = 0; while (!(await sSea()).port && ticks < 200) { await sStep(10); ticks += 10; } const arrived = await whole(); assert.deepStrictEqual([(await sSea()).port, (await sInfo()).날짜, ticks], ['seville', '1522년 5월 3일', 10]);
  await s.click('#game-load'); M = await gm(); assert.deepStrictEqual([M.title, M.items], ['불러오기', ['브라우저 칸 1', '브라우저 칸 2', '브라우저 칸 3!', '파일에서 불러오기', '돌아가기']]); assert.ok(M.notes[1].startsWith('바다 · 1522년 5월 2일 · 자금 820 · 선원 28명 · '), M.notes[1]);
  await pick('브라우저 칸 2'); M = await gm(); assert.deepStrictEqual([M.title, M.items], ['지금 탐험을 두고 칸 2를 불러올까? 저장하지 않은 진행은 사라진다.', ['불러온다', '그만둔다']]); await pick('그만둔다'); assert.strictEqual((await gm()).title, '불러오기'); assert.strictEqual(await whole(), arrived);
  await pick('브라우저 칸 2'); await pick('불러온다'); assert.strictEqual(await gm(), null); assert.strictEqual(await whole(), atSea); V = await sSea(); assert.deepStrictEqual([V.mode, V.run, V.port, V.dest, V.moving], ['sea', false, null, 'seville', true], '바다 위에 멈춘 채로 돌아온다');
  assert.deepStrictEqual(await status(), ['저장한 탐험을 불러왔다', '']); assert.strictEqual(await s.$eval('#result', e => e.textContent), '저장한 탐험을 불러왔다 · 바다 · 1522년 5월 2일 · ‘계속’을 누르면 이어 간다 · 저장될 때의 설정: 기본값. 편집기의 코드는 그대로다.'); assert.strictEqual(await sLabel('pause'), '계속'); assert.ok(await onMap());
  await sStep(40); assert.strictEqual(await whole(), atSea, '계속을 누르기 전에는 날이 가지 않는다'); await s.click('button[data-id=pause]'); await sStep(10); assert.strictEqual(await whole(), arrived, '불러온 뒤 이어 가면 같은 날 같은 값으로 닿는다');
  ok('바다 위에서 저장(하루 반째) → 세비야 입항 → 칸 2를 불러오면 바다 위에 멈춘 채로 · 뱃길과 갈 곳은 그대로 · ‘계속’을 누르면 앞서와 똑같이 5월 3일에 닿는다(시세 · 난수까지 같다)');

  // 파일: .dhsave로 내려받고 다시 연다 · 맞지 않는 파일은 하던 탐험을 그대로 둔다
  const [dl] = await Promise.all([s.waitForEvent('download'), (async () => { await s.click('#game-save'); await pick('파일로 내려받기'); })()]), file = path.join(shot, 'ui-save.dhsave'); await dl.saveAs(file);
  assert.strictEqual(dl.suggestedFilename(), 'donghyunhang-세비야-1522년5월3일.dhsave'); assert.deepStrictEqual(await status(), ['.dhsave 파일로 내려받았다 · 세비야 · 1522년 5월 3일', '']);
  const fd = JSON.parse(fs.readFileSync(file, 'utf8')); assert.strictEqual(JSON.stringify([fd.game, fd.clock, fd.rng]), arrived); assert.deepStrictEqual(Object.keys(fd).sort(), ['clock', 'engine', 'format', 'game', 'lab', 'rng', 'savedAt', 'scene', 'settings', 'summary', 'tick', 'version']);
  const choose = async f => { const [fc] = await Promise.all([s.waitForEvent('filechooser'), (async () => { await s.click('#game-load'); await pick('파일에서 불러오기'); })()]); await fc.setFiles(f); await s.waitForTimeout(150); };
  const bad = (name, text) => { const f = path.join(shot, name); fs.writeFileSync(f, typeof text === 'string' ? text : JSON.stringify(text)); return f; };
  await s.click('button[data-id="tab:market"]'); await s.click('button[data-id="sell:wine"]'); const sold = await whole(); assert.notStrictEqual(sold, arrived);
  await choose(bad('ui-bad-other.dhsave', { ...fd, format: 'donghyunsam-save' })); assert.strictEqual(await gm(), null); assert.deepStrictEqual(await status(), ['불러오기 실패: 동현항 저장 파일이 아니다. 하던 탐험은 그대로 두었다.', 'error']);
  await choose(bad('ui-bad-text.dhsave', '나는 동현이냐?')); assert.deepStrictEqual(await status(), ['불러오기 실패: 동현항 저장 파일이 아니다. 하던 탐험은 그대로 두었다.', 'error']); assert.strictEqual(await whole(), sold);
  const why = [];
  for (const [name, edit] of [['version', d => { d.version = 2; }], ['gold', d => { d.game.gold = -5; }], ['port', d => { d.game.port = 'atlantis'; }], ['ships', d => { d.game.ships = []; }], ['rng', d => { d.rng = 'x'; }], ['setting', d => { d.settings = [[6, 0]]; }]]) {
    const d = JSON.parse(JSON.stringify(fd)); edit(d); await choose(bad('ui-bad-' + name + '.dhsave', d)); M = await gm(); assert.strictEqual(M.title, '이 파일을 불러올까? 저장하지 않은 진행은 사라진다.'); await pick('불러온다');
    const st = await status(); assert.ok(st[0].startsWith('불러오기 실패: ') && st[0].endsWith(' 하던 탐험은 그대로 두었다.') && st[1] === 'error', st[0]); assert.strictEqual(await whole(), sold, name); why.push(st[0].slice(9, -16)); }
  assert.deepStrictEqual(why.slice(0, 5), ['지원하지 않는 저장 형식 버전이다(2).', '탐험대 정보가 맞지 않는다.', '배의 자리가 지도와 맞지 않는다.', '배 정보가 자료와 맞지 않는다.', '난수 정보가 맞지 않는다.'], why.join(' | ')); assert.ok(why[5].startsWith('저장된 설정이 맞지 않는다. 시작 선원 값 0은 쓸 수 없다.'), why[5]);
  await choose(file); M = await gm(); assert.ok(/^세비야 · 1522년 5월 3일 · 자금 [\d,]+ · 선원 28명 · \d+\/\d+ \d\d:\d\d 저장$/.test(M.text), M.text); assert.deepStrictEqual(M.items, ['불러온다', '그만둔다']); await pick('불러온다'); assert.strictEqual(await whole(), arrived); assert.strictEqual((await status())[0], '저장한 탐험을 불러왔다');
  ok(`파일: ${dl.suggestedFilename()}로 내려받는다 · 다시 열면 그 탐험 · 다른 게임의 파일 · 글 파일 · 어긋난 값 여섯(형식 버전 · 자금 −5 · 없는 항구 · 배 0척 · 난수 · 설정 값)은 까닭을 알리고 하던 탐험을 그대로 둔다`);

  // 설정도 따라온다 · 해전 중에는 저장하지 못한다: 날마다 100% 만나는 설정으로 떠나 바다에서 칸 3에 → 4일째 해전 → 저장은 못 한다 → 칸 1(기본값)을 불러오면 해전을 접는다 → 칸 3을 불러오면 그 설정으로 같은 적을 다시 만난다
  const script = await S(() => __dh.lang.compose([[2, 7], [14, 100], [22, 6]], '', { world: __dh.world })); await s.fill('#code', script); await s.click('#run'); const code0 = await s.$eval('#code', e => e.value); assert.ok(code0.includes('나는 동현이냐?')); assert.deepStrictEqual([await S(() => __dh.state.rules.encounter.percent), await S(() => __dh.scene.settings)], [100, [[2, 7], [14, 100], [22, 6]]]);
  for (let i = 0; i < 12; i++) await s.click('button[data-id=zout]'); await sStep(1); await tapPort('elmina'); await s.click('button[data-id=sail]'); await sStep(20); await s.click('#game-save'); await pick('브라우저 칸 3'); const d3 = await slot(3); assert.deepStrictEqual([d3.settings, d3.summary.title, d3.summary.date], [[[2, 7], [14, 100], [22, 6]], '바다', '1522년 5월 2일']);
  const day1 = await whole(); await sStep(60); assert.deepStrictEqual([(await sSea()).n, (await sSea()).mode], [1, 'meet'], '4일째에 해적 출현');
  await s.click('#game-save'); M = await gm(); assert.deepStrictEqual([M.title, M.text, M.items], ['지금은 저장할 수 없다', '해적과 마주친 동안에는 저장할 수 없다. 먼저 어떻게 할지 고른다.', ['돌아가기']]); await s.keyboard.press('Escape'); await s.click('button[data-id=fight]'); assert.strictEqual((await sSea()).n, 2); const foe = await S(() => __dh.engine.scene.b.fleets.foe.name), inBattle = await whole();
  await s.click('#game-save'); M = await gm(); assert.deepStrictEqual([M.title, M.text, M.items], ['지금은 저장할 수 없다', '해전이 끝난 뒤에 저장할 수 있다.', ['돌아가기']]); await s.keyboard.press('Escape'); assert.strictEqual(await gm(), null);
  await loadSlot(1); assert.deepStrictEqual([(await sSea()).n, await whole() === bought, await S(() => __dh.state.rules.encounter.percent), await S(() => __dh.scene.settings), await s.$eval('#code', e => e.value) === code0, await S(() => document.querySelector('.dh-detail-title').textContent)], [1, true, 5, [], true, '리스본 교역소']);
  await loadSlot(3); const res = await s.$eval('#result', e => e.textContent); assert.deepStrictEqual([await whole() === day1, await S(() => __dh.state.rules.encounter.percent), await S(() => __dh.scene.settings), (await sSea()).run], [true, 100, d3.settings, false]);
  assert.ok(res.includes('‘계속’을 누르면 이어 간다 · 저장될 때의 설정: 난수 시드 7 · 해적을 만날 확률(%/일) 100 · 해전 기한(턴) 6. 편집기의 코드는 그대로다.'), res);
  await s.click('button[data-id=pause]'); await sStep(60); assert.strictEqual((await sSea()).mode, 'meet'); await s.click('button[data-id=fight]'); assert.deepStrictEqual([(await sSea()).n, await S(() => __dh.engine.scene.b.fleets.foe.name), await whole() === inBattle], [2, foe, true], '불러온 설정으로 같은 날 같은 적을 만난다'); await S(() => __dh.engine.step(1)); await s.screenshot({ path: shot + '/ui-save-battle.png' });
  await loadSlot(2); V = await sSea(); assert.deepStrictEqual([V.n, V.mode, V.run, await whole() === atSea, await S(() => __dh.state.rules.encounter.percent)], [1, 'sea', false, true, 5], '해전 중에 불러오면 해전을 접는다');
  await s.click('#game-save'); await pick('칸 지우기'); M = await gm(); assert.deepStrictEqual([M.title, M.items], ['칸 지우기', ['브라우저 칸 1', '브라우저 칸 2', '브라우저 칸 3', '돌아가기']]); await pick('브라우저 칸 2'); M = await gm(); assert.deepStrictEqual([M.title, M.items], ['칸 2를 지울까? 되돌릴 수 없다.', ['지운다', '그만둔다']]);
  await pick('지운다'); M = await gm(); assert.deepStrictEqual([M.title, M.items, await slot(2), (await status())[0]], ['칸 지우기', ['브라우저 칸 1', '브라우저 칸 2!', '브라우저 칸 3', '돌아가기'], null, '브라우저 칸 2를 지웠다']);
  await s.keyboard.press('Escape'); assert.strictEqual((await gm()).title, '저장'); await s.keyboard.press('Escape'); assert.strictEqual(await gm(), null);
  ok(`설정도 따라온다: 날마다 100% 만나는 설정의 탐험을 바다에서 저장 → 4일째 ${foe}${wa(foe)} 해전 중에는 저장하지 못한다(까닭을 알린다) → 기본값 탐험을 불러오면 해전을 접고 확률 5% → 다시 불러오면 100%로 같은 날 같은 적 · 편집기의 코드는 그대로 · 칸 지우기는 되묻는다`);

  // 전체 화면: 오른쪽 위 저장 · 불러오기 단추는 전체 화면에서만 보인다 · 메뉴가 그 위에 뜬다
  const tools = () => S(() => ['#fs-save', '#fs-load', '#exit-full'].map(q => { const e = document.querySelector(q), r = e.getBoundingClientRect(); return !e.hidden && r.width > 0 && r.right <= innerWidth && r.top >= 0; }));
  assert.deepStrictEqual(await tools(), [false, false, false]); await S(() => document.querySelector('#full').scrollIntoView({ block: 'center' })); await s.click('#full'); await s.waitForTimeout(600); assert.deepStrictEqual([await S(() => __dhFull.isFull()), await tools()], [true, [true, true, true]]);
  await s.click('#fs-save'); const fm = await S(() => { const m = document.querySelector('#menu').getBoundingClientRect(), top = document.elementFromPoint(m.left + m.width / 2, m.top + 20); return { in: m.left >= 0 && m.right <= innerWidth && m.top >= 0 && m.bottom <= innerHeight, top: !!top.closest('#menu'), native: !!document.fullscreenElement }; });
  assert.ok(fm.in && fm.top, JSON.stringify(fm)); await S(() => __dh.engine.step(1)); await s.screenshot({ path: shot + '/ui-full-save.png' });
  await s.keyboard.press('ArrowDown'); await s.keyboard.press('Enter'); assert.strictEqual((await status())[0], '브라우저 칸 2에 저장했다 · 바다 · 1522년 5월 2일'); assert.ok(await S(() => __dhFull.isFull()));
  await s.click('#fs-load'); await pick('브라우저 칸 1'); await pick('불러온다'); assert.deepStrictEqual([await whole() === bought, await S(() => __dhFull.isFull()), await onMap()], [true, true, true]);
  await s.click('#fs-load'); await S(() => (document.fullscreenElement ? document.exitFullscreen() : __dhFull.setPseudo(false))); await s.waitForTimeout(400);           // 메뉴가 뜬 채로 전체 화면이 닫혀도(브라우저의 Esc) 메뉴는 남는다
  const left = await S(() => { const m = document.querySelector('#menu').getBoundingClientRect(), top = document.elementFromPoint(m.left + m.width / 2, m.top + 20); return [__dhFull.isFull(), !!top.closest('#menu'), m.top >= 0 && m.bottom <= innerHeight]; });
  assert.deepStrictEqual([left, (await gm()).title], [[false, true, true], '불러오기']); await pick('돌아가기'); assert.deepStrictEqual([await gm(), await tools()], [null, [false, false, false]]);
  await S(() => __dhFull.setPseudo(true)); await s.waitForTimeout(200); assert.deepStrictEqual(await tools(), [true, true, true]); await s.click('#fs-save'); await s.keyboard.press('Escape'); assert.deepStrictEqual([await gm(), await S(() => __dhFull.isFull())], [null, true], '창 채우기에서 Esc는 메뉴부터 닫는다');
  await s.keyboard.press('Escape'); await s.waitForTimeout(200); assert.strictEqual(await S(() => __dhFull.isFull()), false);
  ok(`전체 화면(${fm.native ? '브라우저 전체 화면' : '창 채우기'}): 저장 · 불러오기 단추가 오른쪽 위에 · 메뉴가 화면 안에 뜬다 · 칸 2 저장 · 칸 1 불러오기 뒤에도 전체 화면 · 전체 화면이 닫혀도 메뉴는 남는다 · 창 채우기에서 Esc는 메뉴 → 전체 화면 순서로 닫는다`);

  // 단추를 누른 뒤의 키보드: 지도를 찍지 않아도 방향키와 Space가 계속 듣는다(v0.02에서는 단추를 누르면 초점을 잃었다) · 단추 번호는 없다
  const k = await cx.newPage(); k.on('pageerror', e => errs.push('k ' + e.message)); await open(k); await k.evaluate(() => { __dh.state.rules.encounter.percent = 0; });
  assert.strictEqual(await onMap(k), false); await k.click('button[data-id=sail]'); assert.deepStrictEqual([(await sSea(k)).mode, await onMap(k)], ['sea', true], '출항 단추를 누르면 초점이 지도로 온다');
  await k.keyboard.press('ArrowLeft'); let KS = await sSea(k); assert.deepStrictEqual([KS.heading, KS.run, KS.moving], ['left', true, true]); await sStep(20, k); assert.strictEqual((await sSea(k)).day, 1);
  await k.click('button[data-id=pause]'); assert.deepStrictEqual([(await sSea(k)).run, await sLabel('pause', k), await onMap(k)], [false, '계속', true]); await k.keyboard.press('Space'); assert.strictEqual((await sSea(k)).run, true, '멈춤 단추를 누른 뒤에도 Space가 듣는다');
  await k.click('button[data-id=speed]'); await k.keyboard.press('ArrowDown'); assert.deepStrictEqual([(await sSea(k)).heading, await sLabel('speed', k)], ['down', '빠르기 ×2']); await k.click('button[data-id=zin]'); assert.ok(await onMap(k)); await k.keyboard.press('ArrowLeft'); assert.strictEqual((await sSea(k)).heading, 'left');
  ok('단추를 누른 뒤의 키보드: 출항 · 멈춤 · 빠르기 · 확대 단추를 누른 뒤에도 방향키로 키를 잡고 Space로 멈춘다(초점이 지도로 돌아온다)');

  // v0.04 키보드만으로: 숫자 키 단추 · 방향키 · Space · Q E로 항구 고르기 · Enter 출항 · 바다의 Space · 해전의 칸 커서와 Enter
  const kb = await cx.newPage(); kb.on('pageerror', e => errs.push('kb ' + e.message)); await open(kb); await kb.evaluate(() => { __dh.state.rules.encounter.percent = 0; });
  const KZ = () => kb.evaluate(() => { const z = __dh.engine.scene, v = __dh.voyage, c = __dh.engine.clock; return { n: __dh.engine.scenes.length, mode: z.mode, tab: z.tab, sel: z.selected, spot: z.spot, port: v.port, dest: v.dest, run: c.running, speed: c.speed, zoom: z.cam && z.cam.zoom, gold: v.gold, follow: z.follow }; });
  const keys = () => kb.$$eval('.dh-menu button', a => a.map(e => (e.querySelector('.dh-key') || {}).textContent || ''));
  await kb.keyboard.press('Digit1'); assert.strictEqual((await KZ()).tab, null, '지도를 누르기 전에는 숫자 키가 듣지 않는다');
  await kb.focus('.dh-canvas'); assert.deepStrictEqual(await keys(), ['1', '2', '3', '4', '5', '6', '7', '8', '+', '−', 'T']);
  await kb.keyboard.press('Digit1'); let K = await KZ(); assert.strictEqual(K.tab, 'market', '1 = 교역소');
  await kb.keyboard.press('Digit1'); assert.strictEqual((await KZ()).gold, 820, '교역소에서 1 = 포도주 사기'); assert.strictEqual(await onMap(kb), true);
  await kb.keyboard.press('Escape'); assert.strictEqual((await KZ()).tab, null, 'Esc = 돌아가기');
  await kb.keyboard.press('Digit3'); assert.strictEqual((await KZ()).tab, 'dock'); await kb.keyboard.press('Escape');
  const near = await kb.evaluate(() => { const z = __dh.scene, v = __dh.voyage, S = z.grid.center(v.x, v.y); return [...__dh.world.ports.values()].filter(p => p.id !== v.port).map(p => { const Q = z.portPx(p, S.x); return [p.id, Math.hypot(Q.x - S.x, Q.y - S.y)]; }).sort((a, b) => a[1] - b[1]).map(e => e[0]); });
  await kb.keyboard.press('Space'); assert.strictEqual((await KZ()).sel, near[0], 'Space = 가장 가까운 항구');
  await kb.keyboard.press('Space'); assert.strictEqual((await KZ()).sel, near[1]); await kb.keyboard.press('Shift+Space'); assert.strictEqual((await KZ()).sel, near[0], 'Shift+Space는 거꾸로');
  await kb.keyboard.press('KeyE'); assert.strictEqual((await KZ()).sel, near[1]); await kb.keyboard.press('KeyQ'); assert.strictEqual((await KZ()).sel, near[0], 'Q E도 차례로 돈다');
  const seen = new Set(); for (const d of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown']) { await kb.keyboard.press(d); K = await KZ(); assert.ok(K.sel && K.port === 'lisbon', d); seen.add(K.sel); }
  assert.ok(seen.size >= 3, '방향키로 여러 항구를 고른다 ' + [...seen]);
  const camX = await kb.evaluate(() => __dh.scene.cam.x); await kb.keyboard.press('KeyD'); assert.ok(await kb.evaluate(() => __dh.scene.cam.x) > camX, 'D = 지도 옮기기');
  for (let i = 0; i < 25 && (await KZ()).sel !== 'seville'; i++) await kb.keyboard.press('Space'); assert.strictEqual((await KZ()).sel, 'seville');
  assert.strictEqual(await sLabel('sail', kb), '세비야로 출항'); await kb.keyboard.press('Escape'); assert.strictEqual((await KZ()).sel, null, 'Esc = 고른 항구 놓기');
  for (let i = 0; i < 25 && (await KZ()).sel !== 'seville'; i++) await kb.keyboard.press('Space');
  await kb.keyboard.press('Enter'); K = await KZ(); assert.deepStrictEqual([K.mode, K.dest, K.run], ['sea', 'seville', true], 'Enter = 노란 단추(출항)');
  await kb.keyboard.press('Space'); assert.strictEqual((await KZ()).run, false, '바다에서 Space = 멈춤'); await kb.keyboard.press('Space'); assert.strictEqual((await KZ()).run, true);
  const z0 = (await KZ()).zoom; await kb.keyboard.press('Equal'); assert.ok((await KZ()).zoom > z0, '+ = 확대');
  const sk = await keys(), si = (await sMenu(kb)).findIndex(x => x.startsWith('speed')); await kb.keyboard.press('Digit' + sk[si]); assert.strictEqual((await KZ()).speed, 2, `${sk[si]} = 빠르기`);
  for (let i = 0; i < 20 && (await KZ()).mode !== 'port'; i++) await sStep(30, kb); assert.deepStrictEqual([(await KZ()).mode, (await KZ()).port], ['port', 'seville']);
  ok(`키보드만으로 항구에서 항구로: 지도를 누르기 전에는 듣지 않는다 · 단추 번호 1~6과 + − · 1 교역소 → 1 포도주 사기 · Esc 돌아가기 · Space · Shift+Space · Q E로 가까운 항구부터 · 방향키로 그쪽 항구(${seen.size}곳) · D 지도 옮기기 · Enter 세비야로 출항 · Space 멈춤과 계속 · + 확대 · 숫자 키 빠르기 ×2 → 세비야`);

  // 해전도 키보드로: Space 우리 배 · 방향키 커서 · Enter 옮기기 · 숫자 키 · 달아나기 되묻기에서 Enter = 돌아가기 · 결과 카드에서 Enter
  await kb.evaluate(() => { const s = __dh.scene; s.applyDonghyunLang(__dh.lang.compose([[2, 1], [14, 0]], '', { world: __dh.world })); s.voyage.leave(); s.openBattle(s.voyage.rivals.get('blackreef')); }); await kb.focus('.dh-canvas');
  const KB = () => kb.evaluate(() => { const s = __dh.engine.scene, b = s.b; return { n: __dh.engine.scenes.length, mode: s.mode, side: b.side, ask: s.ask, auto: s.auto, sel: s.sel && s.sel.id, cur: s.cur && [s.cur.c, s.cur.r], me: b.units.filter(u => u.side === 'me').map(u => [u.c, u.r, u.moved, u.done]), reach: [...s.reach.values()].map(v => [v.c, v.r]) }; });
  let H = await KB(); assert.deepStrictEqual([H.n, H.mode, H.side, H.cur], [2, 'fight', 'me', null]); assert.deepStrictEqual(await keys(), ['1', '2', '3', '4']);
  await kb.keyboard.press('ArrowRight'); H = await KB(); assert.deepStrictEqual(H.cur, H.me[0].slice(0, 2), '처음 누르면 우리 배 자리에 커서');
  await kb.keyboard.press('Escape'); await kb.keyboard.press('Space'); H = await KB(); assert.strictEqual(H.sel, 'me0', 'Space = 다음 우리 배');
  let trail = []; for (const d of ['ArrowRight', 'ArrowRight']) { await kb.keyboard.press(d); trail.push((await KB()).cur); }
  H = await KB(); assert.ok(H.reach.some(v => v[0] === H.cur[0] && v[1] === H.cur[1]), '커서가 갈 수 있는 칸에 ' + H.cur);
  await kb.keyboard.press('Enter'); H = await KB(); assert.deepStrictEqual(H.me[0].slice(0, 3), [...trail[1], true], 'Enter = 커서 칸으로 옮긴다');
  if (H.sel) { await kb.keyboard.press('Digit1'); H = await KB(); } assert.strictEqual(H.me[0][3], true, '1 = 대기(그 턴 일을 마친다)');
  for (let i = 0; i < 40 && (H = await KB()).side !== 'me'; i++) await sStep(20, kb);
  if (H.mode === 'fight') { await kb.keyboard.press('Digit4'); assert.strictEqual((await KB()).ask, true, '4 = 달아나기(되묻는다)'); await kb.keyboard.press('Enter'); H = await KB(); assert.deepStrictEqual([H.ask, H.mode], [false, 'fight'], '되묻기에서 Enter = 돌아가기'); await kb.keyboard.press('Digit3'); assert.strictEqual((await KB()).auto, true, '3 = 맡기기'); }
  for (let i = 0; i < 200 && (H = await KB()).mode !== 'result'; i++) await sStep(40, kb); assert.strictEqual(H.mode, 'result');
  await sStep(40, kb); await kb.keyboard.press('Enter'); assert.strictEqual((await KZ()).n, 1, '결과 카드에서 Enter = 바다로 돌아가기');
  ok('해전도 키보드로: 단추 번호 1~4(대기 · 차례 넘기기 · 맡기기 · 달아나기) · 방향키로 칸 커서(처음엔 우리 배 자리) · Space 우리 배 · Enter 커서 칸으로 옮기기 · 4 → Enter는 돌아가기 · 3 맡기기 → 결과 카드에서 Enter → 바다');

  // 휴대폰(390px): 저장 줄과 메뉴가 화면 안에 · 손가락으로 저장하고 불러온다
  const pc = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), h = await pc.newPage(); h.on('pageerror', e => errs.push('h ' + e.message)); await open(h);
  const tap = async sel => { const e = await h.$(sel); await e.scrollIntoViewIfNeeded(); const r = await e.boundingBox(); await h.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); }, tapItem = label => tap(`#menu .mi:has(span:text-is("${label}"))`);
  const bar = await h.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(), a = ['#game-save', '#game-load', '#full'].map(r); return { tops: new Set(a.map(x => Math.round(x.top))).size, h: Math.min(...a.map(x => x.height)), right: Math.max(...a.map(x => x.right)), note: r('.save-note').bottom <= a[0].top + 1, sw: document.documentElement.scrollWidth }; });
  assert.ok(bar.tops === 1 && bar.h >= 32 && bar.right <= 390 && bar.note && bar.sw <= 390, JSON.stringify(bar));
  await tap('#game-save'); const pm = await h.evaluate(() => { const m = document.querySelector('#menu').getBoundingClientRect(), it = [...document.querySelectorAll('#menu .mi')].map(e => e.getBoundingClientRect()); return { l: m.left, r: m.right, t: m.top, b: m.bottom, h: Math.min(...it.map(x => x.height)), n: it.length, sw: document.documentElement.scrollWidth, ih: innerHeight }; });
  assert.ok(pm.l >= 0 && pm.r <= 390 && pm.t >= 0 && pm.b <= pm.ih && pm.h >= 44 && pm.n === 6 && pm.sw <= 390, JSON.stringify(pm)); await h.evaluate(() => __dh.engine.step(1)); await h.screenshot({ path: shot + '/ui-phone-save.png' });
  await tapItem('브라우저 칸 1'); assert.strictEqual(await h.$eval('#status', e => e.textContent), '브라우저 칸 1에 저장했다 · 리스본 · 1522년 5월 1일'); const p0 = await whole(h);
  await tap('button[data-id="tab:market"]'); await tap('button[data-id="buy:wine"]'); assert.notStrictEqual(await whole(h), p0); await tap('#game-load'); await tapItem('브라우저 칸 1'); await tapItem('불러온다'); assert.strictEqual(await whole(h), p0); assert.strictEqual(await gm(h), null);
  await tap('#game-load'); await h.touchscreen.tap(8, 8); assert.strictEqual(await gm(h), null, '메뉴 바깥을 누르면 닫힌다');
  ok(`휴대폰: 저장 · 불러오기 · 전체 화면 단추가 한 줄(높이 ${Math.round(bar.h)}px) · 메뉴가 390px 안(단추 ${Math.round(pm.h)}px) · 손가락으로 칸 1 저장 → 불러오기`);
  }

  // ───────── 편집기 아래 저장 칸 목록(다른 실험실과 같은 모양) ─────────
  { const cl = await b.newContext({ viewport: { width: 1280, height: 860 } }), l = await cl.newPage(); l.on('pageerror', e => errs.push('slot ' + e.message)); await l.goto(url); await l.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
    const L = fn => l.evaluate(fn), list = () => L(() => [...document.querySelectorAll('#slot-list .slot-row')].map(r => { const b = r.querySelector('.slot-btn'), x = r.querySelector('.slot-del'); return { t: [...b.children].map(e => e.textContent), off: b.disabled, del: x ? x.textContent : null }; }));
    let rows = await list(); assert.deepStrictEqual(rows, [1, 2, 3].map(n => ({ t: ['칸 ' + n, '비어 있음'], off: true, del: null })), '빈 칸 셋은 흐리고 지우기 단추가 없다');
    assert.deepStrictEqual(await L(() => [document.querySelector('.load-head strong').textContent, document.querySelector('.load-head label').textContent.trim(), !!document.querySelector('.load-box').closest('.setup-panel')]), ['저장한 탐험 불러오기', '파일에서 불러오기', true]);
    await l.click('#run'); await l.click('#game-save'); await l.click('#menu .mi:has(span:text-is("브라우저 칸 2"))');
    rows = await list(); assert.deepStrictEqual([rows[0].off, rows[1].off, rows[2].off, rows[1].del, rows[1].t[0]], [true, false, true, '지우기', '칸 2']); assert.ok(/^리스본 · 1522년 5월 1일 · \d+\/\d+ \d\d:\d\d 저장$/.test(rows[1].t[1]), rows[1].t[1]); assert.ok(rows[1].t[2] && rows[1].t[2].length > 3, '요약 줄이 셋째 줄에');
    const saved = await L(() => localStorage.getItem('donghyunhang:slot2')); await l.reload(); await l.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
    assert.deepStrictEqual((await list())[1].t, rows[1].t, '다시 열어도 목록이 그대로 보인다'); assert.strictEqual(await L(() => __dh.waiting()), true);
    await L(() => document.querySelector('.load-box').scrollIntoView({ block: 'center' })); await l.screenshot({ path: shot + '/ui-slot-list.png' });
    await l.click('#slot-list .slot-row:nth-child(2) .slot-btn'); assert.deepStrictEqual([await L(() => __dh.waiting()), await L(() => __dh.voyage.port), await l.$eval('#status', e => e.textContent), await L(() => document.querySelector('#menu-back').hidden)], [false, 'lisbon', '저장한 탐험을 불러왔다', true], '출전하기 전에는 칸을 누르면 바로 이어 한다');
    await l.click('#slot-list .slot-row:nth-child(2) .slot-btn'); assert.deepStrictEqual(await L(() => [...document.querySelectorAll('#menu .mi span:first-child')].map(e => e.textContent)), ['불러온다', '그만둔다'], '하던 탐험이 있으면 되묻는다'); await l.click('#menu .mi:has(span:text-is("그만둔다"))');
    await l.click('#slot-list .slot-row:nth-child(2) .slot-del'); assert.deepStrictEqual([(await list())[1].del, await L(() => localStorage.getItem('donghyunhang:slot2'))], ['정말 지운다', saved], '한 번 누르면 되묻기만 한다');
    await l.click('#slot-list .slot-row:nth-child(2) .slot-del'); assert.deepStrictEqual([await list(), await L(() => localStorage.getItem('donghyunhang:slot2')), await l.$eval('#status', e => e.textContent)], [[1, 2, 3].map(n => ({ t: ['칸 ' + n, '비어 있음'], off: true, del: null })), null, '브라우저 칸 2를 지웠다.']);
    await l.setViewportSize({ width: 390, height: 844 }); await L(() => localStorage.setItem('donghyunhang:slot1', '{"format":"x"}')); await l.reload(); await l.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
    const ph = await L(() => { const r = [...document.querySelectorAll('#slot-list .slot-row, .load-head, .load-box .slot-note, #slot-list button')].map(e => e.getBoundingClientRect()); return { sw: document.documentElement.scrollWidth, right: Math.max(...r.map(x => x.right)), left: Math.min(...r.map(x => x.left)), h: Math.min(...[...document.querySelectorAll('#slot-list button')].map(e => e.getBoundingClientRect().height)) }; });
    assert.ok(ph.sw <= 390 && ph.right <= 390 && ph.left >= 0 && ph.h >= 40, JSON.stringify(ph)); await L(() => localStorage.clear()); await cl.close();
    ok('저장 칸 목록: 편집기 아래 칸 셋(빈 칸은 흐림) · 저장하면 제목 · 날짜 · 저장 시각 · 요약 · 출전 전에는 눌러서 바로 이어 하기 · 하던 탐험이 있으면 되묻기 · 지우기는 두 번 눌러야 · 휴대폰 390px 안'); }

  assert.deepStrictEqual(errs, []); console.log(`\n${n} ui tests passed · 콘솔 오류 0`); await b.close();
})().catch(e => { console.error(e); process.exit(1); });

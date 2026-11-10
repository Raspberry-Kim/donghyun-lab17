/* 동현항 · 동현랭 연동 — globalState와, 동현랭이 출력한 정수를 그 자리에 덮어쓰는 규약. 어댑터는 동현삼과 같은 DH.DonghyunLangAdapter다.
 *
 * globalState(DH.Hang.newState())에는 기본값이 먼저 들어 있다: hang-rules.js의 RULES, hang-battle.js의 SEA.
 * 시작값(start)은 null이고, null이면 JSON 자료에 적힌 값을 쓴다. 동현랭 설정이 없으면 이 기본값 그대로 탐험이 열린다.
 *
 *   번호  설정                     값
 *    2    난수 씨앗                1~2147483646
 *    3~7  시작 자금 · 식량(일) · 물(일) · 선원 · 선장 무력
 *    8    시작 짐                  교역품 번호(자료에 적힌 순서), 수량                   ← 여러 번 쓸 수 있다
 *    10~14 교역 단위 · 시세 변동 폭(%) · 수수료(%) · 굶을 때 선원 손실(%) · 적을 만날 확률(%/일)
 *    20~24 승리 조건(모을 자금) · 기한(일) · 해전 기한(턴) · 배 이동력 · 포 사거리
 *    30   적 선장 무력             적 함대 번호(자료에 적힌 순서), 값 1~100              ← 여러 번 쓸 수 있다 */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const H = DH.Hang, clone = o => JSON.parse(JSON.stringify(o));
  const fmt = n => Number(n).toLocaleString('ko-KR');

  /** 동현항의 globalState. 기본값(fallback)이 들어 있다. */
  function newState() {
    return {
      rules: clone(H.RULES),                                              // 항해 · 교역 · 항구 수치
      sea: clone(H.SEA),                                                  // 해전 수치
      start: { seed: null, gold: null, food: null, water: null, crew: null, war: null },   // null = 자료 값 그대로
      stage: { gold: 0, days: 0 },                                        // 0 = 조건 없음
      cargo: [], rivals: []                                               // [[교역품 id, 수량]] · [[적 함대 id, 무력]]
    };
  }
  const nth = (map, n) => (map ? [...map.values()][n - 1] : null);
  const fleet = world => (world ? world.fleets.get('player') : null);
  const crewRange = world => { const f = fleet(world); if (!f) return null; const t = f.ships.map(s => world.shipTypes.get(s.type)); return [t.reduce((n, x) => n + x.minCrew, 0), t.reduce((n, x) => n + x.maxCrew, 0)]; };

  const lang = new DH.DonghyunLangAdapter({ name: '동현항', commands: {
    2: { key: 'start.seed', label: '난수 씨앗', min: 1, max: 2147483646, path: 'start.seed', hint: '같은 씨앗이면 같은 바다', def: '1' },
    3: { key: 'start.gold', label: '시작 자금', min: 0, max: 9999999, path: 'start.gold', def: '자료 값' },
    4: { key: 'start.food', label: '시작 식량(일)', min: 0, max: 120, path: 'start.food', def: '자료 값' },
    5: { key: 'start.water', label: '시작 물(일)', min: 0, max: 60, path: 'start.water', def: '자료 값' },
    6: { key: 'start.crew', label: '시작 선원', min: 1, max: 999, path: 'start.crew', hint: '배의 최소~최대 선원 안에서', def: '자료 값',
      check: ([n], { world }) => { const r = crewRange(world); return r && (n < r[0] || n > r[1]) ? `선원 ${n}명은 배의 ${r[0]}~${r[1]}명 밖이다` : null; } },
    7: { key: 'start.war', label: '선장 무력', min: 1, max: 100, path: 'start.war', hint: '일기토에 쓴다', def: '자료 값' },
    8: { key: 'cargo', label: '시작 짐', multi: true, hint: '교역품 번호는 자료에 적힌 순서 · 적으면 그 교역품의 처음 짐을 바꾼다', def: '자료 값',
      args: [{ label: '교역품 번호', min: 1, max: 99 }, { label: '수량', min: 0, max: 9999 }],
      check: ([g], { world }) => (world && !nth(world.goods, g) ? `교역품은 ${world.goods.size}가지뿐이다` : null),
      show: ([g, q], { world }) => `${nth(world && world.goods, g) ? nth(world.goods, g).name : g + '번'} ${fmt(q)}`,
      set: (st, [g, q], { world }) => st.cargo.push([nth(world.goods, g).id, q]) },
    10: { key: 'lot', label: '교역 단위', min: 1, max: 100, path: 'rules.lot', hint: '한 번에 사고파는 수량' },
    11: { key: 'price.stepPct', label: '시세 변동 폭(%)', min: 1, max: 20, path: 'rules.price.stepPct', hint: '한 번 사고팔 때 움직이는 값(그 항구 처음 값의 %)' },
    12: { key: 'price.feePct', label: '교역소 수수료(%)', min: 0, max: 50, path: 'rules.price.feePct', hint: '팔 때 뗀다' },
    13: { key: 'supply.lossPct', label: '굶을 때 하루 선원 손실(%)', min: 1, max: 100, path: 'rules.supply.lossPct', hint: '식량이나 물이 0일일 때' },
    14: { key: 'encounter.percent', label: '적 함대를 만날 확률(%/일)', min: 0, max: 100, path: 'rules.encounter.percent', hint: '0이면 만나지 않는다' },
    20: { key: 'stage.gold', label: '승리 조건: 모을 자금', min: 0, max: 9999999, path: 'stage.gold', hint: '이만큼 모으면 이긴다 · 0 조건 없음' },
    21: { key: 'stage.days', label: '기한(일)', min: 0, max: 3650, path: 'stage.days', hint: '바다에서 보낸 날이 이만큼 되면 진다 · 0 기한 없음' },
    22: { key: 'sea.turns', label: '해전 기한(턴)', min: 5, max: 60, path: 'sea.turns', hint: '지나면 승부 없이 갈라진다' },
    23: { key: 'sea.mp', label: '배 이동력', min: 1, max: 6, path: 'sea.mp', hint: '해전에서 한 턴에 가는 칸' },
    24: { key: 'sea.range', label: '포 사거리', min: 1, max: 6, path: 'sea.range' },
    30: { key: 'rivals', label: '적 선장 무력', multi: true, hint: '적 함대 번호는 자료에 적힌 순서', def: '자료 값',
      args: [{ label: '적 함대 번호', min: 1, max: 99 }, { label: '무력', min: 1, max: 100 }],
      check: ([n], { world }) => (world && !nth(world.rivals, n) ? `적 함대는 ${world.rivals.size}개뿐이다` : null),
      show: ([n, v], { world }) => `${nth(world && world.rivals, n) ? nth(world.rivals, n).captain.name : n + '번 함대'} ${v}`,
      set: (st, [n, v], { world }) => st.rivals.push([nth(world.rivals, n).id, v]) }
  },
  /** 설정을 모두 읽은 뒤의 검사: 시작 짐이 배에 다 실리는지 */
  validate: (values, { world }) => {
    const f = fleet(world); if (!f || !values.cargo) return null;
    const hold = new Map(); for (const sh of f.ships) for (const h of sh.hold) hold.set(h.good, (hold.get(h.good) || 0) + h.qty);
    for (const [g, q] of values.cargo) hold.set(nth(world.goods, g).id, q);
    const used = [...hold.values()].reduce((a, b) => a + b, 0), cap = world.cargoCap(f);
    return used > cap ? `시작 짐 ${fmt(used)}개는 배에 다 실리지 않는다. 적재량은 ${fmt(cap)}이다.` : null;
  } });

  /** 동현랭 설정을 동현항 globalState에 덮어쓴다. ctx.world가 있어야 한다(교역품 · 적 함대 번호를 자료에서 찾는다). */
  const applyDonghyunLang = (scriptText, state, ctx) => lang.applyDonghyunLang(scriptText, state, ctx);

  const examples = world => { const c = (list, title) => lang.compose(list, title, { world }); return [
    { id: 'none', name: '기본값(설정 없음)', code: '나는 동현이냐?\nㅋㅋ 아무것도 출력하지 않으면 기본값 그대로 시작한다\n동현이구나' },
    { id: 'rich', name: '넉넉한 출항', code: c([[3, 5000], [4, 120], [5, 60], [6, 40], [8, 1, 80], [8, 2, 0]], '자금 5,000 · 식량 120일 · 물 60일 · 선원 40명 · 포도주 80 · 올리브유 없음') },
    { id: 'stage', name: '스테이지: 300일 안에 자금 5,000', code: c([[2, 7], [20, 5000], [21, 300], [14, 0]], '씨앗 7 · 자금 5,000을 모으면 이긴다 · 300일 안에 · 적 함대 없음') },
    { id: 'war', name: '해적이 들끓는 바다', code: c([[14, 40], [7, 90], [23, 4], [30, 1, 40]], '날마다 40% 확률로 만난다 · 선장 무력 90 · 배 이동력 4 · 붉은수염 무력 40') }
  ]; };

  DH.Hang = Object.assign(H, { newState, lang, applyDonghyunLang, examples });
})(typeof globalThis !== 'undefined' ? globalThis : this);

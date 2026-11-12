/* 동현항 · 동현랭 연동 — globalState와, 동현랭이 출력한 정수를 그 자리에 덮어쓰는 규약. 어댑터는 동현삼과 같은 DH.DonghyunLangAdapter다.
 *
 * globalState(DH.Hang.newState())에는 기본값이 먼저 들어 있다: hang-rules.js의 RULES, hang-battle.js의 SEA.
 * 시작값(start)은 null이고, null이면 JSON 자료에 적힌 값을 쓴다. 동현랭 설정이 없으면 이 기본값 그대로 탐험이 열린다.
 *
 *   번호  설정                     값
 *    2    난수 씨앗                1~2147483646
 *    3~7  시작 자금 · 식량(일) · 물(일) · 선원 · 선장 무력
 *    8    시작 짐                  교역품 번호(자료에 적힌 순서), 수량                   ← 여러 번 쓸 수 있다
 *    9    시작 기함                배 종류 번호(자료에 적힌 순서: 1 캐러벨 · 2 캐럭 · 3 거북선). 거북선은 무적 모드에서만 된다
 *    10~14 교역 단위 · 시세 변동 폭(%) · 수수료(%) · 굶을 때 선원 손실(%) · 해적을 만날 확률(%/일)
 *    15~18 무적 모드(0 · 1) · 통행료(자금의 %) · 선장 수련 값(금) · 포 보강 값(금)
 *    20~24 승리 조건(모을 자금) · 기한(일) · 해전 기한(턴) · 배 이동력 · 포 사거리
 *    30   해적 선장 무력           해적 번호(자료에 적힌 순서), 값 1~100                 ← 여러 번 쓸 수 있다 */
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
      start: { seed: null, gold: null, food: null, water: null, crew: null, war: null, ship: null },   // null = 자료 값 그대로 · ship은 시작 기함의 배 종류 id
      stage: { gold: 0, days: 0 },                                        // 0 = 조건 없음
      cargo: [], rivals: []                                               // [[교역품 id, 수량]] · [[해적 id, 무력]]
    };
  }
  const nth = (map, n) => (map ? [...map.values()][n - 1] : null);
  const fleet = world => (world ? world.fleets.get('player') : null);
  /** 시작 함대의 배 종류들. ship(배 종류 번호)을 주면 기함을 그 배로 바꿔 본다. */
  const startTypes = (world, ship) => { const f = fleet(world); return f ? f.ships.map((s, i) => (i === 0 && ship ? nth(world.shipTypes, ship) : world.shipTypes.get(s.type))) : null; };

  const lang = new DH.DonghyunLangAdapter({ name: '동현항', commands: {
    2: { key: 'start.seed', label: '난수 씨앗', min: 1, max: 2147483646, path: 'start.seed', hint: '같은 씨앗이면 같은 바다', def: '1' },
    3: { key: 'start.gold', label: '시작 자금', min: 0, max: 9999999, path: 'start.gold', def: '자료 값' },
    4: { key: 'start.food', label: '시작 식량(일)', min: 0, max: 120, path: 'start.food', def: '자료 값' },
    5: { key: 'start.water', label: '시작 물(일)', min: 0, max: 60, path: 'start.water', def: '자료 값' },
    6: { key: 'start.crew', label: '시작 선원', min: 1, max: 999, path: 'start.crew', hint: '배의 최소~최대 선원 안에서', def: '자료 값' },
    7: { key: 'start.war', label: '선장 무력', min: 1, max: 100, path: 'start.war', hint: '일기토와 백병전에 쓴다', def: '자료 값' },
    8: { key: 'cargo', label: '시작 짐', multi: true, hint: '교역품 번호는 자료에 적힌 순서 · 적으면 그 교역품의 처음 짐을 바꾼다', def: '자료 값',
      args: [{ label: '교역품 번호', min: 1, max: 99 }, { label: '수량', min: 0, max: 9999 }],
      check: ([g], { world }) => (world && !nth(world.goods, g) ? `교역품은 ${world.goods.size}가지뿐이다` : null),
      show: ([g, q], { world }) => `${nth(world && world.goods, g) ? nth(world.goods, g).name : g + '번'} ${fmt(q)}`,
      set: (st, [g, q], { world }) => st.cargo.push([nth(world.goods, g).id, q]) },
    9: { key: 'start.ship', label: '시작 기함', min: 1, max: 9, hint: '배 종류 번호는 자료에 적힌 순서(1 캐러벨 · 2 캐럭 · 3 거북선) · 거북선은 무적 모드에서만', def: '자료 값',
      check: ([n], { world }) => (world && !nth(world.shipTypes, n) ? `배 종류는 ${world.shipTypes.size}가지뿐이다` : null),
      show: ([n], { world }) => (nth(world && world.shipTypes, n) ? nth(world.shipTypes, n).name : n + '번 배'),
      set: (st, [n], { world }) => { st.start.ship = nth(world.shipTypes, n).id; } },
    10: { key: 'lot', label: '교역 단위', min: 1, max: 100, path: 'rules.lot', hint: '한 번에 사고파는 수량' },
    11: { key: 'price.stepPct', label: '시세 변동 폭(%)', min: 1, max: 20, path: 'rules.price.stepPct', hint: '한 번 사고팔 때 움직이는 값(그 항구 처음 값의 %)' },
    12: { key: 'price.feePct', label: '교역소 수수료(%)', min: 0, max: 50, path: 'rules.price.feePct', hint: '팔 때 뗀다' },
    13: { key: 'supply.lossPct', label: '굶을 때 하루 선원 손실(%)', min: 1, max: 100, path: 'rules.supply.lossPct', hint: '식량이나 물이 0일일 때' },
    14: { key: 'encounter.percent', label: '해적을 만날 확률(%/일)', min: 0, max: 100, path: 'rules.encounter.percent', hint: '0이면 만나지 않는다' },
    15: { key: 'invincible', label: '무적 모드', min: 0, max: 1, path: 'rules.invincible', hint: '1이면 금을 내지 않고, 식량과 물이 줄지 않고, 우리 배가 다치지 않고, 선장이 일기토에서 지지 않는다 · 거북선을 고를 수 있다' },
    16: { key: 'encounter.tollPct', label: '통행료(자금의 %)', min: 1, max: 100, path: 'rules.encounter.tollPct', hint: '해적에게 내고 지나가는 값 · 적어도 금 100' },
    17: { key: 'inn.train', label: '선장 수련 값(금)', min: 0, max: 99999, path: 'rules.inn.train', hint: '여관에서 무력을 1 올리는 값' },
    18: { key: 'dock.gunGold', label: '포 보강 값(금)', min: 0, max: 99999, path: 'rules.dock.gunGold', hint: '도크에서 포 2문을 더 다는 값' },
    20: { key: 'stage.gold', label: '승리 조건: 모을 자금', min: 0, max: 9999999, path: 'stage.gold', hint: '이만큼 모으면 이긴다 · 0 조건 없음' },
    21: { key: 'stage.days', label: '기한(일)', min: 0, max: 3650, path: 'stage.days', hint: '바다에서 보낸 날이 이만큼 되면 진다 · 0 기한 없음' },
    22: { key: 'sea.turns', label: '해전 기한(턴)', min: 5, max: 60, path: 'sea.turns', hint: '지나면 승부 없이 갈라진다' },
    23: { key: 'sea.mp', label: '배 이동력', min: 1, max: 6, path: 'sea.mp', hint: '해전에서 한 턴에 가는 칸' },
    24: { key: 'sea.range', label: '포 사거리', min: 1, max: 6, path: 'sea.range' },
    30: { key: 'rivals', label: '해적 선장 무력', multi: true, hint: '해적 번호는 자료에 적힌 순서', def: '자료 값',
      args: [{ label: '해적 번호', min: 1, max: 99 }, { label: '무력', min: 1, max: 100 }],
      check: ([n], { world }) => (world && !nth(world.rivals, n) ? `해적은 ${world.rivals.size}무리뿐이다` : null),
      show: ([n, v], { world }) => `${nth(world && world.rivals, n) ? nth(world.rivals, n).captain.name : n + '번 해적'} ${v}`,
      set: (st, [n, v], { world }) => st.rivals.push([nth(world.rivals, n).id, v]) }
  },
  /** 설정을 모두 읽은 뒤의 검사: 거북선은 무적 모드에서만 · 시작 선원이 배의 정원 안인지 · 시작 짐이 배에 다 실리는지 */
  validate: (values, { world }) => {
    const f = fleet(world); if (!f) return null;
    const types = startTypes(world, values['start.ship']), n = values['start.crew'];
    if (types[0].cheat && !values.invincible) return `${DH.josa(types[0].name, '은', '는')} 무적 모드에서만 탄다. 설정 15(무적 모드)를 1로 함께 적는다.`;
    const min = types.reduce((a, t) => a + t.minCrew, 0), max = types.reduce((a, t) => a + t.maxCrew, 0);
    if (n !== undefined && (n < min || n > max)) return `설정 6(시작 선원): 선원 ${n}명은 배의 ${min}~${max}명 밖이다`;
    if (!values.cargo && !values['start.ship']) return null;
    const hold = new Map(); for (const sh of f.ships) for (const h of sh.hold) hold.set(h.good, (hold.get(h.good) || 0) + h.qty);
    for (const [g, q] of values.cargo || []) hold.set(nth(world.goods, g).id, q);
    const used = [...hold.values()].reduce((a, b) => a + b, 0), cap = types.reduce((a, t) => a + t.cargo, 0);
    return used > cap ? `시작 짐 ${fmt(used)}개는 배에 다 실리지 않는다. 적재량은 ${fmt(cap)}이다.` : null;
  } });

  /** 동현랭 설정을 동현항 globalState에 덮어쓴다. ctx.world가 있어야 한다(교역품 · 적 함대 번호를 자료에서 찾는다). */
  const applyDonghyunLang = (scriptText, state, ctx) => lang.applyDonghyunLang(scriptText, state, ctx);

  /* 손으로 쓴 예제(변수 · 반복문)를 짓는 도우미. 수는 어댑터의 식 적기(expression)로 적는다.
   * script(줄들): 줄을 잇는다. '@' 한 글자뿐인 줄은 되돌아올 자리(빈 문장)이고, 다른 줄의 {@}는 그 문장 번호를 적은 식으로 바뀐다.
   * 문장 번호는 동현랭 명세대로 센다: 줄바꿈과 ~로 나눈 조각마다 하나, 주석만 있는 줄도 하나. */
  const A = DH.DonghyunLangAdapter, lit = n => A.expression(n), say = e => `뿡뿡 ${e}~뿡뿡뿡`;
  function script(lines) {
    const at = lines.indexOf('@'), no = at < 0 ? 0 : lines.slice(0, at).reduce((n, l) => n + l.split('~').length, 0) + 1;
    return lines.map(l => (l === '@' ? `ㅋㅋ ↓ 여기가 ${no}번 문장이다. 되돌아오는 자리` : l.replace('{@}', lit(no)).replace('{@번}', no + '번'))).join('\n');
  }

  /** 플레이그라운드에 싣는 예제 열하나. name의 번호는 고르는 칸에 보이는 순서다. 01은 '설정 없음'이고, 09 · 10은 손으로 쓴 동현랭(변수 · 반복문)이다.
   *  11은 무적 모드다(승리 조건을 함께 적지 않는다. 금이 줄지 않아 금세 채워지기 때문이다). */
  const examples = world => { const c = (list, title) => lang.compose(list, title, { world }); return [
    { id: 'none', name: '01 · 기본값(설정 없음)', code: '나는 동현이냐?\nㅋㅋ 아무것도 출력하지 않으면 기본값 그대로 시작한다\n동현이구나' },
    { id: 'rich', name: '02 · 넉넉한 출항', code: c([[3, 5000], [4, 120], [5, 60], [6, 40], [8, 1, 80], [8, 2, 0]], '자금 5,000 · 식량 120일 · 물 60일 · 선원 40명 · 포도주 80 · 올리브유 없음') },
    { id: 'stage', name: '03 · 스테이지: 300일 안에 자금 5,000', code: c([[2, 7], [20, 5000], [21, 300], [14, 0]], '씨앗 7 · 자금 5,000을 모으면 이긴다 · 300일 안에 · 해적 없음') },
    { id: 'war', name: '04 · 해적이 들끓는 바다', code: c([[14, 40], [7, 90], [23, 4], [30, 1, 40]], '날마다 40% 확률로 만난다 · 선장 무력 90 · 배 이동력 4 · 붉은수염 무력 40') },
    { id: 'poor', name: '05 · 빈손 출항', code: c([[3, 300], [4, 30], [5, 30], [8, 1, 0], [8, 2, 0], [10, 5]], '자금 300 · 식량 30일 · 물 30일 · 짐 없음 · 다섯 개씩 사고판다') },
    { id: 'calm', name: '06 · 고요한 바다의 큰손', code: c([[3, 20000], [14, 0], [10, 40], [11, 1], [12, 0]], '자금 20,000 · 해적 없음 · 40개씩 사고판다 · 시세 변동 1% · 수수료 없음') },
    { id: 'hunger', name: '07 · 굶주린 항해', code: c([[4, 10], [5, 10], [13, 30], [14, 0]], '식량 10일 · 물 10일 · 굶으면 하루에 선원 30%를 잃는다 · 해적 없음') },
    { id: 'guns', name: '08 · 포격전 실험: 멀리 쏘고 느리게', code: c([[14, 60], [24, 6], [23, 1], [22, 40], [30, 2, 50], [30, 3, 50]], '날마다 60% 확률로 만난다 · 포 사거리 6 · 배 이동력 1 · 해전 40턴 · 외눈 선장과 폭풍 제독 무력 50') },
    { id: 'scale', name: '09 · 변수: 배율 하나로 채비 셋', code: script(['나는 동현이냐?',
      'ㅋㅋ 변수 · 배율 하나(동현 = 4)로 자금 4,000 · 선원 40명 · 포도주 80',
      'ㅋㅋ 아래 한 줄의 수만 고치면 세 값이 함께 바뀐다. 배율은 1부터 4까지 된다(선원은 10명에서 40명까지)',
      `동현아 ${lit(4)}`,
      'ㅋㅋ 3번 시작 자금 = 배율 × 1,000', say(lit(3)), say(`동현 ${lit(1000)}`),
      'ㅋㅋ 6번 시작 선원 = 배율 × 10', say(lit(6)), say(`동현 ${lit(10)}`),
      'ㅋㅋ 8번 시작 짐: 1번 교역품(포도주) = 배율 × 20', say(lit(8)), say(lit(1)), say(`동현 ${lit(20)}`),
      '동현이구나']) },
    { id: 'loop', name: '10 · 반복문: 열두 교역품을 열 개씩', code: script(['나는 동현이냐?',
      'ㅋㅋ 반복문 · 교역품 열두 가지를 열 개씩 싣는다(모두 120개, 캐러벨에 꼭 찬다)',
      'ㅋㅋ 동현 = 교역품 번호. 한 바퀴에 설정 하나(8번: 교역품 번호, 수량 10)를 출력한다',
      `동현아 ${lit(1)}`,
      '@',
      say(lit(8)), say('동현'), say(lit(10)),
      '동현아 동현도옹',
      'ㅋㅋ 동현이 13보다 작으면(동현에 ㅠ를 열세 번 더해 음수면) {@번} 문장으로 돌아간다',
      `뭉치 동현${'ㅠ'.repeat(13)}? 신중동역 {@}`,
      '동현이구나']) },
    { id: 'turtle', name: '11 · 무적 모드: 거북선과 끝없는 자금', code: c([[15, 1], [9, 3], [14, 40]], '무적 모드 · 거북선으로 출항 · 날마다 40% 확률로 해적을 만난다') }
  ]; };

  DH.Hang = Object.assign(H, { newState, lang, applyDonghyunLang, examples });
})(typeof globalThis !== 'undefined' ? globalThis : this);

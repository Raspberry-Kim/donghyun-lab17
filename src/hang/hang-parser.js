/* 동현항 · 자료 파서 — donghyun_hang_data.json을 읽어 검사하고 게임이 쓰는 꼴로 바꾼다.
 * 규격(version 1)
 *   map         {grid:'square', cols, rows, wrapX, tiles:{글자:이름}, rle:[줄…]}   한 칸 = 경위도 1°
 *   goods[]     {id, name, base}
 *   facilities  {id: 이름}
 *   ports[]     {id, name, lon, lat, x, y(항구 칸·육지), anchor:[x,y](정박 칸·바다), market:[{good, price, stock}], facilities:[id…]}
 *   shipTypes[] {id, name, cargo, minCrew, maxCrew, speed(하루에 가는 칸), hull(선체), guns(포), price(도크에서 사는 값)}
 *   fleets[]    {id, name, x, y, port(항구 id|null), crew, food · water(선원 모두가 먹고 마시는 날 수), gold, captain:{name, war(무력 1~100)},
 *                ships:[{id, type, name, hold:[{good, qty, paid}]}]}   첫 배가 기함이다
 *   rivals[]    {id, name, captain:{name, war}, ships:[배 종류 id…], crew, gold}   바다에서 만나는 적 함대. 첫 배가 기함이다
 * 검사: 항구 20곳 · 항구 칸은 육지, 정박 칸은 그 옆 바다 · 시세가 교역품마다 꼭 하나 · 시설 이름 · 모든 정박 칸이 한 바다로 이어졌는지 ·
 *       탐험대 자리(바다) · 선원 수가 배의 최소~최대 안 · 짐이 적재량을 넘지 않는지 · 선장 무력 · 적 함대의 배 종류와 선원 수. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};

  function parse(json, opt = {}) {
    const expect = opt.ports ?? 20;
    const chk = new DH.Checker('동현항 자료');
    DH.Data.header(json, 'donghyun-hang-data', 1, chk); chk.done();

    const m = json.map || {};
    chk.ok(m.grid === 'square', 'map.grid', "'square'이어야 한다");
    chk.int(m.cols, 'map.cols', 1, 2048); chk.int(m.rows, 'map.rows', 1, 2048);
    chk.arr(m.rle, 'map.rle', m.rows); chk.done();
    const tiles = DH.Data.rleDecode(m.rle, m.cols, chk);
    const names = m.tiles || {}, wrapX = !!m.wrapX;
    const normC = c => (wrapX ? ((c % m.cols) + m.cols) % m.cols : c);
    const inMap = (c, r) => Number.isInteger(c) && Number.isInteger(r) && r >= 0 && r < m.rows && c >= 0 && c < m.cols;
    const at = (c, r) => names[tiles[r][normC(c)]];
    const isSea = (c, r) => r >= 0 && r < m.rows && (wrapX || (c >= 0 && c < m.cols)) && at(c, r) === 'sea';
    const map = { kind: 'square', cols: m.cols, rows: m.rows, wrapX, origin: m.origin, degPerTile: m.degPerTile, tiles, names, at, isSea };
    chk.done();

    const goods = chk.index(json.goods, 'goods');
    for (const g of goods.values()) { chk.str(g.name, `goods.${g.id}.name`); chk.int(g.base, `goods.${g.id}.base`, 1); }
    const fac = json.facilities || {};

    chk.arr(json.ports, 'ports', expect);
    const ports = chk.index(json.ports, 'ports');
    const byTile = new Map();
    for (const p of ports.values()) {
      const w = `ports.${p.id}`;
      chk.str(p.name, w + '.name'); chk.num(p.lon, w + '.lon', -180, 180); chk.num(p.lat, w + '.lat', -90, 90);
      if (chk.ok(inMap(p.x, p.y), w + '.x,y', '지도 밖이다')) {
        chk.ok(at(p.x, p.y) === 'land', w + '.x,y', '항구 칸이 육지가 아니다');
        const k = p.x + ',' + p.y; chk.ok(!byTile.has(k), w + '.x,y', `항구 ${byTile.get(k)}와 같은 칸이다`); byTile.set(k, p.id);
      }
      if (chk.arr(p.anchor, w + '.anchor', 2) && chk.ok(inMap(p.anchor[0], p.anchor[1]), w + '.anchor', '지도 밖이다')) {
        const [ax, ay] = p.anchor; let dx = Math.abs(ax - p.x); if (wrapX) dx = Math.min(dx, m.cols - dx);
        chk.ok(isSea(ax, ay), w + '.anchor', '정박 칸이 바다가 아니다');
        chk.ok(dx <= 1 && Math.abs(ay - p.y) <= 1, w + '.anchor', '항구 칸 바로 옆이 아니다');
      }
      if (chk.arr(p.market, w + '.market')) {
        const seen = new Set();
        p.market.forEach((e, i) => {
          chk.ok(goods.has(e.good), `${w}.market[${i}].good`, `교역품 ${e.good}가 없다`);
          chk.ok(!seen.has(e.good), `${w}.market[${i}].good`, `${e.good}가 두 번 적혔다`); seen.add(e.good);
          chk.int(e.price, `${w}.market[${i}].price`, 1); chk.int(e.stock, `${w}.market[${i}].stock`, 0);
        });
        for (const id of goods.keys()) chk.ok(seen.has(id), w + '.market', `${id} 시세가 빠졌다`);
      }
      if (chk.arr(p.facilities, w + '.facilities')) {
        for (const f of p.facilities) chk.ok(f in fac, w + '.facilities', `시설 ${f}가 facilities에 없다`);
        chk.ok(p.facilities.includes('harbor'), w + '.facilities', '항구(harbor)가 없다');
      }
    }
    chk.done();

    // 모든 정박 칸이 한 바다로 이어졌는지: 첫 항구에서 바다를 따라 퍼져 본다(대각 포함, 길 찾기와 같은 걸음).
    const list = [...ports.values()];
    if (list.length) {
      const seen = new Uint8Array(m.cols * m.rows), q = [list[0].anchor[1] * m.cols + list[0].anchor[0]]; seen[q[0]] = 1;
      for (let i = 0; i < q.length; i++) {
        const c = q[i] % m.cols, r = (q[i] - c) / m.cols;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nr = r + dr; let nc = c + dc;
          if (nr < 0 || nr >= m.rows) continue;
          if (wrapX) nc = normC(nc); else if (nc < 0 || nc >= m.cols) continue;
          const k = nr * m.cols + nc;
          if (seen[k] || at(nc, nr) !== 'sea') continue;
          if (dc && dr && at(nc, r) !== 'sea' && at(c, nr) !== 'sea') continue;   // 땅 두 칸 사이 모서리로는 못 빠져나간다(엔진 길 찾기와 같은 규칙)
          seen[k] = 1; q.push(k);
        }
      }
      for (const p of list) chk.ok(seen[p.anchor[1] * m.cols + p.anchor[0]] === 1, `ports.${p.id}.anchor`, `${list[0].name}에서 뱃길이 닿지 않는다`);
    }

    const shipTypes = chk.index(json.shipTypes, 'shipTypes');
    for (const t of shipTypes.values()) {
      const w = `shipTypes.${t.id}`;
      chk.str(t.name, w + '.name'); chk.int(t.cargo, w + '.cargo', 0); chk.int(t.speed, w + '.speed', 1); chk.int(t.hull, w + '.hull', 1); chk.int(t.guns, w + '.guns', 0); chk.int(t.price, w + '.price', 0);
      if (chk.int(t.minCrew, w + '.minCrew', 1) && chk.int(t.maxCrew, w + '.maxCrew', 1)) chk.ok(t.minCrew <= t.maxCrew, w, '최소 선원이 최대보다 많다');
    }
    const cargoCap = f => f.ships.reduce((s, sh) => s + (shipTypes.get(sh.type)?.cargo || 0), 0);
    const cargoUsed = f => f.ships.reduce((s, sh) => s + sh.hold.reduce((a, h) => a + h.qty, 0), 0);
    const captain = (c, w) => { if (chk.ok(c && typeof c === 'object', w, '선장이 없다')) { chk.str(c.name, w + '.name'); chk.int(c.war, w + '.war', 1, 100); } };
    const fleets = chk.index(json.fleets, 'fleets');
    for (const f of fleets.values()) {
      const w = `fleets.${f.id}`;
      chk.str(f.name, w + '.name'); chk.int(f.crew, w + '.crew', 0); chk.int(f.food, w + '.food', 0); chk.int(f.water, w + '.water', 0); chk.int(f.gold, w + '.gold', 0);
      captain(f.captain, w + '.captain');
      if (chk.ok(inMap(f.x, f.y), w + '.x,y', '지도 밖이다')) chk.ok(isSea(f.x, f.y), w + '.x,y', '바다 칸이 아니다');
      if (f.port !== null) {
        const p = ports.get(f.port);
        if (chk.ok(!!p, w + '.port', `항구 ${f.port}가 없다`)) chk.ok(p.anchor[0] === f.x && p.anchor[1] === f.y, w + '.port', `${p.name}에 있다면서 정박 칸이 아니다`);
      }
      if (!chk.arr(f.ships, w + '.ships') || !chk.ok(f.ships.length > 0, w + '.ships', '배가 없다')) continue;
      let min = 0, max = 0;
      f.ships.forEach((sh, i) => {
        const t = shipTypes.get(sh.type), ws = `${w}.ships[${i}]`;
        if (!chk.ok(!!t, ws + '.type', `배 종류 ${sh.type}가 없다`)) return;
        min += t.minCrew; max += t.maxCrew;
        if (!chk.arr(sh.hold, ws + '.hold')) return;
        let used = 0;
        sh.hold.forEach((h, j) => { chk.ok(goods.has(h.good), `${ws}.hold[${j}].good`, `교역품 ${h.good}가 없다`); chk.int(h.qty, `${ws}.hold[${j}].qty`, 1); chk.int(h.paid, `${ws}.hold[${j}].paid`, 0); used += h.qty || 0; });
        chk.ok(used <= t.cargo, ws + '.hold', `짐 ${used}이 적재량 ${t.cargo}을 넘는다`);
      });
      chk.ok(f.crew >= min && f.crew <= max, w + '.crew', `선원 ${f.crew}명이 배의 ${min}~${max}명 밖이다`);
    }
    const rivals = chk.index(json.rivals || [], 'rivals');
    for (const v of rivals.values()) {
      const w = `rivals.${v.id}`;
      chk.str(v.name, w + '.name'); chk.int(v.gold, w + '.gold', 0); captain(v.captain, w + '.captain');
      if (!chk.arr(v.ships, w + '.ships') || !chk.ok(v.ships.length > 0 && v.ships.length <= 3, w + '.ships', '배는 한 척에서 세 척까지다')) continue;
      let min = 0, max = 0, known = true;
      v.ships.forEach((id, i) => { const t = shipTypes.get(id); if (chk.ok(!!t, `${w}.ships[${i}]`, `배 종류 ${id}가 없다`)) { min += t.minCrew; max += t.maxCrew; } else known = false; });
      if (known) chk.ok(Number.isInteger(v.crew) && v.crew >= min && v.crew <= max, w + '.crew', `선원 ${v.crew}명이 배의 ${min}~${max}명 밖이다`);
    }
    chk.done();

    return { meta: json.meta || {}, map, goods, facilities: fac, ports, shipTypes, fleets, rivals, cargoCap, cargoUsed,
      /** 그 칸(항구 칸이나 정박 칸)의 항구 */
      portAt: (c, r) => list.find(p => (p.x === c && p.y === r) || (p.anchor[0] === c && p.anchor[1] === r)) || null };
  }

  DH.Hang = Object.assign(DH.Hang || {}, { parse });
})(typeof globalThis !== 'undefined' ? globalThis : this);

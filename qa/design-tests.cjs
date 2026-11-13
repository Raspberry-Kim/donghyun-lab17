// v0.15: 그림 난수 격리 · 방문 · 보급 · 옛 저장. node qa/design-tests.cjs
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const files = fs.readFileSync(path.join(__dirname,'core-tests.cjs'),'utf8').match(/for \(const f of \[(.*?)\]\)/)[1].split(',').map(s=>s.trim().replace(/'/g,''));
for(const f of files)require(path.join(root,f));
const DH=globalThis.DH,H=DH.Hang,w=H.parse(JSON.parse(fs.readFileSync(path.join(root,'src/hang/donghyun_hang_data.json'))));
const V=()=>new H.Voyage(w,{rng:new DH.RNG(33)});
let count=0;const test=(name,fn)=>{fn();console.log('ok '+name);count++;};
test('방문: 시작 1회 · 같은 항구에서 입항 연타 불가 · 다른 항구 1회 · 재방문',()=>{
  const v=V();assert.equal(v.visits.get('lisbon'),1);v.enter('lisbon');assert.equal(v.visits.get('lisbon'),1);
  v.leave();v.enter('seville');assert.equal(v.visits.get('seville'),1);
  for(let i=0;i<2;i++){v.leave();v.enter('lisbon');v.leave();v.enter('seville');}
  assert.equal(v.visits.get('seville'),3);assert.equal(v.visits.get('lisbon'),3);
  const r=H.Voyage.restore(w,v.toJSON());assert.deepStrictEqual([...r.visits],[...v.visits]);assert.equal(r.visitsKnown,true);
});
test('옛 저장: 방문 이력 없음 보존 · 확인된 마지막 항구만 1회 · 불량 필드 거부',()=>{
  const d=V().toJSON();delete d.visits;delete d.visitsKnown;delete d.trafficAttempt;
  let r=H.Voyage.restore(w,d);assert.equal(r.visitsKnown,false);assert.deepStrictEqual([...r.visits],[['lisbon',1]]);
  r=H.Voyage.restore(w,r.toJSON());assert.equal(r.visitsKnown,false);
  for(const visits of [[['ghost',1]],[['lisbon',-1]],[['lisbon',1],['lisbon',2]],[['lisbon',1e10]]])assert.throws(()=>H.Voyage.restore(w,{...d,visits}),/방문/);
  assert.throws(()=>H.Voyage.restore(w,{...d,trafficAttempt:10}),/지나는/);
});
test('승리: 적 1척 5일분 · 2~3척 10일분 · 상한 · 패배/도주/무승부 보급 없음',()=>{
  for(const n of [1,2,3])for(const winner of ['me','foe',null])for(const fled of [null,'me']){
    if(winner&&fled)continue;
    const v=V();v.food=v.crew*10;v.water=v.crew*10;
    const r={winner,fled,loot:0,me:{ships:v.ships.map(s=>({...s,ref:s.id,crew:v.crew,out:null}))},foe:{ships:Array.from({length:n},()=>({type:'caravel',out:'sunk'}))}};
    v.settleBattle(r);const days=winner==='me'?(n>=2?10:5):0;
    assert.equal(v.foodDays,10+days);assert.equal(v.waterDays,10+days);
  }
  const v=V();v.food=v.crew*119;v.water=v.crew*59;assert.equal(v.addSupply('food',10),v.crew);assert.equal(v.addSupply('water',10),v.crew);
  assert.equal(v.addSupply('food',5),0);assert.equal(v.addSupply('water',5),0);
});
test('지나는 배: 확률 두 갈래 · 같은 차례 재추첨 금지 · 저장 왕복 · 게임 난수 그대로',()=>{
  const v=V();v.food=0;v.water=0;let gifts=0,kinds=new Set(),miss=0;
  const before=v.rng.state;
  for(let i=0;i<120;i++){
    v.day=i*H.RULES.traffic.every;v.food=0;v.water=0;
    const r=v.greetTraffic();if(r.gift){gifts++;kinds.add(r.kind);assert.equal(r.amount,v.crew*5);}else miss++;
    const saved=v.toJSON();assert.equal(v.greetTraffic().gift,false);assert.deepStrictEqual(saved,v.toJSON());
    const restored=H.Voyage.restore(w,saved);assert.equal(restored.greetTraffic().gift,false);
  }
  assert.ok(gifts>0&&miss>0);assert.equal(kinds.size,2);assert.equal(v.rng.state,before);
});
const layout={log(){},setInfo(){},setDetail(){},setMenu(){},press(){},pressPrimary(){}};
const E=()=>{const e=new DH.Engine({width:480,height:360,seed:1,clock:{unit:'day',start:w.meta.start,ticksPerUnit:20}});const s=new H.HangSeaScene(e,w,layout);e.setScene(s);return {e,s};};
test('항구 45: 4배율에서 원 표시 간격·클릭 일치 · 원래 항로 좌표 불변',()=>{
  const {s,e}=E(),coords=[...w.ports.values()].map(p=>[p.id,p.x,p.y,...p.anchor]);
  for(const z of [.7,1.5,2,5]){
    s.cam.zoom=z;const mid=s.cam.x+e.width/z/2,marks=s.portPositions(z,x=>s.grid.nearX(x,mid));
    for(let i=0;i<marks.length;i++){
      const a=marks[i];for(let j=i+1;j<marks.length;j++)assert.ok(Math.hypot(a.x-marks[j].x,a.y-marks[j].y)*z>=22.8,a.id+'/'+marks[j].id);
      const p=s.cam.toScreen(a.x,a.y);s.onTap(p.x,p.y);assert.equal(s.selected,a.id);
    }
  }assert.deepStrictEqual([...w.ports.values()].map(p=>[p.id,p.x,p.y,...p.anchor]),coords);
});
test('민간 배: 지역별 형 · 바다 경로만 · 게임 난수 불변 · 설명 정지/재개',()=>{
  const {s,e}=E(),before=e.rng.state,types=new Set();
  for(const id of ['lisbon','canton','goa','hakata','cebu']){
    const p=w.ports.get(id);assert.ok(p);s.cam.centerOn(p.x*4,p.y*4);s.cam.clampTo(s.grid);s.civilKey=null;s.updateCivil();assert.equal(s.civil.length,3);
    for(const b of s.civil){types.add(b.type);for(const [c,r] of b.path)assert.ok(w.map.isSea(s.grid.normC(c),r));}
  }assert.ok(types.has('junk')&&types.has('dhow')&&types.has('fishing'));assert.equal(e.rng.state,before);
  s.voyage.sailTo('london');e.clock.running=true;s.openCivil(s.civil[0]);assert.equal(e.clock.running,false);
  s.closeCivil();assert.equal(e.clock.running,true);
});
test('해적 그림: 여섯 종 · 카드/전투 일치 · 전투 난수 불변',()=>{
  const {s,e}=E(),rv=s.voyage.rivals.get('storm'),seed=s.pirateSeed(rv),b=s.voyage.openBattle(rv),before=e.rng.state;
  const bs=new H.HangBattleScene(e,layout,b,{artSeed:seed,onDone(){}});
  assert.equal(H.PIRATE_NAMES.length,6);
  b.units.filter(u=>u.side==='foe').forEach((u,i)=>assert.equal(bs.skin(u),(seed+i)%6));
  assert.equal(e.rng.state,before);assert.equal(bs.skin(b.units[0]),null);
});
test('민간 배 확대·이동: 바다 화면에서 두 척 이상 보임 · 이동 경로 화면 안',()=>{
  const {s,e}=E();
  for(const z of [.7,1.5,2,5])for(const dx of [0,30,60,90]){
    s.cam.zoom=z;s.cam.centerOn(600+dx/z,360);s.cam.clampTo(s.grid);s.updateCivil();
    for(const tick of [1,500,1000,2000]){
      e.tick+=tick;s.updateCivil();const mid=s.cam.x+e.width/z/2;
      const visible=s.civil.filter(b=>{const p=s.cam.toScreen(s.grid.nearX(b.x,mid),b.y);return p.x>0&&p.x<e.width&&p.y>0&&p.y<e.height;});
      assert.ok(visible.length>=2,`zoom ${z}, pan ${dx}, tick ${tick}: ${visible.length}`);
    }
  }
});
console.log(`PASS ${count} design tests`);

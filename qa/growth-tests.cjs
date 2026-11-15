// v1.00 전체 게임 모듈. core-tests는 성장 확장 없는 기본 항해·해전 회귀 검사다.
const fs=require('fs'), path=require('path'), assert=require('assert');
const root=path.join(__dirname,'..');
const files=fs.readFileSync(path.join(__dirname,'core-tests.cjs'),'utf8').match(/for \(const f of \[(.*?)\]\)/)[1].split(',').map(s=>s.trim().replace(/'/g,''));
for(const f of files) require(path.join(root,f));
require('../src/hang/hang-growth.js');require('../src/hang/hang-council.js');
const H=globalThis.DH.Hang, w=H.parse(JSON.parse(fs.readFileSync(path.join(root,'src/hang/donghyun_hang_data.json'))));
const V=(settings=[])=>{ const st=H.newState();const rep=H.lang.applySettings(settings,st,{world:w});assert.ok(rep.ok,rep.errors.join());return new H.Voyage(w,{state:st}); };
let n=0; const test=(name,fn)=>{fn();n++;console.log('ok '+name);};
test('기본 남작·10년 상당 100만, 세 엔딩 설정과 예제 15개',()=>{
  const v=V();assert.equal(v.address(),'각하');assert.deepEqual(v.stage,{gold:1000000,days:3650,ending:2});
  for(const e of H.examples(w)){const st=H.newState();const r=H.applyDonghyunLang(e.code,st,{world:w});assert.ok(r.ok,e.name+r.errors.join());const q=new H.Voyage(w,{state:st});assert.ok(q.stage.gold>0||q.stage.ending===3);assert.ok(q.gold>=200000);assert.equal(q.over,null);assert.deepEqual(q.ships.map(s=>s.type),['turtle','panok','caravel']);assert.ok(q.crew>=q.minCrew&&q.crew<=q.maxCrew);}
  assert.equal(H.examples(w).length,15);
});
test('선박 규격·기존 번호·시작 배정·거북선 실제 피해',()=>{
  assert.deepEqual([...w.shipTypes.keys()],['caravel','carrack','turtle','panok','aegis']);
  const vals=id=>{const t=w.shipTypes.get(id);return[t.speed,t.cargo,t.maxCrew,t.hull,t.guns,t.price];};
  assert.deepEqual(vals('panok'),[3,240,40,200,40,8000]);
  assert.deepEqual(vals('turtle'),[4,360,80,240,80,10000]);
  assert.deepEqual(vals('aegis'),[4,360,80,360,120,15000]);
  const v=V(), b=v.openBattle(v.rivals.get('redsail')),u=b.units.filter(u=>u.side==='me');
  assert.deepEqual(u.map(u=>u.crew),[60,30,30]);assert.deepEqual(b.shot(u[0]),{hull:180,crew:30});
  assert.equal(v.cargoCap,800);assert.equal(v.speed,2);assert.equal(v.maxCrew,160);
});
test('투자 현금 차감·50% 협력항·한계효용·한도·난수 불변',()=>{
  const v=V([[3,99999]]),seed=v.rng.state;
  assert.equal(v.invest(5000).ok,true);assert.equal(v.gold,94999);assert.equal(v.share(),50);assert.ok(v.cooperative());
  assert.ok(v.invest(10000).ok);assert.ok(v.invest(5000).ok);assert.equal(v.share(),80);
  assert.ok(v.invest(10000).ok);assert.ok(v.invest(10000).ok);assert.ok(v.invest(10000).ok);assert.equal(v.invest(1000).ok,false);
  assert.equal(v.rng.state,seed); assert.equal(V([[3,1000]]).invest(5000).ok,false);assert.equal(v.invest(-1000).ok,false);
});
test('매수·매각 수수료와 식량 할인·재고 목표·절감액',()=>{
  const v=V([[3,20000]]);v.invest(5000);assert.equal(v.marketFee(),5);
  const e=v.entry('wine'),q=v.quote('wine');assert.equal(q.buy.price,Math.ceil(e.price*1.05));const g=v.gold;
  v.buy('wine');assert.equal(g-v.gold,q.buy.cost);assert.ok(v.growth.savings>0);
  const b=v.quote('wine');assert.equal(b.sell.unit,Math.floor(b.sell.price*.95));v.sell('wine');
  v.food=0;const c=v.can('food');assert.equal(c.cost,Math.ceil(c.qty*.75/v.rules.supply.perGold));
  const old=e.stock;v.driftMarkets();assert.equal(e.stock,old+5);assert.equal(v.stockTarget('lisbon',e),Math.floor(e.refStock*1.5));
});
test('88개 산지·모든 지분에서 즉시 매수매각 무차익',()=>{
  for(const p of w.ports.values())for(const row of p.market.filter(e=>e.stock>0))for(const I of [0,5000,20000,50000]){
    const v=V([[3,999999],[25,3]]);v.growth.legacyAccess=true;v.enter(p.id);v.growth.legacyAccess=false;v.growth.investments=[[p.id,I]];v.cargo.clear();
    const g=v.gold;assert.ok(v.buy(row.good).ok);assert.ok(v.sell(row.good).ok);assert.ok(v.gold<=g,p.id+row.good+I);
  }
});
test('조언의 순매각액·비율은 현재 시세 계산과 일치·닫힌 항구 제외',()=>{
  const v=V(), a=v.advice();assert.ok(a.good);assert.equal(a.buy,v.buyUnit(v.entry(a.good)));assert.equal(a.unit,v.sellUnit(v.markets.get(a.to).get(a.good),a.to));
  assert.equal(a.pct,Math.floor((a.unit/a.buy-1)*100));assert.ok(v.canPort(a.to).ok);
});
test('탐험 반복 금지·실현 교역 명성·수련으로 명성 증가 없음',()=>{
  const v=V();v.enter('seville');v.enter('seville');assert.equal(v.fame().explore,20);v.leave();v.enter('lisbon');assert.equal(v.fame().explore,20);
  v.recordProfit(199);assert.equal(v.fame().trade,1);v.recordProfit(-300);assert.equal(v.fame().trade,1);v.train();assert.equal(v.totalFame(),21);
});
test('해전은 실제 교전 승리마다 50·무적 교역/해전 명성 제외',()=>{
  for(const inv of [0,1]){const v=V([[15,inv]]);v.leave();v.openBattle(v.rivals.get('redsail'));v.settleBattle({winner:'me',loot:100,me:{ships:[{ref:'s1',hull:60,crew:28,out:null}]},foe:{ships:[]}});
    assert.equal(v.fame().battle,inv?0:50);v.recordProfit(200);assert.equal(v.fame().trade,inv?0:2);
  }
  const v=V([[15,1],[3,5000]]);assert.ok(v.invest(5000).ok);assert.equal(v.gold,0);assert.equal(v.growth.savings,0);
});
test('왕궁 단계별 승작·호칭·공국 승리·명성만으로 승작 불가',()=>{
  const v=V([[25,3],[3,999999]]);v.growth.profit=280000;assert.equal(v.promote().ok,false);
  v.growth.explored=[...w.ports.keys()].filter(p=>!H.GROWTH.ports[p]).slice(0,30);
  v.growth.investments=v.growth.explored.slice(0,8).map(p=>[p,5000]);
  for(let i=1;i<=5;i++){assert.ok(v.promote().ok);assert.equal(v.getRank().name,H.GROWTH.ranks[i].name);assert.equal(v.address(),i>=3?'전하':'각하');}
  assert.equal(v.overWhy,'duchy');assert.equal(v.promote().ok,false);
});
test('작위 항구·선박·왕실 의뢰·좌표와 직접 정박 우회 방지',()=>{
  const v=V([[3,20000]]);const p=w.ports.get('guatemala');assert.equal(v.sailTo(p.id).ok,false);assert.equal(v.sailTo(p.anchor).ok,false);assert.equal(v.enter(p.id).ok,false);
  assert.equal(v.canShip('carrack').ok,false);v.growth.rank=1;assert.ok(v.canShip('carrack').ok);assert.ok(v.offers().some(o=>o.royal===1));
  v.growth.rank=2;assert.ok(v.canShip('turtle').ok);assert.ok(!v.canShip('aegis').ok);v.growth.rank=4;assert.ok(v.canShip('aegis').ok);assert.ok(v.sailTo(p.id).ok);
});
test('자금 단독·기한 경계·같은 날 자금 우선·공국 판 금/기한 무시',()=>{
  let v=V([[3,1000],[25,1],[20,1200]]);v.day=9999;v.checkStage();assert.equal(v.over,null);v.gold=1200;v.checkStage();assert.equal(v.overWhy,'gold');
  v=V([[3,1000],[20,1200],[21,10]]);v.day=9;v.checkStage();assert.equal(v.over,null);v.day=10;v.checkStage();assert.equal(v.overWhy,'time');
  v=V([[3,1000],[20,1200],[21,10]]);v.day=10;v.gold=1200;v.checkStage();assert.equal(v.overWhy,'gold');
  v=V([[25,3],[20,1000],[21,1]]);v.day=9999;v.gold=99999999;v.checkStage();assert.equal(v.over,null);
});
test('저장 왕복·손상 성장/지분/명성/문장/엔딩 거부',()=>{
  const v=V([[3,20000]]);v.invest(5000);v.nextQuote();const d=v.toJSON(),r=H.Voyage.restore(w,d,{state:v.state});assert.deepEqual(r.toJSON(),d);
  for(const change of [d=>d.growth.rank=6,d=>d.growth.investments[0][1]=-1,d=>d.growth.profit=NaN,d=>d.growth.explored.push('ghost'),d=>d.dialogue.quoteIndex=-1,d=>d.stage.ending=4,d=>d.overWhy='duchy',d=>{d.over='won';d.overWhy='gold';}]){
    const bad=JSON.parse(JSON.stringify(d));change(bad);assert.throws(()=>H.Voyage.restore(w,bad,{state:v.state}));
  }
});
test('옛 저장 자금·가격·짐 보존·전 항구/선박 접근·무목표 공국 이전',()=>{
  const v=V(),d=v.toJSON();delete d.growth;delete d.dialogue;delete d.stage;d.markets[0][1][0][1]=25;
  const r=H.Voyage.restore(w,d);assert.equal(r.gold,d.gold);assert.equal(r.entry('wine').price,25);assert.equal(r.quote('wine').buy.price,25);assert.ok(r.canPort('guatemala').ok);assert.equal(r.stage.ending,3);
  assert.deepEqual(r.toJSON().cargo,d.cargo);assert.ok(H.Voyage.restore(w,r.toJSON()).growth.legacyAccess);
});
test('옛 한 척·설정 6번 28명 저장의 장면 복원과 재저장 복원',()=>{
  const engine=new DH.Engine({width:480,height:360,seed:1,clock:{unit:'day',start:w.meta.start,ticksPerUnit:20}});
  const layout={log(){},setInfo(){},setDetail(){},setMenu(){},press(){return false;},pressPrimary(){return false;}};
  const s=new H.HangSeaScene(engine,w,layout);engine.setScene(s);
  const d=JSON.parse(JSON.stringify(s.saveGame()));
  d.settings=[[6,28]];d.game.ships=[{...d.game.ships[0],type:'caravel',hull:60}];d.game.crew=28;
  delete d.game.growth;delete d.game.dialogue;delete d.game.stage;
  let r=s.loadGame(d);assert.ok(r.ok,r.why);assert.equal(s.voyage.crew,28);assert.equal(s.voyage.ships.length,1);
  assert.equal(s.voyage.stage.ending,3);assert.ok(s.voyage.growth.legacyAccess);
  const saved=JSON.parse(JSON.stringify(s.saveGame()));
  r=s.loadGame(saved);assert.ok(r.ok,r.why);assert.deepEqual(s.voyage.toJSON(),saved.game);
});
test('출항 문장·30일 간격·꺼짐·반복 원문 순서',()=>{
  const v=V([[15,1]]);v.leave();assert.equal(v.dialogue.quoteIndex,1);v.leave();assert.equal(v.dialogue.quoteIndex,1);v.steer('left');
  for(let i=0;i<30;i++)v.stepDay();assert.equal(v.dialogue.quoteIndex,2);v.dialogue.quotes=false;
  for(let i=0;i<30;i++)v.stepDay();assert.equal(v.dialogue.quoteIndex,2);
});
test('인용 100구절·한 바퀴 중복 없음·호칭·저장 순서 복원',()=>{
  assert.equal(H.QUOTES.length,100);
  assert.equal(new Set(Array.from({length:100},(_,i)=>H.quoteAt(i+1).text)).size,100);
  assert.equal(new Set(H.QUOTES.map(q=>q.original)).size,100);
  assert.equal(H.quoteAt(101),H.quoteAt(1));
  assert.equal(new Set(H.QUOTES.map(q=>q.url)).size,4);
  for(const q of H.QUOTES) {
    assert.ok(q.section&&q.work&&q.original.length>10);
    assert.ok(q.url.startsWith('https://www.gutenberg.org/'));
    assert.ok(q.text.endsWith('다.'));
    for(const address of ['전하','각하'])assert.equal(H.quoteLine(address,q),`${address}, 쇼펜하우어는 '${q.text}'라고 합니다.`);
  }
  const v=V();for(let i=0;i<11;i++)v.nextQuote();
  const r=H.Voyage.restore(v.world,JSON.parse(JSON.stringify(v.toJSON())));
  assert.equal(H.quoteAt(r.dialogue.quoteIndex),H.quoteAt(v.dialogue.quoteIndex));
  r.nextQuote();assert.equal(r.dialogue.quoteIndex,12);
  r.dialogue.quoteIndex=99;r.nextQuote();
  const last=H.Voyage.restore(w,JSON.parse(JSON.stringify(r.toJSON())));
  assert.equal(last.dialogue.quoteIndex,100);last.nextQuote();
  assert.equal(H.quoteAt(last.dialogue.quoteIndex),H.quoteAt(1));
});
test('여섯 작위의 존댓말 조언·차익 없음·투자 보고',()=>{
  for(let rank=0;rank<6;rank++){
    const v=V();v.growth.rank=rank;
    const address=rank>=3?'전하':'각하',a=v.advice();
    assert.ok(a.text.startsWith(address+', '));assert.ok(a.text.endsWith('별도입니다.'));
    assert.ok(v.invest(5000).text.includes('투자했습니다.'));
    for(const e of v.markets.get(v.port).values())e.stock=0;
    const no=v.advice().text;assert.ok(no.startsWith(address+', '));assert.ok(no.endsWith('권합니다.'));
    for(const text of [a.text,no])assert.ok(!/높다\.|별도다\.|없다\.|살펴보자\./.test(text));
  }
});
console.log(`성장 시험 ${n}개 통과`);

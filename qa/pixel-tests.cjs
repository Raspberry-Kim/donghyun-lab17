// 배 픽셀 렌더러: 곡선 없이 정수 경계 · 방향 반전 · 회전 효과 · 그림 다양성.
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');
const files=fs.readFileSync(path.join(__dirname,'core-tests.cjs'),'utf8').match(/for \(const f of \[(.*?)\]\)/)[1].split(',').map(s=>s.trim().replace(/'/g,''));
for(const f of files)require(path.join(root,f));
const H=globalThis.DH.Hang;
const recorder=(m={a:1,b:0,c:0,d:1,e:0,f:0})=>({
  rects:[],fillStyle:null,getTransform(){return m;},save(){},restore(){},setTransform(){},
  fillRect(x,y,w,h){assert.ok([x,y,w,h].every(Number.isFinite));if(w&&h)this.rects.push([x,y,w,h,this.fillStyle]);}
});
const shapes=[
  ...['caravel','carrack','panok','turtle','aegis'].map(type=>(g,k,face)=>H.drawShip(g,100,100,k,H.LOOK.me,true,face,type)),
  ...Array.from({length:6},(_,skin)=>(g,k,face)=>H.drawShip(g,100,100,k,H.LOOK.foe,true,face,'caravel',skin)),
  ...['fishing','junk','dhow','canoe','merchant','explorer'].map(type=>(g,k,face)=>H.drawCivilShip(g,100,100,k,type,face)),
  ...['fishing','junk','dhow','canoe','merchant','explorer'].map(type=>(g,k,face)=>H.drawCivilMapShip(g,100,100,Math.max(1,Math.round(k)),type,face,0,0)) // 지도에서는 정수 배율로 쓴다
];
let n=0;
for(const k of [.5,1,2.6,4.5])for(const paint of shapes){
  const a=recorder();paint(a,k,1);
  assert.ok(a.rects.reduce((s,r)=>s+r[2]*r[3],0)>=12,'작은 배도 보이는 면적을 갖는다');
  assert.ok(new Set(a.rects.map(r=>r[4])).size>=3,'외곽선·돛·선체 색이 남는다');
  assert.ok(a.rects.every(r=>r.slice(0,4).every(Number.isInteger)),'화면 칸 경계가 정수');
  n++;
}
console.log(`ok ${n} 그림/배율 조합: 곡선 호출 없음 · 빈 그림 없음 · 정수 픽셀 경계`);
for(const paint of shapes){
  const a=recorder(),b=recorder();paint(a,2.5,1);paint(b,2.5,-1);
  const pixels=g=>{const p=[];for(const [x,y,w,h,c] of g.rects)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)p.push([i,j,c].join(':'));return p.sort();};
  const mirrored={rects:a.rects.map(([x,y,w,h,c])=>[200-x-w,y,w,h,c])};
  assert.deepStrictEqual(pixels(b),pixels(mirrored));
}
console.log(`ok ${shapes.length}개 렌더링 구성 좌우 반전: 같은 선체·돛·문양`);
const unique=new Set(shapes.map(paint=>{const g=recorder();paint(g,3,1);return JSON.stringify(g.rects);}));
assert.equal(unique.size,22);console.log('ok 기존 18종과 선박 4형(캐러벨·캐럭은 같은 범선 그림) 구분');
for(const paint of shapes){const g=recorder({a:.8,b:.2,c:-.2,d:.8,e:3,f:5});paint(g,2,-1);assert.ok(g.rects.length>30);}
console.log('ok 회전/침몰 효과의 기존 변환 유지 · 유효한 사각형');
// 지도용 지나는 배: 한 칸 = 화면 1픽셀, 바깥선이 있고, 항해 중에는 물결 자국이 움직인다.
{
  const types=['fishing','junk','dhow','canoe','merchant','explorer'];
  const sizes=types.map(t=>H.CIVIL_MAP[t]);
  for(const sp of sizes){assert.ok(sp.w>=12&&sp.w<17,'우리 배(17칸)보다 작은 엑스트라 배');assert.ok(sp.runs.some(r=>r[3]==='o'));}
  assert.strictEqual(new Set(types.map(t=>JSON.stringify(H.CIVIL_MAP[t].runs))).size,6,'여섯 종류의 모양이 다르다');
  const z=2.2,m={a:z,b:0,c:0,d:z,e:3.3,f:7.1};
  for(const t of types){
    const a=recorder(m);H.drawCivilMapShip(a,50.37,40.81,1/z,t,1,0,0);
    assert.ok(a.rects.every(r=>r.slice(0,4).every(Number.isInteger)));
    assert.ok(a.rects.some(r=>r[2]===1&&r[3]===1),'한 칸이 1×1 화면 픽셀');
    assert.ok(a.rects.every(r=>r[3]===1),'줄 높이도 1픽셀');
    const frames=new Set([0,14,28,44].map(tk=>{const b=recorder(m);H.drawCivilMapShip(b,50.37,40.81,1/z,t,1,tk,3);return JSON.stringify(b.rects);}));
    assert.ok(frames.size>=3,'물결 자국·흔들림이 시간에 따라 바뀐다');
  }
  console.log('ok 지나는 배 6종: 1칸=1픽셀 · 바깥선 · 움직이는 물결 자국');
}
{
  const draw=(type,anim)=>{const g=recorder();H.drawShip(g,100,100,3,H.LOOK.me,true,1,type,null,anim);return g.rects;};
  assert.notDeepEqual(draw('aegis',{tick:0}),draw('aegis',{tick:22}));
  assert.notDeepEqual(draw('turtle',{fire:-1}),draw('turtle',{fire:15}));
  for(const type of ['turtle','aegis']) {
    assert.notDeepEqual(draw(type,{tick:0,fire:-1}),draw(type,{tick:0,fire:60}));
    assert.deepEqual(draw(type,{tick:0,fire:-1}),draw(type,{tick:0,fire:90}));
  }
  for(const type of ['turtle','aegis'])for(const tick of [0,8,16,24,35,60,89]){
    const a=draw(type,{tick,fire:tick});assert.ok(a.every(r=>r.slice(0,4).every(Number.isInteger)));
  }
  console.log('ok 회전 레이더·용머리/포신 확대·불꽃·90틱 뒤 원상 복구 · 정수 픽셀');
}
{
  for(const k of [1,3])for(const side of ['me','foe']){
    const g=recorder();H.drawShip(g,100,100,k,H.LOOK[side],true,1,'aegis',null,{tick:0});
    const colors=new Set(g.rects.map(r=>r[4]));
    for(const color of ['#674c34','#e0b97a','#bf8b4f','#926039','#78523a'])assert.ok(colors.has(color),'지도·해전의 꿀빛 목재 명암·외곽선·포문');
    for(const gray of ['#b9c7c9','#49636b','#6c868e'])assert.ok(!colors.has(gray),'회색 선체 팔레트 제거');
    assert.ok(colors.has('#f6e7c8'),'크림색 원판 레이더');
    for(const c of ['#d56b52','#ad4c3e'])assert.ok(colors.has(c),'크고 작은 대포 모두 붉은 명암');
    for(const c of ['#ead3a5','#729ca4'])assert.ok(colors.has(c),'중앙 함교의 밝은 목재와 넓은 창');
    const b=recorder();H.drawShip(b,100,100,k,H.LOOK[side],true,1,'aegis',null,{tick:22});
    assert.notDeepEqual(g.rects,b.rects,'지도·해전 모두 레이더 회전');
  }
  console.log('ok 목재 이지스함: 두 크기·양 진영의 나무 명암·포문·레이더 보존');
}
{
  for(const k of [1,3])for(const face of [-1,1])for(const fire of [-1,0,40,89,90]){
    const g=recorder();H.drawShip(g,100,100,k,H.LOOK.me,true,face,'aegis',null,{tick:0,fire});
    const red=g.rects.filter(r=>['#d56b52','#ad4c3e','#efad78'].includes(r[4]));
    const top=Math.min(...red.map(r=>r[1])),bottom=Math.max(...red.map(r=>r[1]));
    const center=y=>{const a=red.filter(r=>r[1]===y);return a.reduce((s,r)=>s+r[0]+r[2]/2,0)/a.length;};
    assert.ok((center(top)-center(bottom))*face>0,'포구의 전방 45도 기울기는 항해·전투의 진행 방향과 일치');
  }
  console.log('ok 큰/작은 붉은 대포의 진행 방향 일치 · 배 전체 좌우 반전 보존');
}
{
  for(const k of [1,3]) {
    const a=recorder();H.drawShip(a,100,100,k,H.LOOK.me,true,1,'aegis',null,{fire:-1});
    const bands=['#efad78','#d56b52','#ad4c3e'].map(c=>a.rects.filter(r=>r[4]===c));
    assert.ok(bands.every(b=>b.length>0),'포구·붉은 포신·어두운 옆면');
    const mean=b=>b.reduce((s,r)=>s+r[1],0)/b.length;
    assert.ok(mean(bands[0])<mean(bands[2]),'포구보다 낮은 위치의 차분한 명암');
    for(const type of ['aegis','turtle']) {
      const left=recorder(),right=recorder();
      H.drawShip(left,100,100,k,H.LOOK.me,true,-1,type,null,{tick:0,fire:40});
      H.drawShip(right,100,100,k,H.LOOK.me,true,1,type,null,{tick:0,fire:40});
      assert.deepEqual(left.rects,right.rects.map(([x,y,w,h,c])=>[200-x-w,y,w,h,c]),'발사 중 양 방향 대칭');
    }
  }
  console.log('ok 통통한 이지스함 포신 명암 · 두 선박의 큰/작은 발사 그림 좌우 반전');
}
{
  const mouth=fire=>{
    const g=recorder();H.drawShip(g,100,100,3,H.LOOK.me,true,1,'turtle',null,{tick:0,fire});
    return g.rects.filter(r=>r[4]==='#482520');
  };
  assert.equal(mouth(0).length,0);
  const height=fire=>Math.max(...mouth(fire).map(r=>r[3]));
  assert.ok(height(45)>height(8),'머리 확대와 함께 입 안의 높이가 증가');
  assert.ok(height(45)>height(82),'끝으로 갈수록 턱이 다시 닫힘');
  assert.equal(mouth(90).length,0);
  console.log('ok 거북선: 열린 입·위아래 턱·확대 연동·닫힘 복귀');
}
{
  const draw=(type,fire,k=3,face=1)=>{const g=recorder();H.drawShip(g,100,100,k,H.LOOK.me,true,face,type,null,{tick:0,fire});return g.rects;};
  const flame=rs=>rs.filter(r=>['#cf4a22','#f8bd43'].includes(r[4]));
  const area=rs=>rs.reduce((s,r)=>s+r[2]*r[3],0);
  for(const k of [1,3]){
    assert.deepEqual(draw('panok',-1,k),draw('panok',45,k),'45틱 뒤 원래 판옥선');
    assert.notDeepEqual(draw('panok',-1,k),draw('panok',22.5,k),'포격 때 포구·불꽃 표시');
    assert.ok(area(flame(draw('panok',22.5,k)))<area(flame(draw('turtle',45,k))),'같은 발사 단계에서 거북선보다 작은 불꽃');
    for(const fire of [0,4,12,22.5,39,44,45]){
      const a=draw('panok',fire,k),b=draw('panok',fire,k,-1);
      assert.ok(a.every(r=>r.slice(0,4).every(Number.isInteger)));
      assert.deepEqual(b,a.map(([x,y,w,h,c])=>[200-x-w,y,w,h,c]),'발사 양 방향 대칭');
    }
  }
  console.log('ok 판옥선: 45틱 복귀·더 작은 화염·큰/작은 그림·양 방향·정수 픽셀');
}
console.log('PASS 11 pixel test groups');

// 회색 이지스함: 배치·함번·깃대와 태극기·움직이는 곳·발사 회귀·선체 색.
const assert=require('node:assert/strict');
require('../src/hang/hang-aegis.js');
const {drawAegis:draw,AEGIS:{SPEC,PALETTE:P,FONT}}=globalThis.DH.Hang;
const record=(k,{fire=-1,face=1,flag=true,tick=0}={})=>{
  const g={rects:[],getTransform:()=>({a:1,d:1,e:0,f:0}),save(){},restore(){},setTransform(){},
    fillRect(x,y,w,h){if(w&&h)this.rects.push([x,y,w,h,this.fillStyle]);}};
  draw(g,100,100,k,flag,face,{tick,fire});
  return g.rects;
};
const raster=rs=>{const pixels=new Map();for(const [x,y,w,h,c] of rs)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)pixels.set(i+':'+j,c);return pixels;};
const spec=k=>k<1.6?SPEC.small:SPEC.big;
// 칸 좌표 → 화면 좌표(오른쪽을 볼 때)
const grid=k=>{const s=spec(k),c=k*s.cell,w=s.rows[0].length;return {s,X:j=>Math.round(100-w*c/2+j*c),Y:j=>Math.round(100+5*k-(s.base+1)*c+j*c)};};
const HULL=[P.m,P.d,P.l];

// 1. 배치: 그림 자료의 줄 폭, 선체 중심, 물에 닿는 줄.
assert.deepEqual([SPEC.big.rows[0].length,SPEC.big.rows.length,SPEC.small.rows[0].length,SPEC.small.rows.length],[32,22,19,12]);
for(const s of [SPEC.big,SPEC.small])assert.equal(new Set(s.rows.map(r=>r.length)).size,1,'모든 줄의 폭이 같다');
for(const k of [1,2.1,10]){
  const hull=record(k).filter(r=>HULL.includes(r[4]));
  const left=Math.min(...hull.map(r=>r[0])),right=Math.max(...hull.map(r=>r[0]+r[2]));
  assert(Math.abs((left+right)/2-100)<=Math.max(1,k*.7),'선체 중심이 배의 기준점과 일치');
  const water=record(k).filter(r=>r[4]===P.w);
  assert.equal(Math.max(...water.map(r=>r[1]+r[3])),Math.round(100+5*k),'물보라 아래 끝이 다른 배와 같은 기준선');
}
console.log('PASS 배치: 32×22·19×12칸, 선체 중심, 물 기준선');

// 2. 함번 997: 큰 그림에만 있고, 어느 쪽을 보든 왼쪽에서 오른쪽으로 읽힌다.
const want=[0,1,2,3,4].map(j=>[...SPEC.big.digits.text].map(ch=>FONT[ch][j]).join('.'));
assert.equal(SPEC.big.digits.text,'997');
for(const k of [2.1,3,10])for(const face of [1,-1]){
  const no=raster(record(k,{face}).filter(r=>r[4]===P.N)),{s,X,Y}=grid(k),d=s.digits;
  const read=[0,1,2,3,4].map(j=>Array.from({length:11},(_,i)=>{
    const x=face<0?200-X(d.c+11-i):X(d.c+i);      // 화면의 왼쪽 칸부터 읽는다. 반전하면 함번 자리만 뒤집히고 글자 순서는 그대로다
    return no.has(x+':'+Y(d.r+j))?'#':'.';
  }).join(''));
  assert.deepEqual(read,want,`함번 읽기: k=${k}, face=${face}`);
  // 함번은 선체 안에 있다: 함번 칸 바로 바깥은 선체색이다.
  const all=raster(record(k,{face})),x0=(face<0?200-X(d.c+11):X(d.c))-1;
  assert(HULL.includes(all.get(x0+':'+Y(d.r+2))),'함번 옆은 선체');
}
for(const k of [.5,1,1.2])assert(!record(k).some(r=>r[4]===P.N),'작은 그림에는 함번이 없다');
console.log('PASS 함번 997: 양 방향에서 바로 읽힘, 작은 그림에는 없음');

// 3. 깃대와 태극기: 깃대는 늘 받침(큰 그림은 뒤 구조물 지붕, 작은 그림은 갑판)까지 이어지고, 태극기는 기함일 때만 건다.
assert.deepEqual([SPEC.big,SPEC.small].map(s=>{const pole=s.rows[0].indexOf('o');return s.rows.findIndex(r=>r[pole-1]==='o'&&r[pole]==='o'&&r[pole+1]==='o');}),[10,7]);
for(const k of [1,2.1,10])for(const fire of [-1,22,45,89]){
  const {s,X,Y}=grid(k),pole=s.rows[0].indexOf('o'),foot=s.rows.findIndex(r=>r[pole-1]==='o'&&r[pole]==='o'&&r[pole+1]==='o');
  for(const flag of [true,false]){
    const pixels=raster(record(k,{fire,flag}));
    for(let y=Y(0);y<Y(foot+1);y++)assert.equal(pixels.get(X(pole)+':'+y),P.o,'깃대가 꼭대기부터 받침까지 이어진다');
    const has=c=>[...pixels.values()].includes(c);
    assert.equal(has(P.r)&&has(P.b),flag,'태극기는 기함일 때만');
  }
}
console.log('PASS 깃대 연결 · 기함 태극기');

// 4. 움직이는 곳: 레이더 막대의 길이와 헬기 회전날개.
{
  const rotor=(k,tick)=>{const {s,Y}=grid(k),rs=record(k,{tick}).filter(r=>r[4]===P.o&&r[1]===Y(s.rotor.row)&&r[3]===Y(s.rotor.row+1)-Y(s.rotor.row));return Math.max(...rs.map(r=>r[2]));};
  for(const k of [1,2.1,10])assert(rotor(k,0)>rotor(k,3),'회전날개가 긴 모양과 짧은 모양을 오간다');
  const frames=new Set([0,8,16,24].map(tick=>JSON.stringify(record(2.1,{tick}))));
  assert(frames.size>=3,'레이더 막대와 회전날개가 시간에 따라 바뀐다');
}
console.log('PASS 레이더 막대 · 회전날개');

// 5. 발사: 90틱 복귀, 정수 픽셀, 좌우 대칭(함번 제외), 화염은 뱃머리 앞쪽 위.
for(const k of [.5,1,1.2,2.1,7.5]){
  assert.deepEqual(record(k),record(k,{fire:90}),'90틱 뒤 원상 복구');
  for(const fire of [-1,22,45,89]){
    const body=rs=>rs.filter(r=>r[4]!==P.N),a=record(k,{fire}),b=record(k,{fire,face:-1});
    assert.deepEqual(body(b),body(a).map(([x,y,w,h,c])=>[200-x-w,y,w,h,c]));
    assert(a.every(r=>r.slice(0,4).every(Number.isInteger)));
  }
  const flame=record(k,{fire:45}).filter(r=>r[4]==='#df7040'),{s,X,Y}=grid(k);
  assert(flame.length>0&&!record(k).some(r=>r[4]==='#df7040'),'화염은 포격 중에만');
  assert(flame.every(r=>r[0]>=X(s.cannon.x)&&r[1]+r[3]<=Y(s.cannon.y)+1),'화염은 포신 뿌리의 앞쪽 위로만 뻗는다');
}
console.log('PASS 발사: 90틱 복귀 · 정수 픽셀 · 양방향 · 화염 방향');

// 6. 선체 색: 푸른 기가 없는 짙은 회색이고, 해전·지도의 바다색과 밝기가 갈린다.
{
  const fs=require('node:fs'),path=require('node:path');
  const src=f=>fs.readFileSync(path.join(__dirname,'../src/hang',f),'utf8');
  const SEA=['#9fc4d9','#a6c9dc','#b5d6e2','#93bcd4'];           // 해전 WATER·WATER2, 지도 shallow·sea(=WATER)·deep
  for(const c of SEA.slice(0,2))assert(src('hang-battle-scene.js').includes(c),'해전 바다색 '+c);
  for(const c of ['#b5d6e2','#9fc4d9','#93bcd4'])assert(src('hang-scene.js').includes(c),'지도 바다색 '+c);
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const lum=h=>{const [r,g,b]=rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
  const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
  for(const key of ['d','m','M','l','g','G']){const c=rgb(P[key]);assert(Math.max(...c)-Math.min(...c)<=8,key+' 무채색에 가까운 회색');}
  assert(lum(P.d)<lum(P.m)&&lum(P.m)<lum(P.M)&&lum(P.M)<lum(P.l),'회색 네 단계의 밝기 순서');
  for(const sea of SEA){
    assert(ratio(P.m,sea)>=1.9,'선체 면과 바다 '+sea+' 대비 1.9 이상');
    assert(ratio(P.o,sea)>=7.9,'남색 테두리와 바다 '+sea+' 대비 7.9 이상');
  }
  assert(ratio(P.N,P.m)>=3.5,'함번과 선체 면 대비 3.5 이상');
}
console.log('PASS 선체 색: 무채색 회색 · 바다색 대비 · 함번 대비');
console.log('PASS 6 aegis groups');

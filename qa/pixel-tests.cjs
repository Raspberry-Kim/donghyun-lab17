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
console.log('ok 18종 좌우 반전: 같은 선체·돛·문양');
const unique=new Set(shapes.map(paint=>{const g=recorder();paint(g,3,1);return JSON.stringify(g.rects);}));
assert.equal(unique.size,18);console.log('ok 해적 6종 · 민간 6종 · 지도용 지나는 배 6종 서로 다른 픽셀 그림');
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
console.log('PASS 5 pixel test groups');

// 승인된 통통한 목재함: 배치·고정점·작은 그림·발사 중 간격 회귀.
const assert=require('node:assert/strict');
require('../src/hang/hang-aegis.js');
const draw=globalThis.DH.Hang.drawAegis;
const record=(k,fire=-1,face=1,flag=true)=>{
  const g={rects:[],getTransform:()=>({a:1,d:1,e:0,f:0}),save(){},restore(){},setTransform(){},
    fillRect(x,y,w,h){if(w&&h)this.rects.push([x,y,w,h,this.fillStyle]);}};
  draw(g,100,100,k,flag,face,{tick:0,fire});
  return g.rects;
};
const bounds=rs=>[Math.min(...rs.map(r=>r[0])),Math.max(...rs.map(r=>r[0]+r[2]))];
const center=rs=>bounds(rs).reduce((a,b)=>a+b)/2;
const raster=rs=>{const pixels=new Map();for(const [x,y,w,h,c] of rs)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)pixels.set(i+':'+j,c);return pixels;};
for(const k of [1,2.1,10]){
  const rs=record(k),hull=rs.filter(r=>['#e0b97a','#bf8b4f','#926039'].includes(r[4]));
  const windows=rs.filter(r=>['#729ca4','#b6d0ce'].includes(r[4]));
  assert(Math.abs(center(hull)-center(windows))<=.5,'함교 창 중심과 선체 중심 일치');
}
console.log('PASS 중앙 함교: 지도·해전·확대 그림');
for(const k of [1,10]){
  const tiny=k<1.6,c=tiny?k:k*.7,w=tiny?17:27,base=tiny?16:24;
  const X=j=>Math.round(100-w*c/2+j*c),Y=j=>Math.round(100+5*k-(base+1)*c+j*c);
  for(const fire of [-1,0,8,22,45,65,89,90]){
    const pixels=raster(record(k,fire));
    for(let x=X(tiny?12:19);x<X(tiny?13:20);x++)
      for(let y=Y(tiny?3:7);y<Y(tiny?9:15);y++)
        assert(!pixels.has(x+':'+y),`발사 중 함교·함포 간격: k=${k}, fire=${fire}, pixel=${x}:${y}, color=${pixels.get(x+':'+y)}`);
    const staffX=X(tiny?2:3),staffTop=Y(tiny?3:7),staffBottom=Y(tiny?11:16);
    for(let y=staffTop;y<staffBottom;y++)assert(pixels.has(staffX+':'+y),'깃대와 갑판 고정점의 연속성');
  }
}
console.log('PASS 함교·함포 간격: 대기·발사 8단계, 지도·확대 그림');
console.log('PASS 깃대: 깃발부터 갑판 고정점까지 연결');
for(const k of [.5,1,1.2,2.1,7.5]){
  assert.deepEqual(record(k,-1),record(k,90),'90틱 뒤 원상 복구');
  for(const fire of [-1,22,45,89]){
    const a=record(k,fire),b=record(k,fire,-1);
    assert.deepEqual(b,a.map(([x,y,w,h,c])=>[200-x-w,y,w,h,c]));
    assert(a.every(r=>r.slice(0,4).every(Number.isInteger)));
  }
  assert(record(k).some(r=>r[4]==='#efba45'));
  assert(!record(k,-1,1,false).some(r=>r[4]==='#efba45'));
}
console.log('PASS 기함 깃발·양방향·정수 픽셀·90틱 복귀');
console.log('PASS 4 aegis geometry groups');

// v1.28: README의 출처 링크가 index.html에 끝까지 들어갔는지 본다. node build.cjs 뒤에 node qa/link-tests.cjs
const fs=require('fs'), path=require('path'), assert=require('assert');
const root=path.join(__dirname,'..');
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8'), html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const esc=s=>s.replace(/&/g,'&amp;');
let n=0; const test=(name,fn)=>{fn();n++;console.log('ok '+name);};
const urls=[...readme.matchAll(/\]\((https?:(?:[^()\s]|\([^()\s]*\))+)\)/g)].map(m=>m[1]);
const paren=[...new Set(urls.filter(u=>u.includes('(')))];
test('괄호가 든 주소 '+paren.length+'개가 잘리지 않음',()=>{
  assert.ok(paren.length>=3,'괄호가 든 주소를 찾지 못함');
  for(const u of paren){
    assert.ok(html.includes('href="'+esc(u)+'"'),'빠진 주소: '+u);
    assert.ok(!html.includes('href="'+esc(u.slice(0,u.lastIndexOf(')')))+'"'),'잘린 주소: '+u);
  }
});
test('페이지의 모든 바깥 주소에서 괄호 짝이 맞음',()=>{
  const hrefs=[...html.matchAll(/href="(https?:[^"]+)"/g)].map(m=>m[1]);
  assert.ok(hrefs.length>100);
  for(const h of hrefs) assert.equal((h.match(/\(/g)||[]).length,(h.match(/\)/g)||[]).length,'괄호 짝이 다름: '+h);
});
test('링크 바로 뒤에 남은 닫는 괄호 없음',()=>{
  for(const u of paren){ const i=html.indexOf('href="'+esc(u)+'"'); const end=html.indexOf('</a>',i); assert.notEqual(html[end+4],')','남은 괄호: '+u); }
});
console.log(n+'그룹 통과');

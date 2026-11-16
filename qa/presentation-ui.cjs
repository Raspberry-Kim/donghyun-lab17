// v1.22: all port portraits and real panokseon firing input. v1.27: one collaborator face per port.
const {chromium}=require('/home/user/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const out=process.env.QA_SHOTS||'/tmp/hang122-shots';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chromium'});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  const E=(f,a)=>page.evaluate(f,a),click=id=>page.locator(`[data-id="${id}"]`).click();
  const start=async()=>{await page.selectOption('#example','none');await page.locator('#run').click();await E(()=>__dh.engine.stop());};
  const shot=async name=>{await E(()=>__dh.engine.step(0));await page.locator('#stage-full').screenshot({path:out+'/'+name+'.png'});};
  try{
    await page.goto(process.env.QA_URL||'http://127.0.0.1:3170');
    await page.waitForFunction(()=>window.__dh&&!document.querySelector('#run').disabled);
    await start();
    const ports=await E(()=>[...__dh.world.ports.keys()]);
    assert.equal(ports.length,45);
    // v1.27: 화면에 실제로 그려진 칸 번호. 48칸 아틀라스에서 배경 위치로 되읽는다.
    const cell=()=>page.locator('.hang-portrait').evaluateAll(es=>es.map(e=>{
      const s=getComputedStyle(e),[x,y]=s.backgroundPosition.split(' ').map(parseFloat);
      return {index:Math.round(x*7/100)+8*Math.round(y/20),size:s.backgroundSize,w:e.offsetWidth,h:e.offsetHeight,image:s.backgroundImage.length};
    }));
    const faces={};
    for(const dark of [false,true]){
      if(dark)await page.locator('#theme').click();
      for(const id of ports){
        await E(id=>{__dh.voyage.growth.rank=5;__dh.voyage.enter(id);__dh.scene.refresh();},id);
        const pictures=await page.locator('.hang-portrait').evaluateAll(es=>es.map(e=>{
          const c=getComputedStyle(e),layers=[];
          for(let a=e;a;a=a.parentElement){
            const s=getComputedStyle(a);
            layers.push([s.filter,s.backdropFilter,s.mixBlendMode,s.opacity]);
            for(const pseudo of ['::before','::after']){
              const p=getComputedStyle(a,pseudo);
              if(!['none','normal','""'].includes(p.content))layers.push([p.filter,p.backdropFilter,p.mixBlendMode,p.opacity]);
            }
          }
          return {filter:c.filter,opacity:c.opacity,transform:c.transform,layers};
        }));
        assert.equal(pictures.length,2,id);
        for(const p of pictures)for(const values of p.layers)assert.deepEqual(values,['none','none','normal','1'],id);
        assert.equal(pictures[0].transform,'none');
        assert.equal(pictures[1].transform,'matrix(-1, 0, 0, 1, 0, 0)');
        const drawn=await cell(),visit=await E(id=>__dh.voyage.visits.get(id),id);
        assert.equal(drawn[0].index,0,id);
        for(const d of drawn){assert.equal(d.size,'800% 600%');assert.deepEqual([d.w,d.h],[72,96]);assert(d.image>400000);}
        (faces[id]=faces[id]||[]).push([visit,drawn[1].index]);
      }
    }
    // 첫 순회의 얼굴 45개가 모두 다르고, 다시 들른 제물포·나가사키만 둘째 협력자로 바뀐다.
    const firsts=ports.map(id=>faces[id][0][1]);
    assert.equal(new Set(firsts).size,45);assert(firsts.every(i=>i>=1&&i<=46&&i!==35));
    assert.deepEqual(['lisbon','seville','amsterdam','valencia','marseille','pisa','copenhagen','genoa','venice','london','naples'].map(id=>faces[id][0][1]),[1,2,3,4,5,6,7,8,9,10,11]);
    for(const id of ports){
      const [[v1,a],[v2,b]]=faces[id];assert.equal(v2,v1+1,id);
      if(id==='jemulpo')assert.deepEqual([a,b].sort(),[12,35]);
      else if(id==='nagasaki')assert.deepEqual([a,b].sort(),[15,47]);
      else assert.equal(a,b,id);
    }
    for(const [id,pair] of [['jemulpo',[12,35]],['nagasaki',[15,47]]]){
      const seen=[];
      for(let i=0;i<4;i++){
        await E(id=>{const v=__dh.voyage;v.enter(id==='jemulpo'?'dongnae':'hakata');v.enter(id);__dh.scene.refresh();},id);
        const n=await E(id=>__dh.voyage.visits.get(id),id),d=await cell();seen.push(d[1].index);
        assert.equal(d[1].index,pair[(n+1)%2],id+n);
      }
      assert.equal(new Set(seen).size,2);assert.notEqual(seen[0],seen[1]);assert.equal(seen[0],seen[2]);assert.equal(seen[1],seen[3]);
      await page.locator('.hang-faces').screenshot({path:out+'/face-'+id+'-'+seen[3]+'.png'});
    }
    await page.locator('#theme').click();
    for(const id of ['lisbon','genoa','hormuz','jemulpo','nagasaki','butuan','guatemala','alexandria','elmina','malacca']){
      await E(id=>{__dh.voyage.enter(id);__dh.scene.refresh();},id);
      await page.locator('.hang-faces').screenshot({path:out+'/face-'+id+'.png'});
    }
    await page.setViewportSize({width:375,height:844});await shot('portrait-phone');
    await page.setViewportSize({width:1280,height:900});
    console.log('PASS 45 ports in both themes: no filters, overlays, alpha or blending; original facing preserved; 45 different faces; Jemulpo and Nagasaki alternate by visit');
    await start();
    await E(()=>{const s=__dh.scene;s.voyage.leave();s.meet=s.voyage.rivals.get('redsail');s.refresh();});
    await click('fight');
    for(const dir of [1,-1]){
      const prepared=await E(dir=>{
        const s=__dh.engine.scene,b=s.b,u=b.units.find(u=>u.side==='me'&&u.type==='panok'),f=b.units.find(u=>u.side==='foe');
        u.c=dir>0?2:4;u.r=3;f.c=dir>0?4:2;f.r=3;f.hull=1200;f.crew=80;u.done=false;u.moved=false;
        s.fx=[];s.select(null);s.disp.clear();s.refresh();
        return {damage:Math.floor(u.guns*3*u.crew/u.maxCrew),points:[u,f].map(a=>{const q=s.grid.center(a.c,a.r);return s.cam.toScreen(q.x,q.y);})};
      },dir);
      await page.locator('.dh-canvas').scrollIntoViewIfNeeded();
      const B=await page.locator('.dh-canvas').boundingBox();
      for(const p of prepared.points)await page.mouse.click(B.x+p.x*B.width/480,B.y+p.y*B.height/360);
      const effects=await E(()=>{const s=__dh.engine.scene;return {fx:s.fx,hull:s.b.units.find(u=>u.side==='foe').hull};});
      assert.equal(effects.hull,1200-prepared.damage);
      assert(effects.fx.some(f=>f.kind==='panokFire'&&f.dir===dir&&f.life===45));
      assert(effects.fx.some(f=>f.kind==='smoke'&&f.life===50&&f.strength===.75));
      assert(effects.fx.filter(f=>f.kind==='ball').every(f=>f.flight===17.5));
      await E(()=>__dh.engine.step(22));await shot('panok-fire-'+dir);
      await E(()=>__dh.engine.step(22));assert(await E(()=>__dh.engine.scene.fx.some(f=>f.kind==='panokFire')));
      await E(()=>__dh.engine.step(1));assert(!await E(()=>__dh.engine.scene.fx.some(f=>f.kind==='panokFire')));
    }
    console.log('PASS real panokseon clicks: both directions, damage unchanged, 45 ticks, half-length supporting effects');
    const endAim=await E(()=>{
      const s=__dh.engine.scene,b=s.b,u=b.units.find(u=>u.side==='me'&&u.type==='panok'),f=b.units.find(u=>u.side==='foe');
      f.hull=1;u.done=false;u.moved=false;s.select(null);s.fx=[];s.refresh();
      const original=s.drawCard;s.cardDraws=0;s.drawCard=function(g){this.cardDraws++;return original.call(this,g);};
      return [u,f].map(a=>{const q=s.grid.center(a.c,a.r);return s.cam.toScreen(q.x,q.y);});
    });
    const B=await page.locator('.dh-canvas').boundingBox();
    for(const p of endAim)await page.mouse.click(B.x+p.x*B.width/480,B.y+p.y*B.height/360);
    assert.equal(await E(()=>__dh.engine.scene.mode),'result');
    await E(()=>__dh.engine.step(22));await shot('panok-final-fire');
    assert.equal(await E(()=>__dh.engine.scene.cardDraws),0);
    await E(()=>__dh.engine.step(23));await shot('panok-final-result');
    assert(await E(()=>__dh.engine.scene.cardDraws>0));
    console.log('PASS final panokseon shot remains visible before the result card');
    assert.deepEqual(errors,[]);console.log('PASS 4 presentation UI groups; no console/page errors');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

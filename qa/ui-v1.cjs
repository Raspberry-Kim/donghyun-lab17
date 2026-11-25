// v1.00 실제 묶음의 사용자 입력 검사. 긴 성장·손상 저장은 명시적으로 경계 상태를 준비한다.
const {chromium}=require('/home/user/node_modules/playwright');
const assert=require('assert'),fs=require('fs'),path=require('path');
const out=process.env.QA_SHOTS||'/tmp/hang-v1-shots';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chromium'});
  const p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];let checks=0;
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  const check=s=>{checks++;console.log('ok '+s);}, E=(fn,a)=>p.evaluate(fn,a);
  const click=id=>p.locator(`.dh-menu button[data-id="${id}"]`).click();
  const back=()=>click('back');
  const shot=async n=>{await E(()=>__dh.engine.step(0));return p.locator('#stage-full').screenshot({path:path.join(out,n+'.png')});};
  const start=async(id='none')=>{await p.selectOption('#example',id);await p.locator('#run').click();await E(()=>__dh.engine.stop());};
  const state=()=>E(()=>({gold:__dh.voyage.gold,day:__dh.voyage.day,port:__dh.voyage.port,ships:__dh.voyage.ships.map(s=>s.type),over:__dh.voyage.over,why:__dh.voyage.overWhy}));
  try{
    await p.goto(process.env.QA_URL||'http://127.0.0.1:3170');
    await p.waitForFunction(()=>window.__dh&&!document.querySelector('#run').disabled);
    assert.ok(await E(()=>__dh.waiting()));assert.ok(await p.locator('#full').isDisabled());
    await start();assert.deepEqual((await state()).ships,['turtle','panok','caravel']);assert.equal((await state()).gold,200000);
    assert.equal(await p.locator('.hang-portrait').count(),2);
    assert.ok((await p.locator('.hang-counsel-title').innerText()).includes('각하, 곁에서 보좌하겠습니다.'));
    assert.ok((await p.locator('.hang-counsel').innerText()).includes('높습니다.'));
    assert.deepEqual(await p.locator('.hang-portrait').evaluateAll(a=>a.map(el=>getComputedStyle(el).transform)),['none','matrix(-1, 0, 0, 1, 0, 0)']);
    await shot('port');
    check('출전 전 정지·시작 세 척·자금 20만·두 얼굴');
    const z=await E(()=>__dh.scene.cam.zoom);await p.getByRole('button',{name:'지도 확대',exact:true}).click();
    assert.ok(await E(z=>__dh.scene.cam.zoom>z,z));await p.getByRole('button',{name:'지도 축소',exact:true}).click();
    assert.equal(await E(()=>__dh.scene.cam.zoom),z);
    const blocked=await E(()=>{const el=document.querySelector('.dh-canvas');return ['wheel','gesturestart','gesturechange'].map(type=>{const e=type==='wheel'?new WheelEvent(type,{ctrlKey:true,deltaY:80,bubbles:true,cancelable:true}):new Event(type,{bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented;});});
    assert.deepEqual(blocked,[true,true,true]);assert.equal(await E(()=>__dh.scene.cam.zoom),z);
    check('확대·축소 원복·Ctrl+휠·gesture 차단');
    await click('tab:invest');await click('invest:5000');
    assert.equal(await E(()=>__dh.voyage.share()),50);assert.equal((await state()).gold,195000);await shot('investment');await back();
    await click('tab:market');const q=await E(()=>__dh.voyage.quote('wine').buy);await click('buy:wine');assert.equal((await state()).gold,195000-q.cost);
    assert.ok(await E(()=>__dh.voyage.growth.savings>0));await click('sell:olive');await back();
    check('투자 차감·50% 협력항·할인 시세 실제 매수·매각');
    await click('tab:counsel');await click('dialogue:advice');assert.equal(await E(()=>__dh.voyage.dialogue.advice),false);
    assert.ok((await p.locator('.hang-counsel').innerText()).includes('도착했습니다.'));
    await click('dialogue:advice');await click('dialogue:quotes');assert.equal(await E(()=>__dh.voyage.dialogue.quotes),false);await click('dialogue:quotes');await back();
    check('조언·항해 문장 끄기와 재활성화');
    await click('tab:inn');await click('hire');assert.equal(await E(()=>__dh.voyage.crew),125);await click('train');assert.equal(await E(()=>__dh.voyage.captain.war),71);await back();
    await click('tab:supply');await click('food');await click('water');assert.equal(await E(()=>__dh.voyage.waterDays),60);await back();
    await click('tab:dock');assert.ok(await p.locator('[data-id="ship:aegis"]').isDisabled());
    assert.deepEqual(await p.locator('.dh-menu [data-id^="ship:"]').evaluateAll(a=>a.map(x=>x.dataset.id)),['ship:aegis','ship:turtle','ship:panok','ship:carrack','ship:caravel']);
    await click('pick:s1');await click('gun');assert.equal(await E(()=>__dh.voyage.ships[0].plus),2);await back();await back();
    check('여관 고용·수련·식량·물·도크 순서·잠금·포 보강');
    await p.locator('#game-save').click();await p.locator('.mi').filter({hasText:'브라우저 칸 1'}).click();
    const saved=await state();await click('tab:invest');await click('invest:1000');await back();
    await p.locator('#game-load').click();await p.locator('.mi').filter({hasText:'브라우저 칸 1'}).click();await p.locator('.mi').filter({hasText:'불러온다'}).click();
    assert.deepEqual(await state(),saved);assert.equal(await E(()=>__dh.voyage.share()),50);
    check('브라우저 저장·수정·불러오기와 투자 복원');
    await start();
    // 실제 지도 좌표를 눌러 세비야로 출항한다.
    const pt=await E(()=>{const s=__dh.scene,q=s.world.ports.get('seville'),P=s.portPx(q,s.cam.x+s.cam.viewW/s.cam.zoom/2);return s.cam.toScreen(P.x,P.y);});
    const box=await p.locator('.dh-canvas').boundingBox();await p.mouse.click(box.x+pt.x*box.width/480,box.y+pt.y*box.height/360);
    await click('sail');assert.equal(await E(()=>__dh.voyage.dialogue.quoteIndex),1);
    assert.equal(await p.locator('.hang-quote').innerText(),"각하, 쇼펜하우어는 '세계는 나의 표상이다.'라고 합니다.");
    await E(()=>__dh.engine.step(60));assert.equal((await state()).port,'seville');assert.equal(await E(()=>__dh.voyage.fame().explore),20);
    assert.equal(await p.locator('.hang-portrait').nth(1).evaluate(el=>getComputedStyle(el).transform),'matrix(-1, 0, 0, 1, 0, 0)');
    await shot('arrival');check('지도 선택·출항 문장·항해·세비야 첫 입항 명성');
    await start('million');await E(()=>{__dh.voyage.gold=999999;__dh.scene.refresh();});await click('tab:market');await click('sell:wine');
    assert.equal((await state()).why,'gold');await shot('gold-ending');check('실제 매각으로 자금 엔딩');
    await start('stage');await E(()=>{__dh.voyage.day=299;__dh.scene.refresh();});await click('sail');await p.locator('.dh-canvas').focus();await p.keyboard.press('ArrowLeft');await E(()=>__dh.engine.step(25));
    assert.equal((await state()).why,'time');check('경계일 출항·방향키 입력으로 기한 패배');
    await start('duchy');await E(()=>{const v=__dh.voyage;v.growth.profit=280000;v.growth.explored=[...__dh.world.ports.keys()].filter(p=>!DH.Hang.GROWTH.ports[p]).slice(0,30);v.growth.investments=v.growth.explored.slice(0,8).map(p=>[p,5000]);__dh.scene.refresh();});
    await click('tab:palace');for(let i=0;i<5;i++)await click('promote');
    assert.equal((await state()).why,'duchy');assert.equal(await E(()=>__dh.voyage.address()),'전하');
    assert.ok((await p.locator('.dh-detail').innerText()).includes('세우셨습니다. 축하드립니다.'));
    await shot('duchy-ending');check('왕궁 다섯 승작·전하·공국 엔딩');
    // 전투 배치만 준비하고, 선택과 포격은 실제 캔버스 클릭으로 실행한다.
    await start();await E(()=>{const s=__dh.scene,v=s.voyage;v.leave();s.meet=v.rivals.get('redsail');s.refresh();});await click('fight');
    assert.equal(await p.locator('.hang-counsel').count(),0);assert.ok(await p.locator('.hang-zoom').isHidden());
    const cells=await E(()=>{const s=__dh.engine.scene,b=s.b,u=b.units.find(u=>u.side==='me'),f=b.units.find(u=>u.side==='foe');u.c=2;u.r=3;f.c=4;f.r=3;f.hull=360;f.crew=80;for(const a of b.units){a.done=false;a.moved=false;}s.refresh();return [s.grid.center(2,3),s.grid.center(4,3)].map(q=>s.cam.toScreen(q.x,q.y));});
    await p.locator('.dh-canvas').scrollIntoViewIfNeeded();
    const B=await p.locator('.dh-canvas').boundingBox();for(const c of cells)await p.mouse.click(B.x+c.x*B.width/480,B.y+c.y*B.height/360);
    assert.ok(await E(()=>__dh.engine.scene.fx.some(f=>f.kind==='dragon')));
    await E(()=>__dh.engine.step(12));await shot('dragon-fire');
    assert.equal(await E(()=>__dh.engine.scene.b.units.find(u=>u.side==='foe').hull),180);
    await E(()=>__dh.engine.step(48));assert.ok(await E(()=>__dh.engine.scene.fx.some(f=>f.kind==='dragon')));
    await E(()=>__dh.engine.step(32));assert.ok(await E(()=>!__dh.engine.scene.fx.some(f=>f.kind==='dragon')));
    check('실제 거북선 포격·용머리 불꽃 생성·종료·해전에서 초상 숨김');
    await E(()=>{const b=__dh.engine.scene.b;const u=b.units.find(u=>u.side==='me');u.done=false;u.moved=false;});
    await p.locator('.dh-canvas').scrollIntoViewIfNeeded();const B2=await p.locator('.dh-canvas').boundingBox();
    for(const c of cells)await p.mouse.click(B2.x+c.x*B2.width/480,B2.y+c.y*B2.height/360);
    assert.equal(await E(()=>__dh.engine.scene.mode),'result');
    await E(()=>__dh.engine.step(12));await shot('dragon-finishing-shot');
    await E(()=>__dh.engine.step(80));await shot('dragon-victory-card');
    check('마지막 포격의 불꽃 후 결과 카드 표시');
    await start();await E(()=>{__dh.voyage.growth.rank=4;__dh.scene.refresh();});
    await click('tab:dock');await click('pick:s1');await click('swap:aegis');await back();await back();
    assert.equal((await state()).ships[0],'aegis');
    await E(()=>{const s=__dh.scene;s.voyage.leave();s.meet=s.voyage.rivals.get('redsail');s.refresh();});await click('fight');
    await shot('aegis-radar-0');await E(()=>__dh.engine.step(22));await shot('aegis-radar-22');
    await E(()=>__dh.engine.step(22));await shot('aegis-radar-44');
    check('공작의 이지스함 교환·해전 진입·레이더 막대 세 시점');
    for(const dir of [1,-1]) {
      const aim=await E(dir=>{const s=__dh.engine.scene,b=s.b,u=b.units.find(u=>u.side==='me'),f=b.units.find(u=>u.side==='foe');u.c=dir>0?2:4;u.r=3;f.c=dir>0?4:2;f.r=3;f.hull=1200;f.crew=80;u.done=false;u.moved=false;s.refresh();return [u,f].map(a=>{const q=s.grid.center(a.c,a.r);return s.cam.toScreen(q.x,q.y);});},dir);
      await p.locator('.dh-canvas').scrollIntoViewIfNeeded();
      const B=await p.locator('.dh-canvas').boundingBox();
      for(const c of aim)await p.mouse.click(B.x+c.x*B.width/480,B.y+c.y*B.height/360);
      assert.ok(await E(dir=>__dh.engine.scene.fx.some(f=>f.kind==='aegisFire'&&f.dir===dir&&f.life===90),dir));
      await E(()=>__dh.engine.step(40));await shot('aegis-fire-'+dir);
      assert.ok(await E(()=>__dh.engine.scene.b.units.find(u=>u.side==='foe').hull<1200));
      await E(()=>__dh.engine.step(20));assert.ok(await E(()=>__dh.engine.scene.fx.some(f=>f.kind==='aegisFire')));
      await E(()=>__dh.engine.step(32));assert.ok(await E(()=>!__dh.engine.scene.fx.some(f=>f.kind==='aegisFire')));
    }
    check('이지스함 실제 양방향 포격·피해·90틱 확대/불꽃·종료');
    await start();await E(()=>{__dh.voyage.growth.rank=3;__dh.scene.refresh();});await click('sail');
    for(const index of [4,13,16,17,18,19,99,100,101]) {
      await E(i=>{__dh.voyage.dialogue.quoteIndex=i;__dh.scene.refresh();},index);
      assert.equal(await p.locator('.hang-quote').innerText(),await E(()=>DH.Hang.quoteLine('전하',DH.Hang.quoteAt(__dh.voyage.dialogue.quoteIndex))));
    }
    for(const index of [1,17,18,19]){
      await E(i=>{__dh.voyage.dialogue.quoteIndex=i;__dh.scene.refresh();},index);
      const link=p.locator('.hang-counsel > a'),url=await link.getAttribute('href');
      const opened=p.waitForEvent('popup');await link.click();const popup=await opened;
      await popup.waitForURL(url);assert.equal(popup.url(),url);await popup.close();
    }
    await p.setViewportSize({width:375,height:844});await E(()=>{const Q=DH.Hang.QUOTES;__dh.voyage.dialogue.quoteIndex=Q.reduce((best,q,i)=>q.text.length>Q[best].text.length?i:best,0)+1;__dh.scene.refresh();});await shot('phone-long-quote');
    assert.ok(await E(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await p.setViewportSize({width:1280,height:900});
    check('전하 인용 형식·서로 다른 구절·375px 긴 인용 줄바꿈');
    await start();await p.locator('#full').click();await shot('fullscreen');
    const fit=await E(()=>{const a=document.querySelector('#stage-full').getBoundingClientRect(),b=document.querySelector('.dh-canvas').getBoundingClientRect();return b.right<=a.right&&b.bottom<=a.bottom;});assert.ok(fit);
    await E(()=>document.fullscreenElement?document.exitFullscreen():null);
    await p.setViewportSize({width:390,height:844});await shot('phone');
    assert.ok(await E(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await p.setViewportSize({width:1280,height:900});await shot('desktop-return');
    check('전체화면·휴대폰·데스크톱 복귀·가로 넘침 없음');
    await p.setViewportSize({width:390,height:844});
    for(const tab of ['protocol','rules','engine','math','about']){
      await p.locator(`[data-tab="${tab}"]`).click();
      assert.ok(await E(()=>document.documentElement.scrollWidth<=innerWidth+1),tab+' 가로 넘침');
      assert.ok(!/__[_A-Z]+__/.test(await p.locator('#tab-'+tab).innerText()),tab+' 치환 누락');
    }
    await p.locator('[data-tab="math"]').click();
    assert.ok((await p.locator('#tab-math').innerText()).includes('v1.34'));
    assert.ok((await p.locator('#tab-math').innerText()).includes('45틱(0.75초)'));
    const table=p.locator('#tab-math table').filter({hasText:'이지스함'});
    assert.equal(await table.locator('tbody tr').count(),5);
    await p.locator('#tab-math article').last().screenshot({path:path.join(out,'phone-growth-math.png')});
    await p.locator('[data-tab="play"]').click();await p.setViewportSize({width:1280,height:900});
    check('휴대폰 설명 탭 다섯 곳·성장 수학·현행 선박 표·치환 누락 없음');
    for(const id of await p.locator('#example option').evaluateAll(a=>a.map(o=>o.value))){await start(id);assert.equal((await state()).over,null);assert.ok((await state()).gold>=200000);}
    check('15개 예제 실제 출전·유효한 초기 자금·즉시 엔딩 없음');
    assert.deepEqual(errors,[]);check('pageerror·console error 0');
    console.log(`PASS ${checks} v1 UI groups`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

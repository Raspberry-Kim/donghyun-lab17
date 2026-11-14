// 새 그림과 입력의 실제 브라우저 검사. QA_URL로 공개판도 같은 흐름을 검사한다.
const { chromium }=require('/home/user/node_modules/playwright');
const assert=require('assert'),fs=require('fs'),path=require('path');
const out=process.env.QA_SHOTS||'/tmp/hang15-shots';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const b=await chromium.launch({channel:'chromium',headless:true}),errors=[];let checks=0;
  try {
    const p=await b.newPage({viewport:{width:1280,height:900}});
    p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
    await p.goto(process.env.QA_URL||'http://127.0.0.1:3017');
    await p.locator('#run').click();await p.waitForFunction(()=>__dh.scene.civil.length===3);
    await p.locator('.dh-canvas').screenshot({path:path.join(out,'map-europe.png')});
    const clickAt=async point=>{
      const r=await p.locator('.dh-canvas').boundingBox();
      await p.mouse.click(r.x+point.x*r.width/480,r.y+point.y*r.height/360);
    };
    const portPoint=id=>p.evaluate(id=>{
      const s=__dh.scene,z=s.cam.zoom,mid=s.cam.x+480/z/2;
      const q=s.portPositions(z,x=>s.grid.nearX(x,mid)).find(q=>q.id===id);return s.cam.toScreen(q.x,q.y);
    },id);
    await p.evaluate(()=>{__dh.engine.stop();const s=__dh.scene,q=s.world.ports.get('canton');s.cam.centerOn(q.x*4,q.y*4);s.cam.clampTo(s.grid);s.follow=false;s.updateCivil();__dh.engine.step(1);});
    for(const id of ['canton','hongkong']){
      await clickAt(await portPoint(id));assert.equal(await p.evaluate(()=>__dh.scene.selected),id);
      assert.ok((await p.locator('.dh-detail').innerText()).includes(id==='canton'?'광저우':'홍콩'));checks++;
    }
    await p.evaluate(()=>{const v=__dh.voyage;v.visits.set('canton',3);v.visits.set('hongkong',1);__dh.engine.step(1);});
    await clickAt(await portPoint('canton'));assert.ok((await p.locator('.dh-detail').innerText()).includes('3회'));checks++;
    await p.locator('.dh-canvas').screenshot({path:path.join(out,'map-asia.png')});
    // 작은 배를 실제로 누른다. 설명 창은 날짜를 멈추고, 연타로 보급을 다시 주지 않는다.
    const ship=await p.evaluate(()=>{const s=__dh.scene,b=s.civil[0],mid=s.cam.x+240/s.cam.zoom;return s.cam.toScreen(s.grid.nearX(b.x,mid),b.y);});
    await clickAt(ship);await p.locator('button[data-id="civil-close"]').waitFor();
    assert.equal(await p.evaluate(()=>__dh.engine.clock.running),false);
    const supply=await p.evaluate(()=>[__dh.voyage.food,__dh.voyage.water,__dh.voyage.trafficAttempt]);
    await p.evaluate(()=>__dh.engine.step(1));
    await p.locator('.dh-canvas').screenshot({path:path.join(out,'civil-card.png')});
    await p.keyboard.press('Escape');await p.locator('.dh-canvas').focus();await p.keyboard.press('t');
    await p.locator('button[data-id^="civil:"]').last().click();
    assert.deepStrictEqual(await p.evaluate(()=>[__dh.voyage.food,__dh.voyage.water,__dh.voyage.trafficAttempt]),supply);
    await p.locator('button[data-id="civil-close"]').click();checks++;
    // 375px/390px 폭 및 다시 데스크톱. 지도와 문서의 실제 렌더링을 따로 남긴다.
    for(const width of [375,390,1280]){
      await p.setViewportSize({width,height:900});await p.evaluate(()=>__dh.engine.step(1));
      await p.locator('.dh-canvas').screenshot({path:path.join(out,`map-${width}.png`)});
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await p.getByRole('button',{name:'수학적 원리',exact:true}).click();
      await p.locator('#tab-math article').last().scrollIntoViewIfNeeded();
      assert.equal(await p.locator('#tab-math').evaluate(e=>e.scrollWidth>e.clientWidth),false);
      assert.ok((await p.locator('#tab-math').innerText()).includes('승리에 대한 보급과 작은 보상'));
      await p.screenshot({path:path.join(out,`math-${width}.png`)});
      await p.getByRole('button',{name:'세계 지도',exact:true}).click();checks++;
    }
    // 새 그림이 실제 카드와 전장으로 연결되는지: 해적 조건만 준비하고 싸운다 버튼을 누른다.
    await p.evaluate(()=>{
      const s=__dh.scene;s.restart();s.voyage.leave();s.meet=s.voyage.rivals.get('storm');s.refresh();__dh.engine.step(1);
    });
    await p.locator('.dh-canvas').screenshot({path:path.join(out,'pirate-meet.png')});
    await p.locator('button[data-id="fight"]').click();await p.evaluate(()=>__dh.engine.step(1));
    await p.locator('.dh-canvas').screenshot({path:path.join(out,'battle.png')});
    assert.equal(await p.evaluate(()=>__dh.engine.scenes.length),2);checks++;
    await p.locator('button[data-id="flee"]').click();await p.locator('button[data-id="no"]').click().catch(async()=>{
      const ids=await p.locator('.dh-menu button').evaluateAll(a=>a.map(e=>e.dataset.id));throw new Error('도주 되묻기 취소 버튼 확인: '+ids);
    });
    // 해적선 여섯 그림은 같은 실제 그리기 함수로 모아 확인한다.
    await p.evaluate(()=>{
      const c=document.createElement('canvas');c.id='art-sheet';c.width=900;c.height=360;document.body.prepend(c);
      const g=c.getContext('2d');g.fillStyle='#f4eddf';g.fillRect(0,0,900,360);
      for(let i=0;i<6;i++){const x=150+(i%3)*300,y=90+Math.floor(i/3)*170;
        g.fillStyle='#a6c9dc';g.beginPath();g.roundRect(x-132,y-65,264,124,14);g.fill();
        DH.Hang.drawShip(g,x,y+28,4.5,DH.Hang.LOOK.foe,true,-1,'caravel',i);
        g.fillStyle='#26211c';g.font='700 16px Pretendard';g.textAlign='center';g.fillText(DH.Hang.PIRATE_NAMES[i],x,y+81);
      }
    });
    await p.locator('#art-sheet').screenshot({path:path.join(out,'pirate-six.png')});await p.locator('#art-sheet').evaluate(e=>e.remove());checks++;
    assert.deepStrictEqual(errors,[]);console.log(`PASS ${checks} design UI checks; console errors ${errors.length}; ${out}`);
  } finally { await b.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

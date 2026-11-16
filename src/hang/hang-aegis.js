// 통통한 목재 이지스함: 중앙 함교·분리 함포·갑판에 고정된 깃대.
// 승인된 A안의 픽셀·배율·90틱 연출. 지도용 반동만 줄여 함교와 한 픽셀 간격 유지.
// 전투 계산·저장 데이터와 무관하다.
(function(root){
  'use strict';
  const DH=root.DH=root.DH||{};
  const PALETTE={o:'#674c34',L:'#e0b97a',H:'#bf8b4f',h:'#926039',A:'#ead3a5',B:'#cda773',Y:'#f6e7c8',g:'#78523a',v:'#729ca4',V:'#b6d0ce',m:'#765e40',f:'#efba45',w:'#eaf5f6',R:'#d56b52',r:'#ad4c3e',T:'#efad78'};
  const SPEC={
  "big": [
    "...........................",
    "...........................",
    "...........................",
    "...........................",
    "...........................",
    "...........................",
    "...........................",
    "..........oooooo...........",
    ".........oYYYYYYo..........",
    "........oAAAAAAAAo.........",
    "........oAvVvVvVAo.........",
    "........oAvvvvvvAo.........",
    "........oAAAAAAABo.........",
    ".......oYYYYYYYYYBo........",
    ".......oAAAAAAAABBo........",
    "..oooooooLLLLLLLLLLLoooo...",
    ".oLLLLLLLLLLLLLLLLLLLLLLo..",
    "oLYYYYYYYYYYYYYYYYYYYYYYLo.",
    "oLLLLLLLLLLLLLLLLLLLLLLLLo.",
    "oHHHHHHHHHHHHHHHHHHHHHHHHo.",
    ".oHHHgHHHHHHgHHHHHHgHHHHo..",
    ".oHHHHHHHHHHHHHHHHHHHHHo...",
    "..ohhhhhhhhhhhhhhhhhhho....",
    "...ooooooooooooooooooo.....",
    "....www....wwww....www......"
  ],
  "small": [
    ".................",
    ".................",
    ".................",
    "......oooo.......",
    ".....oYYYYo......",
    ".....oAAAAo......",
    ".....ovVvVo......",
    ".....oAAAABo.....",
    "....oYYYYYYo.....",
    "..ooooLLLLLLLoo..",
    ".oLYYYYYYYYYYLLo.",
    "oLLLLLLLLLLLLLLo.",
    "oHHHHHHHHHHHHHHo.",
    ".oHHgHHHgHHHgHo..",
    "..ohhhhhhhhhho...",
    "...oooooooooo....",
    "...www....www...."
  ],
  "cannon": {
    "big": {
      "x": 23,
      "y": 14,
      "length": 5,
      "width": 3.5
    },
    "small": {
      "x": 14.5,
      "y": 9,
      "length": 3,
      "width": 2
    }
  },
  "radar": {
    "big": {
      "x": 12.5,
      "y": 5
    },
    "small": {
      "x": 7.5,
      "y": 1
    }
  },
  "flag": {
    "big": {
      "x": 3,
      "y": 7,
      "deck": 16
    },
    "small": {
      "x": 2,
      "y": 3,
      "deck": 11
    }
  }
};
  function drawAegis(g,x,y,k,flag,face,anim={}){
    const tiny=k<1.6,s=SPEC,rows=tiny?s.small:s.big,base=tiny?16:24,p=PALETTE,w=tiny?17:27,c=tiny?k:k*.7;
    const m=g.getTransform(),left=x-w*c/2,top=y+5*k-(base+1)*c;
    const X=v=>{const z=Math.round(m.a*(left+v*c)+m.e);return face<0?2*Math.round(m.a*x+m.e)-z:z;};
    const Y=v=>Math.round(m.d*(top+v*c)+m.f);
    g.save();g.setTransform(1,0,0,1,0,0);
    const rect=(a,b,w,h,color)=>{const l=X(a),r=X(a+w),t=Y(b),u=Y(b+h);g.fillStyle=color;g.fillRect(Math.min(l,r),Math.min(t,u),Math.abs(r-l),Math.abs(u-t));};
    rows.forEach((row,j)=>[...row].forEach((ch,i)=>{if(ch!=='.'&&(ch!=='f'||flag))rect(i,j,1,1,p[ch]);}));
    // The stern flagstaff is continuous from its flag to an anchored deck foot.
    const staff=tiny?s.flag.small:s.flag.big;
    rect(staff.x,staff.y,1,staff.deck-staff.y,p.m);
    rect(staff.x-1,staff.deck-1,3,1,p.o);
    if(flag){
      rect(staff.x+1,staff.y,tiny?2:3,1,p.f);
      rect(staff.x+1,staff.y+1,tiny?1:2,1,p.f);
    }
    const radar=tiny?s.radar.small:s.radar.big,phase=(anim.tick||0)/15,rx=.8+2*Math.abs(Math.cos(phase));
    rect(radar.x,radar.y+1,1,tiny?2:3,p.m);
    for(let j=-1;j<=1;j++)for(let i=-3;i<=3;i++)if(i*i/(rx*rx)+j*j/2<=1.2)rect(radar.x+i,radar.y+j,1,1,j===1?p.B:p.Y);
    const a=tiny?s.cannon.small:s.cannon.big,fire=anim.fire??-1,q=fire>=0&&fire<90?fire/90:0,firing=fire>=0&&fire<90;
    const pulse=firing?Math.sin(Math.PI*q):0,swell=1+.24*pulse,recoil=(tiny?.1:.45)*pulse;
    const part=(dx,dy,w,h,color)=>rect(a.x+dx*swell-recoil,a.y+dy*swell+recoil,w*swell,h*swell,color);
    // Fixed narrow deck mount: only the barrel recoils, never the deck attachment.
    rect(a.x-1.5,a.y,3,tiny?2:3,p.o);
    rect(a.x-.7,a.y+.5,1.4,tiny?1:1.8,p.B);
    for(let j=0;j<=a.length;j++){
      part(j-a.width/2,-j-a.width/2,a.width+1,a.width+1,p.o);
    }
    for(let j=0;j<=a.length;j++){
      part(j-a.width/2+.6,-j-a.width/2+.6,a.width-.2,a.width-.2,j>a.length-1?p.T:p.R);
    }
    for(let j=0;j<a.length;j++)part(j+.35,-j+.4,1,1,p.r);
    const band=Math.round(a.length*.5);
    for(let offset=-1;offset<=1;offset++){
      part(band+offset,-band+offset,.9,.9,p.T);
    }
    part(a.length-.45,-a.length-.45,1.15,1.15,p.o);
    if(firing&&q>.07&&q<.9){
      const strength=Math.sin(Math.PI*(q-.07)/.83),length=(tiny?5:9)*strength;
      for(let i=1;i<=length;i++){
        const h=Math.max(.5,(tiny?1:1.6)*strength*(1-i/(length+2)));
        part(a.length+1+i*.72-h,-a.length-1-i*.72-h,1+2*h,1+2*h,'#df7040');
      }
      for(let i=1;i<length*.7;i++)part(a.length+1+i*.72-.4,-a.length-1-i*.72-.4,1.3,1.3,'#ffe29b');
    }
    g.restore();
  }
  DH.Hang=Object.assign(DH.Hang||{},{drawAegis});
})(typeof window!=='undefined'?window:globalThis);

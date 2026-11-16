// 회색 이지스함: 남색 테두리의 짙은 무채색 회색 선체, 함번 997, 뒤 갑판의 헬기와 깃대, 둥근 포탑.
// 큰 그림(해전)은 32×22칸, 작은 그림(지도)은 19×12칸이다. 기준 그림은 뱃머리가 오른쪽을 본다.
// 그림만 다룬다. 전투 계산·저장 데이터와 무관하다.
(function(root){
  'use strict';
  const DH=root.DH=root.DH||{};
  // o 테두리 · n 창 · d m M l 회색 네 단계 · W 흰색 · r b 태극 · w 물보라 · N 함번 · g G 포신
  const PALETTE={o:'#141d4a',n:'#22397c',d:'#66676e',m:'#808187',M:'#9b9ca2',l:'#cbccd0',W:'#f7f8fc',r:'#e8473f',b:'#2a68d8',w:'#eaf5f6',N:'#fbfcfe',g:'#9c9da3',G:'#cccdd1'};
  // cell: 한 칸의 크기(k 단위) · base: 물에 닿는 줄 · bar: 마스트 가로 막대(레이더) · flag: 태극기
  // rotor: 헬기 회전날개 · digits: 함번 · cannon: 포신 뿌리와 길이
  const SPEC={
    big:{
      rows:[
        '..........o.....................',
        '..........o.....oo..............',
        '..........o....oWlo.............',
        '..........o.....oo..............',
        '..........o.....................',
        '..........o.....Ml..............',
        '..........o.....................',
        '..........o....oMlo.............',
        '....o.....o..ooooooooo..........',
        'o..oooo...o..oMMMllllo..........',
        'oooMlnWo.oooooMMMnlnlo.ooo......',
        '..oMMMlo.onllonMnllllooMlWo.....',
        '...oooo..omlloMMMllllooMMlooooo.',
        'ooooooooooooooMMMlllloooooodmmmo',
        'ollllllllllllMMMmmmmmmmmmmmmmmmo',
        'ommmmmmmmmmmmmmmmmmmmmmmmmmmmmo.',
        'ommmmmmmmmmmmmmmmmmmmmmmmmmmmmo.',
        '.ommmmmmmmmmmmmmmmmmmmmmmmmmmo..',
        '.ommmmmmmmmmmmmmmmmmmmmmmmmmmo..',
        '..odddddddddddddddddddddddddo...',
        '...ooooooooooooooooooooooooo....',
        '.....www......wwww.....www......'
      ],
      cell:0.66,
      base:21,
      bar:{row:5,c0:16,c1:17,e:[1,2]},
      flag:{r:0,c:3,rows:['ooooooo','odWWWWd','oWWrrWW','oWWbbWW','odWWWWd','ooooooo']},
      rotor:{row:7,full:[1,7],short:[3,5]},
      digits:{r:14,c:17,text:'997'},
      cannon:{x:26,y:11,length:2.5,width:1,edge:0.5}
    },
    small:{
      rows:[
        '.......o...o.......',
        '.......o..oWo......',
        '.......o.ooooo.....',
        '.......o..olo......',
        '.......o.oooooo....',
        '.......o.oMlnlo.o..',
        'oMlno..o.oMlllooMo.',
        'ooooooooooooooooooo',
        'ollllllllmmmmmmmmo.',
        '.ommmmmmmmWmWmWmo..',
        '..oooooooooooooo...',
        '...ww...ww...ww....'
      ],
      cell:1,
      base:11,
      flag:{r:0,c:3,rows:['oooo','oWrW','oWbW','oooo']},
      rotor:{row:5,full:[0,4],short:[1,3]},
      cannon:{x:17,y:5.8,length:2,width:1,edge:0.5}
    }
  };
  const FONT={'9':['###','#.#','###','..#','###'],'7':['###','..#','..#','..#','..#']};
  function drawAegis(g,x,y,k,flag,face,anim={}){
    const tiny=k<1.6,s=tiny?SPEC.small:SPEC.big,rows=s.rows,w=rows[0].length,c=k*s.cell,p=PALETTE;
    const m=g.getTransform(),left=x-w*c/2,top=y+5*k-(s.base+1)*c;
    const X=v=>{const z=Math.round(m.a*(left+v*c)+m.e);return face<0?2*Math.round(m.a*x+m.e)-z:z;};
    const Y=v=>Math.round(m.d*(top+v*c)+m.f);
    g.save();g.setTransform(1,0,0,1,0,0);
    const rect=(a,b,w,h,color)=>{const l=X(a),r=X(a+w),t=Y(b),u=Y(b+h);g.fillStyle=color;g.fillRect(Math.min(l,r),Math.min(t,u),Math.abs(r-l),Math.abs(u-t));};
    const tick=anim.tick||0;
    // 마스트 가로 막대(레이더): 길이가 천천히 변한다. 그림보다 먼저 그려 마스트가 앞에 온다.
    if(s.bar){
      const b=s.bar,e=Math.round(b.e[0]+(b.e[1]-b.e[0])*Math.abs(Math.cos(tick/15))),n=b.c1-b.c0+1+2*e,mid=(b.c0+b.c1+1)/2;
      rect(b.c0-e-1,b.row-1,n+2,3,p.o);rect(b.c0-e,b.row,mid-(b.c0-e),1,p.M);rect(mid,b.row,b.c1+e+1-mid,1,p.l);
    }
    rows.forEach((row,j)=>[...row].forEach((ch,i)=>{if(ch!=='.')rect(i,j,1,1,p[ch]);}));
    // 태극기는 기함일 때만 건다. 깃대는 늘 서 있다.
    if(flag)s.flag.rows.forEach((row,j)=>[...row].forEach((ch,i)=>{if(ch!=='.')rect(s.flag.c+i,s.flag.r+j,1,1,p[ch]);}));
    // 헬기 회전날개: 긴 날개와 짧은 날개가 번갈아 보인다.
    const span=Math.floor(tick/3)%2?s.rotor.short:s.rotor.full;rect(span[0],s.rotor.row,span[1]-span[0]+1,1,p.o);
    // 함번: 배가 어느 쪽을 보든 왼쪽에서 오른쪽으로 읽힌다.
    if(s.digits){
      const text=s.digits.text,last=text.length*4-2;
      [...text].forEach((ch,n)=>FONT[ch].forEach((line,j)=>[...line].forEach((bit,i)=>{
        if(bit!=='#')return;const col=n*4+i;rect(s.digits.c+(face<0?last-col:col),s.digits.r+j,1,1,p.N);})));
    }
    // 함포: 둥근 포탑은 그림에 있고, 포신만 전방 45도로 그린다. 포격 90틱 동안 부풀고 물러났다가 돌아온다.
    const a=s.cannon,fire=anim.fire??-1,firing=fire>=0&&fire<90,q=firing?fire/90:0,f=tiny?1:.7/s.cell;
    const pulse=firing?Math.sin(Math.PI*q):0,swell=1+.24*pulse,recoil=(tiny?.1:.45*f)*pulse;
    const part=(dx,dy,w,h,color)=>rect(a.x+dx*swell-recoil,a.y+dy*swell+recoil,w*swell,h*swell,color);
    const edge=a.edge;
    for(let j=0;j<=a.length;j+=.5)part(j-a.width/2-edge,-j-a.width/2-edge,a.width+2*edge,a.width+2*edge,p.o);
    for(let j=0;j<=a.length;j+=.5)part(j-a.width/2,-j-a.width/2,a.width,a.width,j>a.length-1?p.G:p.g);
    if(!tiny)for(let j=0;j<=a.length-1;j+=.5)part(j,-j-a.width/2,a.width/2,a.width/2,p.G);
    if(firing&&q>.07&&q<.9){
      const strength=Math.sin(Math.PI*(q-.07)/.83),length=(tiny?5:9)*f*strength;
      for(let i=1;i<=length;i++){
        const h=Math.max(.5,(tiny?1:1.6*f)*strength*(1-i/(length+2)));
        part(a.length+1+i*.72-h,-a.length-1-i*.72-h,1+2*h,1+2*h,'#df7040');
      }
      for(let i=1;i<length*.7;i++)part(a.length+1+i*.72-.4*f,-a.length-1-i*.72-.4*f,1.3*f,1.3*f,'#ffe29b');
    }
    g.restore();
  }
  DH.Hang=Object.assign(DH.Hang||{},{drawAegis,AEGIS:{SPEC,PALETTE,FONT}});
})(typeof window!=='undefined'?window:globalThis);

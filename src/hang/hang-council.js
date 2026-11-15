/* 항구 투자·왕궁 UI. 공통 Layout은 그대로 쓴다. */
(function(root) {
  'use strict';
  const H = root.DH.Hang, fmt = n => n.toLocaleString('ko-KR');
  const QUOTES = [
    { section: '§1', text: '세계는 나의 표상이다.', original: 'The world is my idea:' },
    { section: '§38', text: '모든 의욕은 결핍에서, 따라서 부족에서, 따라서 고통에서 생겨난다.', original: 'All willing arises from want, therefore from deficiency, and therefore from suffering.' },
    { section: '§57', text: '그리하여 삶은 고통과 권태 사이를 시계추처럼 오간다.', original: 'Thus its life swings like a pendulum backwards and forwards between pain and ennui.' }
  ];
  const QUOTE_URL = 'https://www.gutenberg.org/files/38427/38427-h/38427-h.html';
  // 동행 0번, 주요 항구 1~10번. 나머지 항구는 얼굴·색조 조합을 고정한다.
  const FEATURED = ['lisbon', 'seville', 'amsterdam', 'alexandria', 'istanbul', 'aden', 'calicut', 'macau', 'hakata', 'london'];
  H.portrait = (world, pid) => {
    if (!pid) return { index: 0, hue: 0, role: '동행 책사 · 시녀 · 파트너' };
    const i = FEATURED.indexOf(pid), n = [...world.ports.keys()].indexOf(pid);
    return { index: i >= 0 ? i + 1 : 1 + n % 11, hue: i >= 0 ? 0 : (Math.floor(n / 11) + 1) * 9,
      role: ['항구 협력자', '교역 안내인', '상관 연락관'][Math.max(0, n) % 3] };
  };
  Object.assign(H.Voyage.prototype, {
    nextQuote() {
      if (!this.dialogue.quotes) return;
      this.dialogue.quoteIndex = (this.dialogue.quoteIndex + 1) % 1000000000;
      this.dialogue.lastQuoteDay = this.day;
    }
  });
  Object.assign(H.HangSeaScene.prototype, {
    councilDetail() {
      const v = this.voyage, g = v.growth, ranks = H.GROWTH.ranks, f = v.fame();
      if (this.tab === 'counsel') return { title: '동행 책사와 항구 협력자', rows: [
        ['호칭', `${v.getRank().name} ${v.address()}`], ['입항 조언', v.dialogue.advice ? '켜짐 · 현 시세와 수수료로 계산' : '꺼짐'],
        ['항해 문장', v.dialogue.quotes ? '켜짐 · 출항과 30항해일마다' : '꺼짐']],
        note: '조언은 현재 한 거래 단위의 가격 비교다. 항해 중 시세 복귀·연속 매각·식량·해전 비용은 예측하지 않는다. 쇼펜하우어 문장은 19세기 철학을 읽는 비역사적 연출이다. 역할명만 표시한다.' };
      if (this.tab === 'invest') {
        const total = g.investments.reduce((a, [, n]) => a + n, 0);
        return { title: `${v.here.name} 상업 투자`, rows: [
          ['투자금', fmt(v.investment())], ['상업 지분', `${v.share().toFixed(2)}% · ${v.cooperative() ? '협력항' : '50%부터 협력항'}`],
          ['현재 수수료', `${v.marketFee().toFixed(2)}%`], ['식량 할인', `${((1 - v.foodFactor()) * 100).toFixed(2)}%`],
          ['재고 목표', `${v.cooperative() ? (1 + v.share()/100).toFixed(2) : '1.00'}배 · 항해일마다 5개씩 회복`],
          ['전 항구 누적 절감', `금 ${fmt(g.savings)}`], ['전 항구 투자 대비', total ? `${(g.savings / total * 100).toFixed(2)}% 회수 · 순수익률 ${((g.savings-total)/total*100).toFixed(2)}%` : '아직 투자하지 않았다']],
          note: `${v.address()}, 지분 = 투자금 ÷ (투자금 + 5,000). 5,000에 50%, 20,000에 80%다. 투자금은 회수·매각하지 않는다. 이자는 없고 실제 거래·식량 절감만 누적한다. 무적 모드에서도 투자금은 차감하며 무적 거래는 절감액·교역·해전 명성에 넣지 않는다.` };
      }
      const next = ranks[g.rank + 1], unlocked = Object.entries(H.GROWTH.ports).map(([p, r]) => [this.world.ports.get(p).name, ranks[r].name]);
      return { title: v.port === 'lisbon' ? '리스본 왕궁' : '작위 장부 · 승작은 리스본 왕궁', rows: [
        ['현재', `${v.getRank().name} · ${v.address()}`], ['명성', `${v.totalFame()} = 교역 ${f.trade} + 해전 ${f.battle} + 탐험 ${f.explore}`],
        ['기반', `첫 방문 ${g.explored.length}항구 · 협력항 ${v.allies()}곳`],
        ['다음 작위', next ? `${next.name}: 명성 ${next.fame} · 방문 ${next.ports} · 협력항 ${next.allies}` : '대공 · 공국 건국'],
        ...ranks.slice(1).map(r => [r.name, `명성 ${r.fame} · 방문 ${r.ports} · 협력항 ${r.allies}`]),
        ['선박 해금', '남작 캐러벨 · 자작 캐럭·판옥선 · 백작 거북선 · 공작 이지스함(시작 함대·나포선은 예외)'],
        ['항구 해금', unlocked.map(([p, r]) => `${p}(${r})`).join(' · ')],
        ['왕실 의뢰', '자작부터 조합에 1건 추가. 작위마다 수량 10개·보수 기준값 10%p 증가']],
        note: '현금 이익 100마다 교역 명성 1, 해전 승리 50, 새 항구 입항 20(시작항 제외). 승작은 명성·방문·협력항 조건을 모두 채워 한 단계씩 받는다. 단순화한 게임 작위이며 실제 포르투갈 제도나 영토 소유를 재현하지 않는다.' };
    },
    councilMenu() {
      const v = this.voyage, back = { id: 'back', label: '돌아가기', key: 'Esc' };
      if (this.tab === 'counsel') return [
        { id: 'dialogue:advice', label: `입항 조언 ${v.dialogue.advice ? '끄기' : '켜기'}` },
        { id: 'dialogue:quotes', label: `항해 문장 ${v.dialogue.quotes ? '끄기' : '켜기'}` }, back];
      if (this.tab === 'invest') return [...[1000, 5000, 10000].map(n => { const c = v.canInvest(n); return {
        id: 'invest:' + n, label: `금 ${fmt(n)} 투자${c.ok ? ` → ${c.share.toFixed(1)}%` : ''}`, disabled: !c.ok, hint: c.ok ? '투자금은 반환하지 않는다' : c.why }; }), back];
      const c = v.promotion(); return [{ id: 'promote', label: c.ok ? `${c.next} 승작 받기` : '승작 받기', disabled: !c.ok, hint: c.why || '', primary: c.ok }, back];
    },
    refreshCouncil() {
      const v = this.voyage, L = this.layout;
      if (!v.growth || !L.detailEl || !root.document) return;
      const panel = L.detailEl.parentElement;
      panel.querySelector(':scope > .hang-counsel')?.remove();
      panel.classList.toggle('hang-home', !this.tab && ['port', 'sea'].includes(this.mode));
      const create = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; if (text) el.textContent = text; return el; };
      if (!this.zoomTools) {
        const tools = this.zoomTools = create('div', 'hang-zoom');
        for (const [id, label, icon] of [['zin', '지도 확대', '+'], ['zout', '지도 축소', '−']]) {
          const b = create('button', '', icon); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label;
          b.onclick = () => { if (this.engine.scene === this) this.command(id); };
          tools.append(b);
        }
        L.canvas.parentElement.append(tools);
      }
      this.zoomTools.hidden = this.engine.scene !== this;
      if (!['port', 'sea'].includes(this.mode)) return;
      if (this.tab && this.tab !== 'counsel') return;
      const card = create('section', 'hang-counsel');
      card.setAttribute('aria-label', '동행 조언');
      const faces = create('div', 'hang-faces');
      for (const pid of [null, ...(v.port ? [v.port] : [])]) {
        const p = H.portrait(this.world, pid), face = create('figure', 'hang-face');
        const art = create('div', 'hang-portrait'); art.setAttribute('role', 'img');
        art.setAttribute('aria-label', p.role + ' 얼굴 초상');
        art.style.backgroundPosition = `${p.index % 4 * 100/3}% ${Math.floor(p.index / 4) * 50}%`;
        art.style.filter = `hue-rotate(${p.hue}deg)`;
        face.append(art, create('figcaption', '', pid ? v.here.name + ' 협력자' : '동행 책사'));
        faces.append(face);
      }
      card.append(faces);
      card.append(create('strong', 'hang-counsel-title', `${v.address()}, 동행 책사다.`));
      if (v.port && v.dialogue.advice) card.append(create('p', '', v.advice().text));
      else if (!v.port && v.dialogue.quotes && v.dialogue.quoteIndex) {
        const q = QUOTES[(v.dialogue.quoteIndex - 1 + QUOTES.length) % QUOTES.length];
        card.append(create('p', '', `${v.address()}, “${q.text}”`));
        const a = create('a', '', `쇼펜하우어 ${q.section} · 직접 옮김`); a.href = QUOTE_URL; a.target = '_blank'; a.rel = 'noopener'; card.append(a);
      } else card.append(create('p', '', v.port ? `${v.here.name}에 함께 닻을 내렸다.` : '안전한 항해를 바라며 곁을 지킨다.'));
      if (v.port) card.append(create('small', '', `${v.here.name} 협력자 · 상업 지분 ${v.share().toFixed(1)}%`));
      panel.prepend(card);
    }
  });
  H.QUOTES = QUOTES;
})(globalThis);

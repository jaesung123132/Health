/* 플란체 로드맵 — 화면 구성과 조작 */
(function () {
  'use strict';
  const D = window.PL_DATA, PL = window.PL;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('planche.' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('planche.' + k, JSON.stringify(v)); } catch (_) { /* 저장 불가 환경 */ } }
  };
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EX = {};
  D.exercises.forEach(e => { EX[e.id] = e; });
  const engineOK = !!(PL && PL.prepare);
  D.exercises.forEach(e => {
    e._pic = '';
    if (!engineOK) return;
    try { PL.prepare(e); e._pic = PL.pictogram(e); } catch (err) { console.error('운동 준비 실패', e.id, err); }
  });
  const pic = (id) => (EX[id] && EX[id]._pic) || '';

  const state = {
    phase: clampPhase(store.get('phase', 0)), ex: null, t: 0, playing: !reduced, speed: 1,
    guides: true, muscles: false, bad: false, view: 'side', days: store.get('days', 3) === 4 ? 4 : 3
  };
  function clampPhase(n) { n = Number(n); return n >= 0 && n <= 5 ? Math.round(n) : 0; }

  /* ---------- 단계 사다리 ---------- */
  const ladder = $('#ladder');
  ladder.innerHTML = D.phases.map(p => `<button class="rung" role="tab" data-p="${p.id}" aria-selected="false">${pic(p.key)}<b>${esc(p.name)}</b><small>${esc(p.mlabel)}</small></button>`).join('');
  ladder.addEventListener('click', (e) => { const b = e.target.closest('.rung'); if (b) setPhase(+b.dataset.p, true); });

  function setPhase(i, pickKey) {
    state.phase = clampPhase(i); store.set('phase', state.phase);
    $$('.rung', ladder).forEach(b => b.setAttribute('aria-selected', String(+b.dataset.p === state.phase)));
    const cur = $(`.rung[data-p="${state.phase}"]`, ladder);
    if (cur && cur.scrollIntoView && ladder.scrollWidth > ladder.clientWidth) ladder.scrollTo({ left: cur.offsetLeft - 8, behavior: 'smooth' });
    renderGantt();
    if (pickKey) selectEx(D.phases[state.phase].key);
    else renderChips();
  }

  /* ---------- 운동 칩 ---------- */
  const chips = $('#chips');
  function renderChips() {
    const ph = D.phases[state.phase];
    chips.innerHTML = ph.ex.map(id => chip(id, false)).join('') + ph.sup.map(id => chip(id, true)).join('');
  }
  function chip(id, sup) {
    const e = EX[id];
    return `<button class="chip" data-ex="${id}" aria-current="${state.ex && state.ex.id === id}">${pic(id)}${esc(e.name)}${sup ? '<em>계속</em>' : ''}</button>`;
  }
  chips.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) selectEx(b.dataset.ex); });

  /* ---------- 3D 무대 ---------- */
  const stageEl = $('#stage');
  let stage = null;
  if (engineOK) {
    try {
      stage = new PL.Stage(stageEl, { preserve: /[?&]shot\b/.test(location.search) });
      stage.setColors(themeColors());
      stage.onUserOrbit = () => { if (state.view !== 'free' && state.view !== 'quad') setViewButtons('free'); state.view = stage.multi ? 'quad' : 'free'; hideHint(); };
    } catch (err) { console.error('WebGL 초기화 실패', err); stage = null; }
  }
  if (!stage) { $('#nogl').hidden = false; $('#hint').hidden = true; }
  function themeColors() {
    const cs = getComputedStyle(document.documentElement), g = (n) => cs.getPropertyValue(n).trim() || '#888888';
    return { body: g('--body3d'), muscle: g('--muscle3d'), joint: g('--joint3d'), hl: g('--hl3d'), bad: g('--bad3d'), ghost: g('--ghost3d'),
      floor: g('--floor3d'), mat: g('--mat3d'), edge: g('--edge3d'), guide: g('--guide3d'), ref: g('--ref3d'), wood: g('--wood3d'), metal: g('--metal3d'),
      sky: g('--sky3d'), ground: g('--ground3d') };
  }
  const retheme = () => { if (stage) stage.setColors(themeColors()); };
  if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', retheme); }
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  const VIEWS = { side: (f) => ({ az: f - 90, el: 6 }), front: (f) => ({ az: f, el: 10 }), diag: (f) => ({ az: f - 45, el: 24 }), top: (f) => ({ az: f - 90, el: 80 }) };
  function setViewButtons(v) { $$('#views button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); }
  function applyView(v, instant) {
    state.view = v; setViewButtons(v);
    if (!stage) return;
    stage.multi = v === 'quad';
    $('#qlabels').hidden = !stage.multi;
    $('#cap').hidden = stage.multi;
    if (stage.multi) hideHint();
    measureSafe();
    if (VIEWS[v]) stage.setView(Object.assign(VIEWS[v]((state.ex.front || 0) + (v === 'front' ? 0 : (state.ex.azOff || 0))), { zoom: 1 }), instant);
    fitStageHeight();
  }
  // 화면 위(보기 버튼·설명)와 아래(재생 막대)를 피해서 아바타를 배치
  function measureSafe() {
    if (!stage) return;
    const st = stageEl.getBoundingClientRect(), vb = $('#views').getBoundingClientRect(), pb = $('.playbar').getBoundingClientRect();
    const vbot = Math.max(0, vb.bottom - st.top);
    $('#cap').style.top = (vbot + 6) + 'px';
    stage.safe = { t: stage.multi ? vbot : vbot + 50, b: Math.max(0, st.bottom - pb.top) + 6, q: vbot + 4 };
    const ql = $('#qlabels'); ql.style.top = stage.safe.q + 'px'; ql.style.bottom = stage.safe.b + 'px';
  }
  if (stage) new ResizeObserver(measureSafe).observe(stageEl);
  // 휴대폰처럼 좁은 화면에서는 운동의 옆모습 비율에 맞춰 무대 높이를 정해 빈 공간을 줄임
  function fitStageHeight() {
    if (!stage || !state.ex) return;
    if (window.innerWidth >= 700) { stageEl.style.height = ''; return; }
    if (state.view === 'free') return;
    const sz = stage.box.getSize(new PL.THREE.Vector3()), sf = stage.safe || { t: 100, b: 76 };
    const ratio = state.view === 'side' ? sz.y / Math.max(.5, sz.z) * 1.18 : state.view === 'front' ? sz.y / Math.max(.5, sz.x) * 1.1 : .9;
    const want = stageEl.clientWidth * ratio + sf.t + sf.b;
    stageEl.style.height = Math.round(Math.min(Math.max(320, want), Math.min(600, window.innerHeight * .66))) + 'px';
  }
  let rzT = 0;
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(fitStageHeight, 150); });
  $('#views').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { applyView(b.dataset.v); hideHint(); } });

  /* ---------- 운동 선택 ---------- */
  function selectEx(id, keepPhase) {
    const ex = EX[id]; if (!ex) return;
    const ph = D.phases[state.phase];
    if (!keepPhase && ph.ex.indexOf(id) < 0 && ph.sup.indexOf(id) < 0) {
      state.phase = ex.phase; store.set('phase', state.phase);
      $$('.rung', ladder).forEach(b => b.setAttribute('aria-selected', String(+b.dataset.p === state.phase)));
      renderGantt();
    }
    state.ex = ex; state.t = 0;
    if (state.bad && !ex.mistake) state.bad = false;
    renderChips(); renderDetail();
    if (stage && ex._keys) {
      stage.setExercise(ex);
      applyView(state.view === 'free' ? 'side' : state.view, true);
      updateMats(); buildTicks();
    }
    $('#tgBad').hidden = !ex.mistake;
    $('#tgBad').setAttribute('aria-pressed', String(state.bad));
    $('#badwarn').hidden = !state.bad;
    stageEl.setAttribute('aria-label', `3D 아바타: ${ex.name}`);
    const cur = $('.chip[aria-current="true"]', chips);
    if (cur && chips.scrollWidth > chips.clientWidth) chips.scrollTo({ left: cur.offsetLeft - 8, behavior: 'smooth' });
    try { history.replaceState(null, '', '#' + id); } catch (_) { /* 무시 */ }
  }
  function updateMats() {
    if (!stage || !state.ex) return;
    const ex = state.ex;
    stage.man.setState(state.muscles ? ex.muscles.keys : [], state.bad && ex.mistake ? ex.mistake.seg : []);
  }

  /* ---------- 설명 패널 ---------- */
  const detail = $('#detail');
  function linkBtns(ids) { return ids && ids.length ? `<div class="links">${ids.map(id => `<button data-ex="${id}">${esc(EX[id].name)} 보기</button>`).join('')}</div>` : ''; }
  function renderDetail() {
    const e = state.ex, ph = D.phases[e.phase];
    detail.innerHTML = `
      <header class="dh"><div class="dpic">${e._pic}</div><div><p class="dtag">${esc(ph.name)} 단계</p><h3>${esc(e.name)}</h3><p class="den">${esc(e.en)}</p></div></header>
      <dl class="rx"><div><dt>처방</dt><dd>${esc(e.rx)}</dd></div><div><dt>템포</dt><dd>${esc(e.tempo || '—')}</dd></div><div><dt>휴식</dt><dd>${esc(e.rest)}</dd></div></dl>
      <p class="why">${esc(e.why)}</p>
      <section><h4>핵심 자세</h4><ul class="cues">${e.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>
      <section><div class="errhead"><h4>흔한 실수</h4>${e.mistake ? `<button class="mini" id="dBad" aria-pressed="${state.bad}">3D로 비교하기</button>` : ''}</div>
        <ul class="errs">${e.errors.map((c, i) => `<li class="${i === 0 && e.mistake ? 'shown' : ''}">${esc(c)}</li>`).join('')}</ul></section>
      ${e.pass ? `<p class="pass"><b>다음 단계로 가는 기준</b>${esc(e.pass)}</p>` : ''}
      <div class="alt"><div><h5>쉽게 하려면</h5><p>${esc(e.easier.text)}</p>${linkBtns(e.easier.ex)}</div><div><h5>다음 단계</h5><p>${esc(e.harder.text)}</p>${linkBtns(e.harder.ex)}</div></div>
      <p class="mus"><b>주요 근육</b>${esc(e.muscles.names)}</p>`;
  }
  detail.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'dBad') { setBad(!state.bad); return; }
    if (b.dataset.ex) { selectEx(b.dataset.ex); scrollToStage(); }
  });

  /* ---------- 재생 ---------- */
  const playBtn = $('#play'), scrub = $('#scrub'), stepEl = $('#step');
  const ICON = { play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3.5v13l11-6.5z" fill="currentColor"/></svg>', pause: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="3.5" width="4" height="13" rx="1" fill="currentColor"/><rect x="12" y="3.5" width="4" height="13" rx="1" fill="currentColor"/></svg>' };
  function setPlaying(v) { state.playing = v; playBtn.innerHTML = v ? ICON.pause : ICON.play; playBtn.setAttribute('aria-label', v ? '일시정지' : '재생'); }
  playBtn.addEventListener('click', () => setPlaying(!state.playing));
  let scrubbing = false;
  scrub.addEventListener('input', () => { scrubbing = true; if (state.ex) state.t = (+scrub.value / 1000) * state.ex.dur * 0.9999; });
  scrub.addEventListener('change', () => { scrubbing = false; });
  scrub.addEventListener('pointerdown', () => { scrubbing = true; });
  scrub.addEventListener('pointerup', () => { scrubbing = false; });
  $('#speed').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.speed = +b.dataset.s; $$('#speed button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  function buildTicks() {
    const ex = state.ex;
    $('#ticks').innerHTML = ex._steps.filter(s => s.t > 0).map(s => `<i style="left:${(s.t / ex.dur * 100).toFixed(2)}%"></i>`).join('');
  }
  stageEl.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setPlaying(!state.playing); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); if (!stage || stage.multi) return;
      stage.view.az += e.key === 'ArrowLeft' ? 15 : -15; setViewButtons('free'); state.view = 'free';
    }
  });

  /* ---------- 토글 ---------- */
  function toggle(btn, key, after) {
    btn.addEventListener('click', () => { state[key] = !state[key]; btn.setAttribute('aria-pressed', String(state[key])); if (after) after(); });
  }
  toggle($('#tgGuide'), 'guides');
  toggle($('#tgMuscle'), 'muscles', updateMats);
  function setBad(v) {
    state.bad = !!v && !!state.ex.mistake;
    $('#tgBad').setAttribute('aria-pressed', String(state.bad));
    const d = $('#dBad'); if (d) d.setAttribute('aria-pressed', String(state.bad));
    $('#badwarn').hidden = !state.bad;
    updateMats();
  }
  $('#tgBad').addEventListener('click', () => setBad(!state.bad));
  const hint = $('#hint');
  function hideHint() { hint.hidden = true; }
  setTimeout(hideHint, 6000);

  /* ---------- 가이드선 해석 ---------- */
  const T = engineOK ? PL.THREE : null;
  const va = T && new T.Vector3(), vb = T && new T.Vector3(), vc = T && new T.Vector3(), vt = T && new T.Vector3();
  let labs = [], curKi = 0;
  const P_ = (name, S, o) => {
    const f = PL.pts[name]; if (f) return f(S, o);
    const m = /^(sh|wr|hip|kn|an|el)R$/.exec(name); if (m) return o.copy(S[m[1]][1]);
    return o.set(0, 0, 0);
  };
  function addLab(text, p, kind) { labs.push({ text, x: p.x, y: p.y, z: p.z, kind: kind || 'ok' }); }
  function guideFn(S, G, C) {
    labs = [];
    (state.ex.guides || []).forEach(g => {
      const k = g[0], opt = g[g.length - 1];
      if (opt && typeof opt === 'object' && !Array.isArray(opt) && opt.k && opt.k.indexOf(curKi) < 0) return;
      if (k === 'line') { P_(g[1], S, va); P_(g[2], S, vb); G.dash(va, vb, C[g[3]] || C.ok); if (g[4]) addLab(g[4], vc.lerpVectors(va, vb, .5)); }
      else if (k === 'vert') { P_(g[1], S, va); va.y = .004; vb.copy(va); vb.y = g[2]; G.dash(va, vb, C.ref); }
      else if (k === 'lean') {
        P_(g[1], S, va); P_(g[2], S, vb); vc.set(vb.x, vb.y, va.z);
        const d = vb.z - va.z; G.dash(vc, vb, C.ok, true);
        addLab(Math.abs(d) < .015 ? '어깨가 손목 바로 위' : `어깨가 손목보다 ${Math.round(Math.abs(d) * 100)}cm ${d > 0 ? '앞' : '뒤'}`, vt.lerpVectors(vc, vb, .5), 'ok');
      }
      else if (k === 'com') { G.marker(S.com, C.com); va.copy(S.com); vb.copy(S.com); vb.y = .004; G.dash(va, vb, C.ok); addLab('무게중심', va, 'ok'); }
      else if (k === 'angle') { P_(g[1], S, va); P_(g[2], S, vb); P_(g[3], S, vc); addLab(`${g[4]} ${Math.round(PL.angleAt(va, vb, vc))}°`, vb, 'ink'); }
      else if (k === 'level') {
        P_(g[1], S, va); P_(g[2], S, vb); vc.set(vb.x, va.y, vb.z); G.dash(va, vc, C.ref);
        const d = (vb.y - va.y) * 100, ok = Math.abs(d) < 6;
        addLab(Math.abs(d) < 3 ? '엉덩이 = 어깨 높이' : `엉덩이가 어깨보다 ${Math.round(Math.abs(d))}cm ${d > 0 ? '높음' : '낮음'}`, vc, ok ? 'ok' : 'warn');
      }
      else if (k === 'floor') { P_(g[1], S, va); P_(g[2], S, vb); va.y = vb.y = .006; G.dash(va, vb, C[g[3]] || C.ok, true); if (g[4]) addLab(g[4], vc.lerpVectors(va, vb, .5)); }
    });
  }
  const labLayer = $('#labels'), labEls = [];
  function placeLabels() {
    const n = (stage.multi || !state.guides) ? 0 : labs.length;
    while (labEls.length < n) { const s = document.createElement('span'); s.className = 'lbl'; labLayer.appendChild(s); labEls.push(s); }
    const boxes = [];
    for (let i = 0; i < labEls.length; i++) {
      const el = labEls[i];
      if (i >= n) { if (!el.hidden) el.hidden = true; continue; }
      const L = labs[i], pr = stage.project(vt.set(L.x, L.y, L.z));
      if (el.textContent !== L.text) el.textContent = L.text;
      if (el.dataset.k !== L.kind) el.dataset.k = L.kind;
      const w = el.offsetWidth || 120, h = 26;
      const sf = stage.safe || { t: 54, b: 70 };
      let x = Math.max(4 + w / 2, Math.min(stage.w - 4 - w / 2, pr.x)), y = Math.max(sf.t + h, Math.min(stage.h - sf.b - 4, pr.y - 10));
      for (let pass = 0; pass < 4; pass++) {
        const hit = boxes.find(b => Math.abs(b.x - x) < (b.w + w) / 2 + 4 && Math.abs(b.y - y) < h + 2);
        if (!hit) break; y = hit.y + h + 3;
      }
      boxes.push({ x, y, w });
      el.hidden = !pr.vis;
      el.style.transform = `translate(${Math.round(x - w / 2)}px,${Math.round(y - h)}px)`;
    }
  }

  /* ---------- 렌더 루프 ---------- */
  let visible = true, last = performance.now(), lastStep = '';
  if ('IntersectionObserver' in window) new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(stageEl);
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!stage || !state.ex || !state.ex._keys || !visible || document.hidden) return;
    const ex = state.ex;
    if (state.playing && !scrubbing) state.t = (state.t + dt * state.speed) % ex.dur;
    const P = PL.poseAt(ex, state.t, state.bad);
    const PG = state.bad ? PL.poseAt(ex, state.t, false) : null;
    curKi = P.ki;
    stage.render(dt, P, PG, state.guides && !stage.multi ? guideFn : null);
    if (!state.guides || stage.multi) labs = [];
    if (P.step !== lastStep) { stepEl.textContent = P.step || ''; lastStep = P.step; }
    if (!scrubbing) scrub.value = String(Math.round(state.t / ex.dur * 1000));
    placeLabels();
  }

  /* ---------- 로드맵 ---------- */
  const gantt = $('#gantt');
  const MAXM = 60;
  function renderGantt() {
    const ticks = [[0, '시작'], [6, '6개월'], [12, '1년'], [24, '2년'], [36, '3년'], [48, '4년'], [60, '5년+']];
    gantt.innerHTML = `<div class="axis" aria-hidden="true">${ticks.map(([m, l]) => `<span${m === 6 ? ' class="m6"' : ''} style="left:${m / MAXM * 100}%">${l}</span>`).join('')}</div>` +
      D.phases.map(p => {
        const l = p.m[0] / MAXM * 100, w = (p.m[1] - p.m[0]) / MAXM * 100;
        return `<div class="grow${p.id === state.phase ? ' cur' : ''}"><button class="gname" data-p="${p.id}">${pic(p.key)}<span><b>${esc(p.name)}</b><small>${esc(p.mlabel)}</small></span></button>` +
          `<div class="track"><span class="bar${p.id >= 3 ? ' fuzzy' : ''}" style="left:${l}%;width:${w}%"></span></div>` +
          `<p class="gexit"><span>${esc(p.goal)}</span> 승급 기준: <b>${esc(p.exit)}</b></p></div>`;
      }).join('');
  }
  gantt.addEventListener('click', (e) => { const b = e.target.closest('.gname'); if (b) { setPhase(+b.dataset.p, true); syncRoutinePhase(); scrollToStage(); } });

  /* ---------- 주간 루틴 ---------- */
  const rtPhase = $('#rtPhase');
  rtPhase.innerHTML = D.phases.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  let rtP = state.phase;
  function syncRoutinePhase() { rtP = state.phase; rtPhase.value = String(rtP); renderRoutine(); }
  rtPhase.addEventListener('change', () => { rtP = +rtPhase.value; renderRoutine(); });
  $('#rtDays').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.days = +b.dataset.d; store.set('days', state.days); renderRoutine();
  });
  function renderRoutine() {
    $$('#rtDays button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.d === state.days)));
    const wk = D.weeks[state.days], names = ['월', '화', '수', '목', '금', '토', '일'];
    $('#week').innerHTML = wk.map((s, i) => `<div class="day ${s === '쉼' ? '' : s}"><b>${s === '쉼' ? '–' : s}</b>${names[i]}</div>`).join('');
    const R = D.routine[rtP], two = state.days === 4;
    const sess = (key, title, note) => `<div class="sess ${key}"><h3><i>${key}</i>${esc(title)}</h3><p>${esc(note)}</p>` +
      '<div class="blks">' + R[key].map(b => `<div class="blk"><h4>${esc(b.k)}</h4>${b.items.map(([id, rx, n]) => `<button class="item" data-ex="${id}">${pic(id)}<span><b>${esc(EX[id].name)}</b>${n ? `<small>${esc(n)}</small>` : ''}</span><span class="rxv">${esc(rx)}</span></button>`).join('')}</div>`).join('') + '</div></div>';
    $('#sessions').className = 'sessions' + (two ? ' two' : '');
    $('#sessions').innerHTML = sess('A', two ? '플란체·밀기 집중' : '전신 세션', two ? '월·목. 스킬을 가장 먼저, 힘이 남아 있을 때.' : '월·수·금. 스킬을 가장 먼저, 힘이 남아 있을 때.') +
      (two ? sess('B', '당기기·코어 + 가벼운 스킬', '화·금. 손목과 어깨를 쉬게 하면서 균형을 맞춥니다.') : '');
  }
  $('#sessions').addEventListener('click', (e) => { const b = e.target.closest('.item'); if (b) { selectEx(b.dataset.ex); scrollToStage(); } });
  $('#principles').innerHTML = D.principles.map(([t, d]) => `<li><b>${esc(t)}</b>${esc(d)}</li>`).join('');

  /* ---------- 레벨 테스트 ---------- */
  const tform = $('#tform'), tres = $('#tres');
  const saved = store.get('test', null);
  tform.innerHTML = D.tests.map(t => `<div class="field"><label for="t_${t.id}">${esc(t.label)}</label><div class="in"><input id="t_${t.id}" name="${t.id}" type="number" inputmode="numeric" min="0" max="999" step="1" value="${saved && saved[t.id] != null ? +saved[t.id] : t.def}"><span class="u">${t.unit}</span></div>${t.note ? `<small>${esc(t.note)}</small>` : ''}</div>`).join('') +
    `<p class="note">처음 값은 예시입니다. 못 하는 동작은 0으로 두세요.</p>`;
  tform.addEventListener('submit', (e) => e.preventDefault());
  tform.addEventListener('input', runTest);
  let testPhase = 0;
  function runTest() {
    const v = {};
    D.tests.forEach(t => { const n = parseFloat($(`#t_${t.id}`).value); v[t.id] = isFinite(n) && n > 0 ? n : 0; });
    store.set('test', v);
    let ph = 0;
    while (ph < D.gates.length && D.gates[ph].every(([k, need]) => v[k] >= need)) ph++;
    testPhase = ph;
    const P = D.phases[ph], gate = D.gates[ph];
    const label = (k) => D.tests.find(t => t.id === k);
    tres.innerHTML = `<p class="lab">지금 시작할 단계</p><p class="big">${esc(P.name)}</p><p>${esc(P.goal)}</p>` +
      (gate ? `<div class="meters">${gate.map(([k, need]) => {
        const t = label(k), have = v[k], pct = Math.min(100, have / need * 100);
        return `<div class="meter${have >= need ? ' done' : ''}"><div class="mrow"><b>${esc(t.label)}</b><span class="mval">${have} / ${need}${t.unit}</span></div><div class="mbar"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;
      }).join('')}</div><p class="lab" style="margin-bottom:14px">위 기준을 모두 채우면 ${esc(D.phases[ph + 1].name)} 단계로 넘어갑니다.</p>`
        : `<p class="lab" style="margin:14px 0">모든 기준을 채웠습니다. 풀 플란체 홀드 시간을 늘려 가세요.</p>`) +
      `<button class="go" id="goPhase">${esc(P.name)} 단계 운동 보기</button>`;
  }
  tres.addEventListener('click', (e) => { if (e.target.closest('#goPhase')) { setPhase(testPhase, true); syncRoutinePhase(); scrollToStage(); } });

  /* ---------- 안전·출처 ---------- */
  $('#safety').innerHTML = D.safety.map(s => `<li>${esc(s)}</li>`).join('');
  $('#sources').innerHTML = D.sources.map(([t, u, n]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a><span>${esc(n)}</span></li>`).join('');

  function scrollToStage() { const top = $('#viewer').getBoundingClientRect().top + window.scrollY - 4; window.scrollTo({ top, behavior: 'smooth' }); }

  /* ---------- 시작 ---------- */
  function fromHash() { const id = (location.hash || '').slice(1); return EX[id] ? id : null; }
  window.addEventListener('hashchange', () => { const id = fromHash(); if (id && (!state.ex || id !== state.ex.id)) selectEx(id); });
  setPlaying(state.playing);
  const startId = fromHash();
  if (startId) { state.phase = EX[startId].phase; }
  $$('.rung', ladder).forEach(b => b.setAttribute('aria-selected', String(+b.dataset.p === state.phase)));
  renderGantt();
  selectEx(startId || D.phases[state.phase].key, true);
  syncRoutinePhase(); renderRoutine(); runTest();
  requestAnimationFrame(loop);

  // 테스트·캡처용 훅
  window.PLAPP = { state, selectEx, applyView, setBad, setPlaying, setPhase, stage: () => stage, seek: (t) => { state.t = t; } };
})();

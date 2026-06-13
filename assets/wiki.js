/* ============================================================
   wiki.js (OODP) — 전역 사이드바 + On-this-page TOC + 테마 + 모바일
   각 페이지 본문은 그대로, 내비/헤더 크롬만 주입한다.
   ============================================================ */
(function () {
  const GROUPS = [
    { g: 'Ch 1 · 설계 패턴의 토대', dir: 'ch01-foundations', items: [
      { f: 'index.html', t: '챕터 개요' },
      { f: '01.html', t: '패턴이란 + GoF 3분류' },
      { f: '02.html', t: '두 설계 원칙' } ] },
    { g: 'Ch 2 · 생성 패턴', dir: 'ch02-creational', items: [
      { f: 'index.html', t: '챕터 개요' },
      { f: '01.html', t: '싱글톤' },
      { f: '02.html', t: '팩토리 메서드' },
      { f: '03.html', t: '추상 팩토리' } ] },
    { g: 'Ch 3 · 구조 패턴', dir: 'ch03-structural', items: [
      { f: 'index.html', t: '챕터 개요' },
      { f: '01.html', t: '어댑터' },
      { f: '02.html', t: '데커레이터' },
      { f: '03.html', t: '컴포지트' } ] },
    { g: 'Ch 4 · 행위 패턴', dir: 'ch04-behavioral', items: [
      { f: 'index.html', t: '챕터 개요' },
      { f: '01.html', t: '스트래티지' },
      { f: '02.html', t: '스테이트' },
      { f: '03.html', t: '커맨드' },
      { f: '04.html', t: '옵서버' },
      { f: '05.html', t: '템플릿 메서드' },
      { f: '06.html', t: '이터레이터' } ] },
    { g: 'Ch 5 · 시스템 · 객체 설계', dir: 'ch05-system-object-design', items: [
      { f: 'index.html', t: '챕터 개요' },
      { f: '01.html', t: '시스템 설계' },
      { f: '02.html', t: '객체 설계' } ] },
    { g: 'Ch 6 · 패턴 선택 · 비교', dir: 'ch06-decision', items: [
      { f: 'index.html', t: '챕터 개요' },
      { f: '01.html', t: '패턴 선택 의사결정' },
      { f: '02.html', t: '헷갈리는 6쌍' } ] },
    { g: 'Problem Set · 백지 테스트', dir: 'problem-set', items: [
      { f: 'index.html', t: '개요' },
      { f: 'recall.html', t: 'A · 패턴 백지작성' },
      { f: 'scenarios.html', t: 'B · 시나리오→패턴' },
      { f: 'uml.html', t: 'C · UML 손그림' },
      { f: 'compare.html', t: 'D · 비교 빈칸' },
      { f: 'essay.html', t: '서술형 답안 연습' } ] },
  ];
  const DIRS = GROUPS.map(g => g.dir);

  const path = location.pathname;
  let curDir = '', curFile = '', base = './';
  for (const d of DIRS) {
    const i = path.indexOf('/' + d + '/');
    if (i >= 0) { curDir = d; base = '../'; curFile = path.slice(i + d.length + 2); break; }
  }
  if (!curFile || curFile === '') curFile = curDir ? (path.endsWith('/') ? 'index.html' : path.split('/').pop()) : '';
  if (curDir && (curFile === '' || curFile.indexOf('.') < 0)) curFile = 'index.html';

  function run() {
    // 테마
    const saved = (function () { try { return localStorage.getItem('wk-theme'); } catch (e) { return null; } })();
    const sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (sysDark ? 'dark' : 'light'), false);

    // 헤더
    let topbar = document.querySelector('.topbar');
    if (!topbar) { topbar = document.createElement('div'); topbar.className = 'topbar'; document.body.insertBefore(topbar, document.body.firstChild); }
    const homeEl = topbar.querySelector('.home');
    const miniEl = topbar.querySelector('.ch-mini');
    topbar.innerHTML = '';
    const menuBtn = el('button', 'wk-btn wk-menu', '☰');
    menuBtn.setAttribute('aria-label', '메뉴');
    menuBtn.addEventListener('click', () => document.documentElement.classList.toggle('wk-open'));
    const brand = document.createElement('a');
    brand.className = 'wk-brand'; brand.href = base + 'index.html';
    brand.innerHTML = '<span class="dot"></span>OODP 디자인 패턴';
    const spacer = el('div', 'wk-spacer', '');
    const themeBtn = el('button', 'wk-btn wk-theme', themeIcon());
    themeBtn.setAttribute('aria-label', '테마 전환');
    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(next, true); themeBtn.innerHTML = themeIcon();
    });
    topbar.appendChild(menuBtn);
    topbar.appendChild(brand);
    topbar.appendChild(spacer);
    if (homeEl) { homeEl.textContent = '← 전체 목록'; homeEl.setAttribute('href', base + 'index.html'); topbar.appendChild(homeEl); }
    if (miniEl) topbar.appendChild(miniEl);
    topbar.appendChild(themeBtn);

    // 진행 바
    let prog = document.querySelector('.scroll-progress');
    if (!prog) { prog = document.createElement('div'); prog.className = 'scroll-progress'; document.body.insertBefore(prog, document.body.firstChild); }
    Object.assign(prog.style, { position: 'fixed', top: '0', left: '0', width: '0', zIndex: '100' });

    // 좌측 전역 사이드바
    const nav = document.querySelector('.ch-nav');
    const layout = document.querySelector('.ch-layout');
    if (nav) {
      const html = ['<a class="wk-home" href="' + base + 'index.html">⌂ 전체 목록</a>'];
      GROUPS.forEach(grp => {
        html.push('<div class="wk-side-group"><span class="gh">' + grp.g + '</span><ul>' +
          grp.items.map(it => {
            const cur = (grp.dir === curDir && it.f === curFile) ? ' class="wk-current"' : '';
            return '<li><a' + cur + ' href="' + base + grp.dir + '/' + it.f + '">' + it.t + '</a></li>';
          }).join('') + '</ul></div>');
      });
      const inner = nav.querySelector('nav') || nav;
      inner.innerHTML = html.join('');
      nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => document.documentElement.classList.remove('wk-open')));
      // 현재 항목으로 스크롤
      const curA = nav.querySelector('a.wk-current');
      if (curA) curA.scrollIntoView({ block: 'center' });
    }

    // 우측 On this page — 본문 h2 기반
    const main = document.querySelector('.ch-main');
    const heads = main ? [...main.querySelectorAll('h2')].filter(h => h.textContent.trim()) : [];
    heads.forEach((h, i) => { if (!h.id) h.id = 'sec-' + i; });
    if (layout && heads.length >= 2) {
      const toc = document.createElement('aside');
      toc.className = 'wk-toc';
      toc.innerHTML = '<div class="th">On this page</div><ul>' +
        heads.map(h => '<li><a href="#' + h.id + '">' + h.textContent.trim() + '</a></li>').join('') + '</ul>';
      layout.appendChild(toc);
      const links = [...toc.querySelectorAll('a')];
      const map = {}; links.forEach(a => map[a.getAttribute('href').slice(1)] = a);
      const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            links.forEach(a => a.classList.remove('wk-active'));
            const a = map[e.target.id]; if (a) a.classList.add('wk-active');
          }
        });
      }, { rootMargin: '-10% 0px -75% 0px', threshold: 0 });
      heads.forEach(h => obs.observe(h));
    }

    // 진행 바 갱신
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      prog.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    document.addEventListener('click', e => {
      if (document.documentElement.classList.contains('wk-open') &&
          !e.target.closest('.ch-nav') && !e.target.closest('.wk-menu')) {
        document.documentElement.classList.remove('wk-open');
      }
    });

    buildFoot();
    setupLightbox();
  }

  // ----- 하단 전역 네비게이터 (전체 순서 기준 prev/next) -----
  function buildFoot() {
    if (!curDir) return;
    const FLAT = [];
    GROUPS.forEach(g => g.items.forEach(it => FLAT.push({ dir: g.dir, f: it.f, t: it.t })));
    const idx = FLAT.findIndex(x => x.dir === curDir && x.f === curFile);
    if (idx < 0) return;
    const prev = idx > 0 ? FLAT[idx - 1] : null;
    const next = idx < FLAT.length - 1 ? FLAT[idx + 1] : null;
    let foot = document.querySelector('.ch-foot');
    const main = document.querySelector('.ch-main');
    if (!foot) { foot = document.createElement('nav'); foot.className = 'ch-foot'; if (main) main.appendChild(foot); }
    const link = (it, cls, dir) => it
      ? '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + base + it.dir + '/' + it.f + '"><div class="dir">' + dir + '</div><div class="ti">' + it.t + '</div></a>'
      : '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + base + 'index.html"><div class="dir">' + dir + '</div><div class="ti">전체 목록</div></a>';
    foot.innerHTML = link(prev, '', '← 이전') + link(next, 'next', '다음 →');
  }

  // ----- Mermaid: 클릭 확대(줌/팬) + 16:9 PNG 저장 -----
  function setupLightbox() {
    const ov = document.createElement('div');
    ov.className = 'wk-lightbox';
    ov.innerHTML =
      '<div class="wk-lb-bar"><span class="wk-lb-hint">스크롤 = 확대/축소 · 드래그 = 이동 · ESC = 닫기</span><span class="wk-lb-sp"></span>' +
      '<button class="wk-btn wk-lb-png">⬇︎ 16:9 PNG 저장</button>' +
      '<button class="wk-btn wk-lb-zout">－</button><button class="wk-btn wk-lb-zin">＋</button>' +
      '<button class="wk-btn wk-lb-close">✕ 닫기</button></div>' +
      '<div class="wk-lb-stage"><div class="wk-lb-canvas"></div></div>';
    document.body.appendChild(ov);
    const stage = ov.querySelector('.wk-lb-stage');
    const cv = ov.querySelector('.wk-lb-canvas');
    let scale = 1, tx = 0, ty = 0, cur = null;
    const apply = () => { cv.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; };
    const open = svg => {
      cv.innerHTML = '';
      const c = svg.cloneNode(true);
      const vb = c.viewBox && c.viewBox.baseVal;
      const r = svg.getBoundingClientRect();
      const vw = (vb && vb.width) || r.width || 800;
      const vh = (vb && vb.height) || r.height || 600;
      c.removeAttribute('style');
      c.setAttribute('width', vw); c.setAttribute('height', vh);
      c.style.width = vw + 'px'; c.style.height = vh + 'px'; c.style.maxWidth = 'none';
      cv.appendChild(c); cur = c;
      const sw = stage.clientWidth || window.innerWidth;
      const sh = stage.clientHeight || (window.innerHeight - 60);
      scale = Math.min((sw * 0.88) / vw, (sh * 0.88) / vh);
      if (!isFinite(scale) || scale <= 0) scale = 1;
      tx = 0; ty = 0; apply();
      ov.classList.add('on'); document.documentElement.style.overflow = 'hidden';
    };
    const close = () => { ov.classList.remove('on'); document.documentElement.style.overflow = ''; };
    ov.querySelector('.wk-lb-close').addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov || e.target === stage) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    ov.querySelector('.wk-lb-zin').addEventListener('click', () => { scale = Math.min(8, scale * 1.25); apply(); });
    ov.querySelector('.wk-lb-zout').addEventListener('click', () => { scale = Math.max(0.2, scale / 1.25); apply(); });
    stage.addEventListener('wheel', e => { e.preventDefault(); scale = Math.min(8, Math.max(0.2, scale * (e.deltaY < 0 ? 1.1 : 0.9))); apply(); }, { passive: false });
    let drag = false, sx = 0, sy = 0;
    stage.addEventListener('pointerdown', e => { drag = true; sx = e.clientX - tx; sy = e.clientY - ty; });
    window.addEventListener('pointermove', e => { if (!drag) return; tx = e.clientX - sx; ty = e.clientY - sy; apply(); });
    window.addEventListener('pointerup', () => { drag = false; });
    ov.querySelector('.wk-lb-png').addEventListener('click', () => { if (cur) svgToPng(cur); });
    document.addEventListener('click', e => {
      if (e.target.closest && e.target.closest('.wk-lightbox')) return;
      const box = e.target.closest && e.target.closest('pre.mermaid, .mermaid');
      if (box) { const svg = box.querySelector('svg'); if (svg) open(svg); }
    });
  }

  // SVG → 16:9 PNG (흰 배경, 중앙 맞춤)
  function svgToPng(svg) {
    let w = (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) || svg.getBoundingClientRect().width || 1200;
    let h = (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.height) || svg.getBoundingClientRect().height || 675;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', w); clone.setAttribute('height', h);
    const data = new XMLSerializer().serializeToString(clone);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
    const img = new Image();
    img.onload = () => {
      const W = 1920, H = 1080;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      const s = Math.min(W * 0.92 / w, H * 0.92 / h);
      const dw = w * s, dh = h * s;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      try {
        c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'diagram-16x9.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); }, 'image/png');
      } catch (e) { alert('PNG 저장 실패: ' + e.message); }
    };
    img.onerror = () => alert('PNG 변환 실패 — 다이어그램 라벨 형식 문제일 수 있음');
    img.src = url;
  }

  function setTheme(t, persist) {
    document.documentElement.setAttribute('data-theme', t);
    if (persist) { try { localStorage.setItem('wk-theme', t); } catch (e) {} }
  }
  function themeIcon() { return document.documentElement.getAttribute('data-theme') === 'dark' ? '☀︎' : '☾'; }
  function el(tag, cls, html) { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; return e; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();

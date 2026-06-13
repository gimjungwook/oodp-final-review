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

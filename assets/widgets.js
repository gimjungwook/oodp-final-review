/* ============================================================
   Neural Style Transfer 해설 — 공유 인터랙티브 위젯
   전역 THREE(r128, classic build) 사용 → file:// 더블클릭 호환
   ============================================================ */
(function () {
  'use strict';
  const NST = (window.NST = window.NST || {});

  // CSS 변수에서 의미색 읽기
  const css = getComputedStyle(document.documentElement);
  const C = {
    paper:     css.getPropertyValue('--paper').trim() || '#FAF7F0',
    ink:       css.getPropertyValue('--ink').trim() || '#26221C',
    structure: css.getPropertyValue('--structure').trim() || '#2D5B7A',
    style:     css.getPropertyValue('--style').trim() || '#C0492E',
    synth:     css.getPropertyValue('--synth').trim() || '#A47B2E',
  };
  NST.colors = C;

  function hexToRgb(h) {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function easeInOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* ---------- 프레임워크: 수식 렌더 + 스크롤 진행 + nav ---------- */
  NST.renderMath = function () {
    if (window.renderMathInElement) {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
      });
    }
  };

  // 챕터 목록 (전 페이지 공유)
  NST.CHAPTERS = [
    { no: '01', t: '이미지란 무엇인가', f: '01.html' },
    { no: '02', t: 'CNN의 계층적 표현', f: '02.html' },
    { no: '03', t: '콘텐츠 손실', f: '03.html' },
    { no: '04', t: '스타일 표현 — Gram 행렬', f: '04.html' },
    { no: '05', t: '스타일 손실과 전체 손실', f: '05.html' },
    { no: '06', t: '최적화와 구현 선택', f: '06.html' },
    { no: '07', t: '한계 · 현대 비교 · 발표', f: '07.html' },
  ];

  // 챕터 nav + topbar + prev/next 자동 생성
  NST.buildNav = function (currentNo) {
    const cur = NST.CHAPTERS.find(c => c.no === currentNo);
    // topbar
    const tb = document.querySelector('.topbar');
    if (tb) tb.innerHTML =
      `<a class="home" href="index.html">← 신경 스타일 전이 해설</a>` +
      `<span class="ch-mini">CHAPTER ${currentNo} / 07</span>`;
    // 좌측 목차
    const ol = document.querySelector('.ch-nav ol');
    if (ol) ol.innerHTML = NST.CHAPTERS.map(c =>
      `<li><a href="${c.f}" ${c.no === currentNo ? 'class="current"' : ''}>${c.t}</a></li>`).join('');
    // prev/next
    const foot = document.querySelector('.ch-foot');
    if (foot) {
      const i = NST.CHAPTERS.indexOf(cur);
      const prev = i > 0 ? NST.CHAPTERS[i - 1] : { f: 'index.html', t: '표지로', no: '' };
      const next = i < NST.CHAPTERS.length - 1 ? NST.CHAPTERS[i + 1] : { f: 'index.html', t: '표지로', no: '' };
      foot.innerHTML =
        `<a href="${prev.f}"><div class="dir">← 이전</div><div class="ti">${prev.t}</div></a>` +
        `<a href="${next.f}" class="next"><div class="dir">다음 →</div><div class="ti">${next.t}</div></a>`;
    }
  };

  NST.initChrome = function () {
    const bar = document.querySelector('.scroll-progress');
    if (bar) {
      const onScroll = () => {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
      };
      document.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    // 현재 챕터 nav 표시
    const here = (location.pathname.split('/').pop() || 'index.html');
    document.querySelectorAll('.ch-nav a').forEach(a => {
      if (a.getAttribute('href') === here) a.classList.add('current');
    });
  };

  // IntersectionObserver로 위젯 첫 진입 시 init (성능)
  NST.onVisible = function (el, fn) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach(e => { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { rootMargin: '120px' });
    io.observe(el);
  };

  /* ============================================================
     HERO — 입자 모핑: 정돈된 콘텐츠 격자 ↔ 소용돌이치는 스타일 구름
     (WebGL ShaderMaterial, 마우스 반발)
     ============================================================ */
  NST.hero = function (canvas, opts) {
    opts = opts || {};
    if (!window.THREE) { console.warn('THREE 없음'); return; }
    const THREE = window.THREE;
    const wrap = canvas.parentElement;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(0, 0, 3.0);

    // ----- 입자 위치 생성 -----
    const COLS = 110, ROWS = 64;
    const N = COLS * ROWS;
    const content = new Float32Array(N * 3);
    const style = new Float32Array(N * 3);
    const rnd = new Float32Array(N);
    const W = 3.4, H = 2.0;

    // 스타일 타깃: 다중 소용돌이(Starry Night) + 층상 노이즈 z
    const vort = [
      { x: -0.9, y: 0.3, s: 2.4 }, { x: 0.8, y: -0.2, s: -2.0 },
      { x: 0.2, y: 0.7, s: 1.6 }, { x: -0.3, y: -0.6, s: -1.8 },
    ];
    function pseudoNoise(x, y) {
      return Math.sin(x * 2.1 + y * 1.3) * 0.5 + Math.sin(x * 0.7 - y * 2.6) * 0.3 + Math.sin(x * 3.7 + y * 0.4) * 0.2;
    }
    let p = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++, p++) {
        const cx = (c / (COLS - 1) - 0.5) * W;
        const cy = (r / (ROWS - 1) - 0.5) * H;
        // 콘텐츠: 정돈된 평면 격자 + 미세 물결
        content[p * 3] = cx;
        content[p * 3 + 1] = cy;
        content[p * 3 + 2] = Math.sin(cx * 1.6) * Math.cos(cy * 1.6) * 0.05;
        // 스타일: 소용돌이 변형
        let sx = cx, sy = cy;
        for (const v of vort) {
          const dx = cx - v.x, dy = cy - v.y;
          const d2 = dx * dx + dy * dy;
          const ang = (v.s * 0.5) * Math.exp(-d2 * 1.1);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const nx = v.x + dx * ca - dy * sa;
          const ny = v.y + dx * sa + dy * ca;
          sx += (nx - cx); sy += (ny - cy);
        }
        const nz = pseudoNoise(cx, cy);
        style[p * 3] = sx + nz * 0.06;
        style[p * 3 + 1] = sy + pseudoNoise(cy, cx) * 0.06;
        style[p * 3 + 2] = nz * 0.55;
        rnd[p] = Math.random();
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('aContent', new THREE.BufferAttribute(content, 3));
    geo.setAttribute('aStyle', new THREE.BufferAttribute(style, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
    geo.setAttribute('position', new THREE.BufferAttribute(content.slice(), 3));

    const uniforms = {
      uMix: { value: 0 },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(99, 99) },
      uColA: { value: new THREE.Color(C.structure) },
      uColB: { value: new THREE.Color(C.style) },
      uSize: { value: 8.5 * Math.min(devicePixelRatio, 2) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute vec3 aContent; attribute vec3 aStyle; attribute float aRand;
        uniform float uMix, uTime, uSize; uniform vec2 uMouse;
        varying float vM; varying float vA;
        void main(){
          float m = clamp(uMix + (aRand-0.5)*0.35, 0.0, 1.0);
          m = m*m*(3.0-2.0*m);
          vM = m;
          vec3 pos = mix(aContent, aStyle, m);
          // 스타일 상태에서 천천히 회전하는 호흡
          float sw = m * 0.12;
          float a = uTime*0.25 + aRand*6.28;
          pos.xy += vec2(cos(a), sin(a)) * sw * 0.08;
          // 마우스 반발
          vec2 d = pos.xy - uMouse;
          float dist = length(d);
          float push = smoothstep(0.55, 0.0, dist) * 0.45;
          pos.xy += normalize(d + 0.0001) * push;
          vA = 0.55 + 0.45*(1.0-m) + push*0.6;
          vec4 mv = modelViewMatrix * vec4(pos,1.0);
          gl_PointSize = uSize * (1.0 / -mv.z) * (0.8 + m*0.5);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        precision mediump float;
        uniform vec3 uColA, uColB; varying float vM; varying float vA;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float alpha = smoothstep(0.5, 0.12, d) * vA;
          vec3 col = mix(uColA, uColB, vM);
          gl_FragColor = vec4(col, alpha);
        }`,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // ----- 마우스 -----
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const mNDC = new THREE.Vector2(99, 99);
    let targetMouse = new THREE.Vector3(99, 99, 0);
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mNDC.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mNDC.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(mNDC, cam);
      ray.ray.intersectPlane(plane, targetMouse);
    });
    canvas.addEventListener('pointerleave', () => { targetMouse.set(99, 99, 0); });

    function resize() {
      const w = wrap.clientWidth, h = opts.height || Math.round(w * 0.46);
      renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize); resize();

    let raf, t0 = performance.now();
    function frame(now) {
      const t = (now - t0) / 1000;
      uniforms.uTime.value = t;
      // 자동 진동 0→1→0 (느리게)
      uniforms.uMix.value = 0.5 - 0.5 * Math.cos(t * 0.32);
      uniforms.uMouse.value.x = lerp(uniforms.uMouse.value.x, targetMouse.x, 0.12);
      uniforms.uMouse.value.y = lerp(uniforms.uMouse.value.y, targetMouse.y, 0.12);
      points.rotation.y = Math.sin(t * 0.18) * 0.12;
      points.rotation.x = Math.sin(t * 0.13) * 0.05;
      renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // 녹화/정리 훅
    return { stop() { cancelAnimationFrame(raf); }, uniforms };
  };

  /* ============================================================
     GRAM MATRIX — 필터 상관관계 인터랙티브 히트맵
     핵심 직관: 공간 위치를 섞어도 Gram은 (거의) 그대로 → 위치 버림
     ============================================================ */
  NST.gram = function (root) {
    const K = 6;            // 필터 수
    const G = 8;            // 공간 격자 (8x8 = 64 위치)
    const M = G * G;
    // 필터별 기저 패턴(서로 구조적으로 상관되게 설계)
    const protos = [
      (x, y) => Math.sin(x * 1.1),                       // 세로 줄무늬
      (x, y) => Math.sin(x * 1.1 + 0.6),                 // 세로 줄무늬(위상 이동) → 0번과 강상관
      (x, y) => Math.sin(y * 1.1),                       // 가로 줄무늬
      (x, y) => Math.sin((x + y) * 0.9),                 // 대각
      (x, y) => Math.cos(Math.hypot(x - 3.5, y - 3.5) * 1.0), // 동심원
      (x, y) => (Math.sin(x * 1.1) + Math.sin(y * 1.1)) * 0.5, // 0,2번과 부분 상관
    ];
    let perm = [...Array(M).keys()];   // 공간 위치 순열
    let scramble = 0;                  // 0 = 원본, 1 = 완전 셔플

    function buildF() {
      // F[k][m] : 필터 k, 위치 m 반응 (ReLU)
      const F = [];
      for (let k = 0; k < K; k++) {
        const row = new Float32Array(M);
        for (let m = 0; m < M; m++) {
          const x = m % G, y = (m / G) | 0;
          row[m] = Math.max(0, protos[k](x, y));
        }
        F.push(row);
      }
      return F;
    }
    const Fbase = buildF();

    function permutedF() {
      // scramble 비율만큼 위치를 순열로 섞음 (모든 필터 동일 순열)
      const F = [];
      for (let k = 0; k < K; k++) {
        const row = new Float32Array(M);
        for (let m = 0; m < M; m++) {
          row[m] = Fbase[k][scramble > 0 ? perm[m] : m];
        }
        F.push(row);
      }
      return F;
    }
    function gramOf(F) {
      const Gm = [];
      let mx = 0;
      for (let i = 0; i < K; i++) {
        Gm.push(new Float32Array(K));
        for (let j = 0; j < K; j++) {
          let s = 0; for (let m = 0; m < M; m++) s += F[i][m] * F[j][m];
          Gm[i][j] = s; if (s > mx) mx = s;
        }
      }
      return { Gm, mx };
    }

    // ----- DOM -----
    root.innerHTML = `
      <div class="gram-stage">
        <div class="gram-maps"></div>
        <div class="gram-mid">→</div>
        <div class="gram-mat"></div>
      </div>
      <div class="gram-read"></div>`;
    const mapsEl = root.querySelector('.gram-maps');
    const matEl = root.querySelector('.gram-mat');
    const readEl = root.querySelector('.gram-read');

    // feature map 캔버스들
    const mapCanvases = [];
    for (let k = 0; k < K; k++) {
      const d = document.createElement('div'); d.className = 'gmap';
      const cv = document.createElement('canvas'); cv.width = cv.height = 96;
      const lab = document.createElement('span'); lab.textContent = 'F' + (k + 1);
      d.appendChild(cv); d.appendChild(lab); mapsEl.appendChild(d);
      mapCanvases.push({ cv, ctx: cv.getContext('2d'), el: d });
    }
    // Gram 매트릭스 캔버스
    const matCv = document.createElement('canvas'); matCv.width = matCv.height = 240;
    matEl.appendChild(matCv);
    const mctx = matCv.getContext('2d');

    let hovered = null; // [i,j]

    function rampStyle(t) { // paper → style 색 램프
      const a = hexToRgb(C.paper), b = hexToRgb(C.style);
      return `rgb(${(lerp(a[0], b[0], t) * 255) | 0},${(lerp(a[1], b[1], t) * 255) | 0},${(lerp(a[2], b[2], t) * 255) | 0})`;
    }
    function rampMag(t) { // 흰→잉크 (feature map)
      const v = (lerp(245, 38, t)) | 0; return `rgb(${v},${(lerp(243, 34, t)) | 0},${(lerp(236, 28, t)) | 0})`;
    }

    function drawMap(k, F) {
      const { ctx } = mapCanvases[k]; const cell = 96 / G;
      let mx = 0; for (let m = 0; m < M; m++) mx = Math.max(mx, F[k][m]);
      for (let m = 0; m < M; m++) {
        const x = m % G, y = (m / G) | 0;
        ctx.fillStyle = rampMag(mx ? F[k][m] / mx : 0);
        ctx.fillRect(x * cell, y * cell, cell + .5, cell + .5);
      }
      const hot = hovered && (hovered[0] === k || hovered[1] === k);
      mapCanvases[k].el.classList.toggle('hot', !!hot);
    }
    function drawMat(Gm, mx) {
      const cell = 240 / K;
      for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) {
        mctx.fillStyle = rampStyle(mx ? Gm[i][j] / mx : 0);
        mctx.fillRect(j * cell, i * cell, cell, cell);
        if (hovered && hovered[0] === i && hovered[1] === j) {
          mctx.strokeStyle = C.ink; mctx.lineWidth = 2.5;
          mctx.strokeRect(j * cell + 1.2, i * cell + 1.2, cell - 2.4, cell - 2.4);
        }
      }
      mctx.strokeStyle = 'rgba(38,34,28,.12)'; mctx.lineWidth = 1;
      for (let i = 0; i <= K; i++) { mctx.beginPath(); mctx.moveTo(i * cell, 0); mctx.lineTo(i * cell, 240); mctx.moveTo(0, i * cell); mctx.lineTo(240, i * cell); mctx.stroke(); }
    }

    function redraw() {
      const F = permutedF();
      const { Gm, mx } = gramOf(F);
      for (let k = 0; k < K; k++) drawMap(k, F);
      drawMat(Gm, mx);
      if (hovered) {
        const [i, j] = hovered;
        const corr = Gm[i][j] / Math.sqrt(Gm[i][i] * Gm[j][j] || 1);
        readEl.innerHTML = `<b>G<sub>${i + 1},${j + 1}</sub></b> — 필터 <b style="color:${C.style}">F${i + 1}</b>와 <b style="color:${C.style}">F${j + 1}</b>가 같은 위치에서 함께 반응한 정도. 정규화 상관 ≈ <b>${corr.toFixed(2)}</b> ${corr > 0.8 ? '(강하게 동시 출현)' : corr > 0.4 ? '(부분 상관)' : '(거의 독립)'}`;
      } else {
        readEl.innerHTML = `Gram 행렬의 한 칸 위에 마우스를 올리면, 그 칸이 어떤 두 필터의 <b>동시 출현</b>을 재는지 보입니다.`;
      }
    }

    // 호버 히트테스트
    matCv.addEventListener('pointermove', (e) => {
      const r = matCv.getBoundingClientRect();
      const j = clamp(((e.clientX - r.left) / r.width * K) | 0, 0, K - 1);
      const i = clamp(((e.clientY - r.top) / r.height * K) | 0, 0, K - 1);
      hovered = [i, j]; redraw();
    });
    matCv.addEventListener('pointerleave', () => { hovered = null; redraw(); });

    // 컨트롤: 공간 셔플 슬라이더 + 리셋
    const ctr = document.createElement('div'); ctr.className = 'widget-controls';
    ctr.innerHTML = `
      <div class="slider">
        <label>공간 위치 섞기 <b class="sval">0%</b></label>
        <input type="range" class="s-style" min="0" max="100" value="0">
      </div>
      <button class="btn ghost reshuffle">새 순열 ↻</button>
      <div class="legend"><span><i style="background:linear-gradient(90deg,var(--paper),var(--style))"></i>동시 반응 약 → 강</span></div>`;
    root.appendChild(ctr);
    const slider = ctr.querySelector('input');
    const sval = ctr.querySelector('.sval');

    function randPerm() {
      const a = [...Array(M).keys()];
      for (let m = M - 1; m > 0; m--) { const n = (Math.random() * (m + 1)) | 0;[a[m], a[n]] = [a[n], a[m]]; }
      return a;
    }
    let fullPerm = randPerm();
    function applyScramble() {
      // scramble 비율만큼만 위치 교체 (0→identity, 1→fullPerm)
      const id = [...Array(M).keys()];
      const cnt = Math.round(scramble * M);
      perm = id.slice();
      for (let m = 0; m < cnt; m++) perm[m] = fullPerm[m];
      redraw();
    }
    slider.addEventListener('input', () => {
      scramble = slider.value / 100; sval.textContent = slider.value + '%'; applyScramble();
    });
    ctr.querySelector('.reshuffle').addEventListener('click', () => { fullPerm = randPerm(); applyScramble(); });

    redraw();
  };

  /* ---------- 공용: 합성 풍경 그리기 (컨볼루션·재구성·최적화 입력) ---------- */
  function drawScene(ctx, w, h) {
    // 하늘
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#cfe0ea'); sky.addColorStop(1, '#eef1ea');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    // 해
    ctx.fillStyle = '#e8c66a';
    ctx.beginPath(); ctx.arc(w * 0.8, h * 0.22, h * 0.12, 0, 7); ctx.fill();
    // 땅
    ctx.fillStyle = '#7e8b5c'; ctx.fillRect(0, h * 0.68, w, h * 0.32);
    // 집 몸체
    ctx.fillStyle = '#c98b6b'; ctx.fillRect(w * 0.16, h * 0.46, w * 0.3, h * 0.26);
    // 지붕
    ctx.fillStyle = '#7a4a3a'; ctx.beginPath();
    ctx.moveTo(w * 0.13, h * 0.46); ctx.lineTo(w * 0.31, h * 0.30); ctx.lineTo(w * 0.49, h * 0.46); ctx.closePath(); ctx.fill();
    // 창문
    ctx.fillStyle = '#3b4a55'; ctx.fillRect(w * 0.24, h * 0.53, w * 0.07, h * 0.08);
    // 나무
    ctx.fillStyle = '#5a3d2b'; ctx.fillRect(w * 0.66, h * 0.5, w * 0.03, h * 0.2);
    ctx.fillStyle = '#557040'; ctx.beginPath(); ctx.arc(w * 0.675, h * 0.46, h * 0.11, 0, 7); ctx.fill();
  }
  function lumFrom(ctx, w, h) {
    const d = ctx.getImageData(0, 0, w, h).data;
    const L = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) L[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    return L;
  }

  /* ============================================================
     CH01 — 픽셀 ↔ 텐서: hover RGB + 채널 분해
     ============================================================ */
  NST.pixelTensor = function (root) {
    const W = 44, H = 30, S = 12; // 논리 픽셀, 표시 배율
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const octx = off.getContext('2d'); drawScene(octx, W, H);
    const img = octx.getImageData(0, 0, W, H).data;

    root.innerHTML = `
      <div class="px-stage">
        <canvas class="px-main" width="${W * S}" height="${H * S}"></canvas>
        <div class="px-read"><div class="px-swatch"></div><div class="px-vals">픽셀 위에<br>마우스를 올리세요</div></div>
      </div>
      <div class="px-channels" hidden>
        <div class="px-ch"><canvas width="${W * 5}" height="${H * 5}" data-c="0"></canvas><span style="color:#b23">R</span></div>
        <div class="px-ch"><canvas width="${W * 5}" height="${H * 5}" data-c="1"></canvas><span style="color:#2a2">G</span></div>
        <div class="px-ch"><canvas width="${W * 5}" height="${H * 5}" data-c="2"></canvas><span style="color:#36b">B</span></div>
      </div>`;
    const main = root.querySelector('.px-main'), mctx = main.getContext('2d');
    mctx.imageSmoothingEnabled = false;
    mctx.drawImage(off, 0, 0, W * S, H * S);
    // 격자
    mctx.strokeStyle = 'rgba(38,34,28,.06)'; mctx.lineWidth = 1;
    for (let x = 0; x <= W; x++) { mctx.beginPath(); mctx.moveTo(x * S, 0); mctx.lineTo(x * S, H * S); mctx.stroke(); }
    for (let y = 0; y <= H; y++) { mctx.beginPath(); mctx.moveTo(0, y * S); mctx.lineTo(W * S, y * S); mctx.stroke(); }

    const swatch = root.querySelector('.px-swatch'), vals = root.querySelector('.px-vals');
    function redrawMain(hl) {
      mctx.imageSmoothingEnabled = false; mctx.drawImage(off, 0, 0, W * S, H * S);
      mctx.strokeStyle = 'rgba(38,34,28,.06)';
      for (let x = 0; x <= W; x++) { mctx.beginPath(); mctx.moveTo(x * S, 0); mctx.lineTo(x * S, H * S); mctx.stroke(); }
      for (let y = 0; y <= H; y++) { mctx.beginPath(); mctx.moveTo(0, y * S); mctx.lineTo(W * S, y * S); mctx.stroke(); }
      if (hl) { mctx.strokeStyle = C.ink; mctx.lineWidth = 2; mctx.strokeRect(hl[0] * S, hl[1] * S, S, S); }
    }
    main.addEventListener('pointermove', e => {
      const r = main.getBoundingClientRect();
      const px = clamp(((e.clientX - r.left) / r.width * W) | 0, 0, W - 1);
      const py = clamp(((e.clientY - r.top) / r.height * H) | 0, 0, H - 1);
      const i = (py * W + px) * 4, R = img[i], Gg = img[i + 1], B = img[i + 2];
      swatch.style.background = `rgb(${R},${Gg},${B})`;
      vals.innerHTML = `위치 (${px}, ${py})<br><b style="color:#b23">R ${R}</b> · <b style="color:#2a2">G ${Gg}</b> · <b style="color:#36b">B ${B}</b>`;
      redrawMain([px, py]);
    });

    // 채널 분해 렌더
    root.querySelectorAll('.px-ch canvas').forEach(cv => {
      const ch = +cv.dataset.c, cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false;
      const id = cx.createImageData(W, H);
      for (let p = 0; p < W * H; p++) {
        const v = img[p * 4 + ch];
        id.data[p * 4] = ch === 0 ? v : 0; id.data[p * 4 + 1] = ch === 1 ? v : 0;
        id.data[p * 4 + 2] = ch === 2 ? v : 0; id.data[p * 4 + 3] = 255;
      }
      const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
      tmp.getContext('2d').putImageData(id, 0, 0);
      cx.drawImage(tmp, 0, 0, W * 5, H * 5);
    });

    const ctr = document.createElement('div'); ctr.className = 'widget-controls';
    ctr.innerHTML = `<button class="btn ghost toggle-ch">RGB 채널로 분해 ▾</button>
      <span style="font-size:.82rem;color:var(--ink-faint)">한 픽셀 = 빨강·초록·파랑 세 숫자. 이미지 전체 = ${W}×${H}×3 숫자 텐서.</span>`;
    root.appendChild(ctr);
    const chans = root.querySelector('.px-channels');
    ctr.querySelector('.toggle-ch').addEventListener('click', e => {
      const open = chans.hasAttribute('hidden');
      if (open) { chans.removeAttribute('hidden'); e.target.textContent = 'RGB 채널 접기 ▴'; }
      else { chans.setAttribute('hidden', ''); e.target.textContent = 'RGB 채널로 분해 ▾'; }
    });
  };

  /* ============================================================
     CH02 — 라이브 컨볼루션: 필터 선택 → feature map
     ============================================================ */
  NST.convolve = function (root) {
    const W = 168, H = 116;
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const octx = off.getContext('2d'); drawScene(octx, W, H);
    const L = lumFrom(octx, W, H);

    const kernels = {
      '세로 에지': [-1, 0, 1, -2, 0, 2, -1, 0, 1],
      '가로 에지': [-1, -2, -1, 0, 0, 0, 1, 2, 1],
      '윤곽선': [0, -1, 0, -1, 4, -1, 0, -1, 0],
      '흐리기': [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9],
      '엠보스': [-2, -1, 0, -1, 1, 1, 0, 1, 2],
    };
    let cur = '세로 에지';

    root.innerHTML = `
      <div class="conv-stage">
        <div class="conv-col"><canvas class="conv-in" width="${W}" height="${H}"></canvas><span>입력 이미지</span></div>
        <div class="conv-kernel"></div>
        <div class="conv-col"><canvas class="conv-out" width="${W}" height="${H}"></canvas><span>feature map (필터 반응)</span></div>
      </div>`;
    const inCv = root.querySelector('.conv-in'); inCv.getContext('2d').drawImage(off, 0, 0);
    const outCv = root.querySelector('.conv-out'), octx2 = outCv.getContext('2d');
    const kerEl = root.querySelector('.conv-kernel');

    const sCol = hexToRgb(C.structure);
    function run() {
      const k = kernels[cur], out = octx2.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let s = 0, ki = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++, ki++) {
          const xx = clamp(x + dx, 0, W - 1), yy = clamp(y + dy, 0, H - 1);
          s += L[yy * W + xx] * k[ki];
        }
        const isEdge = cur.includes('에지') || cur === '윤곽선' || cur === '엠보스';
        let v = isEdge ? Math.abs(s) : s; v = clamp(v, 0, 1);   // ReLU/abs
        const p = (y * W + x) * 4;
        // 구조색 램프
        out.data[p] = lerp(250, sCol[0] * 255, v); out.data[p + 1] = lerp(247, sCol[1] * 255, v);
        out.data[p + 2] = lerp(240, sCol[2] * 255, v); out.data[p + 3] = 255;
      }
      octx2.putImageData(out, 0, 0);
      // 커널 표시
      kerEl.innerHTML = '<div class="kgrid">' + kernels[cur].map(n =>
        `<span>${(+n.toFixed(2))}</span>`).join('') + '</div><div class="karrow">∗ → 합산 후 ReLU</div>';
    }

    const ctr = document.createElement('div'); ctr.className = 'widget-controls';
    ctr.innerHTML = `<div class="toggle-row">${Object.keys(kernels).map((k, i) =>
      `<button class="btn ghost ${i === 0 ? 'on' : ''}" data-k="${k}">${k}</button>`).join('')}</div>`;
    root.appendChild(ctr);
    ctr.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      cur = b.dataset.k; ctr.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); run();
    }));
    run();
  };

  /* ============================================================
     CH03 — 재구성: 얕은 층(픽셀) ↔ 깊은 층(구조)
     ============================================================ */
  NST.reconstruct = function (root) {
    const W = 168, H = 116;
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    drawScene(off.getContext('2d'), W, H);
    const layers = ['conv1_1', 'conv2_1', 'conv3_1', 'conv4_2', 'conv5_1'];
    let li = 0;

    root.innerHTML = `
      <div class="recon-stage">
        <canvas class="recon-out" width="${W}" height="${H}"></canvas>
        <div class="recon-meta">
          <div class="recon-layer">conv1_1</div>
          <div class="recon-desc"></div>
          <div class="recon-loss"><span>콘텐츠 손실</span><div class="bar"><i></i></div></div>
        </div>
      </div>`;
    const out = root.querySelector('.recon-out'), octx = out.getContext('2d');
    const layEl = root.querySelector('.recon-layer'), descEl = root.querySelector('.recon-desc');
    const lossBar = root.querySelector('.recon-loss i');
    const descs = [
      '얕은 층. 색과 에지, 작은 질감까지 거의 원본 픽셀 그대로 복원된다.',
      '조금 더 깊은 층. 미세 질감이 뭉개지기 시작하지만 형태는 또렷하다.',
      '중간 층. 세부는 사라지고 부분 구조와 배치가 남는다.',
      '깊은 층. 픽셀 세부는 거의 버려지고, 무엇이 어디에 있는지(구조)만 남는다.',
      '가장 깊은 층. 질감은 완전히 사라지고 전역 배치만 추상적으로 남는다.',
    ];
    function render() {
      const blur = li * 1.6;                          // 깊을수록 흐리고 + 거칠게
      octx.filter = `blur(${blur}px) contrast(${1 + li * 0.12})`;
      octx.clearRect(0, 0, W, H); octx.drawImage(off, 0, 0);
      octx.filter = 'none';
      if (li >= 2) { // 깊은 층: 다운샘플→업샘플로 구조만
        const f = [1, 1, 2, 3, 4][li];
        const t = document.createElement('canvas'); t.width = W / f; t.height = H / f;
        const tc = t.getContext('2d'); tc.imageSmoothingEnabled = true; tc.drawImage(out, 0, 0, W / f, H / f);
        octx.imageSmoothingEnabled = true; octx.drawImage(t, 0, 0, W, H);
      }
      layEl.textContent = layers[li];
      descEl.textContent = descs[li];
      lossBar.style.width = (12 + li * 21) + '%';        // 깊을수록 픽셀 차이 ↑
    }
    const ctr = document.createElement('div'); ctr.className = 'widget-controls';
    ctr.innerHTML = `<div class="slider"><label>재구성에 사용한 층 <b class="lv">conv1_1 · 얕음</b></label>
      <input type="range" class="s-structure" min="0" max="4" value="0"></div>
      <span style="font-size:.8rem;color:var(--ink-faint)">← 얕은 층(픽셀 복원) · 깊은 층(구조만) →</span>`;
    root.appendChild(ctr);
    const sl = ctr.querySelector('input'), lv = ctr.querySelector('.lv');
    sl.addEventListener('input', () => { li = +sl.value; lv.textContent = layers[li] + (li < 2 ? ' · 얕음' : li < 4 ? ' · 중간' : ' · 깊음'); render(); });
    render();
  };

  /* ============================================================
     CH05 — α/β 줄다리기: 콘텐츠 구조 ↔ 스타일 질감 실시간 보간
     ============================================================ */
  NST.alphaBeta = function (root) {
    const W = 200, H = 138;
    const cOff = document.createElement('canvas'); cOff.width = W; cOff.height = H;
    drawScene(cOff.getContext('2d'), W, H);
    const cLum = lumFrom(cOff.getContext('2d'), W, H);
    // 스타일 질감(따뜻한 소용돌이)
    const sCol1 = hexToRgb(C.style), sCol2 = hexToRgb('#E8B24A');
    function styleAt(x, y) {
      const u = x / W, v = y / H;
      let s = Math.sin(u * 22 + Math.sin(v * 9) * 3) * 0.5 + 0.5;
      s = s * 0.6 + (Math.sin((u + v) * 16) * 0.5 + 0.5) * 0.4;
      return s;
    }
    root.innerHTML = `
      <div class="ab-stage">
        <div class="ab-src"><canvas class="ab-c" width="${W}" height="${H}"></canvas><span>콘텐츠 p</span></div>
        <div class="ab-src"><canvas class="ab-s" width="${W}" height="${H}"></canvas><span>스타일 a</span></div>
        <div class="ab-arrow">⇒</div>
        <div class="ab-src ab-big"><canvas class="ab-out" width="${W}" height="${H}"></canvas><span>생성 이미지 x</span></div>
      </div>
      <div class="ab-meters">
        <div class="m"><label>콘텐츠 손실 (구조 차이)</label><div class="bar s1"><i class="mc"></i></div></div>
        <div class="m"><label>스타일 손실 (질감 차이)</label><div class="bar s2"><i class="ms"></i></div></div>
      </div>`;
    root.querySelector('.ab-c').getContext('2d').drawImage(cOff, 0, 0);
    // 스타일 미리보기
    const sc = root.querySelector('.ab-s').getContext('2d'), sid = sc.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = styleAt(x, y), p = (y * W + x) * 4;
      sid.data[p] = lerp(sCol2[0], sCol1[0], s) * 255; sid.data[p + 1] = lerp(sCol2[1], sCol1[1], s) * 255;
      sid.data[p + 2] = lerp(sCol2[2], sCol1[2], s) * 255; sid.data[p + 3] = 255;
    }
    sc.putImageData(sid, 0, 0);

    const oc = root.querySelector('.ab-out').getContext('2d');
    const mc = root.querySelector('.mc'), ms = root.querySelector('.ms');
    function render(beta) { // beta 0..1 (스타일 비중)
      const id = oc.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, p = i * 4, lum = cLum[i], st = styleAt(x, y);
        // 콘텐츠 구조(명암)에 스타일 색·질감을 beta만큼 입힘
        const styleR = lerp(sCol2[0], sCol1[0], st), styleG = lerp(sCol2[1], sCol1[1], st), styleB = lerp(sCol2[2], sCol1[2], st);
        const mixR = lerp(lum, styleR * (0.5 + lum * 0.7), beta);
        const mixG = lerp(lum, styleG * (0.5 + lum * 0.7), beta);
        const mixB = lerp(lum, styleB * (0.5 + lum * 0.7), beta);
        id.data[p] = clamp(mixR, 0, 1) * 255; id.data[p + 1] = clamp(mixG, 0, 1) * 255;
        id.data[p + 2] = clamp(mixB, 0, 1) * 255; id.data[p + 3] = 255;
      }
      oc.putImageData(id, 0, 0);
      mc.style.width = (8 + beta * 78) + '%';      // 스타일↑ → 콘텐츠 구조 깨짐
      ms.style.width = (88 - beta * 78) + '%';      // 스타일↑ → 스타일 손실↓
    }
    const ctr = document.createElement('div'); ctr.className = 'widget-controls';
    ctr.innerHTML = `<div class="slider"><label>α 콘텐츠 강조 ↔ β 스타일 강조 <b class="rv">균형</b></label>
      <input type="range" min="0" max="100" value="55"></div>`;
    root.appendChild(ctr);
    const sl = ctr.querySelector('input'), rv = ctr.querySelector('.rv');
    sl.addEventListener('input', () => {
      const b = sl.value / 100; rv.textContent = b < 0.3 ? '구조 우세 (α 큼)' : b > 0.7 ? '질감 우세 (β 큼)' : '균형';
      render(b);
    });
    render(0.55);
  };

  /* ============================================================
     CH06 — 픽셀 경사하강: 노이즈가 목표로 최적화되는 과정 + 손실곡선
     ============================================================ */
  NST.optimize = function (root) {
    const W = 168, H = 116, N = W * H, MAXT = 400, lr = 0.02;
    const tOff = document.createElement('canvas'); tOff.width = W; tOff.height = H;
    drawScene(tOff.getContext('2d'), W, H);
    const tgt = tOff.getContext('2d').getImageData(0, 0, W, H).data;
    // 초기 노이즈 + 결정적 디더(픽셀별 고정) — 슬라이더 스크럽이 재현 가능하도록
    const init = new Float32Array(N * 4), dith = new Float32Array(N * 3);
    for (let i = 0; i < N * 4; i++) init[i] = Math.random() * 255;
    for (let i = 0; i < N * 3; i++) dith[i] = Math.random() - 0.5;
    let L0 = 0;
    for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) { const d = init[i * 4 + c] - tgt[i * 4 + c]; L0 += d * d; }
    L0 /= (N * 3) || 1;

    root.innerHTML = `
      <div class="opt-stage">
        <div class="opt-col"><canvas class="opt-x" width="${W}" height="${H}"></canvas><span>생성 이미지 x (반복 t에서의 상태)</span></div>
        <div class="opt-col"><canvas class="opt-loss" width="${W}" height="${H}"></canvas><span>전체 손실 ↓</span></div>
      </div>`;
    const xc = root.querySelector('.opt-x').getContext('2d');
    const lc = root.querySelector('.opt-loss').getContext('2d');

    function render(t) {
      // 닫힌 형식: cur_t = tgt + (init - tgt)(1-lr)^t, 디더는 같은 비율로 감쇠
      const f = Math.pow(1 - lr, t);
      const id = xc.createImageData(W, H);
      for (let i = 0; i < N; i++) {
        const p = i * 4;
        for (let c = 0; c < 3; c++) {
          const base = tgt[p + c] + (init[p + c] - tgt[p + c]) * f;
          id.data[p + c] = clamp(base + dith[i * 3 + c] * 70 * f, 0, 255);
        }
        id.data[p + 3] = 255;
      }
      xc.putImageData(id, 0, 0);
      // 손실 곡선 (0..t)
      lc.fillStyle = '#fff'; lc.fillRect(0, 0, W, H);
      lc.strokeStyle = 'rgba(38,34,28,.12)'; lc.beginPath(); lc.moveTo(0, H - 1); lc.lineTo(W, H - 1); lc.stroke();
      lc.strokeStyle = C.style; lc.lineWidth = 2; lc.beginPath();
      for (let k = 0; k <= t; k++) {
        const lk = Math.pow(1 - lr, 2 * k);            // L_k / L0
        const x = k / MAXT * W, y = H - lk * (H - 10) - 5;
        k ? lc.lineTo(x, y) : lc.moveTo(x, y);
      }
      lc.stroke();
      const lt = Math.pow(1 - lr, 2 * t);
      lc.fillStyle = C.ink; lc.beginPath(); lc.arc(t / MAXT * W, H - lt * (H - 10) - 5, 3, 0, 7); lc.fill();
      lc.font = '11px monospace'; lc.fillText('iter ' + t + ' · loss ' + (lt * L0).toFixed(0), 6, 14);
    }

    const ctr = document.createElement('div'); ctr.className = 'widget-controls';
    ctr.innerHTML = `<div class="slider"><label>최적화 반복 t (iteration) <b class="iv">0</b> / ${MAXT}</label>
      <input type="range" min="0" max="${MAXT}" value="0"></div>
      <span style="font-size:.8rem;color:var(--ink-faint)">노이즈(t=0) → 목표 이미지(t=${MAXT}). 슬라이더로 수렴 과정을 앞뒤로 감아본다. VGG는 고정, 픽셀만 변한다.</span>`;
    root.appendChild(ctr);
    const sl = ctr.querySelector('input'), iv = ctr.querySelector('.iv');
    sl.addEventListener('input', () => { iv.textContent = sl.value; render(+sl.value); });
    render(0);
  };

  /* ============================================================
     CH07 — Q&A 아코디언
     ============================================================ */
  NST.accordion = function (root) {
    root.querySelectorAll('.qa').forEach(qa => {
      const q = qa.querySelector('.qa-q');
      q.addEventListener('click', () => qa.classList.toggle('open'));
    });
  };

  /* 자동 부팅 */
  document.addEventListener('DOMContentLoaded', function () {
    NST.initChrome();
    // KaTeX는 폰트 로드 후
    if (window.renderMathInElement) NST.renderMath();
    else window.addEventListener('load', NST.renderMath);
  });
})();

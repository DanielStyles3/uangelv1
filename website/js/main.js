/* U Angel Foods — promotional site interactions
   GSAP 3.12.5 + ScrollTrigger, optional Lenis 1.1.13 */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var mq = function (q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } };

  var reduced = docEl.classList.contains('reduced') || mq('(prefers-reduced-motion: reduce)');
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var finePointer = mq('(hover: hover) and (pointer: fine)');
  var lenis = null;
  var hTween = null; // horizontal events tween (when active)

  /* ---------- footer year ---------- */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- nav: scrolled / hide on scroll down ---------- */
  var nav = $('#nav');
  var menuOpen = false;
  var lastY = window.scrollY || 0;
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || 0;
      nav.classList.toggle('scrolled', y > 30);
      if (!menuOpen && y > lastY + 4 && y > 500) nav.classList.add('nav-hidden');
      else if (y < lastY - 4 || y <= 500) nav.classList.remove('nav-hidden');
      lastY = y;
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var burger = $('#burger');
  var menu = $('#mobile-menu');
  function setMenu(open) {
    menuOpen = open;
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    else document.body.style.overflow = open ? 'hidden' : '';
    if (open) nav.classList.remove('nav-hidden');
  }
  burger.addEventListener('click', function () { setMenu(!menuOpen); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });

  /* ---------- anchor scrolling (Lenis-aware, horizontal-aware) ---------- */
  function targetY(el) {
    if (el.id === 'top') return 0;
    var track = $('.events-track');
    if (hTween && hTween.scrollTrigger && track && track.contains(el)) {
      var st = hTween.scrollTrigger;
      var max = track.offsetWidth - $('.events-viewport').clientWidth;
      var left = el.getBoundingClientRect().left - track.getBoundingClientRect().left - 40;
      var ratio = Math.min(1, Math.max(0, max > 0 ? left / max : 0));
      return st.start + ratio * (st.end - st.start) + 2;
    }
    return el.getBoundingClientRect().top + (window.scrollY || 0) - 72 - xbarHeight();
  }
  function xbarHeight() {
    var bar = document.getElementById('xbar');
    return bar && docEl.classList.contains('has-xbar') ? bar.offsetHeight : 0;
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#') { e.preventDefault(); return; } // placeholder links
      var el = document.getElementById(id.slice(1));
      if (!el) return;
      e.preventDefault();
      if (menuOpen) setMenu(false);
      var y = targetY(el);
      if (lenis) lenis.scrollTo(y, { duration: 1.4 });
      else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
      if (id !== '#top' && history.replaceState) history.replaceState(null, '', id);
    });
  });

  /* ---------- Christmas campaign: announcement bar, countdown, snow ----------
     (runs on every path, including reduced motion and no-GSAP) */
  // 15 December 2026, 23:59 in Lagos (Africa/Lagos = UTC+1, no DST) → 22:59 UTC
  var XMAS_DEADLINE = Date.UTC(2026, 11, 15, 22, 59, 0);
  var xbar = $('#xbar');
  function refreshTriggers() { if (hasGsap && !reduced) window.ScrollTrigger.refresh(); }
  function syncXbarHeight() {
    var on = xbar && docEl.classList.contains('has-xbar') && !menuOpen;
    if (on && xbar.offsetHeight) docEl.style.setProperty('--xbar-h', xbar.offsetHeight + 'px');
    else if (!on && !menuOpen) docEl.style.setProperty('--xbar-h', '0px');
  }
  function hideXbar(remember) {
    if (remember) { try { sessionStorage.setItem('ua-xbar-dismissed', '1'); } catch (e) {} }
    docEl.classList.remove('has-xbar');
    syncXbarHeight();
    setTimeout(refreshTriggers, 550); // after the hero padding transition
  }
  if (xbar) {
    syncXbarHeight();
    var xbarResizeT;
    window.addEventListener('resize', function () { clearTimeout(xbarResizeT); xbarResizeT = setTimeout(syncXbarHeight, 120); });
    var xbarClose = $('#xbar-close');
    if (xbarClose) xbarClose.addEventListener('click', function () {
      hideXbar(true);
      var brand = $('.brand');
      if (brand) brand.focus(); // keep keyboard focus inside the header
    });
  }

  var cd = $('#xmas-countdown');
  var cdThanks = $('#xmas-thanks');
  if (cd) {
    var cdEls = { d: $('[data-cd="d"]', cd), h: $('[data-cd="h"]', cd), m: $('[data-cd="m"]', cd) };
    var cdTimer = null;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var setCd = function (el, txt) {
      if (!el || el.textContent === txt) return;
      el.textContent = txt;
      if (!reduced) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
    };
    var tickCd = function () {
      var left = XMAS_DEADLINE - Date.now();
      if (left <= 0) {
        cd.hidden = true;
        if (cdThanks) cdThanks.hidden = false;
        if (xbar && docEl.classList.contains('has-xbar')) hideXbar(false);
        if (cdTimer) clearInterval(cdTimer);
        return false;
      }
      var mins = Math.floor(left / 60000);
      setCd(cdEls.d, String(Math.floor(mins / 1440)));
      setCd(cdEls.h, pad(Math.floor(mins / 60) % 24));
      setCd(cdEls.m, pad(mins % 60));
      return true;
    };
    if (tickCd()) cdTimer = setInterval(tickCd, 1000);
  }

  /* falling snow: one light canvas, only animates while the section is on screen */
  var snowCanvas = $('#xmas-snow');
  var xmasSection = $('#christmas');
  if (snowCanvas && xmasSection && !reduced && snowCanvas.getContext) {
    (function () {
      var ctx = snowCanvas.getContext('2d');
      if (!ctx) return;
      var flakes = [], w = 0, h = 0, raf = 0, last = 0, inView = false;
      function make(anywhere) {
        var r = Math.random() * 2.3 + 0.7;
        return { x: Math.random() * w, y: anywhere ? Math.random() * h : -6, r: r, v: 18 + r * 14 + Math.random() * 12, ph: Math.random() * 6.28, sw: 0.6 + Math.random() * 1.2, a: 0.35 + Math.random() * 0.5 };
      }
      function size() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = xmasSection.clientWidth; h = xmasSection.clientHeight;
        snowCanvas.width = Math.round(w * dpr); snowCanvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var n = Math.round(Math.min(120, Math.max(30, (w * h) / 12000)));
        flakes.length = Math.min(flakes.length, n);
        while (flakes.length < n) flakes.push(make(true));
      }
      function frame(t) {
        raf = requestAnimationFrame(frame);
        var dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
        last = t;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        for (var i = 0; i < flakes.length; i++) {
          var f = flakes[i];
          f.ph += dt * f.sw;
          f.y += f.v * dt;
          f.x += Math.sin(f.ph) * 14 * dt;
          if (f.y > h + 6) { flakes[i] = make(false); continue; }
          ctx.globalAlpha = f.a;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      function start() { if (!raf && inView && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
      function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
      size();
      var sizeT;
      window.addEventListener('resize', function () { clearTimeout(sizeT); sizeT = setTimeout(size, 150); });
      if ('ResizeObserver' in window) new ResizeObserver(function () { clearTimeout(sizeT); sizeT = setTimeout(size, 150); }).observe(xmasSection);
      document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          inView = entries[0].isIntersecting;
          if (inView) start(); else stop();
        }, { rootMargin: '100px 0px' }).observe(xmasSection);
      } else { inView = true; start(); }
    })();
  }

  /* ---------- static path: no GSAP or reduced motion ---------- */
  var loader = $('#loader');
  function markSeen() { try { sessionStorage.setItem('ua-intro-seen', '1'); } catch (e) {} }

  if (!hasGsap || reduced) {
    if (!hasGsap) docEl.classList.add('no-gsap');
    if (loader) loader.style.display = 'none';
    markSeen();
    var rider = $('#route-rider');
    if (rider) rider.setAttribute('visibility', 'hidden');
    return;
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  // mobile URL-bar show/hide fires height-only resizes: don't re-layout pins for those
  ScrollTrigger.config({ ignoreMobileResize: true });
  // but do recalculate after a real orientation change (pins are switched on/off by matchMedia)
  var orientT;
  var onOrient = function () { clearTimeout(orientT); orientT = setTimeout(function () { ScrollTrigger.refresh(); }, 350); };
  window.addEventListener('orientationchange', onOrient);
  try { if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', onOrient); } catch (e) {}

  /* ---------- Lenis smooth scroll synced with ScrollTrigger ---------- */
  if (typeof window.Lenis === 'function') {
    try {
      lenis = new window.Lenis({
        duration: 1.15,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothWheel: true
      });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } catch (e) { lenis = null; }
  }

  /* ---------- split headings into masked words ---------- */
  function appendWords(parent, text) {
    text.split(/(\s+)/).forEach(function (part) {
      if (!part) return;
      if (/^\s+$/.test(part)) { parent.appendChild(document.createTextNode(' ')); return; }
      var w = document.createElement('span');
      w.className = 'word';
      var i = document.createElement('span');
      i.className = 'word-in';
      i.textContent = part;
      w.appendChild(i);
      parent.appendChild(w);
    });
  }
  $$('[data-split]').forEach(function (el) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    el.textContent = '';
    nodes.forEach(function (n) {
      if (n.nodeType === 3) appendWords(el, n.textContent);
      else if (n.nodeType === 1) {
        var clone = n.cloneNode(false);
        appendWords(clone, n.textContent);
        el.appendChild(clone);
      }
    });
  });

  /* ---------- logo build timeline (5 aligned layers) ---------- */
  function buildLogo(stack) {
    var q = function (s) { return stack.querySelector(s); };
    var tl = gsap.timeline();
    tl.fromTo(q('.l-u'), { yPercent: 45, scaleY: 0.7, autoAlpha: 0 }, { yPercent: 0, scaleY: 1, autoAlpha: 1, duration: 0.65, ease: 'back.out(1.7)' })
      .fromTo(q('.l-a'), { xPercent: 45, rotation: 22, autoAlpha: 0 }, { xPercent: 0, rotation: 0, autoAlpha: 1, duration: 0.65, ease: 'back.out(1.5)' }, '-=0.42')
      .fromTo(q('.l-dot'), { yPercent: -45, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.75, ease: 'bounce.out' }, '-=0.4')
      .fromTo(q('.l-dish'), { scale: 0, rotation: -140, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.55, ease: 'back.out(2.2)' }, '-=0.5')
      .to(q('.l-dish'), { yPercent: -1.8, rotation: -6, duration: 0.14, ease: 'power2.out', yoyo: true, repeat: 1 }) // lid peek
      .fromTo(q('.l-text'), { yPercent: 6, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' }, '-=0.25');
    return tl;
  }

  /* ---------- hero intro (paused until loader is done) ---------- */
  // each step is guarded so pages without some hero parts (e.g. about.html) animate cleanly
  var heroTl = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } });
  var heroBits = $$('.hero-sub, .hero-ctas, .hero-chips');
  if ($('.hero-eyebrow')) heroTl.from('.hero-eyebrow', { y: 20, autoAlpha: 0, duration: 0.7 });
  if ($('.hero-title .word-in')) heroTl.from('.hero-title .word-in', { yPercent: 115, rotation: 4, duration: 1.1, stagger: 0.055 }, '-=0.5');
  if (heroBits.length) heroTl.from(heroBits, { y: 30, autoAlpha: 0, duration: 0.9, stagger: 0.1 }, '-=0.8');
  if ($('.pcard')) {
    heroTl.from('.pcard', {
      autoAlpha: 0, scale: 0.6, duration: 1.2, stagger: 0.12, ease: 'back.out(1.4)',
      rotation: function (i) { return [-14, 14, -10][i] || 0; }
    }, '-=1.2');
  }
  if ($('.sticker')) heroTl.from('.sticker', { autoAlpha: 0, duration: 0.6, stagger: 0.15 }, '-=0.6');
  if ($('.scroll-cue')) heroTl.from('.scroll-cue', { autoAlpha: 0, duration: 0.6 }, '-=0.4');

  /* ---------- intro loader ---------- */
  var introPlaying = loader && !docEl.classList.contains('skip-intro') && getComputedStyle(loader).display !== 'none';
  if (introPlaying) {
    if (lenis) lenis.stop();
    var logo = $('[data-logo]', loader);
    var ltl = gsap.timeline({
      onComplete: function () {
        loader.style.display = 'none';
        markSeen();
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
      }
    });
    ltl.fromTo('.glow', { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.4, stagger: 0.18, ease: 'power2.out' }, 0)
      .fromTo('.loader-skip', { autoAlpha: 0 }, { autoAlpha: 0.7, duration: 0.4 }, 0.3)
      .add(buildLogo(logo), 0.1)
      .addLabel('out', 1.95)
      .to(logo, { yPercent: -18, scale: 0.92, autoAlpha: 0, duration: 0.55, ease: 'power3.in' }, 'out')
      .to('.loader-glows, .loader-skip', { autoAlpha: 0, duration: 0.4 }, 'out')
      .fromTo(loader,
        { yPercent: 0, borderRadius: '0% 0% 0% 0% / 0% 0% 0% 0%' },
        { yPercent: -100, borderRadius: '0% 0% 50% 50% / 0% 0% 24% 24%', duration: 0.85, ease: 'power4.inOut', immediateRender: false }, 'out+=0.1')
      .add(function () { heroTl.play(); }, 'out+=0.45');
    loader.addEventListener('click', function () {
      if (ltl.time() < ltl.labels.out) ltl.seek('out');
    });
  } else {
    if (loader) loader.style.display = 'none';
    heroTl.play();
  }

  // safety net: never leave the hero hidden if the animation loop is stalled
  setTimeout(function () {
    if (heroTl.progress() === 0) heroTl.progress(1);
    if (loader && loader.style.display !== 'none' && introPlaying) { loader.style.display = 'none'; if (lenis) lenis.start(); }
  }, 8000);

  /* ---------- hero: mouse parallax + scroll parallax ---------- */
  var hero = $('.hero');
  var cards = $$('.pcard');
  if (finePointer && hero) {
    var movers = cards.map(function (c) {
      var m = $('.pcard-move', c);
      gsap.set(m, { transformPerspective: 900 });
      var o = { duration: 0.9, ease: 'power3.out' };
      return {
        d: parseFloat(c.getAttribute('data-depth')) || 20,
        x: gsap.quickTo(m, 'x', o), y: gsap.quickTo(m, 'y', o),
        rx: gsap.quickTo(m, 'rotationX', o), ry: gsap.quickTo(m, 'rotationY', o)
      };
    });
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      var nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      var ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      movers.forEach(function (m) { m.x(nx * m.d); m.y(ny * m.d); m.ry(nx * 12); m.rx(-ny * 12); });
    });
    hero.addEventListener('pointerleave', function () {
      movers.forEach(function (m) { m.x(0); m.y(0); m.rx(0); m.ry(0); });
    });
  }
  // scroll parallax is toned down on narrow (stacked) layouts so cards never slide over the copy
  var pFactor = function () { return window.innerWidth < 900 ? 0.4 : 1; };
  cards.forEach(function (c) {
    var sp = parseFloat(c.getAttribute('data-speed')) || -80;
    gsap.to(c, {
      y: function () { return sp * pFactor(); }, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
    });
  });
  if (hero && $('.hero-copy')) {
    gsap.to('.hero-copy', { y: function () { return -70 * pFactor(); }, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
  }

  /* ---------- marquee: infinite, reacts to scroll velocity + direction ---------- */
  var rows = $$('[data-marquee]').map(function (m) {
    var track = $('.marquee-track', m);
    var group = $('.marquee-group', track);
    for (var i = 0; i < 2; i++) {
      var c = group.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    }
    return { dir: parseFloat(m.getAttribute('data-dir')) || 1, group: group, w: group.offsetWidth, x: 0, set: gsap.quickSetter(track, 'x', 'px') };
  });
  var boost = 0, scrollSign = 1;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: function (self) {
      boost = Math.max(boost, Math.min(Math.abs(self.getVelocity()) / 4, 900));
      scrollSign = self.direction || 1;
    }
  });
  ScrollTrigger.addEventListener('refresh', function () { rows.forEach(function (r) { r.w = r.group.offsetWidth; }); });
  gsap.ticker.add(function (time, dt) {
    var s = Math.min(dt, 64) / 1000;
    boost *= 0.92;
    rows.forEach(function (r) {
      if (!r.w) return;
      r.x -= r.dir * scrollSign * (70 + boost) * s;
      r.x = gsap.utils.wrap(-r.w, 0, r.x);
      r.set(r.x);
    });
  });

  /* ---------- generic heading word reveals ---------- */
  $$('[data-split]').forEach(function (el) {
    if (el.closest('.hero')) return;
    gsap.from($$('.word-in', el), {
      yPercent: 115, rotation: 3, duration: 1, ease: 'power4.out', stagger: 0.06,
      scrollTrigger: { trigger: el, start: 'top 85%' }
    });
  });

  /* ---------- generic fade-up reveals ---------- */
  var reveals = $$('[data-reveal]');
  gsap.set(reveals, { autoAlpha: 0, y: 40 });
  ScrollTrigger.batch(reveals, {
    start: 'top 88%', once: true,
    onEnter: function (b) { gsap.to(b, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out', overwrite: true }); }
  });

  /* ---------- counters ---------- */
  $$('[data-count]').forEach(function (el) {
    var end = parseFloat(el.getAttribute('data-count'));
    var o = { v: 0 };
    el.textContent = '0';
    gsap.to(o, {
      v: end, duration: 1.6, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: function () { el.textContent = Math.round(o.v).toLocaleString('en-US'); }
    });
  });

  /* ---------- Christmas campaign: entrance, goal count-up, flyer parallax + tilt ---------- */
  var xmas = $('#christmas');
  if (xmas) {
    var xArt = $('.xmas-art', xmas);
    var xNum = $('.xmas-num', xmas);
    var xTl = gsap.timeline({ scrollTrigger: { trigger: xmas, start: 'top 72%', once: true }, defaults: { ease: 'power4.out' } });
    xTl.from(xArt, { autoAlpha: 0, y: 90, rotation: -12, scale: 0.82, duration: 1.4, ease: 'back.out(1.3)' }, 0)
      .from($('.xmas-badge', xmas), { scale: 0, rotation: -120, duration: 1, ease: 'back.out(2)' }, 0.55)
      .from($('.xmas-eyebrow', xmas), { y: 20, autoAlpha: 0, duration: 0.7 }, 0.1)
      .from($$('.xmas-line-in', xmas), { yPercent: 110, rotation: 3, duration: 1.1, stagger: 0.12 }, 0.2)
      .from($('.xmas-goal-tag', xmas), { scale: 0, rotation: -40, duration: 0.7, ease: 'back.out(2.5)' }, 1.0)
      .from($$('.xmas-pill', xmas), { x: -30, autoAlpha: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' }, 0.7)
      .from($('.xmas-purpose', xmas), { y: 24, autoAlpha: 0, duration: 0.8, ease: 'power3.out' }, 0.85)
      .from($$('.xmas-points li', xmas), { y: 26, scale: 0.85, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: 'back.out(1.8)' }, 0.95)
      .from($$('.xmas-countdown, .xmas-thanks:not([hidden]), .xmas-closing, .xmas-ctas, .xmas-brandline', xmas), { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' }, 1.1);

    if (xNum) {
      var goal = parseFloat(xNum.getAttribute('data-goal')) || 10000;
      var gv = { v: 0 };
      xNum.textContent = '0';
      xTl.to(gv, {
        v: goal, duration: 2.4, ease: 'expo.out',
        onUpdate: function () { xNum.textContent = Math.round(gv.v).toLocaleString('en-US'); },
        onComplete: function () {
          xNum.textContent = goal.toLocaleString('en-US');
          xNum.classList.add('is-done');
          gsap.fromTo(xNum, { scale: 1 }, { scale: 1.06, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.out' });
        }
      }, 0.45);
    }

    // flyer drifts against the scroll + mouse tilt on desktop
    var xTilt = $('.xmas-tilt', xmas);
    if (xTilt) {
      var xAmp = function () { return window.innerWidth < 900 ? 22 : 50; };
      gsap.fromTo(xTilt, { y: function () { return xAmp(); } }, { y: function () { return -xAmp(); }, ease: 'none', scrollTrigger: { trigger: xmas, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
    }
    if (finePointer && xTilt) {
      gsap.set(xTilt, { transformPerspective: 1000 });
      var to = { duration: 0.9, ease: 'power3.out' };
      var tRx = gsap.quickTo(xTilt, 'rotationX', to), tRy = gsap.quickTo(xTilt, 'rotationY', to);
      xmas.addEventListener('pointermove', function (e) {
        var r = xmas.getBoundingClientRect();
        tRy(((e.clientX - r.left) / r.width - 0.5) * 14);
        tRx(-((e.clientY - r.top) / r.height - 0.5) * 10);
      });
      xmas.addEventListener('pointerleave', function () { tRx(0); tRy(0); });
    }
  }

  /* ---------- category cards: staggered reveal + hover tilt ---------- */
  var catItems = $$('.cat-item');
  if (catItems.length) gsap.set(catItems, { autoAlpha: 0, y: 80, rotationX: -10, transformPerspective: 1000 });
  if (catItems.length) ScrollTrigger.batch(catItems, {
    start: 'top 90%', once: true,
    onEnter: function (b) { gsap.to(b, { autoAlpha: 1, y: 0, rotationX: 0, duration: 1.1, stagger: 0.12, ease: 'power4.out', overwrite: true }); }
  });
  if (finePointer) {
    $$('.cat-card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5;
        var ny = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(card, { rotationY: nx * 12, rotationX: -ny * 12, y: -10, transformPerspective: 1100, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
      });
      card.addEventListener('pointerleave', function () {
        gsap.to(card, { rotationY: 0, rotationX: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' });
      });
    });
  }

  /* ---------- catering & events: pinned horizontal scroll on large screens ---------- */
  var evSection = $('.events');
  var evTrack = $('.events-track');
  var evViewport = $('.events-viewport');
  var evBar = $('.events-progress span');
  var mm = gsap.matchMedia();
  if (evSection && evTrack && evViewport && evBar) mm.add({
    horiz: '(min-width: 900px) and (min-height: 600px)',
    stack: '(max-width: 899px), (max-height: 599px)'
  }, function (ctx) {
    var evCards = $$('.ev-card', evTrack);
    if (ctx.conditions.horiz) {
      evSection.classList.add('is-horizontal');
      var getMax = function () { return Math.max(0, evTrack.offsetWidth - evViewport.clientWidth); };
      var setBar = gsap.quickSetter(evBar, 'scaleX');
      hTween = gsap.to(evTrack, {
        x: function () { return -getMax(); }, ease: 'none',
        scrollTrigger: {
          trigger: evSection, start: 'top top', end: function () { return '+=' + getMax(); },
          pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: function (self) { setBar(self.progress); }
        }
      });
      $$('.ev-emoji', evTrack).forEach(function (em) {
        gsap.from(em, {
          scale: 0, rotation: -35, duration: 0.7, ease: 'back.out(2.5)',
          scrollTrigger: { trigger: em.closest('.ev-card'), containerAnimation: hTween, start: 'left 92%', toggleActions: 'play none none reverse' }
        });
      });
      gsap.from(evCards.slice(0, 4), {
        x: 120, autoAlpha: 0, duration: 1, stagger: 0.1, ease: 'power3.out', clearProps: 'transform',
        scrollTrigger: { trigger: evSection, start: 'top 70%' }
      });
      return function () { evSection.classList.remove('is-horizontal'); hTween = null; };
    }
    gsap.from(evCards, {
      autoAlpha: 0, y: 40, duration: 0.8, stagger: 0.05, ease: 'power3.out', clearProps: 'transform',
      scrollTrigger: { trigger: evTrack, start: 'top 85%' }
    });
  });
  if ($('.flow')) {
    gsap.from('.flow li', {
      autoAlpha: 0, x: -20, duration: 0.6, stagger: 0.08, ease: 'power3.out',
      scrollTrigger: { trigger: '.flow', start: 'top 85%' }
    });
  }

  /* ---------- local market: route drawing from market to your door ---------- */
  var routePath = $('#route-path');
  var rider = $('#route-rider');
  var routeEnd = $('.route-end');
  if (routePath && rider) {
    var len = routePath.getTotalLength();
    gsap.set(routePath, { strokeDasharray: len, strokeDashoffset: len });
    var p0 = routePath.getPointAtLength(len * 0.08);
    rider.setAttribute('transform', 'translate(' + p0.x.toFixed(1) + ' ' + p0.y.toFixed(1) + ')');
    gsap.to(routePath, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: {
        trigger: '.route-card', start: 'top 75%', end: 'bottom 45%', scrub: 0.6,
        onUpdate: function (self) {
          var p = routePath.getPointAtLength(len * (0.08 + self.progress * 0.8)); // ride between the two stops
          rider.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
          routeEnd.setAttribute('transform', self.progress > 0.97 ? 'translate(530 90) scale(1.18)' : 'translate(530 90)');
        }
      }
    });
  }

  /* ---------- how it works: line draws, icons pop ---------- */
  $$('.steps-line-fg').forEach(function (p) {
    gsap.set(p, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.to(p, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: '.steps-wrap', start: 'top 72%', end: 'bottom 62%', scrub: 0.6 }
    });
  });
  $$('.step').forEach(function (step) {
    var tl = gsap.timeline({ scrollTrigger: { trigger: step, start: 'top 82%' } });
    tl.from($('.step-icon', step), { scale: 0, rotation: -25, duration: 0.8, ease: 'back.out(2.6)' })
      .from($$('.step-num, h3, p', step), { y: 24, autoAlpha: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out' }, '-=0.5');
  });

  /* ---------- our mission: letter paragraphs reveal in sequence ---------- */
  var letter = $('.letter');
  if (letter) {
    gsap.timeline({ scrollTrigger: { trigger: letter, start: 'top 80%', once: true } })
      .from($('.letter-quote', letter), { scale: 0.4, autoAlpha: 0, rotation: -12, duration: 0.8, ease: 'back.out(2)' })
      .from($$('.letter-body p', letter), { y: 28, autoAlpha: 0, duration: 0.8, stagger: 0.18, ease: 'power3.out' }, '-=0.45');
    gsap.from('.mission-cta', {
      y: 24, autoAlpha: 0, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: '.mission-cta', start: 'top 92%', once: true }
    });
  }

  /* ---------- app phone: looping logo build ---------- */
  var phoneLogo = $('.phone-logo');
  if (phoneLogo) {
    var ptl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.3 });
    ptl.add(buildLogo(phoneLogo))
      .to($$('img', phoneLogo), { autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, '+=2.4');
    ScrollTrigger.create({
      trigger: '.phone', start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { if (self.isActive) ptl.play(); else ptl.pause(); }
    });
  }

  /* ---------- magnetic buttons ---------- */
  if (finePointer) {
    $$('.magnetic').forEach(function (el) {
      var o = { duration: 0.6, ease: 'power3.out' };
      var xTo = gsap.quickTo(el, 'x', o), yTo = gsap.quickTo(el, 'y', o);
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  }

  /* ---------- custom cursor follower (desktop only) ---------- */
  if (finePointer) {
    docEl.classList.add('has-cursor');
    var dot = $('.cursor-dot'), ring = $('.cursor-ring');
    var dX = gsap.quickTo(dot, 'x', { duration: 0.12 }), dY = gsap.quickTo(dot, 'y', { duration: 0.12 });
    var rX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3.out' }), rY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3.out' });
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      docEl.classList.add('cursor-on');
      dX(e.clientX); dY(e.clientY); rX(e.clientX); rY(e.clientY);
    }, { passive: true });
    document.addEventListener('mouseleave', function () { docEl.classList.remove('cursor-on'); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target;
      docEl.classList.toggle('cursor-hover', !!(t && t.closest && t.closest('a, button, .cat-card, .ev-card, .vm-card, .pillar, .farm-card, .benefit')));
    });
  }

  /* ---------- keep triggers accurate ---------- */
  if (typeof ScrollTrigger.sort === 'function') ScrollTrigger.sort();
  ScrollTrigger.refresh();
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();

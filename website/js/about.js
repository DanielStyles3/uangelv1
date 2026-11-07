/* U Angel Foods — "Our story" page motion (loads after main.js).
   Everything is visible by default; initial states are only set here,
   so reduced-motion / no-GSAP visitors get a fully static page. */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var mq = function (q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } };

  var reduced = docEl.classList.contains('reduced') || mq('(prefers-reduced-motion: reduce)');
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (!hasGsap || reduced || !$('.story-hero')) return;

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- helpers: split text into words (keeps one level of inline elements) ---------- */
  function splitInto(el, makeWord) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    el.textContent = '';
    nodes.forEach(function (n) {
      var target = el;
      if (n.nodeType === 1) { target = n.cloneNode(false); el.appendChild(target); }
      else if (n.nodeType !== 3) return;
      n.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { target.appendChild(document.createTextNode(' ')); return; }
        target.appendChild(makeWord(part));
      });
    });
  }
  function maskedWord(text) {
    var w = document.createElement('span'); w.className = 'word';
    var i = document.createElement('span'); i.className = 'word-in'; i.textContent = text;
    w.appendChild(i); return w;
  }
  function plainWord(text) {
    var w = document.createElement('span'); w.className = 'sw'; w.textContent = text; return w;
  }

  /* ---------- hero: logo + "U Are An Angel" statement ---------- */
  var slogan = $('[data-words]');
  if (slogan) splitInto(slogan, maskedWord);
  var swash = $('.slogan-swash path');
  if (swash) gsap.set(swash, { strokeDasharray: 1, strokeDashoffset: 1 });

  var htl = gsap.timeline({ delay: 0.35, defaults: { ease: 'power4.out' } });
  htl.from('.badge-logo img', { scale: 0.55, rotation: -10, autoAlpha: 0, duration: 1.3, ease: 'back.out(1.6)' })
    .from('.badge-glow', { scale: 0, autoAlpha: 0, duration: 1.4, ease: 'power2.out' }, 0)
    .from($$('.word-in', slogan), { yPercent: 120, rotation: 6, duration: 1.15, stagger: 0.12 }, 0.45);
  if (swash) htl.to(swash, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, '-=0.5');
  // safety net if the ticker stalls
  setTimeout(function () { if (htl.progress() < 1) htl.progress(1); }, 6000);

  // parallax distances are toned down on narrow (stacked) layouts so nothing slides over neighbouring text
  var pFactor = function () { return window.innerWidth < 900 ? 0.4 : 1; };
  var hero = $('.story-hero');
  gsap.to('.story-badge', { y: function () { return -90 * pFactor(); }, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
  gsap.to('.halo', { scale: 1.25, rotation: 25, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

  /* ---------- line-icons draw when their card enters ---------- */
  $$('.draw-icon').forEach(function (svg) {
    var paths = $$('[pathLength]', svg);
    gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
    ScrollTrigger.create({
      trigger: svg, start: 'top 88%', once: true,
      onEnter: function () { gsap.to(paths, { strokeDashoffset: 0, duration: 1.2, stagger: 0.14, ease: 'power2.inOut', delay: 0.25 }); }
    });
  });

  /* ---------- vision / mission: big numerals drift ---------- */
  $$('.vm-bg-num').forEach(function (n) {
    gsap.fromTo(n, { yPercent: 30 }, { yPercent: -30, ease: 'none', scrollTrigger: { trigger: n.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------- about: photo collage ---------- */
  var photos = $$('.story-photos .sp');
  if (photos.length) {
    gsap.from(photos, {
      autoAlpha: 0, y: 80, scale: 0.8, duration: 1.2, stagger: 0.14, ease: 'back.out(1.3)',
      rotation: function (i) { return [-14, 12, -8][i] || 0; },
      scrollTrigger: { trigger: '.story-photos', start: 'top 80%', once: true }
    });
    photos.forEach(function (p, i) {
      var dy = [-30, -80, -50][i] || -40;
      gsap.to(p, { y: function () { return dy * pFactor(); }, ease: 'none', scrollTrigger: { trigger: '.story-photos', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
    });
  }
  var heart = $('.different-mark');
  if (heart) {
    gsap.from(heart, { scale: 0, rotation: -30, duration: 0.9, ease: 'back.out(2.6)', scrollTrigger: { trigger: '.different', start: 'top 85%', once: true } });
  }

  /* ---------- social impact: progress line draws, steps pop ---------- */
  var fill = $('.impact-fill');
  if (fill) {
    gsap.fromTo(fill, { '--p': 0 }, {
      '--p': 1, ease: 'none',
      scrollTrigger: { trigger: '.impact-wrap', start: 'top 72%', end: 'bottom 60%', scrub: 0.6 }
    });
  }
  $$('.impact-step').forEach(function (step) {
    gsap.timeline({ scrollTrigger: { trigger: step, start: 'top 82%', once: true } })
      .from($('.impact-num', step), { scale: 0, rotation: -40, duration: 0.8, ease: 'back.out(2.4)' })
      .from($('p', step), { y: 26, autoAlpha: 0, duration: 0.7, ease: 'power3.out' }, '-=0.45');
  });

  /* ---------- sustainability: pinned, scrubbed statement ---------- */
  var statement = $('[data-statement]');
  if (statement) {
    $$('.st-line', statement).forEach(function (l) { splitInto(l, plainWord); });
    var words = $$('.sw', statement);
    var title = $('.sustain-title');
    var mm = gsap.matchMedia();
    mm.add({
      pin: '(min-width: 900px) and (min-height: 600px)',
      flow: '(max-width: 899px), (max-height: 599px)'
    }, function (ctx) {
      var sec = $('.sustain');
      if (ctx.conditions.pin) {
        sec.classList.add('is-pinned');
        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: '.statement-pin', start: 'top top', end: '+=140%',
            pin: true, scrub: 0.7, anticipatePin: 1, refreshPriority: 1, invalidateOnRefresh: true
          }
        });
        tl.fromTo(title, { autoAlpha: 0.25, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'none' })
          .fromTo(words, { opacity: 0.1, yPercent: 18 }, { opacity: 1, yPercent: 0, stagger: 0.08, duration: 0.3, ease: 'none' }, 0.1)
          .fromTo('.st-accent', { scale: 0.94 }, { scale: 1, duration: 0.4, ease: 'none' }, '-=0.5')
          .to({}, { duration: 0.25 });
        return function () { sec.classList.remove('is-pinned'); };
      }
      gsap.fromTo(words, { opacity: 0.12 }, {
        opacity: 1, stagger: 0.08, ease: 'none',
        scrollTrigger: { trigger: statement, start: 'top 85%', end: 'bottom 45%', scrub: 0.6 }
      });
    });
  }
  var pillars = $$('.pillar');
  gsap.set(pillars, { autoAlpha: 0, y: 70, rotationX: -12, transformPerspective: 1000 });
  ScrollTrigger.batch(pillars, {
    start: 'top 90%', once: true,
    onEnter: function (b) { gsap.to(b, { autoAlpha: 1, y: 0, rotationX: 0, duration: 1.1, stagger: 0.12, ease: 'power4.out', overwrite: true }); }
  });

  /* ---------- farming: cards + farm-to-fork line ---------- */
  var farmCards = $$('.farm-card');
  gsap.set(farmCards, { autoAlpha: 0, y: 60, scale: 0.94 });
  ScrollTrigger.batch(farmCards, {
    start: 'top 90%', once: true,
    onEnter: function (b) { gsap.to(b, { autoAlpha: 1, y: 0, scale: 1, duration: 1, stagger: 0.12, ease: 'back.out(1.4)', overwrite: true }); }
  });
  var forkLine = $('.fork-line');
  if (forkLine) {
    gsap.set(forkLine, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.to(forkLine, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.fork-card', start: 'top 85%', end: 'center 50%', scrub: 0.6 } });
    gsap.fromTo('.fork-hl', { backgroundSize: '0% 40%' }, { backgroundSize: '100% 40%', duration: 1.1, ease: 'power3.inOut', scrollTrigger: { trigger: '.fork-text', start: 'top 80%', once: true } });
  }

  /* ---------- benefits grid ---------- */
  var benefits = $$('.benefit');
  gsap.set(benefits, { autoAlpha: 0, y: 60 });
  ScrollTrigger.batch(benefits, {
    start: 'top 90%', once: true,
    onEnter: function (b) {
      gsap.to(b, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', overwrite: true });
      gsap.from(b.map(function (x) { return $('.benefit-emoji', x); }), { scale: 0, rotation: -30, duration: 0.8, stagger: 0.1, delay: 0.2, ease: 'back.out(2.6)' });
    }
  });

  /* ---------- legacy: lines light up one by one ---------- */
  $$('.legacy-lines li').forEach(function (li) {
    gsap.fromTo(li, { opacity: 0.12, x: -40 }, {
      opacity: 1, x: 0, ease: 'none',
      scrollTrigger: { trigger: li, start: 'top 88%', end: 'top 58%', scrub: 0.6 }
    });
  });
  gsap.to('.legacy-glow', { yPercent: 40, ease: 'none', scrollTrigger: { trigger: '.legacy', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---------- long-form story ---------- */
  $$('.chapter-num').forEach(function (n) {
    gsap.from(n, { autoAlpha: 0, y: 30, scale: 0.7, duration: 0.9, ease: 'back.out(2)', scrollTrigger: { trigger: n, start: 'top 88%', once: true } });
  });
  $$('.chapter-rule').forEach(function (r) {
    gsap.timeline({ scrollTrigger: { trigger: r, start: 'top 90%', once: true } })
      .from($$('span', r), { scaleX: 0, duration: 0.9, ease: 'power3.inOut' })
      .from($('i', r), { scale: 0, rotation: -180, duration: 0.7, ease: 'back.out(2.4)' }, '-=0.5');
  });
  var pullMark = $('.pull-mark');
  if (pullMark) {
    gsap.from(pullMark, { scale: 0.3, rotation: -14, autoAlpha: 0, duration: 0.9, ease: 'back.out(2)', scrollTrigger: { trigger: '.pull', start: 'top 85%', once: true } });
    gsap.fromTo('.pull', { '--bar': 0 }, { '--bar': 1, duration: 1.1, ease: 'power3.inOut', scrollTrigger: { trigger: '.pull', start: 'top 85%', once: true } });
  }
  [['.truths', '.truths li'], ['.commitments', '.commitments li']].forEach(function (pair) {
    if (!$(pair[0])) return;
    gsap.from(pair[1], {
      autoAlpha: 0, x: -36, duration: 0.8, stagger: 0.14, ease: 'power3.out',
      scrollTrigger: { trigger: pair[0], start: 'top 85%', once: true }
    });
  });
  var ticks = $$('.commit-tick path');
  if (ticks.length) {
    gsap.set(ticks, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.to(ticks, { strokeDashoffset: 0, duration: 0.5, stagger: 0.14, delay: 0.35, ease: 'power2.out', scrollTrigger: { trigger: '.commitments', start: 'top 85%', once: true } });
  }

  /* ---------- honour finale: creed stagger + signature ---------- */
  if ($('.creed')) {
    gsap.timeline({ scrollTrigger: { trigger: '.creed', start: 'top 78%', once: true } })
      .from('.creed li span', { yPercent: 110, rotation: 3, duration: 1.1, stagger: 0.22, ease: 'power4.out' })
      .from('.glory', { y: 24, autoAlpha: 0, duration: 0.9, ease: 'power3.out' }, '-=0.4');
  }
  if ($('.signature')) {
    gsap.timeline({ scrollTrigger: { trigger: '.signature', start: 'top 82%', once: true } })
      .from('.signature-logo', { scale: 0.6, autoAlpha: 0, rotation: -8, duration: 1, ease: 'back.out(1.8)' })
      .from('.sig-rule', { scaleX: 0, duration: 0.9, stagger: 0.15, ease: 'power3.inOut' }, '-=0.6')
      .from(['.sig-built', '.sig-named'], { y: 18, autoAlpha: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out' }, '-=0.6')
      .from('.honour-cta', { y: 20, autoAlpha: 0, duration: 0.7, ease: 'power3.out' }, '-=0.3');
  }

  /* ---------- keep triggers accurate (pins + fonts + images) ---------- */
  if (typeof ScrollTrigger.sort === 'function') ScrollTrigger.sort();
  ScrollTrigger.refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();

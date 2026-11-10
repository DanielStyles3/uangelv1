/* U Angel Foods website — small and dependency-free:
   menu, header border on scroll, Christmas strip/section/countdown, footer year. */
(function () {
  'use strict';
  var CAMPAIGN_END = Date.UTC(2026, 11, 25, 22, 59); // 25 Dec 2026, 23:59 Lagos time
  // Stable download link: /download redirects to the newest APK (see vercel.json → redirects).
  // After each new app build, update that redirect; the button and QR code never change.
  var APP_URL = 'https://uangelfoods.com/download';
  var doc = document.documentElement;

  // "Get the app" button + QR code
  var getApp = document.getElementById('get-app');
  if (getApp && APP_URL) getApp.href = APP_URL;
  var qr = document.getElementById('qr');
  if (qr && APP_URL) {
    qr.innerHTML = '<img alt="QR code to download the U Angel Foods app" width="220" height="220" src="https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=0&data=' + encodeURIComponent(APP_URL) + '">';
  }

  // "Read the full letter"
  var more = document.getElementById('readmore'), box = document.getElementById('letterbox');
  if (more && box) more.addEventListener('click', function () {
    var open = box.classList.toggle('open');
    more.textContent = open ? 'Show less' : 'Read the full letter';
    more.setAttribute('aria-expanded', String(open));
  });

  // Footer year
  var y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());

  // Header border once the page scrolls
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobile menu
  var burger = document.getElementById('burger');
  var menu = document.getElementById('mobile-menu');
  if (burger && menu) {
    var setOpen = function (open) {
      menu.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    burger.addEventListener('click', function () { setOpen(!menu.classList.contains('open')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  // Christmas strip: dismiss for this visit
  var close = document.getElementById('xbar-close');
  if (close) close.addEventListener('click', function () {
    doc.classList.remove('has-xbar');
    try { sessionStorage.setItem('ua-xbar-dismissed', '1'); } catch (e) {}
  });

  // Christmas section + menu links disappear when the campaign is over
  var over = Date.now() >= CAMPAIGN_END;
  if (over) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-xmas], [data-xmas-link]'), function (el) { el.hidden = true; });
    return;
  }

  // Countdown
  var cd = document.getElementById('xmas-countdown');
  if (cd) {
    var parts = { d: cd.querySelector('[data-cd="d"]'), h: cd.querySelector('[data-cd="h"]'), m: cd.querySelector('[data-cd="m"]') };
    var tick = function () {
      var left = Math.max(0, CAMPAIGN_END - Date.now());
      var mins = Math.floor(left / 60000);
      parts.d.textContent = String(Math.floor(mins / 1440));
      parts.h.textContent = String(Math.floor(mins / 60) % 24).padStart(2, '0');
      parts.m.textContent = String(mins % 60).padStart(2, '0');
      if (!left) { clearInterval(timer); cd.hidden = true; }
    };
    var timer = setInterval(tick, 30000);
    tick();
  }
})();

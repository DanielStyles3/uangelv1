/* Live content from the admin dashboard:
 *  - the hero (tag line, headline, intro, 3 photos)  → Admin › Website
 *  - the banners under the hero (same as the app)    → Admin › Promotions
 * The page already contains sensible defaults, so if anything fails nothing changes. */
(function () {
  'use strict';
  var URL_BASE = 'https://rembodejacmfbeohvmhl.supabase.co/rest/v1/';
  var KEY = 'sb_publishable_gQ92ZGE8a1mKL3SLLWB0Dw_knNnJDVg';
  var HEX = /^#[0-9a-f]{6}$/i;

  function get(path) {
    return fetch(URL_BASE + path, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) { return typeof u === 'string' && /^https:\/\//i.test(u) ? u : ''; }
  function setText(sel, v) {
    var el = document.querySelector(sel);
    if (el && typeof v === 'string' && v.trim()) el.textContent = v.trim();
  }

  // ---- Hero ----
  get('site_settings?select=value&key=eq.website_hero').then(function (rows) {
    var h = rows && rows[0] && rows[0].value;
    if (!h) return;
    setText('[data-hero="tag"]', h.tag);
    setText('[data-hero="title"]', h.title);
    setText('[data-hero="highlight"]', h.highlight);
    setText('[data-hero="subtitle"]', h.subtitle);
    (h.photos || []).slice(0, 3).forEach(function (p, i) {
      var fig = document.querySelector('[data-hero-photo="' + i + '"]');
      if (!fig || !p) return;
      var img = fig.querySelector('img'), cap = fig.querySelector('figcaption');
      var url = safeUrl(p.url);
      if (img && url && img.getAttribute('src') !== url) {
        img.removeAttribute('width'); img.removeAttribute('height');
        img.src = url;
        img.alt = p.caption || 'U Angel Foods';
      }
      if (cap && typeof p.caption === 'string') cap.textContent = p.caption;
    });
  }).catch(function () { /* keep defaults */ });

  // ---- Christmas campaign (Admin › Promotions › Christmas banner) ----
  get('site_settings?select=value&key=eq.christmas_banner').then(function (rows) {
    var x = rows && rows[0] && rows[0].value;
    if (!x) return;
    if (x.enabled === false) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-xmas], [data-xmas-link], #xbar'), function (el) { el.hidden = true; el.style.display = 'none'; });
      return;
    }
    var h = document.getElementById('xmas-title');
    // Keep the designed heading ("…by 25 December", bold number) unless the admin changed it.
    if (h && typeof x.title === 'string' && x.title.trim() && x.title.trim() !== 'Help us reach 10,000 pre-orders') h.textContent = x.title.trim();
    var eyebrow = document.querySelector('#christmas .eyebrow');
    if (eyebrow && typeof x.eyebrow === 'string' && x.eyebrow.trim()) eyebrow.textContent = x.eyebrow.trim();
    var cta = document.querySelector('#christmas .hero-ctas a');
    if (cta && typeof x.cta === 'string' && x.cta.trim()) cta.textContent = x.cta.trim() + ' →';
    var img = document.querySelector('#christmas .flyer img'), url = safeUrl(x.image_url);
    if (img && url && img.getAttribute('src') !== url && !/xmas-10000-preorders-25dec\.jpg$/.test(url)) {
      img.removeAttribute('width'); img.removeAttribute('height'); img.src = url;
    }
  }).catch(function () { /* keep defaults */ });

  // ---- Shop tiles: photo = the category's photo (Admin › Categories), same as the app ----
  var tiles = document.querySelectorAll('[data-cat]');
  if (tiles.length) {
    get('categories?select=name,image_url&parent_id=is.null').then(function (rows) {
      var byName = {};
      (rows || []).forEach(function (c) { byName[c.name] = c.image_url; });
      Array.prototype.forEach.call(tiles, function (card) {
        var url = safeUrl(byName[card.getAttribute('data-cat')]);
        var img = card.querySelector('.cat-media img');
        if (img && url && img.getAttribute('src') !== url) img.src = url;
      });
    }).catch(function () { /* keep defaults */ });
  }

  // App banners (Admin › Promotions) are shown in the app only, not on the website.
})();

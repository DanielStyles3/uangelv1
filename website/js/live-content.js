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

  // ---- Banners (live ones only; RLS already hides switched-off / out-of-date banners) ----
  var strip = document.getElementById('offers');
  var track = strip && strip.querySelector('[data-promos]');
  if (!track) return;
  get('promotions?select=id,eyebrow,title,cta,image_url,color&order=sort_order.asc&limit=8').then(function (rows) {
    rows = (rows || []).filter(function (p) { return p.title && safeUrl(p.image_url); });
    if (!rows.length) return;
    track.innerHTML = rows.map(function (p) {
      var c = HEX.test(p.color) ? p.color : '#FD652A';
      return '<a class="promo-card" href="#get" style="--promo:' + c + '">' +
        '<span class="promo-copy">' +
          (p.eyebrow ? '<small>' + esc(p.eyebrow) + '</small>' : '') +
          '<b>' + esc(p.title) + '</b>' +
          '<span class="promo-cta" style="color:' + c + '">' + esc(p.cta || 'Order in the app') + ' →</span>' +
        '</span>' +
        '<span class="promo-photo"><img src="' + esc(safeUrl(p.image_url)) + '" alt="" loading="lazy" decoding="async"></span>' +
      '</a>';
    }).join('');
    track.classList.toggle('single', rows.length === 1);
    strip.hidden = false;
  }).catch(function () { /* no banners: section stays hidden */ });
})();

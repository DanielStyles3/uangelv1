/* U Angel Foods admin: Categories section.
 * Main categories + subcategories with photos, drag-and-drop ordering (arrows as the
 * keyboard / touch alternative), a side-panel editor and a live preview of the app's Home.
 * Uses only the window.Admin contract (core.js). Styles: css/categories.css (cg- prefix). */
(function () {
  'use strict';
  if (!window.Admin || typeof window.Admin.registerSection !== 'function') return;
  var Admin = window.Admin;

  var IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var MAX_BYTES = 15 * 1024 * 1024;   // big camera photos are fine: they're shrunk before upload
  var DEFAULT_COLOR = '#FE8C00';
  var SWATCHES = ['#9D174D', '#991B1B', '#6B21A8', '#9A3412', '#166534', '#7A4419', '#0F5B78', '#FE8C00', '#181C2E'];
  var COLS = 'id,name,description,parent_id,emoji,color,image_url,sort_order,delivery_note,kind,enquiry_only,created_at';

  function svg(d, size, sw) {
    return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2.4) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/></svg>';
  var I_GRIP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="18" r="1.8"/><circle cx="15" cy="18" r="1.8"/></svg>';
  var I_UP = svg('<path d="m18 15-6-6-6 6"/>', 14, 2.6);
  var I_DOWN = svg('<path d="m6 9 6 6 6-6"/>', 14, 2.6);
  var I_LEFT = svg('<path d="m15 18-6-6 6-6"/>', 13, 2.6);
  var I_RIGHT = svg('<path d="m9 18 6-6-6-6"/>', 13, 2.6);
  var I_PLUS = svg('<path d="M12 5v14M5 12h14"/>', 16, 2.6);

  var S = null;            // { cats, byId, mains, subsBy, countBySub, menuTotal }
  var root = null;
  var expanded = {};       // main id -> true (kept across visits)
  var filter = 'all';      // 'all' | 'products' | 'service'
  var previewId = null;    // main category whose subcategories the preview shows
  var flashId = null;
  var saving = false;      // a reorder is being saved
  var drag = null;         // { type: 'main'|'sub', id }

  /* ---------------- Helpers ---------------- */

  function esc(s) { return Admin.escapeHtml(s == null ? '' : String(s)); }
  function norm(s) { return String(s || '').trim().toLowerCase(); }
  function validHex(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim().toUpperCase() : null; }
  function initial(name) { var t = String(name || '').trim(); return t ? Array.from(t)[0].toUpperCase() : '?'; }
  function errMsg(e) { return (e && (e.message || e.error_description)) || 'Something went wrong'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function sortCats(a, b) {
    var x = a.sort_order == null ? 1e9 : a.sort_order, y = b.sort_order == null ? 1e9 : b.sort_order;
    return x - y || String(a.name).localeCompare(String(b.name));
  }
  // A light tint of a colour (placeholder backgrounds).
  function tint(hex) {
    var h = validHex(hex) || DEFAULT_COLOR;
    var n = parseInt(h.slice(1), 16), mix = function (c) { return Math.round(c + (255 - c) * 0.86); };
    return 'rgb(' + mix(n >> 16) + ',' + mix((n >> 8) & 255) + ',' + mix(n & 255) + ')';
  }
  function colorOf(c) {
    if (!c) return DEFAULT_COLOR;
    if (c.parent_id) { var p = S.byId[c.parent_id]; return validHex(c.color) || (p && validHex(p.color)) || DEFAULT_COLOR; }
    return validHex(c.color) || DEFAULT_COLOR;
  }

  async function fetchAll(make) {
    var out = [], from = 0, step = 1000;
    for (;;) {
      var res = await make().range(from, from + step - 1);
      if (res.error) throw res.error;
      out = out.concat(res.data || []);
      if (!res.data || res.data.length < step) break;
      from += step;
    }
    return out;
  }

  function index(cats, menu) {
    var byId = {}, subsBy = {}, countBySub = {};
    cats.forEach(function (c) { byId[c.id] = c; });
    cats.forEach(function (c) { if (c.parent_id) (subsBy[c.parent_id] = subsBy[c.parent_id] || []).push(c); });
    Object.keys(subsBy).forEach(function (k) { subsBy[k].sort(sortCats); });
    (menu || []).forEach(function (m) { if (m.category_id) countBySub[m.category_id] = (countBySub[m.category_id] || 0) + 1; });
    S = {
      cats: cats, byId: byId, subsBy: subsBy, countBySub: countBySub, menuTotal: (menu || []).length,
      mains: cats.filter(function (c) { return !c.parent_id; }).sort(sortCats)
    };
  }
  function reindex() {
    var counts = S.countBySub, total = S.menuTotal;
    index(S.cats, null);
    S.countBySub = counts; S.menuTotal = total;
  }

  async function load() {
    var sb = Admin.sb;
    var r = await Promise.all([
      fetchAll(function () { return sb.from('categories').select(COLS).order('sort_order', { ascending: true }).order('name'); }),
      fetchAll(function () { return sb.from('menu').select('id,category_id').order('id'); })
    ]);
    index(r[0], r[1]);
  }

  function subsOf(mainId) { return (S && S.subsBy[mainId]) || []; }
  /** Products in a category and everything inside it (any depth). */
  function productCount(cat) {
    if (!cat) return 0;
    return (S.countBySub[cat.id] || 0) + subsOf(cat.id).reduce(function (n, s) { return n + productCount(s); }, 0);
  }
  /** 0 = main category, 1 = subcategory (tab in the app), 2 = group (chip), 3 = section (heading). */
  function depthOf(c) { var d = 0; for (var i = 0; c && c.parent_id && i < 10; i++) { d++; c = S.byId[c.parent_id]; } return d; }
  function levelNoun(depth) { return depth <= 0 ? 'category' : depth === 1 ? 'subcategory' : depth === 2 ? 'group' : 'section'; }
  var treeOpen = {};   // main id → the subcategory whose groups & sections are shown

  /* Photo or placeholder. `cls` sizes it; the placeholder is a tinted box with the initial. */
  function pic(c, cls) {
    var color = colorOf(c);
    if (c.image_url) return '<img class="' + cls + '" src="' + esc(c.image_url) + '" alt="" loading="lazy" data-cid="' + esc(c.id) + '" data-cls="' + cls + '">';
    return placeholder(c, cls, color);
  }
  function placeholder(c, cls, color) {
    return '<span class="' + cls + ' cg-ph" style="background:' + tint(color) + ';color:' + (validHex(color) || DEFAULT_COLOR) + '" aria-hidden="true">' + esc(c.emoji || initial(c.name)) + '</span>';
  }

  /* ---------------- Rendering ---------------- */

  function skeleton() {
    var rows = '';
    for (var i = 0; i < 6; i++) rows += '<div class="skeleton cg-skel"></div>';
    return '<div class="page-head"><div><h1>Categories</h1><p class="cg-sub">Loading categories…</p></div></div>' +
      '<div aria-busy="true" aria-label="Loading categories">' + rows + '</div>';
  }

  function renderAll() {
    if (!root) return;
    var shopCount = S.mains.filter(function (m) { return m.kind !== 'service'; }).length;
    var subTotal = S.cats.length - S.mains.length;
    if (!previewId || !S.byId[previewId]) {
      var firstShop = S.mains.find(function (m) { return m.kind !== 'service'; });
      previewId = firstShop ? firstShop.id : (S.mains[0] && S.mains[0].id);
    }

    var html =
      '<div class="page-head cg-head"><div><h1>Categories</h1><p class="cg-sub">' +
        plural(S.mains.length, 'category', 'categories') + ' · ' + plural(subTotal, 'subcategory', 'subcategories') + ' · ' + plural(S.menuTotal, 'product') + '</p></div>' +
        '<button type="button" class="btn btn-primary" data-act="add-main">' + I_PLUS + 'New category</button></div>' +
      '<div class="cg-layout"><div class="cg-col">' +
        '<p class="cg-tip" role="note">' + I_GRIP + '<span>Drag the dots to change the order customers see in the app, or use the arrows. Changes save straight away.</span></p>' +
        '<div class="cg-tabs" role="tablist" aria-label="Filter categories">' +
          tab('all', 'All', S.mains.length) + tab('products', 'Shop', shopCount) + tab('service', 'Services', S.mains.length - shopCount) +
        '</div>' +
        (S.mains.length ? '<div class="cg-list">' + mainRows() + '</div>'
          : '<div class="card cg-empty"><p><b>No categories yet</b></p><p>Create your first category, then add subcategories to it.</p></div>') +
      '</div>' +
      '<aside class="cg-preview" aria-label="Live app preview"><h4>Live app preview</h4><p>What customers see on Home. It updates as you make changes.</p>' +
        '<div class="cg-phone"><div class="cg-screen"><div class="cg-pbar"><span>9:41</span><i></i><span>100%</span></div><div class="cg-pv">' + previewHtml() + '</div></div></div>' +
      '</aside></div>';
    root.innerHTML = html;
  }

  function tab(id, label, n) {
    var on = filter === id;
    return '<button type="button" class="cg-tab' + (on ? ' on' : '') + '" role="tab" aria-selected="' + on + '" data-filter="' + id + '">' + label + ' <b>' + n + '</b></button>';
  }

  function mainRows() {
    var shopPos = 0, svcPos = 0, total = S.mains.length;
    return S.mains.map(function (m, i) {
      var service = m.kind === 'service';
      var pos = service ? ++svcPos : ++shopPos;
      if (filter !== 'all' && (service ? 'service' : 'products') !== filter) return '';
      var subs = subsOf(m.id);
      var open = !!expanded[m.id];
      var noPhoto = subs.filter(function (s) { return !s.image_url; }).length + (m.image_url ? 0 : 1);
      var color = colorOf(m);
      return '<article class="cg-cat' + (open ? ' open' : '') + '" data-id="' + esc(m.id) + '">' +
        '<div class="cg-row">' +
          '<button type="button" class="cg-handle" draggable="true" data-drag-main="' + esc(m.id) + '" aria-label="Drag to reorder ' + esc(m.name) + '" title="Drag to reorder">' + I_GRIP + '</button>' +
          '<span class="cg-pos' + (service ? '' : ' live') + '" title="' + esc(service ? 'Position ' + pos + ' in the Catering & Events banner' : 'Position ' + pos + ' in the circles on Home') + '">' + pos + '</span>' +
          '<span class="cg-ring" style="border-color:' + color + '">' + pic(m, 'cg-ring-img') + '</span>' +
          '<div class="cg-info"><h3>' + esc(m.name) +
            ' <span class="cg-pill ' + (service ? 'svc">Service' : 'shop">Shop') + '</span>' +
            (noPhoto ? '<span class="cg-pill warn">' + plural(noPhoto, 'photo') + ' missing</span>' : '') + '</h3>' +
            '<small>' + plural(subs.length, 'subcategory', 'subcategories') +
              (service ? ' · customers send requests' : ' · ' + plural(productCount(m), 'product')) +
              (m.delivery_note ? ' · 🚚 ' + esc(m.delivery_note) : '') + '</small></div>' +
          '<div class="cg-acts">' +
            '<button type="button" class="cg-icon" data-move-main="' + esc(m.id) + '" data-dir="-1" aria-label="Move ' + esc(m.name) + ' up"' + (i === 0 ? ' disabled' : '') + '>' + I_UP + '</button>' +
            '<button type="button" class="cg-icon" data-move-main="' + esc(m.id) + '" data-dir="1" aria-label="Move ' + esc(m.name) + ' down"' + (i === total - 1 ? ' disabled' : '') + '>' + I_DOWN + '</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + esc(m.id) + '">Edit</button>' +
            '<button type="button" class="cg-icon cg-chev" data-toggle="' + esc(m.id) + '" aria-expanded="' + open + '" aria-controls="cg-subs-' + esc(m.id) + '" aria-label="' + (open ? 'Hide' : 'Show') + ' subcategories of ' + esc(m.name) + '">' + I_DOWN + '</button>' +
          '</div>' +
        '</div>' +
        (open ? subsHtml(m) : '') +
      '</article>';
    }).join('');
  }

  function subsHtml(m) {
    var subs = subsOf(m.id), service = m.kind === 'service';
    return '<div class="cg-subs" id="cg-subs-' + esc(m.id) + '">' +
      '<p class="cg-subs-note">Subcategories, in the order shown on the ' + esc(m.name) + ' page</p>' +
      '<div class="cg-grid">' + subs.map(function (s, j) {
        var pc = productCount(s), inner = subsOf(s.id).length;
        return '<div class="cg-sub" data-sub="' + esc(s.id) + '" data-parent="' + esc(m.id) + '">' +
          '<div class="cg-sub-img">' + pic(s, 'cg-sub-pic') +
            '<button type="button" class="cg-grab" draggable="true" data-drag-sub="' + esc(s.id) + '" aria-label="Drag to reorder ' + esc(s.name) + '" title="Drag to reorder">' + I_GRIP + '</button>' +
            '<span class="cg-num">' + (j + 1) + '</span></div>' +
          '<div class="cg-sub-body"><b>' + esc(s.name) + '</b>' +
            '<small>' + (service && !pc ? 'Request type' : plural(pc, 'product')) + (s.image_url ? '' : ' · <span class="cg-miss">no photo</span>') + '</small>' +
            '<div class="cg-tools">' +
              '<button type="button" class="cg-icon sm" data-move-sub="' + esc(s.id) + '" data-dir="-1" aria-label="Move ' + esc(s.name) + ' earlier"' + (j === 0 ? ' disabled' : '') + '>' + I_LEFT + '</button>' +
              '<button type="button" class="cg-icon sm" data-move-sub="' + esc(s.id) + '" data-dir="1" aria-label="Move ' + esc(s.name) + ' later"' + (j === subs.length - 1 ? ' disabled' : '') + '>' + I_RIGHT + '</button>' +
              '<button type="button" class="cg-edit" data-edit-sub="' + esc(s.id) + '">Edit</button>' +
            '</div>' +
            (service ? '' : '<button type="button" class="cg-inner' + (treeOpen[m.id] === s.id ? ' on' : '') + '" data-tree="' + esc(s.id) + '" aria-expanded="' + (treeOpen[m.id] === s.id) + '">' +
              (inner ? plural(inner, 'group') : 'Groups & sections') + ' ▾</button>') +
          '</div></div>';
      }).join('') +
      '<button type="button" class="cg-add" data-add-sub="' + esc(m.id) + '"><span>+</span>Add subcategory</button>' +
      '</div>' +
      (!service && treeOpen[m.id] && S.byId[treeOpen[m.id]] ? treeHtml(S.byId[treeOpen[m.id]]) : '') +
      '</div>';
  }

  /**
   * Groups and sections inside a subcategory, like a supermarket aisle in the app:
   *   tab "Fruits & Vegetables" → chips "Fruits", "Vegetables" → headings "Bananas", "Citrus"…
   */
  function treeHtml(s) {
    var groups = subsOf(s.id);
    var arrows = function (c, list, j) {
      return '<button type="button" class="cg-icon sm" data-move-sub="' + esc(c.id) + '" data-dir="-1" aria-label="Move ' + esc(c.name) + ' earlier"' + (j === 0 ? ' disabled' : '') + '>' + I_LEFT + '</button>' +
        '<button type="button" class="cg-icon sm" data-move-sub="' + esc(c.id) + '" data-dir="1" aria-label="Move ' + esc(c.name) + ' later"' + (j === list.length - 1 ? ' disabled' : '') + '>' + I_RIGHT + '</button>';
    };
    return '<div class="cg-tree" aria-label="Groups and sections in ' + esc(s.name) + '">' +
      '<div class="cg-tree-h"><div><b>Inside “' + esc(s.name) + '”</b>' +
        '<small>In the app, <b>' + esc(s.name) + '</b> is a tab. <b>Groups</b> are the buttons under it (e.g. Fruits, Vegetables, Herbs) and <b>sections</b> are the headings inside a group (e.g. Bananas, Citrus). Put products in the most specific one. Empty ones are hidden from customers.</small></div>' +
        '<button type="button" class="cg-icon" data-tree="' + esc(s.id) + '" aria-label="Close">×</button></div>' +
      (groups.length ? groups.map(function (g, j) {
        var secs = subsOf(g.id);
        return '<div class="cg-tree-g">' +
          '<div class="cg-tree-row"><span class="cg-tree-dot"></span><b>' + esc(g.name) + '</b><small>' + plural(productCount(g), 'product') + '</small>' +
            '<span class="cg-tree-sp"></span>' + arrows(g, groups, j) +
            '<button type="button" class="cg-edit" data-edit-sub="' + esc(g.id) + '">Edit</button></div>' +
          '<div class="cg-tree-secs">' + secs.map(function (x, k) {
            return '<span class="cg-tree-sec"><span>' + esc(x.name) + ' <small>' + productCount(x) + '</small></span>' + arrows(x, secs, k) +
              '<button type="button" class="cg-icon sm" data-edit-sub="' + esc(x.id) + '" aria-label="Edit ' + esc(x.name) + '">✎</button></span>';
          }).join('') +
            '<button type="button" class="cg-tree-add" data-add-in="' + esc(g.id) + '">+ Section in ' + esc(g.name) + '</button></div>' +
        '</div>';
      }).join('') : '<p class="cg-help" style="margin:4px 0 10px">No groups yet. Its products show as one grid in the app.</p>') +
      '<button type="button" class="cg-add cg-tree-addg" data-add-in="' + esc(s.id) + '"><span>+</span>Add group in ' + esc(s.name) + '</button>' +
    '</div>';
  }

  function previewHtml() {
    var shop = S.mains.filter(function (m) { return m.kind !== 'service'; });
    var svc = S.mains.filter(function (m) { return m.kind === 'service'; });
    var sel = S.byId[previewId];
    var tiles = sel ? subsOf(sel.id).slice(0, 4) : [];
    return '<div><div class="cg-p-hello">Good afternoon 👋</div><div class="cg-p-loc">📍 Lekki, Lagos</div></div>' +
      '<div class="cg-p-search">Search cakes, drinks, groceries…</div>' +
      (shop.length ? '<div class="cg-p-circles">' + shop.map(function (m) {
        return '<div class="cg-p-circle' + (m.id === flashId ? ' flash' : '') + '"><span class="cg-p-ring" style="border-color:' + colorOf(m) + '">' + pic(m, 'cg-p-img') + '</span><b>' + esc(m.name) + '</b></div>';
      }).join('') + '</div>' : '') +
      (sel ? '<div class="cg-p-h">' + esc(sel.name) + ' page</div>' +
        (tiles.length ? '<div class="cg-p-tiles">' + tiles.map(function (s) {
          return '<div class="cg-p-tile">' + pic(s, 'cg-p-tile-img') + '<b>' + esc(s.name) + '</b></div>';
        }).join('') + '</div>' : '<p class="cg-p-none">No subcategories yet</p>') : '') +
      (svc.length ? '<div class="cg-p-banner"><span>CATERING &amp; EVENTS</span><b>Planning something special?</b><div>' +
        svc.map(function (m) { return '<i>' + esc(m.name) + ' →</i>'; }).join('') + '</div></div>' : '');
  }

  function refreshPreview() {
    var pv = root && root.querySelector('.cg-pv');
    if (pv) pv.innerHTML = previewHtml();
  }

  function onImgError(e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.hasAttribute('data-cid') || !S) return;
    var c = S.byId[img.getAttribute('data-cid')];
    if (!c) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = placeholder(c, img.getAttribute('data-cls') || '', colorOf(c));
    img.replaceWith(tmp.firstChild);
  }

  /* ---------------- Clicks ---------------- */

  function onClick(e) {
    var b = e.target.closest('button');
    if (!b || !root || !root.contains(b) || b.disabled) return;
    var v;
    if ((v = b.getAttribute('data-filter'))) { filter = v; renderAll(); return; }
    if ((v = b.getAttribute('data-toggle'))) {
      expanded[v] = !expanded[v];
      if (expanded[v]) previewId = v;
      renderAll();
      var t = root.querySelector('[data-toggle="' + CSS.escape(v) + '"]'); if (t) t.focus();
      return;
    }
    if (b.getAttribute('data-act') === 'add-main') return openEditor('main', null, null);
    if ((v = b.getAttribute('data-edit'))) return S.byId[v] && openEditor('main', S.byId[v], null);
    if ((v = b.getAttribute('data-add-sub'))) return S.byId[v] && openEditor('sub', null, S.byId[v]);
    if ((v = b.getAttribute('data-add-in'))) return S.byId[v] && openEditor('sub', null, S.byId[v]);
    if ((v = b.getAttribute('data-tree'))) {
      var sub = S.byId[v], mainId = sub && sub.parent_id;
      if (!mainId) return;
      treeOpen[mainId] = treeOpen[mainId] === v ? null : v;
      renderAll();
      return;
    }
    if ((v = b.getAttribute('data-edit-sub'))) return S.byId[v] && openEditor('sub', S.byId[v], S.byId[S.byId[v].parent_id]);
    if ((v = b.getAttribute('data-move-main'))) return moveBy(S.mains, v, Number(b.getAttribute('data-dir')), '[data-move-main="');
    if ((v = b.getAttribute('data-move-sub'))) { var c = S.byId[v]; return c && moveBy(subsOf(c.parent_id), v, Number(b.getAttribute('data-dir')), '[data-move-sub="'); }
  }

  /* ---------------- Reordering ---------------- */

  function moveBy(siblings, id, dir, sel) {
    var from = siblings.findIndex(function (c) { return c.id === id; });
    var to = from + dir;
    if (from < 0 || to < 0 || to >= siblings.length) return;
    var order = siblings.slice();
    order.splice(to, 0, order.splice(from, 1)[0]);
    saveOrder(order, id).then(function () {
      var nb = root && root.querySelector(sel + CSS.escape(id) + '"][data-dir="' + dir + '"]');
      if (!nb || nb.disabled) nb = root && root.querySelector(sel + CSS.escape(id) + '"][data-dir="' + (-dir) + '"]');
      if (nb) nb.focus();
    });
  }

  /** Optimistically apply the new order, then save it (sort_order = 1..n). */
  async function saveOrder(order, movedId) {
    if (saving) return;
    var before = order.map(function (c) { return [c, c.sort_order]; });
    order.forEach(function (c, k) { c.sort_order = k + 1; });
    var moved = S.byId[movedId];
    if (moved && !moved.parent_id) { flashId = movedId; setTimeout(function () { flashId = null; refreshPreview(); }, 900); }
    if (moved && moved.parent_id) previewId = moved.parent_id;
    reindex();
    renderAll();

    saving = true;
    try {
      var ids = order.map(function (c) { return c.id; });
      var res = await Admin.sb.rpc('admin_reorder_categories', { p_ids: ids });
      if (res.error && /admin_reorder_categories|PGRST202|function/i.test(res.error.message + ' ' + res.error.code)) {
        // Database not updated yet (schema.sql not re-run): save row by row instead.
        var results = await Promise.all(order.map(function (c) {
          return Admin.sb.from('categories').update({ sort_order: c.sort_order }).eq('id', c.id);
        }));
        res = results.find(function (r) { return r.error; }) || { error: null };
      }
      if (res.error) throw res.error;
      var pos = order.findIndex(function (c) { return c.id === movedId; }) + 1;
      Admin.toast(moved ? 'Order saved. ' + moved.name + ' is now #' + pos : 'Order saved', 'success', { duration: 2200 });
    } catch (e) {
      before.forEach(function (p) { p[0].sort_order = p[1]; });
      reindex();
      renderAll();
      Admin.toast('Couldn’t save the new order: ' + errMsg(e), 'error');
    } finally {
      saving = false;
    }
  }

  function clearMarks() {
    Array.prototype.forEach.call(root.querySelectorAll('.drop-before,.drop-after,.drop-target,.dragging'), function (x) {
      x.classList.remove('drop-before', 'drop-after', 'drop-target', 'dragging');
    });
  }

  function onDragStart(e) {
    var hm = e.target.closest && e.target.closest('[data-drag-main]');
    var hs = e.target.closest && e.target.closest('[data-drag-sub]');
    if (saving || (!hm && !hs)) return;
    if (hs) {
      drag = { type: 'sub', id: hs.getAttribute('data-drag-sub') };
      var card = hs.closest('.cg-sub'); card.classList.add('dragging');
      try { e.dataTransfer.setDragImage(card, 40, 40); } catch (_) {}
    } else {
      drag = { type: 'main', id: hm.getAttribute('data-drag-main') };
      var art = hm.closest('.cg-cat'); art.classList.add('dragging');
      try { e.dataTransfer.setDragImage(art, 30, 30); } catch (_) {}
    }
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', drag.id); } catch (_) {}
  }
  function onDragOver(e) {
    if (!drag) return;
    if (drag.type === 'main') {
      var art = e.target.closest('.cg-cat');
      if (!art || art.getAttribute('data-id') === drag.id) return;
      e.preventDefault();
      Array.prototype.forEach.call(root.querySelectorAll('.drop-before,.drop-after'), function (x) { x.classList.remove('drop-before', 'drop-after'); });
      var r = art.getBoundingClientRect();
      art.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
    } else {
      var card = e.target.closest('.cg-sub'), dragged = S.byId[drag.id];
      if (!card || !dragged || card.getAttribute('data-parent') !== dragged.parent_id || card.getAttribute('data-sub') === drag.id) return;
      e.preventDefault();
      Array.prototype.forEach.call(root.querySelectorAll('.drop-target'), function (x) { x.classList.remove('drop-target'); });
      card.classList.add('drop-target');
    }
  }
  function onDrop(e) {
    if (!drag) return;
    e.preventDefault();
    var d = drag; drag = null;
    if (d.type === 'main') {
      var art = e.target.closest('.cg-cat');
      if (art && art.getAttribute('data-id') !== d.id) {
        var before = art.classList.contains('drop-before');
        var order = S.mains.filter(function (m) { return m.id !== d.id; });
        var at = order.findIndex(function (m) { return m.id === art.getAttribute('data-id'); }) + (before ? 0 : 1);
        order.splice(at, 0, S.byId[d.id]);
        clearMarks();
        saveOrder(order, d.id);
        return;
      }
    } else {
      var card = e.target.closest('.cg-sub'), dragged = S.byId[d.id];
      if (card && dragged && card.getAttribute('data-parent') === dragged.parent_id && card.getAttribute('data-sub') !== d.id) {
        var subs = subsOf(dragged.parent_id).slice();
        var from = subs.indexOf(dragged), to = subs.findIndex(function (s) { return s.id === card.getAttribute('data-sub'); });
        subs.splice(to, 0, subs.splice(from, 1)[0]);
        clearMarks();
        saveOrder(subs, d.id);
        return;
      }
    }
    clearMarks();
  }
  function onDragEnd() { drag = null; if (root) clearMarks(); }

  /* ---------------- Editor (side panel) ---------------- */

  function openEditor(level, item, parent) {
    var isMain = level === 'main';
    var editing = !!item;
    if (!isMain && !parent) { Admin.toast('Parent category not found. Reload the page.', 'error'); return; }
    var pc = editing ? productCount(item) : 0;
    var draft = {
      name: editing ? item.name : '',
      description: editing ? (item.description || '') : '',
      color: isMain ? ((editing && validHex(item.color)) || DEFAULT_COLOR) : null,
      kind: isMain ? (editing ? (item.kind || 'products') : 'products') : (parent.kind || 'products'),
      delivery_note: editing ? (item.delivery_note || '') : '',
      enquiry_only: editing ? !!item.enquiry_only : false,
      emoji: editing ? item.emoji : null,
      file: null, objUrl: null, removed: false
    };
    var currentUrl = editing ? item.image_url : null;
    var uid = 'cg' + Math.random().toString(36).slice(2, 8);

    var form = document.createElement('form');
    form.className = 'cg-form';
    form.noValidate = true;
    form.innerHTML =
      (isMain ? '' : '<p class="cg-in">Inside <b>' + esc(parent.name) + '</b></p>') +
      '<div class="field"><span class="cg-lbl" id="' + uid + '-pl">Photo</span>' +
        '<div class="cg-up" role="group" aria-labelledby="' + uid + '-pl">' +
          '<div class="cg-up-prev" data-prev></div>' +
          '<div class="cg-drop" data-drop>' +
            '<span>' + (isMain ? 'Drag a photo here or choose one. Square photos look best in the circle.' : 'Drag a photo here or choose one. Products without their own photo show this one.') + '</span>' +
            '<div class="cg-drop-btns">' +
              '<label class="btn btn-ghost btn-sm" for="' + uid + '-file" tabindex="0" role="button">Choose photo</label>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-remove>Remove</button>' +
            '</div>' +
            '<input type="file" id="' + uid + '-file" class="cg-file" accept="image/jpeg,image/png,image/webp">' +
            '<span class="cg-help">JPEG, PNG or WebP, up to 5 MB.</span>' +
            '<span class="cg-err" data-photo-err role="alert"></span>' +
          '</div>' +
        '</div></div>' +
      '<div class="field"><label for="' + uid + '-name">Name <span class="cg-req" aria-hidden="true">*</span></label>' +
        '<input id="' + uid + '-name" name="name" class="input" maxlength="80" autocomplete="off" autofocus value="' + esc(draft.name) + '">' +
        '<span class="cg-err" data-err="name" role="alert"></span></div>' +
      (isMain ?
        '<div class="field"><span class="cg-lbl" id="' + uid + '-kl">What customers do here</span>' +
          '<div class="cg-seg" role="radiogroup" aria-labelledby="' + uid + '-kl">' +
            '<button type="button" role="radio" data-kind="products">Shop<small>Browse and add to cart</small></button>' +
            '<button type="button" role="radio" data-kind="service">Service<small>Send a request for a quote</small></button>' +
          '</div>' +
          '<div class="cg-warn" data-kind-warn hidden role="status"></div></div>' +
        '<div class="field"><span class="cg-lbl" id="' + uid + '-cl">Ring colour</span>' +
          '<div class="cg-swatches" role="radiogroup" aria-labelledby="' + uid + '-cl" data-swatches></div>' +
          '<span class="cg-err" data-err="color" role="alert"></span></div>'
        : '') +
      '<div class="field"><label for="' + uid + '-desc">Short description <span class="cg-opt">(optional)</span></label>' +
        '<textarea id="' + uid + '-desc" name="description" class="textarea" rows="2" maxlength="500">' + esc(draft.description) + '</textarea></div>' +
      (isMain ?
        '<div class="field" data-note-field><label for="' + uid + '-note">Delivery note <span class="cg-opt">(optional)</span></label>' +
          '<input id="' + uid + '-note" name="delivery_note" class="input" maxlength="120" autocomplete="off" placeholder="e.g. Standard next-day delivery" value="' + esc(draft.delivery_note) + '"></div>'
        : '') +
      // Made to order (e.g. Wedding Cakes): no Add to cart, customers send an enquiry instead.
      (!isMain && draft.kind !== 'service' ?
        '<div class="pp-avail" style="border:1.5px solid #FDBA9B;background:#FFF8F4"><div><b>Enquiry only</b>' +
          '<small>For made-to-order items like wedding cakes: the app hides the price and Add to cart and shows “Send an enquiry” and WhatsApp instead. You agree the design and send an invoice on WhatsApp; the customer pays by bank transfer. Enquiries appear under Requests.</small></div>' +
          '<button type="button" class="pp-switch" role="switch" aria-checked="' + draft.enquiry_only + '" data-enquiry aria-label="Enquiry only"><i></i></button></div>'
        : '') +
      '<div class="field"><span class="cg-lbl">How it looks in the app</span><div class="cg-mini" data-mini></div></div>' +
      (isMain ? '<p class="cg-help" style="margin:0">This photo is also used for the category’s card in the “Shop” section of uangelfoods.com.</p>' : '') +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';

    var $ = function (s) { return form.querySelector(s); };
    var input = $('.cg-file'), drop = $('[data-drop]'), errEl = $('[data-photo-err]');
    var enqSw = $('[data-enquiry]');
    if (enqSw) enqSw.addEventListener('click', function () { draft.enquiry_only = !draft.enquiry_only; enqSw.setAttribute('aria-checked', String(draft.enquiry_only)); });

    function photoSrc() { return draft.objUrl || (!draft.removed ? currentUrl : null); }
    function ring() { return isMain ? draft.color : colorOf(parent); }
    function face(cls) {
      var src = photoSrc(), color = ring();
      return src ? '<img class="' + cls + '" src="' + esc(src) + '" alt="">'
        : '<span class="' + cls + ' cg-ph" style="background:' + tint(color) + ';color:' + color + '">' + esc(draft.emoji || initial(draft.name)) + '</span>';
    }
    function paint(keepSwatches) {
      var color = ring();
      var name = esc(draft.name.trim() || (isMain ? 'Category name' : 'Subcategory name'));
      $('[data-prev]').style.borderColor = color;
      $('[data-prev]').innerHTML = face('cg-up-img');
      $('[data-remove]').hidden = !photoSrc();
      if (isMain && keepSwatches) {
        // The native colour picker is open: only update the selection, don't rebuild it.
        Array.prototype.forEach.call(form.querySelectorAll('[data-color]'), function (b) { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); });
        form.querySelector('.cg-sw-custom').classList.add('on');
      } else if (isMain) {
        $('[data-swatches]').innerHTML = SWATCHES.map(function (c) {
          var on = c === draft.color;
          return '<button type="button" role="radio" class="cg-sw' + (on ? ' on' : '') + '" aria-checked="' + on + '" aria-label="Colour ' + c + '" data-color="' + c + '" style="background:' + c + '"></button>';
        }).join('') +
          '<label class="cg-sw cg-sw-custom' + (SWATCHES.indexOf(draft.color) === -1 ? ' on' : '') + '" title="Pick any colour">' +
          '<input type="color" value="' + esc(draft.color.toLowerCase()) + '" aria-label="Pick any colour" data-custom></label>';
      }
      if (isMain) {
        Array.prototype.forEach.call(form.querySelectorAll('[data-kind]'), function (b) {
          var on = b.getAttribute('data-kind') === draft.kind;
          b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
        });
        var warn = $('[data-kind-warn]');
        var toService = draft.kind === 'service' && (!editing || item.kind !== 'service');
        warn.hidden = !(toService && editing);
        if (!warn.hidden) warn.textContent = pc > 0
          ? 'This category has ' + plural(pc, 'product') + '. As a service, customers send a request instead of buying, so they won’t be able to shop these here.'
          : 'Its subcategories will also become request types.';
      }
      $('[data-mini]').innerHTML = isMain
        ? '<div class="cg-mini-item"><small>' + (draft.kind === 'service' ? 'Catering & Events banner' : 'Home circle') + '</small>' +
            (draft.kind === 'service'
              ? '<span class="cg-mini-btn">' + name + ' →</span>'
              : '<div class="cg-p-circle"><span class="cg-p-ring big" style="border-color:' + color + '">' + face('cg-p-img') + '</span><b>' + name + '</b></div>') +
          '</div><p class="cg-mini-note">' + (draft.kind === 'service'
            ? 'Services appear as a button in the dark Catering & Events banner at the bottom of Home.'
            : 'Appears in the row of circles near the top of Home. Use the arrows or drag to set its position.') + '</p>'
        : '<div class="cg-mini-item"><small>Tile on the ' + esc(parent.name) + ' page</small><div class="cg-p-tile big">' + face('cg-p-tile-img') + '<b>' + name + '</b></div></div>';
    }

    function take(file) {
      errEl.textContent = '';
      if (!file) return;
      if (IMG_TYPES.indexOf(file.type) === -1) { errEl.textContent = 'Please choose a JPEG, PNG or WebP image.'; return; }
      if (file.size > MAX_BYTES) { errEl.textContent = 'That image is larger than 15 MB.'; return; }
      if (draft.objUrl) URL.revokeObjectURL(draft.objUrl);
      draft.file = file; draft.removed = false; draft.objUrl = URL.createObjectURL(file);
      // Start shrinking + uploading now, so Save is instant.
      draft.upload = Admin.uploadImage(file, 'categories');
      draft.upload.catch(function () {});
      paint();
    }
    function dispose() { if (draft.objUrl) URL.revokeObjectURL(draft.objUrl); }

    input.addEventListener('change', function () { take(input.files && input.files[0]); input.value = ''; });
    form.querySelector('label[for="' + uid + '-file"]').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    $('[data-remove]').addEventListener('click', function () {
      if (draft.objUrl) URL.revokeObjectURL(draft.objUrl);
      draft.file = null; draft.objUrl = null; draft.removed = true; errEl.textContent = '';
      paint();
    });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { take(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
    drop.addEventListener('click', function (e) { if (!e.target.closest('label, button, input')) input.click(); });
    $('[name="name"]').addEventListener('input', function () { draft.name = this.value; fieldError('name', ''); paint(); });
    $('[name="description"]').addEventListener('input', function () { draft.description = this.value; });
    if (isMain) {
      $('[name="delivery_note"]').addEventListener('input', function () { draft.delivery_note = this.value; });
      form.addEventListener('click', function (e) {
        var sw = e.target.closest('[data-color]');
        if (sw) { draft.color = sw.getAttribute('data-color'); paint(); return; }
        var k = e.target.closest('[data-kind]');
        if (k) { draft.kind = k.getAttribute('data-kind'); paint(); }
      });
      form.addEventListener('input', function (e) {
        if (e.target.hasAttribute('data-custom')) { draft.color = validHex(e.target.value) || DEFAULT_COLOR; paint(true); }
      });
    }
    function fieldError(name, msg) {
      var ctl = form.querySelector('[name="' + name + '"]'), err = form.querySelector('[data-err="' + name + '"]');
      if (err) err.textContent = msg || '';
      if (ctl) { ctl.classList.toggle('cg-invalid', !!msg); if (msg) ctl.setAttribute('aria-invalid', 'true'); else ctl.removeAttribute('aria-invalid'); }
    }
    paint();

    var busy = false, m;
    async function save() {
      if (busy) return;
      var name = draft.name.trim().replace(/\s+/g, ' ');
      var siblings = isMain ? S.mains : subsOf(parent.id);
      if (!name) { fieldError('name', 'Enter a name.'); $('[name="name"]').focus(); return; }
      if (siblings.some(function (x) { return norm(x.name) === norm(name) && (!editing || x.id !== item.id); })) {
        fieldError('name', isMain ? 'A category with this name already exists.' : '“' + parent.name + '” already has a subcategory with this name.');
        $('[name="name"]').focus(); return;
      }
      var kindChanged = isMain && editing && draft.kind !== (item.kind || 'products');
      if (kindChanged && draft.kind === 'service' && pc > 0) {
        var ok = await Admin.confirm('“' + item.name + '” has ' + plural(pc, 'product') + '. Switch it to a service anyway? Customers won’t be able to buy them from this category.', { danger: true, confirmLabel: 'Switch to service' });
        if (!ok) return;
      }

      busy = true;
      var saveBtn = m.el.querySelector('.modal-actions .btn-primary');
      Admin.setLoading(saveBtn, true, 'Saving…');
      try {
        var imageUrl;
        try {
          imageUrl = draft.file ? await (draft.upload || Admin.uploadImage(draft.file, 'categories')) : (draft.removed ? null : (currentUrl || null));
        } catch (e) { Admin.toast('Photo upload failed: ' + errMsg(e), 'error'); return; }

        var payload = { name: name, description: draft.description.trim() || null, image_url: imageUrl };
        if (isMain) {
          payload.color = draft.color;
          payload.kind = draft.kind;
          payload.delivery_note = draft.delivery_note.trim() || null;
        } else if (draft.kind !== 'service') {
          payload.enquiry_only = !!draft.enquiry_only;
        }
        if (!editing) {
          payload.parent_id = isMain ? null : parent.id;
          if (!isMain) payload.kind = parent.kind || 'products';
          payload.sort_order = siblings.reduce(function (mx, x) { return Math.max(mx, x.sort_order || 0); }, 0) + 1;
        }
        var res = editing
          ? await Admin.sb.from('categories').update(payload).eq('id', item.id).select(COLS).single()
          : await Admin.sb.from('categories').insert(payload).select(COLS).single();
        if (res.error) {
          if (res.error.code === '23505') fieldError('name', 'That name is already taken here.');
          else Admin.toast('Couldn’t save: ' + errMsg(res.error), 'error');
          return;
        }
        var saved = res.data, subErr = null;
        if (editing) {
          Object.assign(S.byId[item.id], saved);
          if (kindChanged && subsOf(item.id).length) {
            var u = await Admin.sb.from('categories').update({ kind: draft.kind }).eq('parent_id', item.id);
            if (u.error) subErr = u.error; else subsOf(item.id).forEach(function (s) { s.kind = draft.kind; });
          }
        } else {
          S.cats.push(saved);
          if (isMain) { expanded[saved.id] = true; previewId = saved.id; }
          else {
            var top = parent; while (top.parent_id && S.byId[top.parent_id]) top = S.byId[top.parent_id];
            expanded[top.id] = true; previewId = top.id;
            // Added inside a subcategory (a group or section): keep that panel open.
            if (parent.parent_id) { var tab = parent; while (tab.parent_id && tab.parent_id !== top.id) tab = S.byId[tab.parent_id]; treeOpen[top.id] = tab.id; }
          }
        }
        reindex();
        dispose();
        m.close();
        if (subErr) Admin.toast('Saved, but its subcategories couldn’t be updated: ' + errMsg(subErr), 'error');
        else Admin.toast(editing ? 'Saved “' + saved.name + '”' : 'Added “' + saved.name + '”', 'success');
        renderAll();
      } catch (e) {
        Admin.toast('Couldn’t save: ' + errMsg(e), 'error');
      } finally {
        busy = false;
        if (m.isOpen()) Admin.setLoading(saveBtn, false);
      }
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });

    var actions = [];
    if (editing) actions.push({ label: 'Delete', variant: 'danger', onClick: function (close) { tryDelete(item, close); } });
    actions.push({ label: 'Cancel', variant: 'ghost', onClick: function (close) { dispose(); close(); } });
    var noun = isMain ? 'category' : levelNoun(depthOf(parent) + 1);   // subcategory / group / section
    actions.push({ label: editing ? 'Save changes' : (isMain ? 'Create category' : 'Add ' + noun), variant: 'primary', onClick: function () { save(); } });
    m = Admin.modal({
      title: (editing ? 'Edit ' : 'New ') + noun,
      body: form,
      className: 'cg-drawer',
      actions: actions,
      onClose: dispose
    });
  }

  async function tryDelete(c, closeEditor) {
    if (!c.parent_id) {
      var subs = subsOf(c.id).length;
      if (subs) { blocked('Can’t delete “' + c.name + '” yet', 'It still has ' + plural(subs, 'subcategory', 'subcategories') + '. Delete or move them first.', false); return; }
    } else {
      var kids = subsOf(c.id).length;   // e.g. Catering › Events has the event types under it
      if (kids) { blocked('Can’t delete “' + c.name + '” yet', 'It has ' + plural(kids, 'option') + ' under it (' + subsOf(c.id).map(function (k) { return k.name; }).join(', ') + ').', false); return; }
      var pc = S.countBySub[c.id] || 0;
      if (pc) { blocked('Can’t delete “' + c.name + '” yet', 'Move or delete its ' + plural(pc, 'product') + ' first. You can do that in the Products section.', true); return; }
    }
    var ok = await Admin.confirm('Delete “' + c.name + '”? ' + (c.parent_id ? '' : 'It will disappear from the app’s Home screen. ') + 'This can’t be undone.',
      { danger: true, confirmLabel: c.parent_id ? 'Delete subcategory' : 'Delete category' });
    if (!ok) return;
    var res = await Admin.sb.from('categories').delete().eq('id', c.id);
    if (res.error) { Admin.toast('Couldn’t delete: ' + errMsg(res.error), 'error'); return; }
    S.cats = S.cats.filter(function (x) { return x.id !== c.id; });
    delete expanded[c.id];
    reindex();
    closeEditor();
    Admin.toast('Deleted “' + c.name + '”', 'success');
    renderAll();
  }

  function blocked(title, message, withProductsLink) {
    var actions = [];
    if (withProductsLink) actions.push({ label: 'Open Products', variant: 'ghost', onClick: function (close) { close(); Admin.closeAllModals(); Admin.navigate('products'); } });
    actions.push({ label: 'OK', variant: 'primary', onClick: function (close) { close(); } });
    Admin.modal({ title: title, body: '<p>' + esc(message) + '</p>', className: 'modal-confirm', actions: actions });
  }

  /* ---------------- Register ---------------- */

  async function mount(el) {
    var wrap = document.createElement('div');
    wrap.className = 'cg-page';
    el.innerHTML = '';
    el.appendChild(wrap);
    root = wrap;
    wrap.innerHTML = skeleton();
    wrap.addEventListener('click', onClick);
    wrap.addEventListener('error', onImgError, true);
    wrap.addEventListener('dragstart', onDragStart);
    wrap.addEventListener('dragover', onDragOver);
    wrap.addEventListener('drop', onDrop);
    wrap.addEventListener('dragend', onDragEnd);
    try {
      await load();
    } catch (e) {
      if (root !== wrap) return;
      wrap.innerHTML = '<div class="page-head"><div><h1>Categories</h1></div></div>' +
        '<div class="card cg-empty"><p><b>Couldn’t load categories</b></p><p>' + esc(errMsg(e)) + '</p>' +
        '<button type="button" class="btn btn-primary" data-cg-retry>Try again</button></div>';
      var retry = wrap.querySelector('[data-cg-retry]');
      if (retry) retry.addEventListener('click', function () { mount(el); });
      return;
    }
    if (root === wrap) renderAll();
  }

  Admin.registerSection({ id: 'categories', label: 'Categories', icon: ICON, order: 5, render: mount });
})();

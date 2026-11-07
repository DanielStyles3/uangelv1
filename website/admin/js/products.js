/* U Angel Foods admin: Products section (products + add-ons & extras). Uses only the window.Admin contract. */
(function () {
  'use strict';
  if (!window.Admin || typeof window.Admin.registerSection !== 'function') return;
  var Admin = window.Admin;

  var PAGE_SIZE = 60;
  var IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var MAX_BYTES = 5 * 1024 * 1024;
  var TYPE_LABEL = { topping: 'Add-on', side: 'Extra' };

  var ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>';
  var I_GRID = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
  var I_LIST = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>';
  var I_INFO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
  var I_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" style="vertical-align:-3px;margin-right:4px"><path d="M12 5v14M5 12h14"/></svg>';

  // Persisted UI state across visits to the section
  var ui = { tab: 'products', q: '', main: '', sub: '', photo: '', sort: 'name', view: 'grid', limit: PAGE_SIZE };
  var S = null; // loaded data
  var root = null;

  function esc(s) { return Admin.escapeHtml(s == null ? '' : String(s)); }
  function naira(n) { return Admin.formatNaira(Number(n) || 0); }
  function norm(s) { return String(s || '').trim().toLowerCase(); }
  function validHex(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim() : null; }
  function initial(name) { var t = String(name || '').trim(); return t ? Array.from(t)[0].toUpperCase() : '?'; }
  function errMsg(e) { return (e && (e.message || e.error_description)) || 'Something went wrong'; }
  function sortCats(a, b) {
    var x = a.sort_order == null ? 1e9 : a.sort_order, y = b.sort_order == null ? 1e9 : b.sort_order;
    return x - y || String(a.name).localeCompare(String(b.name));
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

  async function load() {
    var sb = Admin.sb;
    var r = await Promise.all([
      fetchAll(function () { return sb.from('categories').select('id,name,parent_id,emoji,color,image_url,sort_order,kind').order('sort_order', { ascending: true }).order('name'); }),
      fetchAll(function () { return sb.from('menu').select('id,name,description,image_url,emoji,price,rating,calories,protein,category_id,created_at').order('name'); }),
      fetchAll(function () { return sb.from('customizations').select('id,name,price,type').order('name'); }),
      fetchAll(function () { return sb.from('menu_customizations').select('menu_id,customization_id').order('menu_id'); })
    ]);
    var cats = r[0], byId = {};
    cats.forEach(function (c) { byId[c.id] = c; });
    var mains = cats.filter(function (c) { return !c.parent_id; }).sort(sortCats);
    var subsBy = {};
    cats.forEach(function (c) { if (c.parent_id) (subsBy[c.parent_id] = subsBy[c.parent_id] || []).push(c); });
    Object.keys(subsBy).forEach(function (k) { subsBy[k].sort(sortCats); });
    S = { cats: cats, catById: byId, mains: mains, subsBy: subsBy, products: r[1], customs: r[2], links: r[3] };
  }

  function isServiceMain(m) { return m && m.kind === 'service'; }
  function productMains() { return S.mains.filter(function (m) { return !isServiceMain(m); }); }
  function mainOf(sub) { return sub && sub.parent_id ? S.catById[sub.parent_id] : null; }
  function catPath(p) {
    var sub = S.catById[p.category_id];
    if (!sub) return 'No category';
    var m = mainOf(sub);
    return m ? sub.name + ' › ' + m.name : sub.name;
  }
  function linksFor(menuId) {
    return S.links.filter(function (l) { return l.menu_id === menuId; }).map(function (l) { return l.customization_id; });
  }
  function catColor(p) {
    var sub = S.catById[p.category_id];
    var m = mainOf(sub);
    return validHex((m && m.color) || (sub && sub.color)) || '#FE8C00';
  }
  function placeholder(p, small) {
    return '<div class="cx-ph' + (small ? ' cx-ph-sm cx-thumb-ph' : '') + '" style="background:' + catColor(p) + '" aria-hidden="true">' + esc(initial(p.name)) + '</div>';
  }

  /* ---------------- Rendering ---------------- */

  function skeleton() {
    var cards = '';
    for (var i = 0; i < 8; i++) cards += '<div class="skeleton cx-skel-card"></div>';
    return '<div class="page-head"><div><h1>Products</h1><p class="cx-sub">Loading catalogue…</p></div></div>' +
      '<div class="cx-pgrid" aria-busy="true" aria-label="Loading products">' + cards + '</div>';
  }

  function headHtml() {
    var noPhoto = S.products.filter(function (p) { return !p.image_url; }).length;
    var tops = S.customs.filter(function (c) { return c.type === 'topping'; }).length;
    return '<div class="page-head">' +
      '<div><h1>Products</h1><p class="cx-sub">' + S.products.length + ' product' + (S.products.length === 1 ? '' : 's') +
      ' · ' + noPhoto + ' without photo · ' + tops + ' add-on' + (tops === 1 ? '' : 's') + ', ' + (S.customs.length - tops) + ' extra' + (S.customs.length - tops === 1 ? '' : 's') + '</p></div>' +
      '<div class="cx-head-actions">' +
      (ui.tab === 'products'
        ? '<button type="button" class="btn btn-primary" data-act="add-product">' + I_PLUS + 'Add product</button>'
        : '<button type="button" class="btn btn-primary" data-act="add-custom">' + I_PLUS + 'Add add-on / extra</button>') +
      '</div></div>' +
      '<div class="cx-tabs" role="tablist" aria-label="Products sections">' +
      '<button type="button" class="cx-tab" role="tab" id="cx-tab-products" aria-controls="cx-panel" aria-selected="' + (ui.tab === 'products') + '" data-tab="products">Products<span class="cx-count">' + S.products.length + '</span></button>' +
      '<button type="button" class="cx-tab" role="tab" id="cx-tab-custom" aria-controls="cx-panel" aria-selected="' + (ui.tab === 'custom') + '" data-tab="custom">Add-ons &amp; extras<span class="cx-count">' + S.customs.length + '</span></button>' +
      '</div>';
  }

  function renderAll() {
    if (!root) return;
    root.innerHTML = headHtml() + '<div id="cx-panel" role="tabpanel" aria-labelledby="' + (ui.tab === 'products' ? 'cx-tab-products' : 'cx-tab-custom') + '"></div>';
    var panel = root.querySelector('#cx-panel');
    if (ui.tab === 'products') renderProductsPanel(panel); else renderCustomPanel(panel);
  }

  function mainOptions(sel) {
    return '<option value="">All categories</option>' + productMains().map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (sel === m.id ? ' selected' : '') + '>' + esc((m.emoji ? m.emoji + ' ' : '') + m.name) + '</option>';
    }).join('');
  }
  function subOptions(mainId, sel) {
    var html = '<option value="">All subcategories</option>';
    var mains = mainId ? productMains().filter(function (m) { return m.id === mainId; }) : productMains();
    mains.forEach(function (m) {
      var subs = S.subsBy[m.id] || [];
      if (!subs.length) return;
      var opts = subs.map(function (s) { return '<option value="' + esc(s.id) + '"' + (sel === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('');
      html += mainId ? opts : '<optgroup label="' + esc(m.name) + '">' + opts + '</optgroup>';
    });
    return html;
  }

  function renderProductsPanel(panel) {
    // drop stale filters (e.g. category deleted)
    if (ui.main && (!S.catById[ui.main] || isServiceMain(S.catById[ui.main]))) ui.main = '';
    if (ui.sub && (!S.catById[ui.sub] || (ui.main && S.catById[ui.sub].parent_id !== ui.main))) ui.sub = '';

    panel.innerHTML =
      '<div class="toolbar cx-toolbar">' +
      '<label class="cx-sr" for="cx-q">Search products by name</label>' +
      '<input id="cx-q" class="input cx-search" type="search" placeholder="Search by name…" value="' + esc(ui.q) + '" autocomplete="off">' +
      '<label class="cx-sr" for="cx-main">Main category</label>' +
      '<select id="cx-main" class="select">' + mainOptions(ui.main) + '</select>' +
      '<label class="cx-sr" for="cx-subf">Subcategory</label>' +
      '<select id="cx-subf" class="select">' + subOptions(ui.main, ui.sub) + '</select>' +
      '<label class="cx-sr" for="cx-photo">Photo filter</label>' +
      '<select id="cx-photo" class="select">' +
      '<option value="">Any photo</option><option value="yes"' + (ui.photo === 'yes' ? ' selected' : '') + '>Has photo</option><option value="no"' + (ui.photo === 'no' ? ' selected' : '') + '>No photo</option></select>' +
      '<label class="cx-sr" for="cx-sort">Sort by</label>' +
      '<select id="cx-sort" class="select">' +
      [['name', 'Name A–Z'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['newest', 'Newest first']].map(function (o) {
        return '<option value="' + o[0] + '"' + (ui.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>' +
      '<div class="cx-view" role="group" aria-label="View">' +
      '<button type="button" data-view="grid" aria-pressed="' + (ui.view === 'grid') + '" aria-label="Grid view" title="Grid view">' + I_GRID + '</button>' +
      '<button type="button" data-view="table" aria-pressed="' + (ui.view === 'table') + '" aria-label="Table view" title="Table view">' + I_LIST + '</button>' +
      '</div></div>' +
      '<p class="cx-hint">' + I_INFO + '<span>Products without their own photo show their subcategory’s photo in the app. Here they show a coloured placeholder with the product initial.</span></p>' +
      '<div id="cx-results" aria-live="polite"></div>';

    var q = panel.querySelector('#cx-q');
    q.addEventListener('input', Admin.debounce(function () { ui.q = q.value; ui.limit = PAGE_SIZE; renderResults(); }, 200));
    panel.querySelector('#cx-main').addEventListener('change', function (e) {
      ui.main = e.target.value; ui.sub = ''; ui.limit = PAGE_SIZE;
      panel.querySelector('#cx-subf').innerHTML = subOptions(ui.main, '');
      renderResults();
    });
    panel.querySelector('#cx-subf').addEventListener('change', function (e) { ui.sub = e.target.value; ui.limit = PAGE_SIZE; renderResults(); });
    panel.querySelector('#cx-photo').addEventListener('change', function (e) { ui.photo = e.target.value; ui.limit = PAGE_SIZE; renderResults(); });
    panel.querySelector('#cx-sort').addEventListener('change', function (e) { ui.sort = e.target.value; renderResults(); });
    Array.prototype.forEach.call(panel.querySelectorAll('[data-view]'), function (b) {
      b.addEventListener('click', function () {
        ui.view = b.getAttribute('data-view');
        Array.prototype.forEach.call(panel.querySelectorAll('[data-view]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        renderResults();
      });
    });
    renderResults();
  }

  function filtered() {
    var q = norm(ui.q);
    var list = S.products.filter(function (p) {
      if (q && norm(p.name).indexOf(q) === -1) return false;
      if (ui.photo === 'yes' && !p.image_url) return false;
      if (ui.photo === 'no' && p.image_url) return false;
      if (ui.sub) return p.category_id === ui.sub;
      if (ui.main) { var s = S.catById[p.category_id]; return !!s && s.parent_id === ui.main; }
      return true;
    });
    var cmp = {
      name: function (a, b) { return String(a.name).localeCompare(String(b.name)); },
      price_asc: function (a, b) { return (Number(a.price) || 0) - (Number(b.price) || 0) || String(a.name).localeCompare(String(b.name)); },
      price_desc: function (a, b) { return (Number(b.price) || 0) - (Number(a.price) || 0) || String(a.name).localeCompare(String(b.name)); },
      newest: function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); }
    }[ui.sort] || function () { return 0; };
    return list.sort(cmp);
  }

  function ratingHtml(p) {
    if (p.rating == null) return '<span class="cx-rating cx-muted">No rating</span>';
    return '<span class="cx-rating" aria-label="Rating ' + esc(Number(p.rating).toFixed(1)) + ' out of 5"><b aria-hidden="true">★</b> ' + esc(Number(p.rating).toFixed(1)) + '</span>';
  }

  function renderResults() {
    var box = root && root.querySelector('#cx-results');
    if (!box) return;
    var list = filtered();
    if (!S.products.length) {
      box.innerHTML = '<div class="empty"><p><b>No products yet</b></p><p>Add your first product to start selling in the app.</p><button type="button" class="btn btn-primary" data-act="add-product">' + I_PLUS + 'Add product</button></div>';
      return;
    }
    if (!list.length) {
      box.innerHTML = '<div class="empty"><p><b>No products match these filters</b></p><button type="button" class="btn btn-ghost" data-act="clear-filters">Clear filters</button></div>';
      return;
    }
    var shown = list.slice(0, ui.limit);
    var html;
    if (ui.view === 'table') {
      html = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th scope="col"><span class="cx-sr">Photo</span></th><th scope="col">Name</th><th scope="col">Category</th><th scope="col" class="cx-right">Price</th><th scope="col">Rating</th><th scope="col">Add-ons</th><th scope="col"><span class="cx-sr">Actions</span></th>' +
        '</tr></thead><tbody>' + shown.map(function (p) {
          var n = linksFor(p.id).length;
          return '<tr>' +
            '<td>' + (p.image_url ? '<img class="thumb" src="' + esc(p.image_url) + '" alt="" loading="lazy" data-pid="' + esc(p.id) + '" data-small="1">' : placeholder(p, true)) + '</td>' +
            '<td class="cx-cell-name">' + esc(p.name) + '</td>' +
            '<td>' + esc(catPath(p)) + '</td>' +
            '<td class="cx-right cx-nowrap">' + esc(naira(p.price)) + '</td>' +
            '<td>' + ratingHtml(p) + '</td>' +
            '<td>' + (n ? n : '<span class="cx-muted">—</span>') + '</td>' +
            '<td><div class="cx-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + esc(p.id) + '" aria-label="Edit ' + esc(p.name) + '">Edit</button>' +
            '<button type="button" class="btn btn-danger btn-sm" data-del="' + esc(p.id) + '" aria-label="Delete ' + esc(p.name) + '">Delete</button>' +
            '</div></td></tr>';
        }).join('') + '</tbody></table></div>';
    } else {
      html = '<div class="cx-pgrid">' + shown.map(function (p) {
        return '<article class="card cx-pcard">' +
          '<div class="cx-pmedia">' + (p.image_url
            ? '<img src="' + esc(p.image_url) + '" alt="" loading="lazy" data-pid="' + esc(p.id) + '">'
            : placeholder(p) + '<span class="cx-nophoto">No photo</span>') + '</div>' +
          '<div class="cx-pbody">' +
          '<button type="button" class="cx-pname" data-edit="' + esc(p.id) + '">' + esc(p.name) + '</button>' +
          '<div class="cx-ppath" title="' + esc(catPath(p)) + '">' + esc(catPath(p)) + '</div>' +
          '<div class="cx-pmeta"><span class="cx-price">' + esc(naira(p.price)) + '</span>' + ratingHtml(p) + '</div>' +
          '</div>' +
          '<div class="cx-pactions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + esc(p.id) + '" aria-label="Edit ' + esc(p.name) + '">Edit</button>' +
          '<button type="button" class="btn btn-danger btn-sm" data-del="' + esc(p.id) + '" aria-label="Delete ' + esc(p.name) + '">Delete</button>' +
          '</div></article>';
      }).join('') + '</div>';
    }
    html += '<div class="cx-more"><span class="cx-muted">Showing ' + shown.length + ' of ' + list.length + (list.length !== S.products.length ? ' matching (' + S.products.length + ' total)' : '') + '</span>' +
      (list.length > shown.length ? '<button type="button" class="btn btn-ghost" data-act="more">Load more</button>' : '') + '</div>';
    box.innerHTML = html;
  }

  // Broken image -> placeholder
  function onImgError(e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.hasAttribute('data-pid')) return;
    var p = S && S.products.find(function (x) { return x.id === img.getAttribute('data-pid'); });
    if (!p) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = placeholder(p, img.hasAttribute('data-small'));
    img.replaceWith(wrap.firstChild);
  }

  function onRootClick(e) {
    var t = e.target.closest('button');
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute('data-tab')) {
      var tab = t.getAttribute('data-tab');
      if (tab !== ui.tab) { ui.tab = tab; renderAll(); var f = root.querySelector('[data-tab="' + tab + '"]'); if (f) f.focus(); }
      return;
    }
    if (t.hasAttribute('data-edit')) { var p = S.products.find(function (x) { return x.id === t.getAttribute('data-edit'); }); if (p) openProductForm(p); return; }
    if (t.hasAttribute('data-del')) { var d = S.products.find(function (x) { return x.id === t.getAttribute('data-del'); }); if (d) deleteProduct(d); return; }
    if (t.hasAttribute('data-cedit')) { var c = S.customs.find(function (x) { return x.id === t.getAttribute('data-cedit'); }); if (c) openCustomForm(c); return; }
    if (t.hasAttribute('data-cdel')) { var cd = S.customs.find(function (x) { return x.id === t.getAttribute('data-cdel'); }); if (cd) deleteCustom(cd); return; }
    var act = t.getAttribute('data-act');
    if (act === 'add-product') openProductForm(null);
    else if (act === 'add-custom') openCustomForm(null);
    else if (act === 'more') { ui.limit += PAGE_SIZE; renderResults(); }
    else if (act === 'clear-filters') { ui.q = ''; ui.main = ''; ui.sub = ''; ui.photo = ''; ui.limit = PAGE_SIZE; renderAll(); }
  }

  function onTabKey(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('cx-tab') || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    var tab = ui.tab === 'products' ? 'custom' : 'products';
    ui.tab = tab; renderAll();
    var f = root.querySelector('[data-tab="' + tab + '"]'); if (f) f.focus();
    e.preventDefault();
  }

  /* ---------------- Shared form helpers ---------------- */

  function setBusy(m, label, busy, busyLabel) {
    if (!m || !m.el) return;
    Array.prototype.forEach.call(m.el.querySelectorAll('button'), function (b) {
      var txt = b.getAttribute('data-cx-label') || b.textContent.trim();
      if (txt === label) {
        if (!b.hasAttribute('data-cx-label')) b.setAttribute('data-cx-label', txt);
        b.disabled = busy;
        b.setAttribute('aria-busy', String(busy));
        b.textContent = busy ? (busyLabel || 'Saving…') : txt;
      }
    });
  }

  function fieldError(form, name, msg) {
    var ctl = form.querySelector('[name="' + name + '"]');
    var err = form.querySelector('[data-err="' + name + '"]');
    if (err) err.textContent = msg || '';
    if (ctl) {
      ctl.classList.toggle('cx-invalid', !!msg);
      if (msg) ctl.setAttribute('aria-invalid', 'true'); else ctl.removeAttribute('aria-invalid');
    }
  }

  function photoField(currentUrl, folder) {
    var wrap = document.createElement('div');
    wrap.className = 'cx-photo';
    var uid = 'cxf' + Math.random().toString(36).slice(2, 8);
    wrap.innerHTML =
      '<div class="cx-photo-prev" aria-live="polite"></div>' +
      '<div class="cx-drop">' +
      '<span class="cx-drop-desk">Drag a photo here, or</span><span class="cx-drop-touch">Tap here to choose a photo</span>' +
      '<div class="cx-drop-btns">' +
      '<label class="btn btn-ghost btn-sm" for="' + uid + '" tabindex="0" role="button">Choose photo</label>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-remove>Remove photo</button>' +
      '</div>' +
      '<input class="cx-file" type="file" id="' + uid + '" accept="image/jpeg,image/png,image/webp" aria-label="Choose photo">' +
      '<span class="cx-help">JPEG, PNG or WebP, up to 5 MB.</span>' +
      '<span class="cx-err" data-photo-err></span>' +
      '</div>';
    var prev = wrap.querySelector('.cx-photo-prev');
    var drop = wrap.querySelector('.cx-drop');
    var input = wrap.querySelector('input[type=file]');
    var pick = wrap.querySelector('label[for="' + uid + '"]');
    var removeBtn = wrap.querySelector('[data-remove]');
    var errEl = wrap.querySelector('[data-photo-err]');
    var state = { file: null, removed: false, objUrl: null };

    function show() {
      var src = state.objUrl || (!state.removed ? currentUrl : null);
      prev.innerHTML = src ? '<img src="' + esc(src) + '" alt="Photo preview">' : '<span>No photo</span>';
      removeBtn.hidden = !src;
    }
    function take(file) {
      errEl.textContent = '';
      if (!file) return;
      if (IMG_TYPES.indexOf(file.type) === -1) { errEl.textContent = 'Please choose a JPEG, PNG or WebP image.'; return; }
      if (file.size > MAX_BYTES) { errEl.textContent = 'That image is larger than 5 MB.'; return; }
      if (state.objUrl) URL.revokeObjectURL(state.objUrl);
      state.file = file; state.removed = false; state.objUrl = URL.createObjectURL(file);
      show();
    }
    input.addEventListener('change', function () { take(input.files && input.files[0]); input.value = ''; });
    pick.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    removeBtn.addEventListener('click', function () {
      if (state.objUrl) URL.revokeObjectURL(state.objUrl);
      state.file = null; state.objUrl = null; state.removed = true; errEl.textContent = '';
      show();
    });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('cx-over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('cx-over'); }); });
    drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; take(f); });
    // Tap / click anywhere on the zone opens the picker (phones can't drag files in).
    drop.addEventListener('click', function (e) { if (e.target.closest('label, button, input')) return; input.click(); });
    show();

    return {
      el: wrap,
      changed: function () { return !!state.file || state.removed; },
      // Returns the URL to store (uploads if a new file was chosen).
      resolve: async function () {
        if (state.file) return await Admin.uploadImage(state.file, folder);
        if (state.removed) return null;
        return currentUrl || null;
      },
      dispose: function () { if (state.objUrl) URL.revokeObjectURL(state.objUrl); }
    };
  }

  /* ---------------- Product form ---------------- */

  function subcategorySelectHtml(selected) {
    var html = '<option value="">Choose a subcategory…</option>';
    var found = false;
    productMains().forEach(function (m) {
      var subs = S.subsBy[m.id] || [];
      if (!subs.length) return;
      html += '<optgroup label="' + esc(m.name) + '">' + subs.map(function (s) {
        if (s.id === selected) found = true;
        return '<option value="' + esc(s.id) + '"' + (s.id === selected ? ' selected' : '') + '>' + esc((s.emoji ? s.emoji + ' ' : '') + s.name) + '</option>';
      }).join('') + '</optgroup>';
    });
    // Keep an existing (unexpected) assignment visible rather than silently dropping it.
    if (selected && !found && S.catById[selected]) {
      var c = S.catById[selected], m = mainOf(c);
      html += '<optgroup label="Other"><option value="' + esc(c.id) + '" selected>' + esc(c.name + (m ? ' (' + m.name + ')' : '')) + '</option></optgroup>';
    }
    return html;
  }

  function addonGroupHtml(type, legend, selectedIds) {
    var items = S.customs.filter(function (c) { return c.type === type; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    var body = items.length ? items.map(function (c) {
      return '<label class="cx-check"><input type="checkbox" name="cust" value="' + esc(c.id) + '"' + (selectedIds.indexOf(c.id) !== -1 ? ' checked' : '') + '>' +
        '<span>' + esc(c.name) + '</span><span class="cx-addon-price">' + (Number(c.price) > 0 ? '+' + esc(naira(c.price)) : 'Free') + '</span></label>';
    }).join('') : '<p class="cx-help">None yet. Create them in the “Add-ons &amp; extras” tab.</p>';
    return '<fieldset><legend>' + legend + '</legend><div class="cx-addon-list">' + body + '</div></fieldset>';
  }

  function openProductForm(p) {
    var editing = !!p;
    var origLinks = editing ? linksFor(p.id) : [];
    var form = document.createElement('form');
    form.className = 'cx-form';
    form.noValidate = true;
    form.innerHTML =
      '<div class="field cx-full"><label for="pf-name">Name <span class="cx-req" aria-hidden="true">*</span></label>' +
      '<input id="pf-name" name="name" class="input" required maxlength="120" autocomplete="off" value="' + esc(editing ? p.name : '') + '">' +
      '<span class="cx-err" data-err="name" role="alert"></span></div>' +
      '<div class="field"><label for="pf-cat">Subcategory <span class="cx-req" aria-hidden="true">*</span></label>' +
      '<select id="pf-cat" name="category_id" class="select" required>' + subcategorySelectHtml(editing ? p.category_id : (ui.sub || '')) + '</select>' +
      '<span class="cx-err" data-err="category_id" role="alert"></span></div>' +
      '<div class="field"><label for="pf-price">Price (₦) <span class="cx-req" aria-hidden="true">*</span></label>' +
      '<input id="pf-price" name="price" class="input" type="number" inputmode="decimal" min="0" step="0.01" required value="' + esc(editing && p.price != null ? Number(p.price) : '') + '">' +
      '<span class="cx-err" data-err="price" role="alert"></span></div>' +
      '<div class="cx-form-3">' +
      '<div class="field"><label for="pf-rating">Rating (0–5)</label>' +
      '<input id="pf-rating" name="rating" class="input" type="number" inputmode="decimal" min="0" max="5" step="0.1" value="' + esc(editing ? (p.rating != null ? Number(p.rating) : '') : '4.5') + '">' +
      '<span class="cx-err" data-err="rating" role="alert"></span></div>' +
      '<div class="field"><label for="pf-cal">Calories (optional)</label>' +
      '<input id="pf-cal" name="calories" class="input" type="number" inputmode="numeric" min="0" step="1" value="' + esc(editing && p.calories != null ? p.calories : '') + '">' +
      '<span class="cx-err" data-err="calories" role="alert"></span></div>' +
      '<div class="field"><label for="pf-pro">Protein, g (optional)</label>' +
      '<input id="pf-pro" name="protein" class="input" type="number" inputmode="numeric" min="0" step="1" value="' + esc(editing && p.protein != null ? p.protein : '') + '">' +
      '<span class="cx-err" data-err="protein" role="alert"></span></div>' +
      '</div>' +
      '<div class="field cx-full"><label for="pf-desc">Description</label>' +
      '<textarea id="pf-desc" name="description" class="textarea" rows="3" maxlength="2000">' + esc(editing ? p.description : '') + '</textarea></div>' +
      '<div class="field cx-full"><span id="pf-photo-label" style="font-weight:700">Photo</span><div data-photo></div>' +
      '<span class="cx-help">If there is no photo, the app shows the subcategory’s photo instead.</span></div>' +
      '<div class="field cx-full"><span style="font-weight:700">Add-ons &amp; extras</span>' +
      '<div class="cx-addons">' + addonGroupHtml('topping', 'Add-ons', origLinks) + addonGroupHtml('side', 'Extras', origLinks) + '</div></div>' +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';

    var photo = photoField(editing ? p.image_url : null, 'products');
    photo.el.setAttribute('role', 'group');
    photo.el.setAttribute('aria-labelledby', 'pf-photo-label');
    form.querySelector('[data-photo]').appendChild(photo.el);

    var saving = false;
    var SAVE = editing ? 'Save changes' : 'Add product';
    var m;

    async function save() {
      if (saving) return;
      ['name', 'category_id', 'price', 'rating', 'calories', 'protein'].forEach(function (n) { fieldError(form, n, ''); });
      var f = form.elements;
      var name = f.name.value.trim().replace(/\s+/g, ' ');
      var catId = f.category_id.value;
      var priceRaw = f.price.value.trim();
      var ratingRaw = f.rating.value.trim();
      var calRaw = f.calories.value.trim();
      var proRaw = f.protein.value.trim();
      var errors = [];

      if (!name) errors.push(['name', 'Enter a product name.']);
      else if (S.products.some(function (x) { return norm(x.name) === norm(name) && (!editing || x.id !== p.id); }))
        errors.push(['name', 'A product called “' + name + '” already exists. Product names must be unique.']);
      if (!catId) errors.push(['category_id', 'Choose a subcategory.']);
      var price = Number(priceRaw);
      if (priceRaw === '' || !isFinite(price)) errors.push(['price', 'Enter a price.']);
      else if (price < 0) errors.push(['price', 'Price can’t be negative.']);
      else if (price >= 1e8) errors.push(['price', 'Price is too large.']);
      var rating = null;
      if (ratingRaw !== '') {
        rating = Number(ratingRaw);
        if (!isFinite(rating) || rating < 0 || rating > 5) errors.push(['rating', 'Rating must be between 0 and 5.']);
        else rating = Math.round(rating * 10) / 10;
      }
      function intOrNull(raw, key, label) {
        if (raw === '') return null;
        var n = Number(raw);
        if (!isFinite(n) || n < 0 || Math.floor(n) !== n) { errors.push([key, label + ' must be a whole number, 0 or more.']); return null; }
        if (n > 2147483647) { errors.push([key, label + ' is too large.']); return null; }
        return n;
      }
      var calories = intOrNull(calRaw, 'calories', 'Calories');
      var protein = intOrNull(proRaw, 'protein', 'Protein');

      if (errors.length) {
        errors.forEach(function (er) { fieldError(form, er[0], er[1]); });
        var first = form.querySelector('[name="' + errors[0][0] + '"]');
        if (first) first.focus();
        return;
      }

      var wanted = Array.prototype.map.call(form.querySelectorAll('input[name="cust"]:checked'), function (i) { return i.value; });
      saving = true;
      setBusy(m, SAVE, true);
      try {
        var imageUrl;
        try { imageUrl = await photo.resolve(); }
        catch (e) { Admin.toast('Photo upload failed: ' + errMsg(e), 'error'); return; }

        var payload = {
          name: name, category_id: catId, price: Math.round(price * 100) / 100,
          description: f.description.value.trim() || null,
          rating: rating, calories: calories, protein: protein, image_url: imageUrl
        };
        var res = editing
          ? await Admin.sb.from('menu').update(payload).eq('id', p.id).select().single()
          : await Admin.sb.from('menu').insert(payload).select().single();
        if (res.error) {
          if (res.error.code === '23505') {
            fieldError(form, 'name', 'A product called “' + name + '” already exists. Product names must be unique.');
            form.querySelector('[name="name"]').focus();
            Admin.toast('That product name is already taken.', 'error');
          } else {
            Admin.toast('Couldn’t save the product: ' + errMsg(res.error), 'error');
          }
          return;
        }
        var saved = res.data;
        if (editing) {
          var i = S.products.findIndex(function (x) { return x.id === p.id; });
          if (i !== -1) S.products[i] = Object.assign({}, S.products[i], saved);
        } else {
          S.products.push(saved);
        }

        // Sync add-on links
        var toRemove = origLinks.filter(function (id) { return wanted.indexOf(id) === -1; });
        var toAdd = wanted.filter(function (id) { return origLinks.indexOf(id) === -1; });
        var linkErr = null;
        if (toRemove.length) {
          var d = await Admin.sb.from('menu_customizations').delete().eq('menu_id', saved.id).in('customization_id', toRemove);
          if (d.error) linkErr = d.error;
          else S.links = S.links.filter(function (l) { return !(l.menu_id === saved.id && toRemove.indexOf(l.customization_id) !== -1); });
        }
        if (toAdd.length) {
          var rows = toAdd.map(function (cid) { return { menu_id: saved.id, customization_id: cid }; });
          var ins = await Admin.sb.from('menu_customizations').insert(rows);
          if (ins.error) linkErr = ins.error;
          else S.links = S.links.concat(rows);
        }

        photo.dispose();
        m.close();
        if (linkErr) Admin.toast('Product saved, but add-ons couldn’t be updated: ' + errMsg(linkErr), 'error');
        else Admin.toast(editing ? 'Saved “' + saved.name + '”' : 'Added “' + saved.name + '”', 'success');
        if (!editing && typeof Admin.refreshBadges === 'function') { try { Admin.refreshBadges(); } catch (e) { /* optional */ } }
        renderAll();
      } catch (e) {
        Admin.toast('Couldn’t save the product: ' + errMsg(e), 'error');
      } finally {
        saving = false;
        setBusy(m, SAVE, false);
      }
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });
    m = Admin.modal({
      title: editing ? 'Edit product' : 'Add product',
      body: form,
      wide: true,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: function (close) { photo.dispose(); close(); } },
        { label: SAVE, variant: 'primary', onClick: function () { save(); } }
      ]
    });
    setTimeout(function () { var n = form.querySelector('#pf-name'); if (n) n.focus(); }, 30);
  }

  async function deleteProduct(p) {
    var ok = await Admin.confirm(
      'Delete “' + p.name + '”? It will be removed from the app straight away. Past orders keep their own copy of the item (name, price and photo), so order history is not affected.',
      { danger: true, confirmLabel: 'Delete product' });
    if (!ok) return;
    var res = await Admin.sb.from('menu').delete().eq('id', p.id);
    if (res.error) { Admin.toast('Couldn’t delete the product: ' + errMsg(res.error), 'error'); return; }
    S.products = S.products.filter(function (x) { return x.id !== p.id; });
    S.links = S.links.filter(function (l) { return l.menu_id !== p.id; });
    Admin.toast('Deleted “' + p.name + '”', 'success');
    if (typeof Admin.refreshBadges === 'function') { try { Admin.refreshBadges(); } catch (e) { /* optional */ } }
    renderAll();
  }

  /* ---------------- Add-ons & extras ---------------- */

  function usage(cid) { return S.links.filter(function (l) { return l.customization_id === cid; }).length; }

  function renderCustomPanel(panel) {
    var list = S.customs.slice().sort(function (a, b) {
      return String(a.type).localeCompare(String(b.type)) * -1 || String(a.name).localeCompare(String(b.name));
    });
    var hint = '<p class="cx-hint">' + I_INFO + '<span>Add-ons (toppings) and extras (sides) are optional paid extras customers can pick on a product. Link them to products in each product’s edit form.</span></p>';
    if (!list.length) {
      panel.innerHTML = hint + '<div class="empty"><p><b>No add-ons or extras yet</b></p><button type="button" class="btn btn-primary" data-act="add-custom">' + I_PLUS + 'Add add-on / extra</button></div>';
      return;
    }
    panel.innerHTML = hint + '<div class="table-wrap"><table class="table table-cards"><thead><tr>' +
      '<th scope="col">Name</th><th scope="col">Type</th><th scope="col" class="cx-right">Price</th><th scope="col">Used by</th><th scope="col"><span class="cx-sr">Actions</span></th>' +
      '</tr></thead><tbody>' + list.map(function (c) {
        var n = usage(c.id);
        return '<tr><td class="cx-cell-name tc-id">' + esc(c.name) + '</td>' +
          '<td class="tc-badge"><span class="chip">' + esc(TYPE_LABEL[c.type] || c.type) + '</span></td>' +
          '<td class="cx-right cx-nowrap tc-total">' + (Number(c.price) > 0 ? esc(naira(c.price)) : 'Free') + '</td>' +
          '<td class="tc-time"><span class="tc-only">Used by </span>' + n + ' product' + (n === 1 ? '' : 's') + '</td>' +
          '<td class="tc-actions"><div class="cx-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-cedit="' + esc(c.id) + '" aria-label="Edit ' + esc(c.name) + '">Edit</button>' +
          '<button type="button" class="btn btn-danger btn-sm" data-cdel="' + esc(c.id) + '" aria-label="Delete ' + esc(c.name) + '">Delete</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function openCustomForm(c) {
    var editing = !!c;
    var form = document.createElement('form');
    form.className = 'cx-form';
    form.noValidate = true;
    form.innerHTML =
      '<div class="field cx-full"><label for="cf-name">Name <span class="cx-req" aria-hidden="true">*</span></label>' +
      '<input id="cf-name" name="name" class="input" required maxlength="80" autocomplete="off" value="' + esc(editing ? c.name : '') + '">' +
      '<span class="cx-err" data-err="name" role="alert"></span></div>' +
      '<div class="field"><label for="cf-type">Type</label>' +
      '<select id="cf-type" name="type" class="select">' +
      '<option value="topping"' + (!editing || c.type === 'topping' ? ' selected' : '') + '>Add-on</option>' +
      '<option value="side"' + (editing && c.type === 'side' ? ' selected' : '') + '>Extra</option></select></div>' +
      '<div class="field"><label for="cf-price">Price (₦) <span class="cx-req" aria-hidden="true">*</span></label>' +
      '<input id="cf-price" name="price" class="input" type="number" inputmode="decimal" min="0" step="0.01" required value="' + esc(editing && c.price != null ? Number(c.price) : '') + '">' +
      '<span class="cx-err" data-err="price" role="alert"></span></div>' +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';

    var saving = false, m;
    var SAVE = editing ? 'Save changes' : 'Add';
    async function save() {
      if (saving) return;
      fieldError(form, 'name', ''); fieldError(form, 'price', '');
      var name = form.elements.name.value.trim().replace(/\s+/g, ' ');
      var type = form.elements.type.value === 'side' ? 'side' : 'topping';
      var priceRaw = form.elements.price.value.trim();
      var price = Number(priceRaw);
      var bad = null;
      if (!name) { fieldError(form, 'name', 'Enter a name.'); bad = bad || 'name'; }
      else if (S.customs.some(function (x) { return norm(x.name) === norm(name) && (!editing || x.id !== c.id); })) { fieldError(form, 'name', 'An add-on or extra with this name already exists.'); bad = bad || 'name'; }
      if (priceRaw === '' || !isFinite(price)) { fieldError(form, 'price', 'Enter a price (0 for free).'); bad = bad || 'price'; }
      else if (price < 0) { fieldError(form, 'price', 'Price can’t be negative.'); bad = bad || 'price'; }
      else if (price >= 1e8) { fieldError(form, 'price', 'Price is too large.'); bad = bad || 'price'; }
      if (bad) { form.querySelector('[name="' + bad + '"]').focus(); return; }

      saving = true; setBusy(m, SAVE, true);
      try {
        var payload = { name: name, type: type, price: Math.round(price * 100) / 100 };
        var res = editing
          ? await Admin.sb.from('customizations').update(payload).eq('id', c.id).select().single()
          : await Admin.sb.from('customizations').insert(payload).select().single();
        if (res.error) {
          if (res.error.code === '23505') { fieldError(form, 'name', 'An add-on or extra with this name already exists.'); Admin.toast('That name is already taken.', 'error'); }
          else Admin.toast('Couldn’t save: ' + errMsg(res.error), 'error');
          return;
        }
        if (editing) {
          var i = S.customs.findIndex(function (x) { return x.id === c.id; });
          if (i !== -1) S.customs[i] = res.data;
        } else S.customs.push(res.data);
        m.close();
        Admin.toast(editing ? 'Saved “' + res.data.name + '”' : 'Added “' + res.data.name + '”', 'success');
        renderAll();
      } catch (e) {
        Admin.toast('Couldn’t save: ' + errMsg(e), 'error');
      } finally {
        saving = false; setBusy(m, SAVE, false);
      }
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });
    m = Admin.modal({
      title: editing ? 'Edit add-on / extra' : 'New add-on / extra',
      body: form,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: function (close) { close(); } },
        { label: SAVE, variant: 'primary', onClick: function () { save(); } }
      ]
    });
    setTimeout(function () { var n = form.querySelector('#cf-name'); if (n) n.focus(); }, 30);
  }

  async function deleteCustom(c) {
    var n = usage(c.id);
    var ok = await Admin.confirm(
      'Delete “' + c.name + '”?' + (n ? ' It will be removed from ' + n + ' product' + (n === 1 ? '' : 's') + '.' : '') +
      ' Past orders keep their own copy of the add-ons that were chosen.',
      { danger: true, confirmLabel: 'Delete' });
    if (!ok) return;
    var res = await Admin.sb.from('customizations').delete().eq('id', c.id);
    if (res.error) { Admin.toast('Couldn’t delete: ' + errMsg(res.error), 'error'); return; }
    S.customs = S.customs.filter(function (x) { return x.id !== c.id; });
    S.links = S.links.filter(function (l) { return l.customization_id !== c.id; });
    Admin.toast('Deleted “' + c.name + '”', 'success');
    renderAll();
  }

  /* ---------------- Register ---------------- */

  // Each render gets its own wrapper element, so listeners never stack or leak into other sections.
  async function mount(el) {
    var wrap = document.createElement('div');
    wrap.className = 'cx-products';
    el.innerHTML = '';
    el.appendChild(wrap);
    root = wrap;
    wrap.innerHTML = skeleton();
    wrap.addEventListener('click', onRootClick);
    wrap.addEventListener('keydown', onTabKey);
    wrap.addEventListener('error', onImgError, true);
    try {
      await load();
    } catch (e) {
      if (root !== wrap) return;
      wrap.innerHTML = '<div class="page-head"><div><h1>Products</h1></div></div>' +
        '<div class="empty"><p><b>Couldn’t load products</b></p><p>' + esc(errMsg(e)) + '</p>' +
        '<button type="button" class="btn btn-primary" data-cx-retry>Try again</button></div>';
      Admin.toast('Couldn’t load products: ' + errMsg(e), 'error');
      var retry = wrap.querySelector('[data-cx-retry]');
      if (retry) retry.addEventListener('click', function () { mount(el); });
      return;
    }
    if (root === wrap) renderAll();
  }

  Admin.registerSection({ id: 'products', label: 'Products', icon: ICON, order: 4, render: mount });
})();

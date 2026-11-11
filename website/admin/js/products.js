/* U Angel Foods admin: Products section.
 * Photo grid with search, category → subcategory filters, quick filters (sold out, missing photo,
 * best sellers), an in-stock switch on every card, a side-panel editor (category first, then its
 * subcategories) with an app preview, and an Add-ons tab. Styles: css/manage.css (pp-) and the
 * shared editor styles in css/categories.css (cg-). Uses only the window.Admin contract. */
(function () {
  'use strict';
  if (!window.Admin || typeof window.Admin.registerSection !== 'function') return;
  var A = window.Admin;
  var I = A.icons;
  var GIFT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';

  var IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var MAX_BYTES = 5 * 1024 * 1024;
  var PAGE = 48;
  var MENU_COLS = 'id,name,description,image_url,emoji,price,rating,calories,protein,is_available,is_campaign,category_id,delivery_fee,delivery_note,affiliate_rate,created_at';
  // When it arrives (menu.delivery_note). '' = use the category's note.
  var DELIVERY_TIMES = ['', 'Same-day delivery', 'Next-day delivery', 'Delivery varies'];
  /** The category's standard fee (same rule as delivery_fee_for in the database). */
  function standardFee(mainName) { return /^(Groceries & Essentials|The Local Market)$/.test(mainName || '') ? 5000 : 2000; }

  var S = null, root = null;
  var ui = { tab: 'products', q: '', main: '', sub: '', chip: '', sort: 'name', limit: PAGE };

  function esc(s) { return A.escapeHtml(s == null ? '' : String(s)); }
  function naira(n) { return A.formatNaira(Number(n) || 0); }
  function norm(s) { return String(s || '').trim().toLowerCase(); }
  function errMsg(e) { return (e && (e.message || e.error_description)) || 'Something went wrong'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function sortCats(a, b) { return (a.sort_order == null ? 1e9 : a.sort_order) - (b.sort_order == null ? 1e9 : b.sort_order) || String(a.name).localeCompare(String(b.name)); }
  function missingColumn(e) { return /is_available/.test(errMsg(e)); }

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
    var sb = A.sb;
    var since = A.startOfLagosDay(-29).toISOString();
    var menuQuery = function (cols) { return fetchAll(function () { return sb.from('menu').select(cols).order('name'); }); };
    var r = await Promise.all([
      fetchAll(function () { return sb.from('categories').select('id,name,parent_id,color,image_url,sort_order,kind').order('sort_order', { ascending: true }).order('name'); }),
      // Works before schema.sql adds is_available (then everything counts as in stock).
      menuQuery(MENU_COLS).catch(function (e) { if (missingColumn(e)) return menuQuery(MENU_COLS.replace(',is_available', '')); throw e; }),
      fetchAll(function () { return sb.from('customizations').select('id,name,price,type').order('name'); }),
      fetchAll(function () { return sb.from('menu_customizations').select('menu_id,customization_id').order('menu_id'); }),
      // Customer options per product (cakes). Missing table (schema.sql not run yet) = none.
      fetchAll(function () { return sb.from('option_groups').select('id,menu_id,name,required').order('sort_order'); }).catch(function () { return []; }),
      fetchAll(function () {
        return sb.from('order_items').select('menu_id,quantity,orders!inner(payment_status,paid_at)')
          .eq('orders.payment_status', 'paid').gte('orders.paid_at', since).order('id');
      }).catch(function () { return []; })
    ]);
    var cats = r[0], catById = {}, subsBy = {};
    cats.forEach(function (c) { catById[c.id] = c; });
    cats.forEach(function (c) { if (c.parent_id) (subsBy[c.parent_id] = subsBy[c.parent_id] || []).push(c); });
    Object.keys(subsBy).forEach(function (k) { subsBy[k].sort(sortCats); });
    var sold = {};
    r[5].forEach(function (it) { if (it.menu_id) sold[it.menu_id] = (sold[it.menu_id] || 0) + (Number(it.quantity) || 0); });
    S = {
      cats: cats, catById: catById, subsBy: subsBy,
      mains: cats.filter(function (c) { return !c.parent_id && c.kind !== 'service'; }).sort(sortCats),
      products: r[1].map(function (p) { if (p.is_available === undefined) p.is_available = true; return p; }),
      customs: r[2], links: r[3], sold: sold, optGroups: r[4] || []
    };
  }

  function subOf(p) { return S.catById[p.category_id] || null; }
  function mainOf(p) { var s = subOf(p); return s ? (s.parent_id ? S.catById[s.parent_id] : s) : null; }
  /** Show the "Sizes & options" shortcut on cakes and on anything that already has options. */
  function hasOptionsUI(p) {
    if ((S.optGroups || []).some(function (g) { return g.menu_id === p.id; })) return true;
    var m = mainOf(p);
    return !!(m && /cake/i.test(m.name));
  }
  function colorOf(p) { var m = mainOf(p); return (m && m.color) || '#FE8C00'; }
  function photoOf(p) { var s = subOf(p); return p.image_url || (s && s.image_url) || null; }
  function linksFor(id) { return S.links.filter(function (l) { return l.menu_id === id; }).map(function (l) { return l.customization_id; }); }
  function bestIds() {
    return Object.keys(S.sold).sort(function (a, b) { return S.sold[b] - S.sold[a]; }).slice(0, 10);
  }

  /* ---------------- Page ---------------- */

  function renderAll() {
    if (!root) return;
    var shop = shopProducts(), xmas = xmasProducts();
    var off = shop.filter(function (p) { return p.is_available === false; }).length;
    var nophoto = shop.filter(function (p) { return !p.image_url; }).length;
    root.innerHTML =
      '<div class="page-head pp-head"><div><h1>Products</h1><p class="pp-sub">' + plural(shop.length, 'product') + ' · ' + plural(xmas.length, 'pre-order package') + ' · ' + plural(S.customs.length, 'add-on') + '</p></div>' +
        '<div class="actions">' +
          (ui.tab === 'xmas'
            ? '<button type="button" class="btn btn-primary" data-new-xmas>' + I.plus + 'New pre-order package</button>'
            : ui.tab === 'products'
            ? '<button type="button" class="btn btn-primary" data-new>' + I.plus + 'New product</button>'
            : '<button type="button" class="btn btn-primary" data-new-addon>' + I.plus + 'New add-on</button>') +
        '</div></div>' +
      '<div class="pp-tabs" role="tablist">' +
        '<button type="button" role="tab" aria-selected="' + (ui.tab === 'products') + '" data-tab="products">Products</button>' +
        '<button type="button" role="tab" aria-selected="' + (ui.tab === 'addons') + '" data-tab="addons">Add-ons &amp; extras</button>' +
        '<button type="button" role="tab" aria-selected="' + (ui.tab === 'xmas') + '" data-tab="xmas" class="pp-tab-xmas">' + GIFT + 'Christmas pre-order <b>' + xmas.length + '</b></button></div>' +
      (ui.tab === 'products'
        ? '<div class="toolbar pp-toolbar">' +
            '<label class="search"><span class="sr-only">Search products</span>' + I.search + '<input class="input" type="search" data-q placeholder="Search products" value="' + esc(ui.q) + '" autocomplete="off"></label>' +
            '<select class="select" data-main aria-label="Category"><option value="">All categories</option>' +
              S.mains.map(function (m) { return '<option value="' + esc(m.id) + '"' + (ui.main === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('') + '</select>' +
            '<select class="select" data-sub aria-label="Subcategory"' + (ui.main ? '' : ' disabled') + '><option value="">' + (ui.main ? 'All subcategories' : 'Pick a category first') + '</option>' +
              (ui.main ? (S.subsBy[ui.main] || []).map(function (s) { return '<option value="' + esc(s.id) + '"' + (ui.sub === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') : '') + '</select>' +
            '<select class="select" data-sort aria-label="Sort">' +
              [['name', 'Name A–Z'], ['sold', 'Best selling (30 days)'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['newest', 'Newest first']].map(function (o) {
                return '<option value="' + o[0] + '"' + (ui.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
              }).join('') + '</select></div>' +
          '<div class="pp-chips" role="group" aria-label="Quick filters">' +
            chip('', 'All', shop.length) + chip('off', 'Sold out', off, true) + chip('nophoto', 'Missing photo', nophoto, true) + chip('best', 'Best sellers', bestIds().length) +
          '</div><div data-results></div>'
        : ui.tab === 'xmas' ? '<div data-xmas></div>' : '<div data-addons></div>');
    if (ui.tab === 'products') renderResults(); else if (ui.tab === 'xmas') renderXmas(); else renderAddons();
  }

  /* ---------------- Christmas pre-order ---------------- */

  // Pre-order packages (menu.is_campaign) live on their own tab, separate from the normal shop.
  function shopProducts() { return S.products.filter(function (p) { return !p.is_campaign; }); }
  function xmasProducts() { return S.products.filter(function (p) { return p.is_campaign; }).sort(function (a, b) { return (Number(a.price) || 0) - (Number(b.price) || 0); }); }

  async function renderXmas() {
    var box = root.querySelector('[data-xmas]');
    if (!box) return;
    var list = xmasProducts();
    var live = list.filter(function (p) { return p.is_available !== false; }).length;
    box.innerHTML =
      '<div class="xm-hero"><div class="xm-hero-txt">' +
          '<span class="xm-eyebrow">' + GIFT + 'Christmas 2026 · 10,000 pre-orders by 25 December</span>' +
          '<h2>Pre-order packages</h2>' +
          '<p>Everything here shows only on the app’s Christmas page, never in the normal menu. Customers pay online, with <b>no delivery fee and no address</b>, and every package bought counts toward the 10,000 goal.</p>' +
        '</div><div class="xm-progress" data-xm-progress><b>…</b><span>pre-orders paid</span><div class="xm-bar"><i style="width:0"></i></div><small>Goal: 10,000</small></div></div>' +
      (list.length
        ? '<p class="pp-sub" style="margin:4px 0 12px">' + plural(list.length, 'package') + ' · ' + live + ' showing in the app · cheapest shows first</p>' +
          '<div class="pp-grid">' + list.map(cardHtml).join('') +
          '<button type="button" class="pp-new xm-new" data-new-xmas><span>+</span>New pre-order package</button></div>'
        : A.emptyState('No pre-order packages yet', 'Create a package (e.g. “Christmas Food Pack”, “Family Giving Box”). Set its name, price, photo and description, and it appears on the app’s Christmas page.', I.box) +
          '<div style="text-align:center;margin-top:12px"><button type="button" class="btn btn-primary" data-new-xmas>' + I.plus + 'New pre-order package</button></div>');
    try {
      var r = await A.sb.rpc('campaign_progress');
      var n = Number(r.data) || 0, el = box.querySelector('[data-xm-progress]');
      if (el && !r.error) {
        el.querySelector('b').textContent = A.formatNumber(n);
        el.querySelector('.xm-bar i').style.width = Math.max(2, Math.min(100, n / 100)) + '%';
      }
    } catch (e) { /* progress is a nice-to-have */ }
  }
  function chip(id, label, n, warn) {
    return '<button type="button" class="pp-chip' + (warn ? ' warn' : '') + (ui.chip === id ? ' on' : '') + '" data-chip="' + id + '" aria-pressed="' + (ui.chip === id) + '">' + esc(label) + ' <b>' + n + '</b></button>';
  }

  function filtered() {
    var q = norm(ui.q), best = ui.chip === 'best' ? bestIds() : null;
    var list = shopProducts().filter(function (p) {
      if (q && norm(p.name).indexOf(q) === -1 && norm(p.description).indexOf(q) === -1) return false;
      if (ui.sub && p.category_id !== ui.sub) return false;
      if (ui.main && !ui.sub) { var m = mainOf(p); if (!m || m.id !== ui.main) return false; }
      if (ui.chip === 'off' && p.is_available !== false) return false;
      if (ui.chip === 'nophoto' && p.image_url) return false;
      if (best && best.indexOf(p.id) === -1) return false;
      return true;
    });
    var by = {
      name: function (a, b) { return String(a.name).localeCompare(String(b.name)); },
      sold: function (a, b) { return (S.sold[b.id] || 0) - (S.sold[a.id] || 0) || String(a.name).localeCompare(String(b.name)); },
      price_asc: function (a, b) { return (Number(a.price) || 0) - (Number(b.price) || 0); },
      price_desc: function (a, b) { return (Number(b.price) || 0) - (Number(a.price) || 0); },
      newest: function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); }
    }[ui.chip === 'best' ? 'sold' : ui.sort];
    return list.sort(by);
  }

  function renderResults() {
    var box = root.querySelector('[data-results]');
    var list = filtered(), shown = list.slice(0, ui.limit);
    if (!list.length) {
      box.innerHTML = A.emptyState(S.products.length ? 'No products match' : 'No products yet',
        S.products.length ? 'Try a different search or clear the filters.' : 'Add your first product with “New product”.', I.box);
      return;
    }
    box.innerHTML = '<div class="pp-grid">' + shown.map(cardHtml).join('') +
      (!ui.chip && !ui.q ? '<button type="button" class="pp-new" data-new><span>+</span>New product</button>' : '') + '</div>' +
      (shown.length < list.length ? '<div class="pp-more"><span>Showing ' + shown.length + ' of ' + list.length + '</span><button type="button" class="btn btn-ghost btn-sm" data-more>Show more</button></div>' : '');
  }

  function cardHtml(p) {
    var sub = subOf(p), main = mainOf(p), photo = photoOf(p), on = p.is_available !== false, n = S.sold[p.id] || 0;
    var tag = !on ? '<span class="pp-tag out">Sold out</span>' : !p.image_url ? '<span class="pp-tag warn" title="Showing the subcategory photo">No own photo</span>' : '';
    return '<article class="pp-card' + (on ? '' : ' off') + '">' +
      '<button type="button" class="pp-img" data-edit="' + esc(p.id) + '" aria-label="Edit ' + esc(p.name) + '" style="background:' + esc(colorOf(p)) + '1a">' +
        (photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy"' + (p.image_url ? '' : ' class="fallback"') + ' data-pid="' + esc(p.id) + '">' : '<span class="pp-noimg">' + esc((p.name || '?').charAt(0)) + '</span>') +
        '<span class="pp-badges">' + (p.rating ? '<span class="pp-tag">★ ' + Number(p.rating).toFixed(1) + '</span>' : '<span></span>') + tag + '</span></button>' +
      '<div class="pp-body"><b>' + esc(p.name) + '</b>' +
        (p.is_campaign
          ? '<small style="color:#C8102E;font-weight:700">Christmas pre-order · no delivery</small>'
          : '<small>' + esc(main ? main.name : 'No category') + (sub && sub.parent_id ? ' › ' + esc(sub.name) : '') + '</small>') +
        '<div class="pp-row"><span class="pp-price">' + esc(naira(p.price)) + '</span><span class="pp-sold">' + n + ' sold · 30d</span></div>' +
        (!p.is_campaign && (p.delivery_fee != null || p.delivery_note || p.affiliate_rate != null)
          ? '<div class="pp-custom">' +
              (p.delivery_fee != null ? '<span>Delivery ' + esc(naira(p.delivery_fee)) + '</span>' : '') +
              (p.delivery_note ? '<span>' + esc(p.delivery_note.replace(/ delivery$/i, '')) + '</span>' : '') +
              (p.affiliate_rate != null ? '<span>Affiliate ' + esc(String(Math.round(Number(p.affiliate_rate) * 1000) / 10)) + '%</span>' : '') +
            '</div>'
          : '') +
        '<div class="pp-row"><button type="button" class="pp-switch" role="switch" aria-checked="' + on + '" data-stock="' + esc(p.id) + '" aria-label="' + esc(p.name) + ' in stock"><i></i>' + (on ? 'In stock' : 'Sold out') + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + esc(p.id) + '">Edit</button></div>' +
        (hasOptionsUI(p) ? '<button type="button" class="btn btn-ghost btn-sm pp-optbtn" data-options="' + esc(p.id) + '" style="margin-top:6px;width:100%;justify-content:center">Sizes &amp; options</button>' : '') +
        '</div></article>';
  }

  function onImgError(e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.hasAttribute('data-pid')) return;
    var span = document.createElement('span'); span.className = 'pp-noimg'; span.textContent = '•';
    img.replaceWith(span);
  }

  async function toggleStock(p, btn) {
    var next = p.is_available === false;
    btn.disabled = true;
    var res = await A.sb.from('menu').update({ is_available: next }).eq('id', p.id).select('id,is_available').single();
    btn.disabled = false;
    if (res.error) {
      A.toast(missingColumn(res.error) ? 'Run the updated supabase/schema.sql first to turn on “Sold out”.' : 'Couldn’t update: ' + errMsg(res.error), 'error');
      return;
    }
    p.is_available = res.data.is_available;
    A.toast(next ? p.name + ' is back in stock' : p.name + ' now shows as sold out in the app', 'success');
    renderAll();
  }

  /* ---------------- Clicks ---------------- */

  function onClick(e) {
    var b = e.target.closest('button');
    if (!b || !root.contains(b) || b.disabled) return;
    var v;
    if ((v = b.getAttribute('data-tab'))) { ui.tab = v; renderAll(); return; }
    if (b.hasAttribute('data-new')) return openProduct(null);
    if (b.hasAttribute('data-new-xmas')) return openProduct(null, { giving: true });
    if (b.hasAttribute('data-new-addon')) return openAddon(null);
    if ((v = b.getAttribute('data-edit'))) { var p = S.products.find(function (x) { return x.id === v; }); if (p) openProduct(p); return; }
    if ((v = b.getAttribute('data-stock'))) { var ps = S.products.find(function (x) { return x.id === v; }); if (ps) toggleStock(ps, b); return; }
    if ((v = b.getAttribute('data-options'))) { var po = S.products.find(function (x) { return x.id === v; }); if (po) openOptions(po, function () { renderResults(); }); return; }
    if (b.hasAttribute('data-chip')) { ui.chip = b.getAttribute('data-chip'); ui.limit = PAGE; renderAll(); return; }
    if (b.hasAttribute('data-more')) { ui.limit += PAGE; renderResults(); return; }
    if ((v = b.getAttribute('data-aedit'))) { var c = S.customs.find(function (x) { return x.id === v; }); if (c) openAddon(c); return; }
    if ((v = b.getAttribute('data-adel'))) { var cd = S.customs.find(function (x) { return x.id === v; }); if (cd) deleteAddon(cd); return; }
  }
  function onInput(e) {
    if (e.target.matches('[data-q]')) { ui.q = e.target.value; ui.limit = PAGE; renderResultsSoon(); }
  }
  var renderResultsSoon = A.debounce(function () { if (root && root.querySelector('[data-results]')) renderResults(); }, 150);
  function onChange(e) {
    var t = e.target;
    if (t.matches('[data-main]')) { ui.main = t.value; ui.sub = ''; ui.limit = PAGE; renderAll(); var m = root.querySelector('[data-main]'); if (m) m.focus(); }
    else if (t.matches('[data-sub]')) { ui.sub = t.value; ui.limit = PAGE; renderResults(); }
    else if (t.matches('[data-sort]')) { ui.sort = t.value; renderResults(); }
  }

  /* ---------------- Product editor ---------------- */

  function openProduct(p, preset) {
    var editing = !!p;
    var startSub = editing ? subOf(p) : null;
    var draft = {
      name: editing ? p.name : '',
      price: editing ? String(Number(p.price) || '') : '',
      main: startSub ? (startSub.parent_id || startSub.id) : (ui.main || ''),
      sub: startSub && startSub.parent_id ? startSub.id : (!editing && ui.sub ? ui.sub : ''),
      description: editing ? (p.description || '') : '',
      on: editing ? p.is_available !== false : true,
      giving: editing ? !!p.is_campaign : !!(preset && preset.giving),
      fee: editing && p.delivery_fee != null && !p.is_campaign ? String(Number(p.delivery_fee)) : '',
      when: editing ? (p.delivery_note || '') : '',
      rate: editing && p.affiliate_rate != null ? String(Math.round(Number(p.affiliate_rate) * 1000) / 10) : '',
      rating: editing && p.rating != null ? String(p.rating) : '',
      calories: editing && p.calories != null ? String(p.calories) : '',
      protein: editing && p.protein != null ? String(p.protein) : '',
      addons: editing ? linksFor(p.id) : [],
      file: null, objUrl: null, removed: false
    };
    var currentUrl = editing ? p.image_url : null;
    var uid = 'pp' + Math.random().toString(36).slice(2, 8);
    var form = document.createElement('form');
    form.className = 'cg-form';
    form.noValidate = true;

    function mainOptions() {
      return '<option value="">Choose a category</option>' + S.mains.map(function (m) {
        return '<option value="' + esc(m.id) + '"' + (draft.main === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>';
      }).join('');
    }
    function subOptions() {
      if (!draft.main) return '<option value="">Choose a category first</option>';
      var subs = S.subsBy[draft.main] || [];
      if (!subs.length) return '<option value="">This category has no subcategories yet</option>';
      return '<option value="">Choose a subcategory</option>' + subs.map(function (s) {
        return '<option value="' + esc(s.id) + '"' + (draft.sub === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
      }).join('');
    }
    function addonChips(type) {
      var list = S.customs.filter(function (c) { return c.type === type; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      if (!list.length) return '<span class="cg-help">None yet.</span>';
      return list.map(function (c) {
        var on = draft.addons.indexOf(c.id) !== -1;
        return '<button type="button" class="pp-addon" aria-pressed="' + on + '" data-addon="' + esc(c.id) + '">' + esc(c.name) + ' <small>' + (Number(c.price) ? '+' + esc(naira(c.price)) : 'free') + '</small></button>';
      }).join('');
    }

    form.innerHTML =
      '<div class="field"><span class="cg-lbl" id="' + uid + '-pl">Photo</span>' +
        '<div class="pp-up" role="group" aria-labelledby="' + uid + '-pl"><div class="pp-up-prev" data-prev></div>' +
          '<div class="cg-drop" data-drop><span>Drag a photo here or choose one. A clear photo on a plain background sells best.</span>' +
            '<div class="cg-drop-btns"><label class="btn btn-ghost btn-sm" for="' + uid + '-file" tabindex="0" role="button">Choose photo</label>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-remove>Remove</button></div>' +
            '<input type="file" id="' + uid + '-file" class="cg-file" accept="image/jpeg,image/png,image/webp">' +
            '<span class="cg-help">If you skip this, the app shows the subcategory photo.</span>' +
            '<span class="cg-err" data-photo-err role="alert"></span></div></div></div>' +
      '<div class="field"><label for="' + uid + '-name">Name <span class="cg-req" aria-hidden="true">*</span></label>' +
        '<input id="' + uid + '-name" name="name" class="input" maxlength="120" autocomplete="off" autofocus placeholder="e.g. Chapman – 50cl Bottle" value="' + esc(draft.name) + '">' +
        '<span class="cg-err" data-err="name" role="alert"></span></div>' +
      '<div class="field"><label for="' + uid + '-price">Price <span class="cg-req" aria-hidden="true">*</span></label>' +
        '<div class="pp-money"><span aria-hidden="true">₦</span><input id="' + uid + '-price" name="price" class="input" inputmode="decimal" autocomplete="off" value="' + esc(draft.price) + '"></div>' +
        '<span class="cg-err" data-err="price" role="alert"></span></div>' +
      // Delivery and affiliate commission for this product (hidden for Christmas pre-orders: no delivery, no commission).
      '<fieldset class="pp-dlv" data-dlv' + (draft.giving ? ' style="display:none"' : '') + '><legend>Delivery &amp; affiliate</legend>' +
        '<div class="pp-three">' +
          '<div class="field"><label for="' + uid + '-fee">Delivery fee</label>' +
            '<div class="pp-money"><span aria-hidden="true">₦</span><input id="' + uid + '-fee" name="fee" class="input" inputmode="decimal" autocomplete="off" value="' + esc(draft.fee) + '" data-fee-ph></div>' +
            '<span class="cg-help" data-fee-help></span><span class="cg-err" data-err="fee" role="alert"></span></div>' +
          '<div class="field"><label for="' + uid + '-when">When it arrives</label>' +
            '<select id="' + uid + '-when" name="when" class="select">' + DELIVERY_TIMES.map(function (t) {
              return '<option value="' + esc(t) + '"' + (draft.when === t ? ' selected' : '') + '>' + (t ? esc(t) : 'Same as its category') + '</option>';
            }).join('') + (draft.when && DELIVERY_TIMES.indexOf(draft.when) === -1 ? '<option value="' + esc(draft.when) + '" selected>' + esc(draft.when) + '</option>' : '') + '</select></div>' +
          '<div class="field"><label for="' + uid + '-rate">Affiliate earns</label>' +
            '<div class="pp-money pp-pct"><input id="' + uid + '-rate" name="rate" class="input" inputmode="decimal" autocomplete="off" placeholder="5" value="' + esc(draft.rate) + '"><span aria-hidden="true">%</span></div>' +
            '<span class="cg-help">Empty = standard 5%. 0 = no commission.</span><span class="cg-err" data-err="rate" role="alert"></span></div>' +
        '</div>' +
        '<span class="cg-help">An order pays the highest delivery fee of the products in it.</span>' +
      '</fieldset>' +
      '<div class="pp-avail" style="border:1.5px solid #F5C2C7;background:#FFF5F5"><div><b>Christmas pre-order product</b>' +
        '<small>For the Christmas campaign: shown on the app’s Christmas page (not in the normal menu), no delivery fee or address, and every one bought counts toward the 10,000 goal.</small></div>' +
        '<button type="button" class="pp-switch" role="switch" aria-checked="' + draft.giving + '" data-giving aria-label="Christmas pre-order product"><i></i></button></div>' +
      '<div class="pp-two" data-cats' + (draft.giving ? ' style="display:none"' : '') + '>' +
        '<div class="field"><label for="' + uid + '-main">Category <span class="cg-req" aria-hidden="true">*</span></label>' +
          '<select id="' + uid + '-main" name="main" class="select">' + mainOptions() + '</select>' +
          '<span class="cg-err" data-err="main" role="alert"></span></div>' +
        '<div class="field"><label for="' + uid + '-sub">Subcategory <span class="cg-req" aria-hidden="true">*</span></label>' +
          '<select id="' + uid + '-sub" name="sub" class="select"' + (draft.main ? '' : ' disabled') + '>' + subOptions() + '</select>' +
          '<span class="cg-err" data-err="sub" role="alert"></span></div>' +
      '</div>' +
      '<div class="field"><label for="' + uid + '-desc">Description <span class="cg-opt">(optional)</span></label>' +
        '<textarea id="' + uid + '-desc" name="description" class="textarea" rows="3" maxlength="1000" placeholder="What it is, size, what makes it special">' + esc(draft.description) + '</textarea></div>' +
      '<div class="pp-avail"><div><b>In stock</b><small>Turn off to show “Sold out” in the app without deleting the product.</small></div>' +
        '<button type="button" class="pp-switch" role="switch" aria-checked="' + draft.on + '" data-on aria-label="In stock"><i></i></button></div>' +
      '<div class="field"><span class="cg-lbl">Add-ons customers can pick <span class="cg-opt">(optional)</span></span>' +
        '<div class="pp-addons" data-group="topping"><span class="pp-addons-h">Add-ons</span>' + addonChips('topping') + '</div>' +
        '<div class="pp-addons" data-group="side"><span class="pp-addons-h">Extras</span>' + addonChips('side') + '</div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-add-addon style="align-self:flex-start">' + I.plus + 'New add-on</button></div>' +
      '<div class="field"><span class="cg-lbl">Customer options <span class="cg-opt">(e.g. cake size, flavour, message)</span></span>' +
        (editing
          ? '<div class="pp-optsum" data-optsum>' + optSummary(p.id) + '</div>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-edit-options style="align-self:flex-start">Edit sizes &amp; options</button>'
          : '<span class="cg-help">Save the product first, then you can add options like size and flavour.</span>') +
      '</div>' +
      '<details class="pp-more-fields"' + (draft.rating || draft.calories || draft.protein ? ' open' : '') + '><summary>Rating &amp; nutrition (optional)</summary><div class="pp-three">' +
        '<div class="field"><label for="' + uid + '-rating">Rating (0–5)</label><input id="' + uid + '-rating" name="rating" class="input" inputmode="decimal" value="' + esc(draft.rating) + '"><span class="cg-err" data-err="rating" role="alert"></span></div>' +
        '<div class="field"><label for="' + uid + '-cal">Calories</label><input id="' + uid + '-cal" name="calories" class="input" inputmode="numeric" value="' + esc(draft.calories) + '"><span class="cg-err" data-err="calories" role="alert"></span></div>' +
        '<div class="field"><label for="' + uid + '-pro">Protein (g)</label><input id="' + uid + '-pro" name="protein" class="input" inputmode="numeric" value="' + esc(draft.protein) + '"><span class="cg-err" data-err="protein" role="alert"></span></div>' +
      '</div></details>' +
      '<div class="field"><span class="cg-lbl">How it looks in the app</span><div class="pp-preview" data-preview></div></div>' +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';

    var $ = function (s) { return form.querySelector(s); };
    var input = $('.cg-file'), drop = $('[data-drop]'), errEl = $('[data-photo-err]');
    function chosenSub() { return draft.sub ? S.catById[draft.sub] : null; }
    function color() { var m = S.catById[draft.main]; return (m && m.color) || '#FE8C00'; }
    function previewSrc() {
      if (draft.objUrl) return draft.objUrl;
      if (!draft.removed && currentUrl) return currentUrl;
      var s = chosenSub(); return s && s.image_url ? s.image_url : null;
    }
    function paintPhoto() {
      var own = draft.objUrl || (!draft.removed && currentUrl);
      var src = previewSrc();
      $('[data-prev]').style.background = color() + '1a';
      $('[data-prev]').innerHTML = src ? '<img src="' + esc(src) + '" alt=""' + (own ? '' : ' class="fallback"') + '>' + (own ? '' : '<span class="pp-fb-note">Subcategory photo</span>') : '<span class="pp-noimg">' + esc((draft.name || '?').charAt(0)) + '</span>';
      $('[data-remove]').hidden = !own;
      paintPreview();
    }
    function paintPreview() {
      var src = previewSrc(), price = Number(String(draft.price).replace(/[^\d.]/g, '')) || 0, s = chosenSub(), m = S.catById[draft.main];
      $('[data-preview]').innerHTML =
        '<div class="pp-app' + (draft.on ? '' : ' sold') + '"><div class="pp-app-img" style="background:' + color() + '1a">' + (src ? '<img src="' + esc(src) + '" alt="">' : '') +
          (draft.rating ? '<span class="pp-app-r">★ ' + esc(Number(draft.rating).toFixed(1)) + '</span>' : '') + (draft.on ? '' : '<span class="pp-app-sold">Sold out</span>') + '</div>' +
          '<b>' + esc(draft.name.trim() || 'Product name') + '</b><div class="pp-app-f"><span>' + esc(naira(price)) + '</span>' + (draft.on ? '<i>+</i>' : '') + '</div></div>' +
        '<p>' + (draft.on
          ? (draft.giving ? 'Appears on the app’s Christmas pre-order page (not in the normal menu).'
            : m ? 'Appears in the ' + esc(m.name) + ' row on Home' + (s ? ' and on the ' + esc(s.name) + ' page' : '') + '.' : 'Choose a category to see where it appears.')
          : 'Customers can still see it but can’t add it to their cart.') + '</p>';
    }
    function fieldError(name, msg) {
      var ctl = form.querySelector('[name="' + name + '"]'), err = form.querySelector('[data-err="' + name + '"]');
      if (err) err.textContent = msg || '';
      if (ctl) { ctl.classList.toggle('cg-invalid', !!msg); if (msg) ctl.setAttribute('aria-invalid', 'true'); else ctl.removeAttribute('aria-invalid'); }
    }
    function take(file) {
      errEl.textContent = '';
      if (!file) return;
      if (IMG_TYPES.indexOf(file.type) === -1) { errEl.textContent = 'Please choose a JPEG, PNG or WebP image.'; return; }
      if (file.size > MAX_BYTES) { errEl.textContent = 'That image is larger than 5 MB.'; return; }
      if (draft.objUrl) URL.revokeObjectURL(draft.objUrl);
      draft.file = file; draft.removed = false; draft.objUrl = URL.createObjectURL(file);
      paintPhoto();
    }
    function dispose() { if (draft.objUrl) URL.revokeObjectURL(draft.objUrl); }

    input.addEventListener('change', function () { take(input.files && input.files[0]); input.value = ''; });
    form.querySelector('label[for="' + uid + '-file"]').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    $('[data-remove]').addEventListener('click', function () { if (draft.objUrl) URL.revokeObjectURL(draft.objUrl); draft.file = null; draft.objUrl = null; draft.removed = true; paintPhoto(); });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { take(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
    drop.addEventListener('click', function (e) { if (!e.target.closest('label, button, input')) input.click(); });

    form.addEventListener('input', function (e) {
      var n = e.target.name;
      if (n && draft.hasOwnProperty(n) && n !== 'main' && n !== 'sub') { draft[n] = e.target.value; fieldError(n, ''); }
      if (n === 'name' || n === 'price' || n === 'rating') paintPreview();
      if (n === 'name' && !previewSrc()) paintPhoto();
    });
    $('[name="main"]').addEventListener('change', function () {
      draft.main = this.value; draft.sub = ''; fieldError('main', ''); fieldError('sub', '');
      var sel = $('[name="sub"]'); sel.innerHTML = subOptions(); sel.disabled = !draft.main;
      paintPhoto();
      if (draft.main) sel.focus();
    });
    $('[name="sub"]').addEventListener('change', function () { draft.sub = this.value; fieldError('sub', ''); paintPhoto(); });
    // Placeholder/help shows the category's standard fee, so an empty box is self-explanatory.
    function paintFeeHint() {
      var m = S.catById[draft.main], std = standardFee(m && m.name);
      $('[data-fee-ph]').placeholder = String(std);
      $('[data-fee-help]').textContent = 'Empty = standard ' + naira(std) + (m ? ' for ' + m.name : '') + '.';
    }
    paintFeeHint();
    $('[name="main"]').addEventListener('change', paintFeeHint);
    $('[name="when"]').addEventListener('change', function () { draft.when = this.value; });
    form.addEventListener('click', function (e) {
      var a = e.target.closest('[data-addon]');
      if (a) {
        var id = a.getAttribute('data-addon'), k = draft.addons.indexOf(id);
        if (k === -1) draft.addons.push(id); else draft.addons.splice(k, 1);
        a.setAttribute('aria-pressed', String(k === -1));
        return;
      }
      if (e.target.closest('[data-edit-options]')) {
        openOptions(p, function () { var s = form.querySelector('[data-optsum]'); if (s) s.innerHTML = optSummary(p.id); });
        return;
      }
      if (e.target.closest('[data-on]')) { draft.on = !draft.on; $('[data-on]').setAttribute('aria-checked', String(draft.on)); paintPreview(); return; }
      if (e.target.closest('[data-giving]')) {
        draft.giving = !draft.giving;
        $('[data-giving]').setAttribute('aria-checked', String(draft.giving));
        $('[data-cats]').style.display = draft.giving ? 'none' : '';
        $('[data-dlv]').style.display = draft.giving ? 'none' : '';
        fieldError('main', ''); fieldError('sub', '');
        return;
      }
      if (e.target.closest('[data-add-addon]')) {
        openAddon(null, function (c) {
          draft.addons.push(c.id);
          ['topping', 'side'].forEach(function (t) { var g = form.querySelector('[data-group="' + t + '"]'); g.innerHTML = '<span class="pp-addons-h">' + (t === 'topping' ? 'Add-ons' : 'Extras') + '</span>' + addonChips(t); });
        });
      }
    });
    paintPhoto();

    var busy = false, m;
    async function save() {
      if (busy) return;
      ['name', 'price', 'main', 'sub', 'rating', 'calories', 'protein', 'fee', 'rate'].forEach(function (n) { fieldError(n, ''); });
      var name = draft.name.trim().replace(/\s+/g, ' ');
      var price = Number(String(draft.price).replace(/[,\s₦]/g, ''));
      var bad = [];
      if (!name) bad.push(['name', 'Enter a name.']);
      else if (S.products.some(function (x) { return norm(x.name) === norm(name) && (!editing || x.id !== p.id); })) bad.push(['name', 'A product with this name already exists.']);
      if (!String(draft.price).trim() || !isFinite(price) || price < 0) bad.push(['price', 'Enter a price, e.g. 3500.']);
      // The Christmas Food Pack has no category on purpose (it's only reached from the Christmas page).
      var giving = draft.giving;
      if (giving) { /* no category needed */ }
      else if (!draft.main) bad.push(['main', 'Choose a category.']);
      else if (!draft.sub) bad.push(['sub', (S.subsBy[draft.main] || []).length ? 'Choose a subcategory.' : 'Add a subcategory to this category first (Categories page).']);
      function num(key, label, lo, hi, isInt) {
        var raw = String(draft[key]).trim();
        if (!raw) return null;
        var v = Number(raw);
        if (!isFinite(v) || v < lo || (hi != null && v > hi) || (isInt && Math.round(v) !== v)) { bad.push([key, label]); return null; }
        return v;
      }
      var rating = num('rating', 'Use a number from 0 to 5.', 0, 5, false);
      var calories = num('calories', 'Use a whole number.', 0, null, true);
      var protein = num('protein', 'Use a whole number.', 0, null, true);
      var feeRaw = String(draft.fee).replace(/[,\s₦]/g, '');
      draft.fee = feeRaw;
      var fee = giving ? 0 : num('fee', 'Enter an amount in naira, e.g. 3000, or leave empty.', 0, null, false);
      var ratePct = giving ? null : num('rate', 'Use a percentage from 0 to 50, e.g. 7.5, or leave empty.', 0, 50, false);
      if (bad.length) {
        bad.forEach(function (b) { fieldError(b[0], b[1]); });
        if (['rating', 'calories', 'protein'].indexOf(bad[0][0]) !== -1) form.querySelector('details').open = true;
        var first = form.querySelector('[name="' + bad[0][0] + '"]'); if (first) first.focus();
        return;
      }

      busy = true;
      var saveBtn = m.el.querySelector('.modal-actions .btn-primary');
      A.setLoading(saveBtn, true, 'Saving…');
      try {
        var imageUrl;
        try { imageUrl = draft.file ? await A.uploadImage(draft.file, 'products') : (draft.removed ? null : (currentUrl || null)); }
        catch (e) { A.toast('Photo upload failed: ' + errMsg(e), 'error'); return; }
        var payload = {
          name: name, price: Math.round(price * 100) / 100, category_id: giving ? null : draft.sub,
          description: draft.description.trim() || null, image_url: imageUrl,
          rating: rating, calories: calories, protein: protein, is_available: draft.on,
          // Christmas pre-order products: no category, ₦0 delivery, no commission.
          is_campaign: giving,
          delivery_fee: giving ? 0 : fee,
          delivery_note: giving ? null : (draft.when || null),
          affiliate_rate: giving ? null : (ratePct == null ? null : Math.round(ratePct * 100) / 10000)
        };
        var res = editing
          ? await A.sb.from('menu').update(payload).eq('id', p.id).select(MENU_COLS).single()
          : await A.sb.from('menu').insert(payload).select(MENU_COLS).single();
        if (res.error && missingColumn(res.error)) {
          // Database not updated yet: save without the stock switch.
          delete payload.is_available;
          var cols = MENU_COLS.replace(',is_available', '');
          res = editing
            ? await A.sb.from('menu').update(payload).eq('id', p.id).select(cols).single()
            : await A.sb.from('menu').insert(payload).select(cols).single();
          if (!res.error) { res.data.is_available = true; if (!draft.on) A.toast('Saved. To use “Sold out”, run the updated supabase/schema.sql.', 'error'); }
        }
        if (res.error) {
          if (res.error.code === '23505') fieldError('name', 'A product with this name already exists.');
          else A.toast('Couldn’t save the product: ' + errMsg(res.error), 'error');
          return;
        }
        var saved = res.data;
        if (editing) { var i = S.products.findIndex(function (x) { return x.id === p.id; }); S.products[i] = saved; }
        else S.products.push(saved);

        // Sync add-on links
        var before = editing ? linksFor(saved.id) : [];
        var toRemove = before.filter(function (id) { return draft.addons.indexOf(id) === -1; });
        var toAdd = draft.addons.filter(function (id) { return before.indexOf(id) === -1; });
        var linkErr = null;
        if (toRemove.length) {
          var d = await A.sb.from('menu_customizations').delete().eq('menu_id', saved.id).in('customization_id', toRemove);
          if (d.error) linkErr = d.error; else S.links = S.links.filter(function (l) { return !(l.menu_id === saved.id && toRemove.indexOf(l.customization_id) !== -1); });
        }
        if (toAdd.length) {
          var rows = toAdd.map(function (cid) { return { menu_id: saved.id, customization_id: cid }; });
          var ins = await A.sb.from('menu_customizations').insert(rows);
          if (ins.error) linkErr = ins.error; else S.links = S.links.concat(rows);
        }
        dispose();
        m.close();
        if (linkErr) A.toast('Saved, but add-ons couldn’t be updated: ' + errMsg(linkErr), 'error');
        else A.toast(editing ? 'Saved “' + saved.name + '”' : 'Added “' + saved.name + '”', 'success');
        renderAll();
      } catch (e) {
        A.toast('Couldn’t save the product: ' + errMsg(e), 'error');
      } finally {
        busy = false;
        if (m.isOpen()) A.setLoading(saveBtn, false);
      }
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });

    var actions = [];
    if (editing) actions.push({ label: 'Delete', variant: 'danger', onClick: function (close) { deleteProduct(p, close); } });
    actions.push({ label: 'Cancel', variant: 'ghost', onClick: function (close) { dispose(); close(); } });
    actions.push({ label: editing ? 'Save changes' : 'Add product', variant: 'primary', onClick: function () { save(); } });
    m = A.modal({ title: draft.giving ? (editing ? 'Edit pre-order package' : 'New pre-order package') : (editing ? 'Edit product' : 'New product'), body: form, className: 'cg-drawer', actions: actions, onClose: dispose });
  }

  async function deleteProduct(p, closeEditor) {
    var ok = await A.confirm('Delete “' + p.name + '”? It disappears from the app. Past orders keep their details. This can’t be undone.\n\nTip: to hide it for a while, switch it to “Sold out” instead.',
      { danger: true, confirmLabel: 'Delete product' });
    if (!ok) return;
    var res = await A.sb.from('menu').delete().eq('id', p.id);
    if (res.error) { A.toast('Couldn’t delete: ' + errMsg(res.error), 'error'); return; }
    S.products = S.products.filter(function (x) { return x.id !== p.id; });
    S.links = S.links.filter(function (l) { return l.menu_id !== p.id; });
    if (closeEditor) closeEditor();
    A.toast('Deleted “' + p.name + '”', 'success');
    renderAll();
  }

  /* ---------------- Add-ons ---------------- */

  /* ---------------- Customer options (cake size, flavour, message…) ---------------- */

  function optSummary(menuId) {
    var gs = (S.optGroups || []).filter(function (g) { return g.menu_id === menuId; });
    if (!gs.length) return '<span class="cg-help">None. Customers add it to the cart as it is.</span>';
    return gs.map(function (g) { return '<span class="pp-optchip">' + esc(g.name) + (g.required ? ' <b>*</b>' : '') + '</span>'; }).join('');
  }

  /** Window to manage the questions customers answer for one product. Saves straight away. */
  async function openOptions(p, onDone) {
    var body = document.createElement('div');
    body.className = 'cg-form';
    var groups = [];
    var m = A.modal({
      title: 'Customer options · ' + p.name, body: body, wide: true,
      onClose: function () { S.optGroups = (S.optGroups || []).filter(function (g) { return g.menu_id !== p.id; }).concat(groups.map(function (g) { return { id: g.id, menu_id: p.id, name: g.name, required: g.required }; })); if (onDone) onDone(); },
      actions: [{ label: 'Done', variant: 'primary', onClick: function (close) { close(); } }]
    });

    async function reload() {
      var res = await A.sb.from('option_groups').select('id,name,kind,required,max_length,placeholder,sort_order,option_values(id,name,price,hint,swatch,sort_order)')
        .eq('menu_id', p.id).order('sort_order');
      if (res.error) {
        body.innerHTML = '';
        body.appendChild(A.errorState(/option_groups/.test(errMsg(res.error)) ? 'Customer options need the updated supabase/schema.sql.' : errMsg(res.error), reload));
        return;
      }
      groups = (res.data || []).map(function (g) { g.option_values = (g.option_values || []).sort(function (a, b) { return a.sort_order - b.sort_order; }); return g; });
      paint();
    }
    async function run(q, ok) {
      var res = await q;
      if (res.error) { A.toast('Couldn’t save: ' + errMsg(res.error), 'error'); return false; }
      if (ok) A.toast(ok, 'success', { duration: 1600 });
      await reload();
      return true;
    }

    function paint() {
      var others = S.products.filter(function (x) { return x.id !== p.id && (S.optGroups || []).some(function (g) { return g.menu_id === x.id; }); });
      body.innerHTML =
        '<p class="pp-note" style="margin:0">Questions customers answer before adding <b>' + esc(p.name) + '</b> to the cart, like <b>Size</b> or <b>Flavour</b>. Add any choices you want; each can add to the base price of <b>' + esc(naira(p.price)) + '</b>. Use ◀ ▶ to change the order customers see. Changes save straight away.</p>' +
        (groups.length ? groups.map(function (g, i) {
          return '<div class="pp-og">' +
            '<div class="pp-og-h"><b>' + esc(g.name) + '</b>' +
              '<span class="pp-optchip">' + (g.kind === 'text' ? 'Customer types (max ' + (g.max_length || 300) + ')' : 'Choose one') + '</span>' +
              (g.required ? '<span class="pp-optchip req">Required</span>' : '') +
              '<span class="pr-spacer"></span>' +
              '<button type="button" class="cg-icon sm" data-gmove="' + g.id + '" data-dir="-1" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
              '<button type="button" class="cg-icon sm" data-gmove="' + g.id + '" data-dir="1" aria-label="Move down"' + (i === groups.length - 1 ? ' disabled' : '') + '>↓</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-gedit="' + g.id + '">Edit</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-gdel="' + g.id + '" style="color:var(--red)">Delete</button></div>' +
            (g.kind === 'single'
              ? '<div class="pp-ov">' + g.option_values.map(function (v, vi) {
                  return '<span class="pp-ovc">' +
                    (g.option_values.length > 1 ? '<button type="button" data-vmove="' + v.id + '" data-g="' + g.id + '" data-dir="-1" aria-label="Move ' + esc(v.name) + ' left"' + (vi === 0 ? ' disabled' : '') + '>◀</button>' : '') +
                    (v.swatch ? '<i style="background:' + esc(v.swatch) + '"></i>' : '') + esc(cleanName(v.name)) +
                    ' <small>' + (Number(v.price) ? '+' + esc(naira(v.price)) + ' = ' + esc(naira(Number(p.price) + Number(v.price))) : 'included') + (v.hint ? ' · ' + esc(v.hint) : '') + '</small>' +
                    (g.option_values.length > 1 ? '<button type="button" data-vmove="' + v.id + '" data-g="' + g.id + '" data-dir="1" aria-label="Move ' + esc(v.name) + ' right"' + (vi === g.option_values.length - 1 ? ' disabled' : '') + '>▶</button>' : '') +
                    '<button type="button" data-vedit="' + v.id + '" data-g="' + g.id + '" aria-label="Edit ' + esc(v.name) + '">✎</button>' +
                    '<button type="button" data-vdel="' + v.id + '" aria-label="Delete ' + esc(v.name) + '">×</button></span>';
                }).join('') + '<button type="button" class="btn btn-ghost btn-sm" data-vadd="' + g.id + '">' + I.plus + 'Add choice</button></div>'
              : (g.placeholder ? '<p class="cg-help" style="margin:6px 0 0">Example shown to customers: “' + esc(g.placeholder) + '”</p>' : '')) +
          '</div>';
        }).join('') : '<p class="cg-help">No options yet.</p>') +
        '<div class="pp-og-add"><button type="button" class="btn btn-ghost btn-sm" data-gadd="single">' + I.plus + 'Add a “choose one” question</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-gadd="text">' + I.plus + 'Add a “customer types” question</button>' +
          (others.length && !groups.length ? '<select class="select" data-copy aria-label="Copy options from another product"><option value="">Copy options from…</option>' +
            others.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('') + '</select>' : '') +
        '</div>' +
        (groups.length ? '<div class="pp-og-add" style="border-top:1px solid var(--line, #E6E6EA);padding-top:14px"><button type="button" class="btn btn-ghost btn-sm" data-apply>Use these options on other products…</button>' +
          '<span class="cg-help" style="margin:0">e.g. give every cake the same sizes in one go.</span></div>' : '');
    }

    function ask(title, fields, initial) {
      return new Promise(function (resolve) {
        var f = document.createElement('form'); f.className = 'cg-form'; f.noValidate = true;
        f.innerHTML = fields.map(function (x) {
          if (x.type === 'swatch') {
            // Colour picker: preset dots, "any colour", or no colour. The value lives in a hidden input.
            var curV = /^#[0-9a-f]{6}$/i.test(initial[x.name] || '') ? initial[x.name].toUpperCase() : '';
            return '<div class="field"><span class="cg-lbl">' + esc(x.label) + '</span>' +
              '<input type="hidden" name="' + x.name + '" value="' + esc(curV) + '">' +
              '<div class="cg-swatches" role="radiogroup" aria-label="' + esc(x.label) + '" data-ovsw>' +
                '<button type="button" class="cg-sw ov-none' + (curV ? '' : ' on') + '" data-ovc="" title="No colour" aria-label="No colour">∅</button>' +
                OPTION_SWATCHES.map(function (s) {
                  return '<button type="button" class="cg-sw' + (curV === s[1] ? ' on' : '') + '" data-ovc="' + s[1] + '" style="background:' + s[1] + '" title="' + esc(s[0]) + '" aria-label="' + esc(s[0]) + '"></button>';
                }).join('') +
                '<label class="cg-sw cg-sw-custom' + (curV && !OPTION_SWATCHES.some(function (s) { return s[1] === curV; }) ? ' on' : '') + '" title="Pick any colour">' +
                  '<input type="color" value="' + esc((curV || '#FD652A').toLowerCase()) + '" aria-label="Pick any colour" data-ovcustom></label>' +
              '</div>' + (x.help ? '<span class="cg-help">' + esc(x.help) + '</span>' : '') + '</div>';
          }
          if (x.type === 'check') return '<label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="' + x.name + '"' + (initial[x.name] ? ' checked' : '') + '> ' + esc(x.label) + '</label>';
          return '<div class="field"><label for="og-' + x.name + '">' + esc(x.label) + '</label><input id="og-' + x.name + '" name="' + x.name + '" class="input"' +
            (x.type === 'color' ? ' type="color"' : '') + (x.mode ? ' inputmode="' + x.mode + '"' : '') + ' placeholder="' + esc(x.ph || '') + '" value="' + esc(initial[x.name] == null ? '' : initial[x.name]) + '">' +
            (x.help ? '<span class="cg-help">' + esc(x.help) + '</span>' : '') + '</div>';
        }).join('') + '<button type="submit" hidden></button>';
        var done = false;
        function submit(close) {
          var out = {};
          fields.forEach(function (x) { var el = f.elements[x.name]; out[x.name] = x.type === 'check' ? el.checked : el.value.trim(); });
          if (fields[0] && !out[fields[0].name]) { f.elements[fields[0].name].focus(); return; }
          done = true; close(); resolve(out);
        }
        var mm = A.modal({ title: title, body: f, onClose: function () { if (!done) resolve(null); },
          actions: [{ label: 'Cancel', variant: 'ghost', onClick: function (close) { close(); } }, { label: 'Save', variant: 'primary', onClick: function (close) { submit(close); } }] });
        f.addEventListener('submit', function (e) { e.preventDefault(); submit(mm.close); });
        // Colour picker: choosing a dot (or any colour) sets the hidden value; typing a colour name pre-picks it.
        var swBox = f.querySelector('[data-ovsw]');
        if (swBox) {
          var hidden = swBox.previousElementSibling, touched = !!hidden.value;
          var setSw = function (val, custom) {
            hidden.value = val;
            swBox.querySelectorAll('.cg-sw').forEach(function (el) {
              el.classList.toggle('on', custom ? el.classList.contains('cg-sw-custom') : el.getAttribute('data-ovc') === val);
            });
          };
          swBox.addEventListener('click', function (e) {
            var bb = e.target.closest('[data-ovc]'); if (!bb) return;
            touched = true; setSw(bb.getAttribute('data-ovc'), false);
          });
          swBox.addEventListener('input', function (e) {
            if (!e.target.hasAttribute('data-ovcustom')) return;
            touched = true; var hv = e.target.value.toUpperCase();
            setSw(hv, !OPTION_SWATCHES.some(function (s) { return s[1] === hv; }));
          });
          var nameEl = f.elements[fields[0].name];
          nameEl.addEventListener('input', function () {
            if (touched) return;
            var guess = colourFromName(cleanName(nameEl.value));
            setSw(guess || '', false);
          });
        }
      });
    }
    // Colour choices: "🟢 Green" → "Green" with a green swatch, so every colour shows as a dot in the app.
    var COLOURS = [['vanilla cream', '#F5E6B8'], ['chocolate brown', '#8B5A3C'], ['baby blue', '#BFDBFE'], ['light blue', '#BFDBFE'],
      ['sky blue', '#7DD3FC'], ['navy blue', '#1E3A8A'], ['royal blue', '#2563EB'], ['baby pink', '#FBCFE8'], ['hot pink', '#EC4899'],
      ['light pink', '#FBCFE8'], ['rose gold', '#E8B4A0'], ['lilac', '#D8B4FE'], ['lavender', '#DDD6FE'], ['mint', '#A7F3D0'],
      ['teal', '#2DD4BF'], ['turquoise', '#5EEAD4'], ['peach', '#FDBA8C'], ['coral', '#FB7185'], ['maroon', '#9F1239'],
      ['burgundy', '#881337'], ['wine', '#7F1D1D'], ['navy', '#1E3A8A'], ['cream', '#FFF4D6'], ['ivory', '#FFFBEB'], ['beige', '#E7D7B8'],
      ['champagne', '#F3E5C0'], ['nude', '#E8C4A8'], ['brown', '#8B5A3C'], ['chocolate', '#7B4A2E'], ['caramel', '#C68A4E'],
      ['silver', '#CBD5E1'], ['grey', '#9CA3AF'], ['gray', '#9CA3AF'], ['gold', '#FBBF24'], ['white', '#FFFFFF'], ['black', '#1F2937'],
      ['red', '#F87171'], ['pink', '#F9A8C8'], ['orange', '#FB923C'], ['yellow', '#FDE047'], ['green', '#4ADE80'], ['blue', '#93C5FD'],
      ['purple', '#C4B5FD'], ['violet', '#A78BFA'], ['rainbow', '#FBBF24']].sort(function (a, b) { return b[0].length - a[0].length; });
    // The dots offered in the colour picker (name, colour).
    var OPTION_SWATCHES = [['White', '#FFFFFF'], ['Cream', '#FFF4D6'], ['Vanilla cream', '#F5E6B8'], ['Gold', '#FBBF24'], ['Yellow', '#FDE047'],
      ['Orange', '#FB923C'], ['Peach', '#FDBA8C'], ['Red', '#F87171'], ['Maroon', '#9F1239'], ['Pink', '#F9A8C8'], ['Baby pink', '#FBCFE8'],
      ['Rose gold', '#E8B4A0'], ['Purple', '#C4B5FD'], ['Lilac', '#D8B4FE'], ['Blue', '#93C5FD'], ['Royal blue', '#2563EB'], ['Navy', '#1E3A8A'],
      ['Teal', '#2DD4BF'], ['Mint', '#A7F3D0'], ['Green', '#4ADE80'], ['Brown', '#8B5A3C'], ['Silver', '#CBD5E1'], ['Black', '#1F2937']];
    function cleanName(n) { var s = String(n || '').replace(/^[^A-Za-z0-9À-ɏ]+/, '').trim(); return s || String(n || '').trim(); }
    function colourFromName(n) {
      var s = String(n || '').toLowerCase();
      var hit = COLOURS.find(function (c) { return new RegExp('\\b' + c[0] + '\\b').test(s); });
      return hit ? hit[1] : null;
    }
    function money(v) { var n = Number(String(v || '0').replace(/[,\s₦]/g, '')); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; }

    body.addEventListener('click', async function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      var v, g;
      if ((v = b.getAttribute('data-gadd'))) {
        var text = v === 'text';
        var a = await ask(text ? 'New “customer types” question' : 'New “choose one” question', [
          { name: 'name', label: 'Question', ph: text ? 'e.g. Message on the cake' : 'e.g. Size' },
          text ? { name: 'max_length', label: 'Longest answer (characters)', mode: 'numeric', ph: '40' } : null,
          text ? { name: 'placeholder', label: 'Example for customers (optional)', ph: 'e.g. Happy 10th, Tolu!' } : null,
          { name: 'required', label: 'Customers must answer this', type: 'check' }
        ].filter(Boolean), { required: !text });
        if (!a) return;
        await run(A.sb.from('option_groups').insert({ menu_id: p.id, name: a.name, kind: v, required: !!a.required,
          max_length: text ? (Number(a.max_length) || 40) : null, placeholder: text ? (a.placeholder || null) : null,
          sort_order: groups.reduce(function (mx, x) { return Math.max(mx, x.sort_order || 0); }, 0) + 1 }), 'Question added');
        return;
      }
      if ((v = b.getAttribute('data-gedit'))) {
        g = groups.find(function (x) { return x.id === v; }); if (!g) return;
        var t = g.kind === 'text';
        var r = await ask('Edit question', [
          { name: 'name', label: 'Question' },
          t ? { name: 'max_length', label: 'Longest answer (characters)', mode: 'numeric' } : null,
          t ? { name: 'placeholder', label: 'Example for customers (optional)' } : null,
          { name: 'required', label: 'Customers must answer this', type: 'check' }
        ].filter(Boolean), g);
        if (!r) return;
        var upd = { name: r.name, required: !!r.required };
        if (t) { upd.max_length = Number(r.max_length) || g.max_length || 40; upd.placeholder = r.placeholder || null; }
        await run(A.sb.from('option_groups').update(upd).eq('id', g.id), 'Saved');
        return;
      }
      if ((v = b.getAttribute('data-gdel'))) {
        g = groups.find(function (x) { return x.id === v; });
        if (g && await A.confirm('Delete the question “' + g.name + '” and its choices?', { danger: true, confirmLabel: 'Delete' }))
          await run(A.sb.from('option_groups').delete().eq('id', g.id), 'Deleted');
        return;
      }
      if ((v = b.getAttribute('data-gmove'))) {
        var i = groups.findIndex(function (x) { return x.id === v; }), j = i + Number(b.getAttribute('data-dir'));
        var order = groups.slice(); order.splice(j, 0, order.splice(i, 1)[0]);
        var res = await Promise.all(order.map(function (x, k) { return A.sb.from('option_groups').update({ sort_order: k + 1 }).eq('id', x.id); }));
        var bad = res.find(function (x) { return x.error; }); if (bad) A.toast('Couldn’t reorder: ' + errMsg(bad.error), 'error');
        await reload();
        return;
      }
      if ((v = b.getAttribute('data-vadd')) || (v = b.getAttribute('data-vedit'))) {
        var gid = b.getAttribute('data-vadd') || b.getAttribute('data-g');
        g = groups.find(function (x) { return x.id === gid; });
        var cur = b.hasAttribute('data-vedit') ? g.option_values.find(function (x) { return x.id === v; }) : null;
        var c = await ask(cur ? 'Edit choice' : 'New choice for “' + g.name + '”', [
          { name: 'name', label: 'Choice', ph: 'e.g. 8 inch' },
          { name: 'price', label: 'Extra price (₦)', mode: 'decimal', ph: '0',
            help: 'Added to the base price of ' + naira(p.price) + '. 0 means it’s included. Example: for a size that should cost ' + naira(Number(p.price) + 7000) + ' in total, enter 7000.' },
          { name: 'hint', label: 'Small note (optional)', ph: 'e.g. serves 15–20' },
          { name: 'swatch', label: 'Colour (for colour choices)', type: 'swatch',
            help: 'Pick the colour customers will see as a dot in the app; no emoji needed. Typing a name like “Green” picks it for you. Choose ∅ for choices that aren’t colours (sizes, flavours).' }
        ], cur ? { name: cleanName(cur.name), price: Number(cur.price) || '', hint: cur.hint, swatch: cur.swatch || colourFromName(cleanName(cur.name)) } : {});
        if (!c) return;
        var price = money(c.price);
        if (price == null) { A.toast('Enter the extra price as a number, e.g. 2500.', 'error'); return; }
        var nm = cleanName(c.name);
        var sw = /^#[0-9a-f]{6}$/i.test(c.swatch || '') ? c.swatch.toUpperCase() : null; // ∅ = not a colour
        var row = { name: nm, price: price, hint: c.hint || null, swatch: sw };
        if (cur) await run(A.sb.from('option_values').update(row).eq('id', cur.id), 'Saved');
        else { row.group_id = g.id; row.sort_order = g.option_values.length + 1; await run(A.sb.from('option_values').insert(row), 'Choice added'); }
        return;
      }
      if ((v = b.getAttribute('data-vdel'))) {
        if (await A.confirm('Delete this choice?', { danger: true, confirmLabel: 'Delete' })) await run(A.sb.from('option_values').delete().eq('id', v), 'Deleted');
        return;
      }
      if ((v = b.getAttribute('data-vmove'))) {
        g = groups.find(function (x) { return x.id === b.getAttribute('data-g'); }); if (!g) return;
        var vi = g.option_values.findIndex(function (x) { return x.id === v; }), vj = vi + Number(b.getAttribute('data-dir'));
        if (vi < 0 || vj < 0 || vj >= g.option_values.length) return;
        var vorder = g.option_values.slice(); vorder.splice(vj, 0, vorder.splice(vi, 1)[0]);
        var vres = await Promise.all(vorder.map(function (x, k) { return A.sb.from('option_values').update({ sort_order: k + 1 }).eq('id', x.id); }));
        var vbad = vres.find(function (x) { return x.error; }); if (vbad) A.toast('Couldn’t reorder: ' + errMsg(vbad.error), 'error');
        await reload();
        return;
      }
      if (b.hasAttribute('data-apply')) { applyToOthers(); return; }
    });

    /** Copy this product's options onto other products (replacing theirs). */
    function applyToOthers() {
      var main = mainOf(p);
      var pool = S.products.filter(function (x) { return x.id !== p.id; });
      var same = main ? pool.filter(function (x) { var mm = mainOf(x); return mm && mm.id === main.id; }) : [];
      var list = same.length ? same : pool;
      var f = document.createElement('form'); f.className = 'cg-form'; f.noValidate = true;
      f.innerHTML =
        '<p class="pp-note" style="margin:0">Give these products the same options as <b>' + esc(p.name) + '</b> (' + groups.map(function (x) { return esc(x.name); }).join(', ') + '). ' +
          '<b>Their current options are replaced.</b> Prices of the choices are copied as they are.</p>' +
        '<label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" data-all checked> Select all</label>' +
        '<div style="display:flex;flex-direction:column;gap:8px;max-height:46vh;overflow:auto">' + list.map(function (x) {
          var has = (S.optGroups || []).some(function (gg) { return gg.menu_id === x.id; });
          return '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="t" value="' + esc(x.id) + '" checked> ' + esc(x.name) +
            ' <small class="cg-help" style="margin:0">' + esc(naira(x.price)) + (has ? ' · has options' : '') + '</small></label>';
        }).join('') + '</div>';
      f.querySelector('[data-all]').addEventListener('change', function (e) {
        Array.prototype.forEach.call(f.querySelectorAll('input[name="t"]'), function (c) { c.checked = e.target.checked; });
      });
      var busy = false;
      var mm = A.modal({ title: 'Use these options on other products', body: f, actions: [
        { label: 'Cancel', variant: 'ghost', onClick: function (close) { close(); } },
        { label: 'Apply', variant: 'primary', onClick: async function (close) {
          if (busy) return;
          var ids = Array.prototype.filter.call(f.querySelectorAll('input[name="t"]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
          if (!ids.length) { A.toast('Tick at least one product.', 'error'); return; }
          if (!await A.confirm('Replace the options on ' + ids.length + ' product' + (ids.length === 1 ? '' : 's') + '?', { confirmLabel: 'Replace options' })) return;
          busy = true;
          var btn = mm.el.querySelector('.modal-actions .btn-primary'); A.setLoading(btn, true, 'Applying…');
          var failed = 0;
          for (var k = 0; k < ids.length; k++) {
            var del = await A.sb.from('option_groups').delete().eq('menu_id', ids[k]);
            if (del.error) { failed++; continue; }
            for (var q = 0; q < groups.length; q++) {
              var sg = groups[q];
              var ins = await A.sb.from('option_groups').insert({ menu_id: ids[k], name: sg.name, kind: sg.kind, required: sg.required, max_length: sg.max_length, placeholder: sg.placeholder, sort_order: sg.sort_order }).select('id').single();
              if (ins.error) { failed++; break; }
              if (sg.option_values.length) {
                var vi2 = await A.sb.from('option_values').insert(sg.option_values.map(function (ov) { return { group_id: ins.data.id, name: ov.name, price: ov.price, hint: ov.hint, swatch: ov.swatch, sort_order: ov.sort_order }; }));
                if (vi2.error) { failed++; break; }
              }
            }
          }
          // Refresh the product list's option summary.
          var all = await A.sb.from('option_groups').select('id,menu_id,name,required').order('sort_order');
          if (!all.error) S.optGroups = all.data || [];
          A.setLoading(btn, false); busy = false; close();
          if (failed) A.toast('Done, but ' + failed + ' product' + (failed === 1 ? '' : 's') + ' couldn’t be updated. Try again.', 'error');
          else A.toast('Options applied to ' + ids.length + ' product' + (ids.length === 1 ? '' : 's') + '.', 'success');
        } }
      ] });
    }
    body.addEventListener('change', async function (e) {
      if (!e.target.matches('[data-copy]') || !e.target.value) return;
      var from = S.products.find(function (x) { return x.id === e.target.value; });
      if (!from || !await A.confirm('Copy all options from “' + from.name + '”?', { confirmLabel: 'Copy' })) { e.target.value = ''; return; }
      var src = await A.sb.from('option_groups').select('name,kind,required,max_length,placeholder,sort_order,option_values(name,price,hint,swatch,sort_order)').eq('menu_id', from.id);
      if (src.error) { A.toast('Couldn’t copy: ' + errMsg(src.error), 'error'); return; }
      for (var k = 0; k < src.data.length; k++) {
        var sg = src.data[k];
        var ins = await A.sb.from('option_groups').insert({ menu_id: p.id, name: sg.name, kind: sg.kind, required: sg.required, max_length: sg.max_length, placeholder: sg.placeholder, sort_order: sg.sort_order }).select('id').single();
        if (ins.error) { A.toast('Couldn’t copy: ' + errMsg(ins.error), 'error'); break; }
        if ((sg.option_values || []).length) {
          var vi = await A.sb.from('option_values').insert(sg.option_values.map(function (ov) { return { group_id: ins.data.id, name: ov.name, price: ov.price, hint: ov.hint, swatch: ov.swatch, sort_order: ov.sort_order }; }));
          if (vi.error) { A.toast('Couldn’t copy: ' + errMsg(vi.error), 'error'); break; }
        }
      }
      A.toast('Options copied', 'success');
      await reload();
    });

    body.innerHTML = A.skeletonBlocks(3, 'line');
    await reload();
    if (!m.isOpen()) return;
  }

  function usage(cid) { return S.links.filter(function (l) { return l.customization_id === cid; }).length; }
  function renderAddons() {
    var box = root.querySelector('[data-addons]');
    var list = S.customs.slice().sort(function (a, b) { return String(a.type).localeCompare(String(b.type)) || String(a.name).localeCompare(String(b.name)); });
    if (!list.length) { box.innerHTML = A.emptyState('No add-ons yet', 'Add-ons are optional things customers can add to a product, like candles or gift wrapping.', I.plus); return; }
    box.innerHTML = '<p class="pp-note">Add-ons and extras are optional things customers can pick on a product page, like birthday candles or gift wrapping. Choose which products offer them in each product’s editor.</p>' +
      '<div class="card flush"><div class="table-wrap"><table class="table table-cards pp-atable"><thead><tr><th>Name</th><th>Type</th><th class="num">Price</th><th class="num">Used by</th><th class="text-right"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      list.map(function (c) {
        var n = usage(c.id);
        return '<tr><td class="pp-a-name"><b>' + esc(c.name) + '</b></td><td class="pp-a-type">' + (c.type === 'side' ? 'Extra' : 'Add-on') + '</td>' +
          '<td class="num pp-a-price">' + (Number(c.price) ? esc(naira(c.price)) : 'Free') + '</td><td class="num pp-a-used">' + plural(n, 'product') + '</td>' +
          '<td class="text-right nowrap pp-a-acts"><button type="button" class="btn btn-ghost btn-sm" data-aedit="' + esc(c.id) + '">Edit</button> ' +
          '<button type="button" class="btn btn-ghost btn-sm" data-adel="' + esc(c.id) + '" style="color:var(--red)">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function openAddon(c, onCreated) {
    var editing = !!c;
    var form = document.createElement('form');
    form.className = 'cg-form';
    form.noValidate = true;
    form.innerHTML =
      '<div class="field"><label for="ad-name">Name <span class="cg-req" aria-hidden="true">*</span></label>' +
        '<input id="ad-name" name="name" class="input" maxlength="80" autocomplete="off" autofocus placeholder="e.g. Birthday Candles" value="' + esc(editing ? c.name : '') + '">' +
        '<span class="cg-err" data-err="name" role="alert"></span></div>' +
      '<div class="field"><label for="ad-price">Price</label><div class="pp-money"><span aria-hidden="true">₦</span><input id="ad-price" name="price" class="input" inputmode="decimal" value="' + esc(editing ? String(Number(c.price) || 0) : '') + '" placeholder="0 for free"></div>' +
        '<span class="cg-err" data-err="price" role="alert"></span></div>' +
      '<div class="field"><span class="cg-lbl">Type</span><div class="cg-seg" role="radiogroup" aria-label="Type">' +
        '<button type="button" role="radio" data-type="topping">Add-on<small>e.g. candles, frosting</small></button>' +
        '<button type="button" role="radio" data-type="side">Extra<small>e.g. gift box, plates</small></button></div></div>' +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';
    var type = editing ? c.type : 'topping';
    function paintType() { Array.prototype.forEach.call(form.querySelectorAll('[data-type]'), function (b) { var on = b.getAttribute('data-type') === type; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); }
    form.addEventListener('click', function (e) { var b = e.target.closest('[data-type]'); if (b) { type = b.getAttribute('data-type'); paintType(); } });
    paintType();
    function err(n, msg) { var el = form.querySelector('[data-err="' + n + '"]'); if (el) el.textContent = msg || ''; }

    var busy = false, m;
    async function save() {
      if (busy) return;
      err('name', ''); err('price', '');
      var name = form.elements.name.value.trim().replace(/\s+/g, ' ');
      var rawPrice = form.elements.price.value.replace(/[,\s₦]/g, '');
      var price = rawPrice ? Number(rawPrice) : 0;
      if (!name) { err('name', 'Enter a name.'); form.elements.name.focus(); return; }
      if (S.customs.some(function (x) { return norm(x.name) === norm(name) && (!editing || x.id !== c.id); })) { err('name', 'An add-on with this name already exists.'); return; }
      if (!isFinite(price) || price < 0) { err('price', 'Enter a price, or 0 for free.'); return; }
      busy = true;
      var btn = m.el.querySelector('.modal-actions .btn-primary');
      A.setLoading(btn, true, 'Saving…');
      try {
        var payload = { name: name, price: Math.round(price * 100) / 100, type: type };
        var res = editing
          ? await A.sb.from('customizations').update(payload).eq('id', c.id).select('id,name,price,type').single()
          : await A.sb.from('customizations').insert(payload).select('id,name,price,type').single();
        if (res.error) { A.toast('Couldn’t save: ' + errMsg(res.error), 'error'); return; }
        if (editing) Object.assign(c, res.data); else S.customs.push(res.data);
        m.close();
        A.toast(editing ? 'Saved “' + res.data.name + '”' : 'Added “' + res.data.name + '”', 'success');
        if (onCreated && !editing) onCreated(res.data);
        else if (ui.tab === 'addons') renderAll();
      } finally {
        busy = false;
        if (m.isOpen()) A.setLoading(btn, false);
      }
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });
    m = A.modal({
      title: editing ? 'Edit add-on' : 'New add-on', body: form,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: function (close) { close(); } },
        { label: editing ? 'Save changes' : 'Add', variant: 'primary', onClick: function () { save(); } }
      ]
    });
  }

  async function deleteAddon(c) {
    var n = usage(c.id);
    var ok = await A.confirm('Delete “' + c.name + '”?' + (n ? ' It will be removed from ' + plural(n, 'product') + '.' : '') + ' This can’t be undone.', { danger: true, confirmLabel: 'Delete add-on' });
    if (!ok) return;
    var res = await A.sb.from('customizations').delete().eq('id', c.id);
    if (res.error) { A.toast('Couldn’t delete: ' + errMsg(res.error), 'error'); return; }
    S.customs = S.customs.filter(function (x) { return x.id !== c.id; });
    S.links = S.links.filter(function (l) { return l.customization_id !== c.id; });
    A.toast('Deleted “' + c.name + '”', 'success');
    renderAll();
  }

  /* ---------------- Register ---------------- */

  async function mount(el) {
    var wrap = document.createElement('div');
    wrap.className = 'pp-page';
    el.innerHTML = '';
    el.appendChild(wrap);
    root = wrap;
    wrap.innerHTML = '<div class="page-head"><div><h1>Products</h1><p class="pp-sub">Loading products…</p></div></div><div class="pp-grid">' + A.skeletonBlocks(8, 'pp-sk') + '</div>';
    wrap.addEventListener('click', onClick);
    wrap.addEventListener('input', onInput);
    wrap.addEventListener('change', onChange);
    wrap.addEventListener('error', onImgError, true);
    try {
      await load();
    } catch (e) {
      if (root !== wrap) return;
      wrap.innerHTML = '<div class="page-head"><div><h1>Products</h1></div></div>';
      wrap.appendChild(A.errorState(errMsg(e), function () { mount(el); }));
      return;
    }
    if (root === wrap) renderAll();
  }

  A.registerSection({ id: 'products', label: 'Products', icon: I.box, order: 4, render: mount });
})();

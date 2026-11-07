/* U Angel Foods admin: Categories section (main categories + subcategories). Uses only the window.Admin contract. */
(function () {
  'use strict';
  if (!window.Admin || typeof window.Admin.registerSection !== 'function') return;
  var Admin = window.Admin;

  var IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var MAX_BYTES = 5 * 1024 * 1024;
  var DEFAULT_COLOR = '#FE8C00';
  var COLS = 'id,name,description,parent_id,emoji,color,image_url,sort_order,delivery_note,kind,created_at';

  var ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/></svg>';
  var I_UP = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>';
  var I_DOWN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  var I_INFO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
  var I_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" style="vertical-align:-3px;margin-right:4px"><path d="M12 5v14M5 12h14"/></svg>';

  var S = null;            // { cats, byId, mains, subsBy, countBySub }
  var root = null;
  var expanded = {};       // main id -> true (persists across visits)
  var moving = false;

  function esc(s) { return Admin.escapeHtml(s == null ? '' : String(s)); }
  function norm(s) { return String(s || '').trim().toLowerCase(); }
  function validHex(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim() : null; }
  function initial(name) { var t = String(name || '').trim(); return t ? Array.from(t)[0].toUpperCase() : '?'; }
  function errMsg(e) { return (e && (e.message || e.error_description)) || 'Something went wrong'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
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
  function productCount(cat) {
    if (!cat) return 0;
    if (cat.parent_id) return S.countBySub[cat.id] || 0;
    return subsOf(cat.id).reduce(function (n, s) { return n + (S.countBySub[s.id] || 0); }, 0);
  }

  /* ---------------- Rendering ---------------- */

  function skeleton() {
    var rows = '';
    for (var i = 0; i < 5; i++) rows += '<div class="skeleton cx-skel-cat"></div>';
    return '<div class="page-head"><div><h1>Categories</h1><p class="cx-sub">Loading categories…</p></div></div>' +
      '<div aria-busy="true" aria-label="Loading categories">' + rows + '</div>';
  }

  function media(c, cls) {
    var color = validHex(c.color) || DEFAULT_COLOR;
    if (c.image_url) return '<img src="' + esc(c.image_url) + '" alt="" loading="lazy" data-cid="' + esc(c.id) + '"' + (cls ? ' class="' + cls + '"' : '') + '>';
    return phHtml(c, color, cls === 'thumb');
  }
  function phHtml(c, color, small) {
    var txt = c.emoji ? c.emoji : initial(c.name);
    return '<div class="cx-ph' + (small ? ' cx-ph-sm cx-thumb-ph' : '') + '" style="background:' + color + '" aria-hidden="true">' + esc(txt) + '</div>';
  }

  function renderAll() {
    if (!root) return;
    var subTotal = S.cats.length - S.mains.length;
    var html = '<div class="page-head">' +
      '<div><h1>Categories</h1><p class="cx-sub">' + plural(S.mains.length, 'main category', 'main categories') + ' · ' +
      plural(subTotal, 'subcategory', 'subcategories') + ' · ' + plural(S.menuTotal, 'product') + '</p></div>' +
      '<div class="cx-head-actions"><button type="button" class="btn btn-primary" data-act="add-main">' + I_PLUS + 'Add main category</button></div></div>' +
      '<p class="cx-hint">' + I_INFO + '<span>Main categories appear on the app’s Home screen in this order. Products belong to subcategories. Service categories take requests instead of selling products.</span></p>';

    if (!S.mains.length) {
      html += '<div class="empty"><p><b>No categories yet</b></p><p>Create a main category, then add subcategories to it.</p></div>';
      root.innerHTML = html;
      return;
    }
    html += '<div class="cx-cats">' + S.mains.map(function (m, i) { return mainCard(m, i, S.mains.length); }).join('') + '</div>';
    root.innerHTML = html;
  }

  function mainCard(m, i, total) {
    var subs = subsOf(m.id);
    var pc = productCount(m);
    var color = validHex(m.color);
    var service = m.kind === 'service';
    var open = !!expanded[m.id];
    var listId = 'cx-subs-' + m.id;
    return '<article class="card cx-ccard" aria-labelledby="cx-ct-' + esc(m.id) + '">' +
      '<div class="cx-ctop">' +
      '<div class="cx-cmedia" style="border-bottom-color:' + (color || 'transparent') + '">' + media(m) + '</div>' +
      '<div class="cx-cinfo">' +
      '<h2 class="cx-ctitle" id="cx-ct-' + esc(m.id) + '">' + (m.emoji ? '<span class="cx-emoji" aria-hidden="true">' + esc(m.emoji) + '</span>' : '') + esc(m.name) +
      ' <span class="cx-kind ' + (service ? 'cx-kind-service' : 'cx-kind-products') + '">' + (service ? 'Service' : 'Products') + '</span></h2>' +
      (m.description ? '<p class="cx-cdesc">' + esc(m.description) + '</p>' : '') +
      '<div class="cx-cmeta">' +
      '<span class="cx-swatch" title="Card colour">' + (color ? '<i style="background:' + color + '"></i>' + esc(color.toUpperCase()) : '<span>No colour</span>') + '</span>' +
      '<span>' + plural(subs.length, 'subcategory', 'subcategories') + '</span>' +
      (service ? (pc ? '<span>' + plural(pc, 'product') + '</span>' : '<span class="cx-muted">Requests only</span>') : '<span>' + plural(pc, 'product') + '</span>') +
      (m.delivery_note ? '<span class="cx-muted">Delivery: ' + esc(m.delivery_note) + '</span>' : '') +
      '</div></div></div>' +
      '<div class="cx-cbar">' +
      '<div class="cx-order">' +
      '<button type="button" class="btn btn-ghost btn-sm cx-icon-btn" data-move-main="' + esc(m.id) + '" data-dir="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move ' + esc(m.name) + ' up" title="Move up">' + I_UP + '</button>' +
      '<button type="button" class="btn btn-ghost btn-sm cx-icon-btn" data-move-main="' + esc(m.id) + '" data-dir="1"' + (i === total - 1 ? ' disabled' : '') + ' aria-label="Move ' + esc(m.name) + ' down" title="Move down">' + I_DOWN + '</button>' +
      '</div>' +
      '<div class="cx-actions">' +
      '<button type="button" class="btn btn-ghost btn-sm cx-toggle" data-toggle="' + esc(m.id) + '" aria-expanded="' + open + '" aria-controls="' + esc(listId) + '">Subcategories (' + subs.length + ') ' + I_DOWN + '</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + esc(m.id) + '" aria-label="Edit ' + esc(m.name) + '">Edit</button>' +
      '<button type="button" class="btn btn-danger btn-sm" data-del="' + esc(m.id) + '" aria-label="Delete ' + esc(m.name) + '">Delete</button>' +
      '</div></div>' +
      '<div class="cx-subs" id="' + esc(listId) + '"' + (open ? '' : ' hidden') + '>' +
      (subs.length ? '<ul class="cx-sublist">' + subs.map(function (s, j) { return subRow(s, j, subs.length, service); }).join('') + '</ul>'
        : '<p class="cx-muted" style="margin:4px 0">No subcategories yet.</p>') +
      '<button type="button" class="btn btn-ghost btn-sm cx-subadd" data-add-sub="' + esc(m.id) + '">' + I_PLUS + 'Add subcategory</button>' +
      '</div></article>';
  }

  function subRow(s, j, total, service) {
    var pc = S.countBySub[s.id] || 0;
    var parent = S.byId[s.parent_id];
    var color = validHex(s.color) || (parent && validHex(parent.color)) || DEFAULT_COLOR;
    var thumb = s.image_url
      ? '<img class="thumb" src="' + esc(s.image_url) + '" alt="" loading="lazy" data-cid="' + esc(s.id) + '" data-small="1">'
      : phHtml(s, color, true);
    return '<li class="cx-subrow">' + thumb +
      '<div class="cx-subname"><b>' + (s.emoji ? '<span aria-hidden="true">' + esc(s.emoji) + '</span> ' : '') + esc(s.name) + '</b>' +
      '<small>' + (service && !pc ? 'Service' : plural(pc, 'product')) + (s.image_url ? '' : ' · no photo') + '</small></div>' +
      '<div class="cx-actions">' +
      '<button type="button" class="btn btn-ghost btn-sm cx-icon-btn" data-move-sub="' + esc(s.id) + '" data-dir="-1"' + (j === 0 ? ' disabled' : '') + ' aria-label="Move ' + esc(s.name) + ' up" title="Move up">' + I_UP + '</button>' +
      '<button type="button" class="btn btn-ghost btn-sm cx-icon-btn" data-move-sub="' + esc(s.id) + '" data-dir="1"' + (j === total - 1 ? ' disabled' : '') + ' aria-label="Move ' + esc(s.name) + ' down" title="Move down">' + I_DOWN + '</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-edit-sub="' + esc(s.id) + '" aria-label="Edit ' + esc(s.name) + '">Edit</button>' +
      '<button type="button" class="btn btn-danger btn-sm" data-del-sub="' + esc(s.id) + '" aria-label="Delete ' + esc(s.name) + '">Delete</button>' +
      '</div></li>';
  }

  function onImgError(e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.hasAttribute('data-cid') || !S) return;
    var c = S.byId[img.getAttribute('data-cid')];
    if (!c) return;
    var parent = c.parent_id ? S.byId[c.parent_id] : null;
    var color = validHex(c.color) || (parent && validHex(parent.color)) || DEFAULT_COLOR;
    var tmp = document.createElement('div');
    tmp.innerHTML = phHtml(c, color, img.hasAttribute('data-small'));
    img.replaceWith(tmp.firstChild);
  }

  function onClick(e) {
    var b = e.target.closest('button');
    if (!b || !root || !root.contains(b) || b.disabled) return;
    var v;
    if ((v = b.getAttribute('data-toggle'))) {
      expanded[v] = !expanded[v];
      b.setAttribute('aria-expanded', String(!!expanded[v]));
      var list = root.querySelector('#cx-subs-' + CSS.escape(v));
      if (list) list.hidden = !expanded[v];
      return;
    }
    if (b.getAttribute('data-act') === 'add-main') return openMainForm(null);
    if ((v = b.getAttribute('data-edit'))) return S.byId[v] && openMainForm(S.byId[v]);
    if ((v = b.getAttribute('data-del'))) return S.byId[v] && deleteMain(S.byId[v]);
    if ((v = b.getAttribute('data-add-sub'))) return S.byId[v] && openSubForm(null, S.byId[v]);
    if ((v = b.getAttribute('data-edit-sub'))) return S.byId[v] && openSubForm(S.byId[v], S.byId[S.byId[v].parent_id]);
    if ((v = b.getAttribute('data-del-sub'))) return S.byId[v] && deleteSub(S.byId[v]);
    if ((v = b.getAttribute('data-move-main'))) return move(S.mains, v, Number(b.getAttribute('data-dir')), b);
    if ((v = b.getAttribute('data-move-sub'))) { var c = S.byId[v]; return c && move(subsOf(c.parent_id), v, Number(b.getAttribute('data-dir')), b); }
  }

  /* ---------------- Reordering ---------------- */

  async function move(siblings, id, dir, btn) {
    if (moving) return;
    var idx = siblings.findIndex(function (c) { return c.id === id; });
    var j = idx + dir;
    if (idx < 0 || j < 0 || j >= siblings.length) return;
    var a = siblings[idx], b = siblings[j];
    var updates;
    if (a.sort_order !== b.sort_order && a.sort_order != null && b.sort_order != null) {
      updates = [[a.id, b.sort_order], [b.id, a.sort_order]];
    } else {
      // Duplicate / missing sort orders: renumber this group 1..n in the new order.
      var arr = siblings.slice();
      arr[idx] = b; arr[j] = a;
      updates = arr.map(function (c, k) { return [c.id, k + 1]; }).filter(function (u) { return S.byId[u[0]].sort_order !== u[1]; });
    }
    moving = true;
    if (btn) btn.setAttribute('aria-busy', 'true');
    try {
      var results = await Promise.all(updates.map(function (u) {
        return Admin.sb.from('categories').update({ sort_order: u[1] }).eq('id', u[0]);
      }));
      var failed = results.filter(function (r) { return r.error; });
      results.forEach(function (r, k) { if (!r.error) S.byId[updates[k][0]].sort_order = updates[k][1]; });
      if (failed.length) Admin.toast('Couldn’t reorder: ' + errMsg(failed[0].error), 'error');
      reindex();
      renderAll();
      // keep keyboard focus on the moved item's same button
      var sel = (a.parent_id ? '[data-move-sub="' : '[data-move-main="') + CSS.escape(a.id) + '"][data-dir="' + dir + '"]';
      var nb = root && root.querySelector(sel);
      if (nb && !nb.disabled) nb.focus();
      else if (root) { var other = root.querySelector(sel.replace('data-dir="' + dir + '"', 'data-dir="' + (-dir) + '"')); if (other) other.focus(); }
    } catch (e) {
      Admin.toast('Couldn’t reorder: ' + errMsg(e), 'error');
    } finally {
      moving = false;
    }
  }

  /* ---------------- Form helpers ---------------- */

  function setBusy(m, label, busy) {
    if (!m || !m.el) return;
    Array.prototype.forEach.call(m.el.querySelectorAll('button'), function (b) {
      var txt = b.getAttribute('data-cx-label') || b.textContent.trim();
      if (txt === label) {
        if (!b.hasAttribute('data-cx-label')) b.setAttribute('data-cx-label', txt);
        b.disabled = busy;
        b.setAttribute('aria-busy', String(busy));
        b.textContent = busy ? 'Saving…' : txt;
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
    var uid = 'cxc' + Math.random().toString(36).slice(2, 8);
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
      resolve: async function () {
        if (state.file) return await Admin.uploadImage(state.file, folder);
        if (state.removed) return null;
        return currentUrl || null;
      },
      dispose: function () { if (state.objUrl) URL.revokeObjectURL(state.objUrl); }
    };
  }

  function blocked(title, message, withProductsLink) {
    var actions = [];
    if (withProductsLink) actions.push({ label: 'Open Products', variant: 'ghost', onClick: function (close) { close(); Admin.navigate('products'); } });
    actions.push({ label: 'OK', variant: 'primary', onClick: function (close) { close(); } });
    Admin.modal({ title: title, body: '<p>' + esc(message) + '</p>', actions: actions });
  }

  /* ---------------- Main category form ---------------- */

  function openMainForm(c) {
    var editing = !!c;
    var pc = editing ? productCount(c) : 0;
    var color = (editing && validHex(c.color)) || DEFAULT_COLOR;
    var form = document.createElement('form');
    form.className = 'cx-form';
    form.noValidate = true;
    form.innerHTML =
      '<div class="field"><label for="mc-name">Name <span class="cx-req" aria-hidden="true">*</span></label>' +
      '<input id="mc-name" name="name" class="input" required maxlength="80" autocomplete="off" value="' + esc(editing ? c.name : '') + '">' +
      '<span class="cx-err" data-err="name" role="alert"></span></div>' +
      '<div class="field"><label for="mc-emoji">Emoji</label>' +
      '<input id="mc-emoji" name="emoji" class="input" maxlength="16" autocomplete="off" placeholder="e.g. 🎂" value="' + esc(editing ? c.emoji : '') + '">' +
      '<span class="cx-help">Shown when the photo is missing.</span></div>' +
      '<div class="field cx-full"><label for="mc-desc">Description</label>' +
      '<textarea id="mc-desc" name="description" class="textarea" rows="2" maxlength="500">' + esc(editing ? c.description : '') + '</textarea></div>' +
      '<div class="field"><label for="mc-hex">Card colour</label>' +
      '<div class="cx-color"><input type="color" id="mc-color" value="' + esc(color.toLowerCase()) + '" aria-label="Pick card colour">' +
      '<input id="mc-hex" name="color" class="input" maxlength="7" autocomplete="off" placeholder="#RRGGBB" value="' + esc(editing ? (c.color || '') : DEFAULT_COLOR) + '"></div>' +
      '<span class="cx-err" data-err="color" role="alert"></span></div>' +
      '<div class="field"><label for="mc-kind">Kind</label>' +
      '<select id="mc-kind" name="kind" class="select">' +
      '<option value="products"' + (!editing || c.kind !== 'service' ? ' selected' : '') + '>Products (shop)</option>' +
      '<option value="service"' + (editing && c.kind === 'service' ? ' selected' : '') + '>Service (requests)</option></select></div>' +
      '<div class="cx-warn cx-full" data-kind-warn hidden role="status"></div>' +
      '<div class="field cx-full"><label for="mc-note">Delivery note</label>' +
      '<input id="mc-note" name="delivery_note" class="input" maxlength="120" autocomplete="off" placeholder="e.g. Standard next-day delivery" value="' + esc(editing ? c.delivery_note : '') + '"></div>' +
      '<div class="field cx-full"><span id="mc-photo-label" style="font-weight:700">Photo</span><div data-photo></div></div>' +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';

    var photo = photoField(editing ? c.image_url : null, 'categories');
    photo.el.setAttribute('role', 'group');
    photo.el.setAttribute('aria-labelledby', 'mc-photo-label');
    form.querySelector('[data-photo]').appendChild(photo.el);

    var picker = form.querySelector('#mc-color');
    var hex = form.querySelector('#mc-hex');
    picker.addEventListener('input', function () { hex.value = picker.value.toUpperCase(); fieldError(form, 'color', ''); });
    hex.addEventListener('input', function () { var h = validHex(hex.value); if (h) picker.value = h.toLowerCase(); });

    var kindSel = form.querySelector('#mc-kind');
    var warn = form.querySelector('[data-kind-warn]');
    function updateWarn() {
      var toService = kindSel.value === 'service' && (!editing || c.kind !== 'service');
      if (toService && pc > 0) {
        warn.hidden = false;
        warn.textContent = 'This category has ' + plural(pc, 'product') + '. Service categories take requests instead of selling products, so customers won’t be able to shop them here. Consider moving the products to another category first.';
      } else if (toService && editing) {
        warn.hidden = false;
        warn.textContent = 'Its subcategories will also become service subcategories (customers send a request instead of ordering).';
      } else warn.hidden = true;
    }
    kindSel.addEventListener('change', updateWarn);
    updateWarn();

    var saving = false, m;
    var SAVE = editing ? 'Save changes' : 'Add category';

    async function save() {
      if (saving) return;
      ['name', 'color'].forEach(function (n) { fieldError(form, n, ''); });
      var f = form.elements;
      var name = f.name.value.trim().replace(/\s+/g, ' ');
      var colorRaw = f.color.value.trim();
      if (colorRaw && colorRaw[0] !== '#') colorRaw = '#' + colorRaw;
      var kind = f.kind.value === 'service' ? 'service' : 'products';
      var bad = null;
      if (!name) { fieldError(form, 'name', 'Enter a name.'); bad = bad || 'name'; }
      else if (S.mains.some(function (x) { return norm(x.name) === norm(name) && (!editing || x.id !== c.id); })) { fieldError(form, 'name', 'A main category with this name already exists.'); bad = bad || 'name'; }
      if (colorRaw && !validHex(colorRaw)) { fieldError(form, 'color', 'Use a hex colour like #FE8C00.'); bad = bad || 'color'; }
      if (bad) { form.querySelector('[name="' + bad + '"]').focus(); return; }

      var kindChanged = editing && kind !== (c.kind || 'products');
      if (kindChanged && kind === 'service' && pc > 0) {
        var ok = await Admin.confirm('“' + c.name + '” has ' + plural(pc, 'product') + '. Switch it to a service category anyway? Customers won’t be able to buy them from this category.', { danger: true, confirmLabel: 'Switch to service' });
        if (!ok) return;
      }

      saving = true; setBusy(m, SAVE, true);
      try {
        var imageUrl;
        try { imageUrl = await photo.resolve(); }
        catch (e) { Admin.toast('Photo upload failed: ' + errMsg(e), 'error'); return; }
        var payload = {
          name: name,
          description: f.description.value.trim() || null,
          emoji: f.emoji.value.trim() || null,
          color: colorRaw ? validHex(colorRaw).toUpperCase() : null,
          delivery_note: f.delivery_note.value.trim() || null,
          kind: kind,
          image_url: imageUrl
        };
        if (!editing) {
          payload.parent_id = null;
          payload.sort_order = S.mains.reduce(function (mx, x) { return Math.max(mx, x.sort_order || 0); }, 0) + 1;
        }
        var res = editing
          ? await Admin.sb.from('categories').update(payload).eq('id', c.id).select(COLS).single()
          : await Admin.sb.from('categories').insert(payload).select(COLS).single();
        if (res.error) {
          if (res.error.code === '23505') { fieldError(form, 'name', 'A main category with this name already exists.'); Admin.toast('That name is already taken.', 'error'); }
          else Admin.toast('Couldn’t save the category: ' + errMsg(res.error), 'error');
          return;
        }
        var saved = res.data;
        var subErr = null;
        if (editing) {
          Object.assign(S.byId[c.id], saved);
          if (kindChanged && subsOf(c.id).length) {
            var u = await Admin.sb.from('categories').update({ kind: kind }).eq('parent_id', c.id);
            if (u.error) subErr = u.error;
            else subsOf(c.id).forEach(function (s) { s.kind = kind; });
          }
        } else {
          S.cats.push(saved);
        }
        reindex();
        photo.dispose();
        m.close();
        if (subErr) Admin.toast('Saved, but its subcategories couldn’t be updated: ' + errMsg(subErr), 'error');
        else Admin.toast(editing ? 'Saved “' + saved.name + '”' : 'Added “' + saved.name + '”', 'success');
        renderAll();
      } catch (e) {
        Admin.toast('Couldn’t save the category: ' + errMsg(e), 'error');
      } finally {
        saving = false; setBusy(m, SAVE, false);
      }
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });
    m = Admin.modal({
      title: editing ? 'Edit main category' : 'New main category',
      body: form,
      wide: true,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: function (close) { photo.dispose(); close(); } },
        { label: SAVE, variant: 'primary', onClick: function () { save(); } }
      ]
    });
    setTimeout(function () { var n = form.querySelector('#mc-name'); if (n) n.focus(); }, 30);
  }

  async function deleteMain(c) {
    var subs = subsOf(c.id).length;
    if (subs) {
      blocked('Can’t delete “' + c.name + '” yet', 'It still has ' + plural(subs, 'subcategory', 'subcategories') + '. Delete its subcategories first (and move or delete their products).', false);
      return;
    }
    var ok = await Admin.confirm('Delete the main category “' + c.name + '”? It will disappear from the app’s Home screen. This can’t be undone.', { danger: true, confirmLabel: 'Delete category' });
    if (!ok) return;
    var res = await Admin.sb.from('categories').delete().eq('id', c.id);
    if (res.error) { Admin.toast('Couldn’t delete: ' + errMsg(res.error), 'error'); return; }
    S.cats = S.cats.filter(function (x) { return x.id !== c.id; });
    delete expanded[c.id];
    reindex();
    Admin.toast('Deleted “' + c.name + '”', 'success');
    renderAll();
  }

  /* ---------------- Subcategory form ---------------- */

  function openSubForm(s, parent) {
    if (!parent) { Admin.toast('Parent category not found. Reload the page.', 'error'); return; }
    var editing = !!s;
    var form = document.createElement('form');
    form.className = 'cx-form';
    form.noValidate = true;
    form.innerHTML =
      '<p class="cx-help cx-full" style="margin:0">Main category: <b>' + esc((parent.emoji ? parent.emoji + ' ' : '') + parent.name) + '</b></p>' +
      '<div class="field"><label for="sc-name">Name <span class="cx-req" aria-hidden="true">*</span></label>' +
      '<input id="sc-name" name="name" class="input" required maxlength="80" autocomplete="off" value="' + esc(editing ? s.name : '') + '">' +
      '<span class="cx-err" data-err="name" role="alert"></span></div>' +
      '<div class="field"><label for="sc-emoji">Emoji</label>' +
      '<input id="sc-emoji" name="emoji" class="input" maxlength="16" autocomplete="off" value="' + esc(editing ? s.emoji : '') + '">' +
      '<span class="cx-help">Shown when the photo is missing.</span></div>' +
      '<div class="field cx-full"><label for="sc-desc">Description</label>' +
      '<textarea id="sc-desc" name="description" class="textarea" rows="2" maxlength="500">' + esc(editing ? s.description : '') + '</textarea></div>' +
      '<div class="field cx-full"><span id="sc-photo-label" style="font-weight:700">Photo</span><div data-photo></div>' +
      (parent.kind !== 'service' ? '<span class="cx-help">Products without their own photo show this photo in the app.</span>' : '') + '</div>' +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';

    var photo = photoField(editing ? s.image_url : null, 'categories');
    photo.el.setAttribute('role', 'group');
    photo.el.setAttribute('aria-labelledby', 'sc-photo-label');
    form.querySelector('[data-photo]').appendChild(photo.el);

    var saving = false, m;
    var SAVE = editing ? 'Save changes' : 'Add subcategory';
    async function save() {
      if (saving) return;
      fieldError(form, 'name', '');
      var f = form.elements;
      var name = f.name.value.trim().replace(/\s+/g, ' ');
      if (!name) { fieldError(form, 'name', 'Enter a name.'); f.name.focus(); return; }
      if (subsOf(parent.id).some(function (x) { return norm(x.name) === norm(name) && (!editing || x.id !== s.id); })) {
        fieldError(form, 'name', '“' + parent.name + '” already has a subcategory with this name.'); f.name.focus(); return;
      }
      saving = true; setBusy(m, SAVE, true);
      try {
        var imageUrl;
        try { imageUrl = await photo.resolve(); }
        catch (e) { Admin.toast('Photo upload failed: ' + errMsg(e), 'error'); return; }
        var payload = {
          name: name,
          description: f.description.value.trim() || null,
          emoji: f.emoji.value.trim() || null,
          image_url: imageUrl
        };
        if (!editing) {
          payload.parent_id = parent.id;
          payload.kind = parent.kind || 'products';
          payload.sort_order = subsOf(parent.id).reduce(function (mx, x) { return Math.max(mx, x.sort_order || 0); }, 0) + 1;
        }
        var res = editing
          ? await Admin.sb.from('categories').update(payload).eq('id', s.id).select(COLS).single()
          : await Admin.sb.from('categories').insert(payload).select(COLS).single();
        if (res.error) {
          if (res.error.code === '23505') { fieldError(form, 'name', '“' + parent.name + '” already has a subcategory with this name.'); Admin.toast('That name is already taken in this category.', 'error'); }
          else Admin.toast('Couldn’t save the subcategory: ' + errMsg(res.error), 'error');
          return;
        }
        if (editing) Object.assign(S.byId[s.id], res.data);
        else { S.cats.push(res.data); expanded[parent.id] = true; }
        reindex();
        photo.dispose();
        m.close();
        Admin.toast(editing ? 'Saved “' + res.data.name + '”' : 'Added “' + res.data.name + '”', 'success');
        renderAll();
      } catch (e) {
        Admin.toast('Couldn’t save the subcategory: ' + errMsg(e), 'error');
      } finally {
        saving = false; setBusy(m, SAVE, false);
      }
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });
    m = Admin.modal({
      title: editing ? 'Edit subcategory' : 'New subcategory',
      body: form,
      wide: true,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: function (close) { photo.dispose(); close(); } },
        { label: SAVE, variant: 'primary', onClick: function () { save(); } }
      ]
    });
    setTimeout(function () { var n = form.querySelector('#sc-name'); if (n) n.focus(); }, 30);
  }

  async function deleteSub(s) {
    var pc = S.countBySub[s.id] || 0;
    if (pc) {
      blocked('Can’t delete “' + s.name + '” yet', 'Move or delete its ' + plural(pc, 'product') + ' first. You can do that in the Products section.', true);
      return;
    }
    var ok = await Admin.confirm('Delete the subcategory “' + s.name + '”? This can’t be undone.', { danger: true, confirmLabel: 'Delete subcategory' });
    if (!ok) return;
    var res = await Admin.sb.from('categories').delete().eq('id', s.id);
    if (res.error) { Admin.toast('Couldn’t delete: ' + errMsg(res.error), 'error'); return; }
    S.cats = S.cats.filter(function (x) { return x.id !== s.id; });
    reindex();
    Admin.toast('Deleted “' + s.name + '”', 'success');
    renderAll();
  }

  /* ---------------- Register ---------------- */

  async function mount(el) {
    var wrap = document.createElement('div');
    wrap.className = 'cx-categories';
    el.innerHTML = '';
    el.appendChild(wrap);
    root = wrap;
    wrap.innerHTML = skeleton();
    wrap.addEventListener('click', onClick);
    wrap.addEventListener('error', onImgError, true);
    try {
      await load();
    } catch (e) {
      if (root !== wrap) return;
      wrap.innerHTML = '<div class="page-head"><div><h1>Categories</h1></div></div>' +
        '<div class="empty"><p><b>Couldn’t load categories</b></p><p>' + esc(errMsg(e)) + '</p>' +
        '<button type="button" class="btn btn-primary" data-cx-retry>Try again</button></div>';
      Admin.toast('Couldn’t load categories: ' + errMsg(e), 'error');
      var retry = wrap.querySelector('[data-cx-retry]');
      if (retry) retry.addEventListener('click', function () { mount(el); });
      return;
    }
    if (root === wrap) renderAll();
  }

  Admin.registerSection({ id: 'categories', label: 'Categories', icon: ICON, order: 5, render: mount });
})();

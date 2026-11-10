/* U Angel Foods admin — Promotions: the sliding banners at the top of the app's Home.
 * Simple list with a preview of each banner, status (Live / Scheduled / Ended / Off), an on/off
 * switch, up/down ordering and a side-panel editor with a live preview.
 * Styles: css/manage.css (pr-) + shared editor styles in css/categories.css (cg-). */
(function () {
  'use strict';
  var A = window.Admin;
  if (!A || !A.registerSection) return;
  var esc = A.escapeHtml;
  var I = A.icons;
  var COLS = 'id,eyebrow,title,cta,image_url,color,link_type,link_id,starts_at,ends_at,is_active,sort_order,created_at';
  var SWATCHES = ['#FD652A', '#9D174D', '#9A3412', '#166534', '#7A4419', '#0F5B78', '#6B21A8', '#181C2E'];
  var IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var MAX_LIVE = 5;
  var ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

  var S;

  function errMsg(e) { return (e && (e.message || e.error_description)) || 'Something went wrong'; }
  function validHex(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toUpperCase() : null; }
  function status(p) {
    var now = Date.now();
    if (!p.is_active) return ['off', 'Off'];
    if (p.starts_at && new Date(p.starts_at).getTime() > now) return ['scheduled', 'Starts ' + A.formatDate(p.starts_at)];
    if (p.ends_at && new Date(p.ends_at).getTime() <= now) return ['ended', 'Ended ' + A.formatDate(p.ends_at)];
    return ['live', p.ends_at ? 'Live until ' + A.formatDate(p.ends_at) : 'Live'];
  }
  function linkText(p) {
    if (p.link_type === 'none' || !p.link_id) return 'Doesn’t open anything';
    if (p.link_type === 'product') { var m = S.products.find(function (x) { return x.id === p.link_id; }); return m ? 'Opens product: ' + m.name : 'Product was deleted'; }
    var c = S.cats.find(function (x) { return x.id === p.link_id; });
    if (!c) return 'Category was deleted';
    return p.link_type === 'service' ? 'Opens the request form: ' + c.name : 'Opens category: ' + c.name;
  }
  // Date inputs (YYYY-MM-DD, Lagos) ↔ timestamps
  function toInput(iso) { return iso ? A.lagosDateKey(iso) : ''; }
  function fromInput(v, endOfDay) { return v ? new Date(v + (endOfDay ? 'T23:59:59+01:00' : 'T00:00:00+01:00')).toISOString() : null; }

  function bannerHtml(p, src) {
    var color = validHex(p.color) || '#FD652A';
    return '<div class="pr-banner" style="background:' + color + '"><span class="pr-glow"></span>' +
      '<span class="pr-copy">' + (p.eyebrow ? '<small>' + esc(p.eyebrow) + '</small>' : '') + '<b>' + esc(p.title || 'Your headline here') + '</b>' +
        '<span class="pr-cta" style="color:' + color + '">' + esc(p.cta || 'Shop now') + ' →</span></span>' +
      '<span class="pr-photo">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : '<span>Photo</span>') + '</span></div>';
  }

  /* ---------------- Data ---------------- */

  /* ---------------- Christmas banner (site_settings 'christmas_banner') ---------------- */

  var XMAS_KEY = 'christmas_banner';
  var XMAS_COLOR = '#C8102E';
  var XMAS_DEFAULT = { enabled: true, eyebrow: 'Christmas pre-order', title: 'Help us reach 10,000 pre-orders', cta: 'Pre-order now', image_url: 'https://uangelfoods.com/assets/campaign/xmas-10000-preorders.jpg' };

  function xmasHtml() {
    var x = S.xmas;
    return '<div class="card" style="padding:14px;margin-bottom:18px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">' +
      '<button type="button" class="pr-preview" data-xmas-edit aria-label="Edit the Christmas banner" style="flex:1 1 280px;max-width:420px">' +
        bannerHtml({ eyebrow: x.eyebrow, title: x.title, cta: x.cta, color: XMAS_COLOR }, x.image_url) + '</button>' +
      '<div style="flex:1 1 220px;display:flex;flex-direction:column;gap:8px">' +
        '<b>Christmas pre-order banner</b>' +
        '<span class="cg-help" style="margin:0">Always first in the app, with the live pre-order progress bar. Also controls the Christmas section on the website. Ends by itself after 15 December.</span>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<button type="button" class="pp-switch" role="switch" aria-checked="' + (x.enabled !== false) + '" data-xmas-toggle aria-label="Show the Christmas banner"><i></i>' + (x.enabled !== false ? 'On' : 'Off') + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-xmas-edit>Edit</button>' +
        '</div>' +
      '</div></div>';
  }

  async function saveXmas(value) {
    var res = await A.sb.from('site_settings').upsert({ key: XMAS_KEY, value: value, updated_at: new Date().toISOString() }).select('value').single();
    if (res.error) throw res.error;
    S.xmas = Object.assign({}, XMAS_DEFAULT, res.data.value);
  }

  async function toggleXmas(btn) {
    btn.disabled = true;
    try {
      await saveXmas(Object.assign({}, S.xmas, { enabled: S.xmas.enabled === false }));
      A.toast(S.xmas.enabled === false ? 'Christmas banner hidden in the app and on the website.' : 'Christmas banner is showing again.', 'success');
      renderList();
    } catch (e) { A.toast('Couldn’t update: ' + errMsg(e), 'error'); btn.disabled = false; }
  }

  function openXmasEditor() {
    var d = Object.assign({}, S.xmas, { file: null, objUrl: null });
    var form = document.createElement('form');
    form.className = 'cg-form';
    form.noValidate = true;
    form.innerHTML =
      '<div class="field"><span class="cg-lbl">Preview</span><div data-preview></div></div>' +
      '<div class="field"><span class="cg-lbl">Photo</span>' +
        '<div class="cg-drop"><span>The campaign flyer works well here.</span>' +
          '<div class="cg-drop-btns"><label class="btn btn-ghost btn-sm" for="xm-file" tabindex="0" role="button">Choose photo</label></div>' +
          '<input type="file" id="xm-file" class="cg-file" accept="image/jpeg,image/png,image/webp">' +
          '<span class="cg-err" data-err="photo" role="alert"></span></div></div>' +
      '<div class="field"><label for="xm-title">Headline</label><input id="xm-title" name="title" class="input" maxlength="60" value="' + esc(d.title) + '"></div>' +
      '<div class="pp-two"><div class="field"><label for="xm-eyebrow">Small heading</label><input id="xm-eyebrow" name="eyebrow" class="input" maxlength="30" value="' + esc(d.eyebrow) + '"></div>' +
        '<div class="field"><label for="xm-cta">Button text</label><input id="xm-cta" name="cta" class="input" maxlength="24" value="' + esc(d.cta) + '"></div></div>' +
      '<p class="cg-help" style="margin:0">Tapping it opens the Christmas page in the app.</p>' +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';
    var input = form.querySelector('#xm-file');
    function paint() { form.querySelector('[data-preview]').innerHTML = bannerHtml({ eyebrow: d.eyebrow, title: d.title, cta: d.cta, color: XMAS_COLOR }, d.objUrl || d.image_url); }
    function dispose() { if (d.objUrl) URL.revokeObjectURL(d.objUrl); }
    paint();
    input.addEventListener('change', function () {
      var file = input.files && input.files[0]; input.value = '';
      var err = form.querySelector('[data-err="photo"]'); err.textContent = '';
      if (!file) return;
      if (IMG_TYPES.indexOf(file.type) === -1) { err.textContent = 'Please choose a JPEG, PNG or WebP image.'; return; }
      if (file.size > 5 * 1024 * 1024) { err.textContent = 'That image is larger than 5 MB.'; return; }
      dispose(); d.file = file; d.objUrl = URL.createObjectURL(file); paint();
    });
    form.addEventListener('input', function (e) { var n = e.target.name; if (n === 'title' || n === 'eyebrow' || n === 'cta') { d[n] = e.target.value; paint(); } });
    var busy = false, m;
    async function save() {
      if (busy) return;
      busy = true;
      var btn = m.el.querySelector('.modal-actions .btn-primary');
      A.setLoading(btn, true, 'Saving…');
      try {
        var url = d.image_url;
        if (d.file) {
          try { url = await A.uploadImage(d.file, 'promotions'); }
          catch (e) { A.toast('Photo upload failed: ' + errMsg(e), 'error'); return; }
        }
        await saveXmas({
          enabled: S.xmas.enabled !== false,
          eyebrow: d.eyebrow.trim() || XMAS_DEFAULT.eyebrow, title: d.title.trim() || XMAS_DEFAULT.title,
          cta: d.cta.trim() || XMAS_DEFAULT.cta, image_url: url
        });
        dispose(); m.close();
        A.toast('Saved. The Christmas banner is updated in the app and on the website.', 'success');
        renderList();
      } catch (e) { A.toast('Couldn’t save: ' + errMsg(e), 'error'); }
      finally { busy = false; if (m.isOpen()) A.setLoading(btn, false); }
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });
    m = A.modal({ title: 'Christmas banner', body: form, className: 'cg-drawer', onClose: dispose, actions: [
      { label: 'Cancel', variant: 'ghost', onClick: function (close) { dispose(); close(); } },
      { label: 'Save changes', variant: 'primary', onClick: function () { save(); } }
    ] });
  }

  async function load() {
    var xr = await A.sb.from('site_settings').select('value').eq('key', XMAS_KEY).maybeSingle();
    S.xmas = Object.assign({}, XMAS_DEFAULT, (xr && !xr.error && xr.data && xr.data.value) || {});
    S.xmasLive = Date.now() < Date.UTC(2026, 11, 15, 22, 59); // same end as the app (constants/campaign.ts)
    var r = await Promise.all([
      A.sb.from('promotions').select(COLS).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      A.sb.from('categories').select('id,name,parent_id,kind,sort_order').is('parent_id', null).order('sort_order'),
      A.sb.from('menu').select('id,name').order('name').limit(2000)
    ]);
    if (r[0].error) throw r[0].error;
    S.rows = r[0].data || [];
    S.cats = A.unwrap(r[1]) || [];
    S.products = A.unwrap(r[2]) || [];
  }

  /* ---------------- List ---------------- */

  function renderList() {
    var box = S.el.querySelector('[data-list]');
    var live = S.rows.filter(function (p) { return status(p)[0] === 'live'; }).length;
    var xOn = S.xmasLive && S.xmas.enabled !== false ? 1 : 0;
    S.el.querySelector('[data-sub]').textContent = (live + xOn) + ' live banner' + (live + xOn === 1 ? '' : 's') + (xOn ? ' (including Christmas)' : '') + ' · ' + (S.rows.length + (S.xmasLive ? 1 : 0)) + ' in total';
    var pinned = S.xmasLive ? xmasHtml() : '';
    if (!S.rows.length) {
      box.innerHTML = pinned + '<div class="card pr-empty">' + A.emptyState('No banners yet',
        'Until you add one, the app shows its two built-in banners (drinks and cakes). Add a banner to promote a category, a product or your catering service.', I.image) +
        '<div style="text-align:center;padding-bottom:22px"><button type="button" class="btn btn-primary" data-new>' + I.plus + 'New banner</button></div></div>';
      return;
    }
    box.innerHTML = pinned + (live > MAX_LIVE ? '<p class="cg-warn">' + live + ' banners are live. Customers rarely swipe past ' + MAX_LIVE + ', so consider switching some off.</p>' : '') +
      '<div class="pr-list">' + S.rows.map(function (p, i) {
        var st = status(p);
        return '<article class="card pr-row' + (st[0] === 'live' ? '' : ' dim') + '">' +
          '<button type="button" class="pr-preview" data-edit="' + esc(p.id) + '" aria-label="Edit banner: ' + esc(p.title) + '">' + bannerHtml(p, p.image_url) + '</button>' +
          '<div class="pr-info"><div class="pr-top"><span class="pr-pos">' + (i + 1) + '</span><span class="pr-st ' + st[0] + '">' + esc(st[1]) + '</span></div>' +
            '<b>' + esc(p.title) + '</b><small>' + esc(linkText(p)) + '</small>' +
            '<div class="pr-acts">' +
              '<button type="button" class="pp-switch" role="switch" aria-checked="' + !!p.is_active + '" data-toggle="' + esc(p.id) + '" aria-label="Show this banner"><i></i>' + (p.is_active ? 'On' : 'Off') + '</button>' +
              '<span class="pr-spacer"></span>' +
              '<button type="button" class="cg-icon" data-move="' + esc(p.id) + '" data-dir="-1" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>' + I.chevronDown.replace('<svg', '<svg style="transform:rotate(180deg)"') + '</button>' +
              '<button type="button" class="cg-icon" data-move="' + esc(p.id) + '" data-dir="1" aria-label="Move down"' + (i === S.rows.length - 1 ? ' disabled' : '') + '>' + I.chevronDown + '</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + esc(p.id) + '">Edit</button>' +
            '</div></div></article>';
      }).join('') + '</div>';
  }

  async function toggle(p, btn) {
    btn.disabled = true;
    var res = await A.sb.from('promotions').update({ is_active: !p.is_active }).eq('id', p.id).select(COLS).single();
    btn.disabled = false;
    if (res.error) { A.toast('Couldn’t update: ' + errMsg(res.error), 'error'); return; }
    Object.assign(p, res.data);
    A.toast(p.is_active ? 'Banner switched on' : 'Banner switched off. It no longer shows in the app.', 'success');
    renderList();
  }

  async function move(id, dir) {
    var i = S.rows.findIndex(function (p) { return p.id === id; }), j = i + dir;
    if (i < 0 || j < 0 || j >= S.rows.length) return;
    var order = S.rows.slice();
    order.splice(j, 0, order.splice(i, 1)[0]);
    var before = S.rows;
    S.rows = order;
    order.forEach(function (p, k) { p.sort_order = k + 1; });
    renderList();
    var results = await Promise.all(order.map(function (p) { return A.sb.from('promotions').update({ sort_order: p.sort_order }).eq('id', p.id); }));
    var bad = results.find(function (r) { return r.error; });
    if (bad) { S.rows = before; A.toast('Couldn’t save the order: ' + errMsg(bad.error), 'error'); renderList(); return; }
    var b = S.el.querySelector('[data-move="' + id + '"][data-dir="' + dir + '"]');
    if (b && !b.disabled) b.focus();
  }

  /* ---------------- Editor ---------------- */

  function openEditor(p) {
    var editing = !!p;
    var d = {
      eyebrow: editing ? (p.eyebrow || '') : '', title: editing ? p.title : '', cta: editing ? p.cta : 'Shop now',
      color: editing ? (validHex(p.color) || '#FD652A') : '#FD652A',
      link_type: editing ? p.link_type : 'category', link_id: editing ? (p.link_id || '') : '',
      start: editing ? toInput(p.starts_at) : '', end: editing ? toInput(p.ends_at) : '',
      file: null, objUrl: null
    };
    var current = editing ? p.image_url : null;
    var form = document.createElement('form');
    form.className = 'cg-form';
    form.noValidate = true;

    function targetOptions() {
      if (d.link_type === 'product') return '<option value="">Choose a product</option>' + S.products.map(function (m) { return '<option value="' + esc(m.id) + '"' + (d.link_id === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('');
      var kind = d.link_type === 'service' ? 'service' : 'products';
      return '<option value="">Choose a ' + (kind === 'service' ? 'service' : 'category') + '</option>' + S.cats.filter(function (c) { return (c.kind || 'products') === kind; })
        .map(function (c) { return '<option value="' + esc(c.id) + '"' + (d.link_id === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
    }

    form.innerHTML =
      '<div class="field"><span class="cg-lbl">Preview</span><div data-preview></div></div>' +
      '<div class="field"><span class="cg-lbl">Photo <span class="cg-req" aria-hidden="true">*</span></span>' +
        '<div class="cg-drop" data-drop><span>Drag a photo here or choose one. A close-up of the food works best.</span>' +
          '<div class="cg-drop-btns"><label class="btn btn-ghost btn-sm" for="pr-file" tabindex="0" role="button">Choose photo</label></div>' +
          '<input type="file" id="pr-file" class="cg-file" accept="image/jpeg,image/png,image/webp">' +
          '<span class="cg-err" data-err="photo" role="alert"></span></div></div>' +
      '<div class="field"><label for="pr-title">Headline <span class="cg-req" aria-hidden="true">*</span></label>' +
        '<input id="pr-title" name="title" class="input" maxlength="60" autocomplete="off" autofocus placeholder="e.g. Cakes for every special moment" value="' + esc(d.title) + '">' +
        '<span class="cg-err" data-err="title" role="alert"></span></div>' +
      '<div class="pp-two"><div class="field"><label for="pr-eyebrow">Small heading <span class="cg-opt">(optional)</span></label>' +
          '<input id="pr-eyebrow" name="eyebrow" class="input" maxlength="30" autocomplete="off" placeholder="e.g. This weekend only" value="' + esc(d.eyebrow) + '"></div>' +
        '<div class="field"><label for="pr-cta">Button text</label>' +
          '<input id="pr-cta" name="cta" class="input" maxlength="24" autocomplete="off" value="' + esc(d.cta) + '"></div></div>' +
      '<div class="field"><span class="cg-lbl" id="pr-cl">Colour</span><div class="cg-swatches" role="radiogroup" aria-labelledby="pr-cl" data-swatches></div></div>' +
      '<div class="field"><span class="cg-lbl" id="pr-ll">When tapped, open</span>' +
        '<div class="pr-seg" role="radiogroup" aria-labelledby="pr-ll">' +
          [['category', 'A category'], ['product', 'A product'], ['service', 'Catering / events form'], ['none', 'Nothing']].map(function (o) {
            return '<button type="button" role="radio" data-link="' + o[0] + '">' + o[1] + '</button>';
          }).join('') + '</div>' +
        '<select class="select" name="link_id" aria-label="Where the banner leads" data-target></select>' +
        '<span class="cg-err" data-err="link_id" role="alert"></span></div>' +
      '<div class="pp-two"><div class="field"><label for="pr-start">Show from <span class="cg-opt">(optional)</span></label><input id="pr-start" name="start" type="date" class="input" value="' + esc(d.start) + '"></div>' +
        '<div class="field"><label for="pr-end">Until <span class="cg-opt">(optional)</span></label><input id="pr-end" name="end" type="date" class="input" value="' + esc(d.end) + '">' +
        '<span class="cg-err" data-err="end" role="alert"></span></div></div>' +
      '<p class="cg-help" style="margin:0">Leave the dates empty to show the banner until you switch it off. It goes live and ends automatically on these dates.</p>' +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';

    var $ = function (s) { return form.querySelector(s); };
    var input = $('#pr-file');
    function src() { return d.objUrl || current; }
    function err(n, m) { var e = form.querySelector('[data-err="' + n + '"]'); if (e) e.textContent = m || ''; }
    function paint() {
      $('[data-preview]').innerHTML = bannerHtml({ eyebrow: d.eyebrow, title: d.title, cta: d.cta, color: d.color }, src());
      $('[data-swatches]').innerHTML = SWATCHES.map(function (c) {
        var on = c === d.color;
        return '<button type="button" role="radio" class="cg-sw' + (on ? ' on' : '') + '" aria-checked="' + on + '" aria-label="Colour ' + c + '" data-color="' + c + '" style="background:' + c + '"></button>';
      }).join('');
      Array.prototype.forEach.call(form.querySelectorAll('[data-link]'), function (b) { var on = b.getAttribute('data-link') === d.link_type; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
      var sel = $('[data-target]');
      sel.style.display = d.link_type === 'none' ? 'none' : '';
      if (d.link_type !== 'none') sel.innerHTML = targetOptions();
    }
    function take(file) {
      err('photo', '');
      if (!file) return;
      if (IMG_TYPES.indexOf(file.type) === -1) { err('photo', 'Please choose a JPEG, PNG or WebP image.'); return; }
      if (file.size > 5 * 1024 * 1024) { err('photo', 'That image is larger than 5 MB.'); return; }
      if (d.objUrl) URL.revokeObjectURL(d.objUrl);
      d.file = file; d.objUrl = URL.createObjectURL(file);
      paint();
    }
    function dispose() { if (d.objUrl) URL.revokeObjectURL(d.objUrl); }

    input.addEventListener('change', function () { take(input.files && input.files[0]); input.value = ''; });
    form.querySelector('label[for="pr-file"]').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    var drop = $('[data-drop]');
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { take(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
    drop.addEventListener('click', function (e) { if (!e.target.closest('label, button, input')) input.click(); });
    form.addEventListener('input', function (e) {
      var n = e.target.name;
      if (n === 'title' || n === 'eyebrow' || n === 'cta') { d[n] = e.target.value; err(n, ''); $('[data-preview]').innerHTML = bannerHtml({ eyebrow: d.eyebrow, title: d.title, cta: d.cta, color: d.color }, src()); }
      if (n === 'start' || n === 'end') { d[n] = e.target.value; err('end', ''); }
    });
    $('[data-target]').addEventListener('change', function () { d.link_id = this.value; err('link_id', ''); });
    form.addEventListener('click', function (e) {
      var c = e.target.closest('[data-color]');
      if (c) { d.color = c.getAttribute('data-color'); paint(); return; }
      var l = e.target.closest('[data-link]');
      if (l) { d.link_type = l.getAttribute('data-link'); d.link_id = ''; err('link_id', ''); paint(); }
    });
    paint();

    var busy = false, m;
    async function save() {
      if (busy) return;
      ['photo', 'title', 'link_id', 'end'].forEach(function (n) { err(n, ''); });
      var title = d.title.trim().replace(/\s+/g, ' '), bad = null;
      if (!src()) { err('photo', 'Add a photo.'); bad = bad || 'photo'; }
      if (!title) { err('title', 'Enter a headline.'); bad = bad || 'title'; }
      if (d.link_type !== 'none' && !d.link_id) { err('link_id', 'Choose where the banner leads, or pick “Nothing”.'); bad = bad || 'link_id'; }
      var starts = fromInput(d.start, false), ends = fromInput(d.end, true);
      if (starts && ends && new Date(ends) <= new Date(starts)) { err('end', 'The end date must be after the start date.'); bad = bad || 'end'; }
      if (bad) { var f = form.querySelector('[name="' + bad + '"]'); if (f) f.focus(); return; }

      busy = true;
      var btn = m.el.querySelector('.modal-actions .btn-primary');
      A.setLoading(btn, true, 'Saving…');
      try {
        var url = current;
        if (d.file) {
          try { url = await A.uploadImage(d.file, 'promotions'); }
          catch (e) { A.toast('Photo upload failed: ' + errMsg(e), 'error'); return; }
        }
        var payload = {
          title: title, eyebrow: d.eyebrow.trim() || null, cta: d.cta.trim() || 'Shop now', color: d.color, image_url: url,
          link_type: d.link_type, link_id: d.link_type === 'none' ? null : d.link_id, starts_at: starts, ends_at: ends
        };
        if (!editing) { payload.is_active = true; payload.sort_order = S.rows.reduce(function (mx, x) { return Math.max(mx, x.sort_order || 0); }, 0) + 1; }
        var res = editing
          ? await A.sb.from('promotions').update(payload).eq('id', p.id).select(COLS).single()
          : await A.sb.from('promotions').insert(payload).select(COLS).single();
        if (res.error) { A.toast('Couldn’t save the banner: ' + errMsg(res.error), 'error'); return; }
        if (editing) Object.assign(p, res.data); else S.rows.push(res.data);
        dispose();
        m.close();
        var st = status(res.data);
        A.toast(st[0] === 'live' ? 'Saved. The banner is live in the app.' : 'Saved. ' + st[1] + '.', 'success');
        renderList();
      } finally {
        busy = false;
        if (m.isOpen()) A.setLoading(btn, false);
      }
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });

    var actions = [];
    if (editing) actions.push({ label: 'Delete', variant: 'danger', onClick: function (close) { remove(p, close); } });
    actions.push({ label: 'Cancel', variant: 'ghost', onClick: function (close) { dispose(); close(); } });
    actions.push({ label: editing ? 'Save changes' : 'Add banner', variant: 'primary', onClick: function () { save(); } });
    m = A.modal({ title: editing ? 'Edit banner' : 'New banner', body: form, className: 'cg-drawer', actions: actions, onClose: dispose });
  }

  async function remove(p, close) {
    if (!await A.confirm('Delete the banner “' + p.title + '”? It disappears from the app.\n\nTip: switch it off instead if you might use it again.', { danger: true, confirmLabel: 'Delete banner' })) return;
    var res = await A.sb.from('promotions').delete().eq('id', p.id);
    if (res.error) { A.toast('Couldn’t delete: ' + errMsg(res.error), 'error'); return; }
    S.rows = S.rows.filter(function (x) { return x.id !== p.id; });
    close();
    A.toast('Banner deleted', 'success');
    renderList();
  }

  /* ---------------- Page ---------------- */

  async function render(el) {
    S = { el: el, rows: [], cats: [], products: [] };
    el.innerHTML =
      '<div class="page-head"><div><h1>Promotions</h1><p data-sub>Banners at the top of the app’s Home screen.</p></div>' +
        '<div class="actions"><button type="button" class="btn btn-primary" data-new>' + I.plus + 'New banner</button></div></div>' +
      '<p class="pp-note">These banners slide at the top of the app’s Home screen, in this order. They don’t appear on the website. Tap a banner to change its photo or text. Switch one off to hide it, or give it dates so it starts and ends by itself.</p>' +
      '<div data-list>' + A.skeletonBlocks(3, 'pr-sk') + '</div>';

    el.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled || !S.loaded) return;
      var v;
      if (b.hasAttribute('data-new')) return openEditor(null);
      if (b.hasAttribute('data-xmas-edit')) return openXmasEditor();
      if (b.hasAttribute('data-xmas-toggle')) return toggleXmas(b);
      if ((v = b.getAttribute('data-edit'))) { var p = S.rows.find(function (x) { return x.id === v; }); if (p) openEditor(p); return; }
      if ((v = b.getAttribute('data-toggle'))) { var t = S.rows.find(function (x) { return x.id === v; }); if (t) toggle(t, b); return; }
      if ((v = b.getAttribute('data-move'))) move(v, Number(b.getAttribute('data-dir')));
    });

    try {
      await load();
    } catch (e) {
      var box = el.querySelector('[data-list]');
      box.innerHTML = '';
      box.appendChild(A.errorState(/promotions/.test(errMsg(e))
        ? 'Promotions need the updated supabase/schema.sql. Run it in the Supabase SQL Editor, then refresh.'
        : errMsg(e), function () { A.rerender(); }));
      return;
    }
    if (!el.isConnected) return;
    S.loaded = true;
    renderList();
  }

  A.registerSection({ id: 'promotions', label: 'Promotions', icon: ICON, order: 5.5, render: render });
})();

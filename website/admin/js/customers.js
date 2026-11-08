/* U Angel Foods admin — Customers.
 * Summary tiles, customer groups, a sortable table with WhatsApp / call buttons, a profile
 * side panel (contact, stats, what they usually buy, recent orders, admin access) and a CSV
 * download. Styles: css/manage.css (cu-) + shared drawer styles in css/categories.css. */
(function () {
  'use strict';
  var A = window.Admin;
  if (!A || !A.registerSection) return;
  var esc = A.escapeHtml;
  var I = A.icons;
  var PAGE = 50;
  var DAY = 86400000;
  var AV = ['#9D174D', '#0F5B78', '#166534', '#7A4419', '#6B21A8', '#9A3412', '#181C2E'];
  var GROUPS = [
    ['all', 'All'], ['vip', 'Top customers'], ['regular', 'Regulars'], ['new', 'New'],
    ['quiet', 'Inactive 30+ days'], ['none', 'No orders yet'], ['admin', 'Admins']
  ];

  var S;

  function nameOf(c) { return c.name || c.email || 'Customer'; }
  function initials(c) { return nameOf(c).trim().split(/\s+/).map(function (x) { return x.charAt(0); }).join('').slice(0, 2).toUpperCase() || '?'; }
  function avColor(c) { var h = 0, s = String(c.id || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return AV[Math.abs(h) % AV.length]; }
  function area(c) { return [c.city, c.state].filter(Boolean).join(', '); }
  function daysSince(iso) { return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null; }
  function lastText(c) {
    var d = daysSince(c.last_order_at);
    if (d == null) return Number(c.orders_count) ? '—' : 'Never';
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 60 ? d + ' days ago' : A.formatDate(c.last_order_at);
  }

  /* Group: none → inactive → top → new → regular. "Top" = top 10% by spend (at least 1). */
  function group(c) {
    if (!Number(c.orders_count)) return ['none', 'No orders yet'];
    var d = daysSince(c.last_order_at);
    if (d != null && d > 30) return ['quiet', 'Inactive 30+ days'];
    if (Number(c.total_spent) >= S.vipMin) return ['vip', 'Top customer'];
    if (daysSince(c.created_at) != null && daysSince(c.created_at) <= 30) return ['new', 'New'];
    return ['regular', 'Regular'];
  }

  function filtered() {
    var q = S.q.toLowerCase();
    var rows = S.rows.filter(function (c) {
      if (S.group === 'admin' ? !c.is_admin : (S.group !== 'all' && group(c)[0] !== S.group)) return false;
      if (!q) return true;
      return [c.name, c.email, c.phone, c.city, c.state].some(function (v) { return v && String(v).toLowerCase().indexOf(q) >= 0; });
    });
    var by = {
      spent: function (a, b) { return (Number(b.total_spent) || 0) - (Number(a.total_spent) || 0); },
      orders: function (a, b) { return (Number(b.orders_count) || 0) - (Number(a.orders_count) || 0); },
      last: function (a, b) { return String(b.last_order_at || '').localeCompare(String(a.last_order_at || '')); },
      newest: function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); },
      name: function (a, b) { return nameOf(a).localeCompare(nameOf(b)); }
    }[S.sort];
    return rows.sort(by);
  }

  /* ---------------- Rendering ---------------- */

  function tilesHtml() {
    var rows = S.rows, buyers = rows.filter(function (c) { return Number(c.orders_count) > 0; });
    var repeat = buyers.filter(function (c) { return Number(c.orders_count) > 1; }).length;
    var spent = buyers.reduce(function (s, c) { return s + (Number(c.total_spent) || 0); }, 0);
    var joined30 = rows.filter(function (c) { var d = daysSince(c.created_at); return d != null && d <= 30; }).length;
    function tile(label, value, sub) { return '<div class="card cu-tile"><span>' + esc(label) + '</span><b>' + esc(value) + '</b><small>' + esc(sub) + '</small></div>'; }
    return tile('Customers', A.formatNumber(rows.length), '+' + joined30 + ' joined in the last 30 days') +
      tile('Have ordered', A.formatNumber(buyers.length), rows.length ? Math.round(buyers.length / rows.length * 100) + '% of sign-ups' : '—') +
      tile('Come back again', buyers.length ? Math.round(repeat / buyers.length * 100) + '%' : '—', repeat + ' ordered more than once') +
      tile('Average spend', buyers.length ? A.formatNaira(spent / buyers.length) : '—', 'per customer who ordered');
  }

  function chipsHtml() {
    var counts = { all: S.rows.length, admin: S.rows.filter(function (c) { return c.is_admin; }).length };
    S.rows.forEach(function (c) { var g = group(c)[0]; counts[g] = (counts[g] || 0) + 1; });
    return GROUPS.map(function (g) {
      var on = S.group === g[0];
      return '<button type="button" class="cu-chip' + (on ? ' on' : '') + '" data-group="' + g[0] + '" aria-pressed="' + on + '">' + esc(g[1]) + ' <b>' + (counts[g[0]] || 0) + '</b></button>';
    }).join('');
  }

  function sortTh(key, label) {
    var on = S.sort === key;
    return '<th class="num"' + (on ? ' aria-sort="descending"' : '') + '><button type="button" class="cu-sort' + (on ? ' on' : '') + '" data-sort="' + key + '">' + esc(label) + (on ? ' ↓' : '') + '</button></th>';
  }

  function rowHtml(c) {
    var g = group(c);
    var wa = c.phone ? '<a class="cu-cbtn wa" href="' + esc(A.waLink(c.phone)) + '" target="_blank" rel="noopener" aria-label="WhatsApp ' + esc(nameOf(c)) + '" data-stop>' + I.whatsapp + '</a>' : '';
    var call = c.phone ? '<a class="cu-cbtn" href="' + esc(A.telLink(c.phone)) + '" aria-label="Call ' + esc(nameOf(c)) + '" data-stop>' + I.phone + '</a>' : '';
    return '<tr class="clickable" tabindex="0" data-id="' + esc(c.id) + '">' +
      '<td><div class="cu-who"><span class="cu-av" style="background:' + avColor(c) + '" aria-hidden="true">' + esc(initials(c)) + '</span>' +
        '<span><b>' + esc(nameOf(c)) + (c.is_admin ? ' <span class="cu-g admin">Admin</span>' : '') + '</b><small>' + esc(c.phone || c.email || '') + '</small></span></div></td>' +
      '<td>' + esc(area(c) || '—') + '</td>' +
      '<td><span class="cu-g ' + g[0] + '">' + esc(g[1]) + '</span></td>' +
      '<td class="num">' + A.formatNumber(Number(c.orders_count) || 0) + '</td>' +
      '<td class="num"><b>' + esc(A.formatNaira(c.total_spent)) + '</b></td>' +
      '<td class="num nowrap">' + esc(lastText(c)) + '</td>' +
      '<td><div class="cu-contact">' + (wa + call || '<span class="muted small">—</span>') + '</div></td></tr>';
  }

  function renderTable() {
    var list = filtered(), shown = list.slice(0, S.limit);
    var box = S.el.querySelector('[data-table]');
    if (!list.length) {
      box.innerHTML = S.rows.length ? A.emptyState('No matching customers', 'Try a different search or group.', I.search)
        : A.emptyState('No customers yet', 'People who sign up in the app will appear here.', I.users);
      return;
    }
    box.innerHTML = '<div class="table-wrap"><table class="table cu-table"><thead><tr>' +
      '<th>Customer</th><th>Area</th><th>Group</th>' + sortTh('orders', 'Orders') + sortTh('spent', 'Total spent') + sortTh('last', 'Last order') +
      '<th><span class="sr-only">Contact</span></th></tr></thead><tbody>' + shown.map(rowHtml).join('') + '</tbody></table></div>' +
      '<div class="table-foot"><span>Showing ' + A.formatNumber(shown.length) + ' of ' + A.formatNumber(list.length) + '</span>' +
      (shown.length < list.length ? '<button type="button" class="btn btn-ghost btn-sm" data-more>Show more</button>' : '') + '</div>';
  }

  function renderAll() {
    S.el.querySelector('[data-tiles]').innerHTML = tilesHtml();
    S.el.querySelector('[data-chips]').innerHTML = chipsHtml();
    renderTable();
  }

  /* ---------------- Profile panel ---------------- */

  async function openProfile(c) {
    var g = group(c);
    var body = document.createElement('div');
    body.className = 'cg-form';
    var orders = Number(c.orders_count) || 0;
    body.innerHTML =
      '<div class="cu-prof"><span class="cu-av big" style="background:' + avColor(c) + '" aria-hidden="true">' + esc(initials(c)) + '</span>' +
        '<div><b>' + esc(nameOf(c)) + '</b><small>' + esc(area(c) || 'No address yet') + ' · <span class="cu-g ' + g[0] + '">' + esc(g[1]) + '</span></small></div></div>' +
      '<div class="cu-actions">' +
        (c.phone ? '<a class="btn btn-ghost btn-sm" href="' + esc(A.waLink(c.phone)) + '" target="_blank" rel="noopener">' + I.whatsapp + 'WhatsApp</a>' +
          '<a class="btn btn-ghost btn-sm" href="' + esc(A.telLink(c.phone)) + '">' + I.phone + 'Call</a>' : '') +
        (c.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(c.email) + '">' + I.mail + 'Email</a>' : '') +
      '</div>' +
      '<p class="cu-note">' + esc([c.phone, c.email].filter(Boolean).join(' · ') || 'No contact details') + ' · Joined ' + esc(A.formatDate(c.created_at)) + '</p>' +
      '<div class="cu-stats"><div><span>Orders</span><b>' + A.formatNumber(orders) + '</b></div>' +
        '<div><span>Total spent</span><b>' + esc(A.formatNaira(c.total_spent)) + '</b></div>' +
        '<div><span>Average order</span><b>' + (orders ? esc(A.formatNaira((Number(c.total_spent) || 0) / orders)) : '—') + '</b></div></div>' +
      '<div data-history>' + (orders ? A.skeletonBlocks(3, 'line') : '<p class="cu-note">Signed up but hasn’t ordered yet. A friendly WhatsApp message about a popular product often helps.</p>') + '</div>' +
      '<div class="cu-adminrow"><div><b>Admin access</b><small>Lets this person sign in to this dashboard.</small></div>' +
        '<button type="button" class="pp-switch" role="switch" aria-checked="' + !!c.is_admin + '" data-admin aria-label="Admin access"' + (c.email ? '' : ' disabled') + '><i></i></button></div>';

    var m = A.modal({
      title: nameOf(c), body: body, className: 'cg-drawer',
      actions: [{ label: 'Close', variant: 'ghost', onClick: function (close) { close(); } }]
    });

    body.querySelector('[data-admin]').addEventListener('click', async function () {
      var btn = this, make = !c.is_admin, self = A.user && A.user.id === c.id;
      var ok = await A.confirm(make
        ? 'Give ' + nameOf(c) + ' full admin access?\n\nThey will be able to see all orders and customers, and change the menu.'
        : (self ? 'Remove your own admin access?\n\nYou will be signed out and won’t be able to use this dashboard unless another admin adds you back.'
                : 'Remove admin access from ' + nameOf(c) + '?\n\nTheir customer account stays.'),
        { danger: !make, confirmLabel: make ? 'Make admin' : 'Remove admin', title: make ? 'Add admin' : 'Remove admin' });
      if (!ok) return;
      btn.disabled = true;
      var res = await A.sb.rpc('admin_set_admin', { p_email: c.email, p_make_admin: make });
      btn.disabled = false;
      if (res.error) { A.toast(A.errMessage(res.error), 'error'); return; }
      if (self && !make) { A.signOut(); return; }
      c.is_admin = make;
      btn.setAttribute('aria-checked', String(make));
      A.toast(make ? nameOf(c) + ' is now an admin' : nameOf(c) + ' is no longer an admin', 'success');
      renderAll();
    });

    if (!orders) return;
    var hist = body.querySelector('[data-history]');
    try {
      var res = await A.sb.from('orders').select('id, status, payment_status, total, created_at, order_items(name, quantity)')
        .eq('user_id', c.id).order('created_at', { ascending: false }).limit(20);
      var list = A.unwrap(res) || [];
      if (!m.isOpen()) return;
      var counts = {};
      list.forEach(function (o) { if (o.payment_status === 'paid') (o.order_items || []).forEach(function (it) { var k = String(it.name || '').split(' – ')[0]; counts[k] = (counts[k] || 0) + (Number(it.quantity) || 1); }); });
      var favs = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 4);
      hist.innerHTML =
        (favs.length ? '<div class="field"><span class="cg-lbl">Usually buys</span><div class="cu-favs">' + favs.map(function (f) { return '<span>' + esc(f) + ' <b>×' + counts[f] + '</b></span>'; }).join('') + '</div></div>' : '') +
        '<div class="field"><span class="cg-lbl">Recent orders</span><div class="cu-olist">' + list.slice(0, 5).map(function (o) {
          var n = (o.order_items || []).reduce(function (s, it) { return s + (Number(it.quantity) || 0); }, 0);
          return '<button type="button" data-order="' + esc(o.id) + '"><span>#' + esc(A.shortId(o.id)) + '<small>' + esc(A.timeAgo(o.created_at)) + ' · ' + n + ' item' + (n === 1 ? '' : 's') + '</small></span>' +
            '<b>' + esc(A.formatNaira(o.total)) + '</b>' + A.badge(o.status) + '</button>';
        }).join('') + '</div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-all-orders style="align-self:flex-start">See all their orders →</button></div>';
      hist.addEventListener('click', function (e) {
        var o = e.target.closest('[data-order]');
        if (o && typeof A.openOrder === 'function') { A.openOrder(o.getAttribute('data-order')); return; }
        if (e.target.closest('[data-all-orders]')) { m.close(); A.navigate('orders', { view: 'list', customer: c.id }); }
      });
    } catch (e) {
      hist.innerHTML = '';
      hist.appendChild(A.errorState(A.errMessage(e), function () { m.close(); openProfile(c); }));
    }
  }

  /* ---------------- CSV ---------------- */

  function downloadCsv() {
    var list = filtered();
    var cell = function (v) { var s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var lines = [['Name', 'Email', 'Phone', 'City', 'State', 'Group', 'Orders', 'Total spent (NGN)', 'Last order', 'Joined'].join(',')];
    list.forEach(function (c) {
      lines.push([c.name, c.email, c.phone, c.city, c.state, group(c)[1], Number(c.orders_count) || 0, Number(c.total_spent) || 0,
        c.last_order_at ? A.lagosDateKey(c.last_order_at) : '', A.lagosDateKey(c.created_at)].map(cell).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'u-angel-customers-' + A.lagosDateKey(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    A.toast('Downloaded ' + list.length + ' customer' + (list.length === 1 ? '' : 's'), 'success');
  }

  /* ---------------- Page ---------------- */

  async function render(el, params) {
    params = params || A.getParams();
    var g = params.get('group');
    S = { el: el, rows: [], q: params.get('q') || '', group: GROUPS.some(function (x) { return x[0] === g; }) ? g : 'all', sort: 'spent', limit: PAGE, vipMin: Infinity };

    el.innerHTML =
      '<div class="page-head"><div><h1>Customers</h1><p>Everyone who has signed up in the U Angel Foods app.</p></div>' +
        '<div class="actions"><button type="button" class="btn btn-ghost btn-sm" data-csv>' + I.upload + 'Download list (CSV)</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-reload>' + I.refresh + 'Refresh</button></div></div>' +
      '<div class="cu-tiles" data-tiles>' + A.skeletonBlocks(4, 'cu-sk') + '</div>' +
      '<div class="toolbar"><label class="search"><span class="sr-only">Search customers</span>' + I.search +
        '<input class="input" type="search" data-search placeholder="Name, phone, email or area" value="' + esc(S.q) + '" autocomplete="off"></label></div>' +
      '<div class="cu-chips" role="group" aria-label="Customer groups" data-chips></div>' +
      '<div class="card flush" data-table><div class="table-wrap"><table class="table"><tbody>' + A.skeletonRows(6, 6) + '</tbody></table></div></div>';

    var search = el.querySelector('[data-search]');
    search.addEventListener('input', A.debounce(function () {
      S.q = search.value.trim(); S.limit = PAGE;
      A.replaceParams({ q: S.q, group: S.group !== 'all' ? S.group : '' });
      if (S.loaded) renderTable();
    }, 200));
    el.querySelector('[data-reload]').addEventListener('click', function () { A.rerender(); });
    el.querySelector('[data-csv]').addEventListener('click', function () { if (S.loaded) downloadCsv(); });
    el.querySelector('[data-chips]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-group]');
      if (!b) return;
      S.group = b.getAttribute('data-group'); S.limit = PAGE;
      A.replaceParams({ q: S.q, group: S.group !== 'all' ? S.group : '' });
      el.querySelector('[data-chips]').innerHTML = chipsHtml();
      renderTable();
    });
    var table = el.querySelector('[data-table]');
    table.addEventListener('click', function (e) {
      if (e.target.closest('[data-stop]')) return;
      var s = e.target.closest('[data-sort]');
      if (s) { S.sort = s.getAttribute('data-sort'); renderTable(); return; }
      if (e.target.closest('[data-more]')) { S.limit += PAGE; renderTable(); return; }
      var tr = e.target.closest('tr[data-id]');
      if (tr) { var c = S.rows.find(function (x) { return x.id === tr.getAttribute('data-id'); }); if (c) openProfile(c); }
    });
    table.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-id]')) {
        e.preventDefault();
        var c = S.rows.find(function (x) { return x.id === e.target.getAttribute('data-id'); });
        if (c) openProfile(c);
      }
    });

    try {
      S.rows = A.unwrap(await A.sb.rpc('admin_customers')) || [];
    } catch (e) {
      table.innerHTML = '';
      table.appendChild(A.errorState(A.errMessage(e), function () { A.rerender(); }));
      return;
    }
    if (!el.isConnected) return;
    var spends = S.rows.map(function (c) { return Number(c.total_spent) || 0; }).filter(function (v) { return v > 0; }).sort(function (a, b) { return b - a; });
    S.vipMin = spends.length ? spends[Math.max(0, Math.ceil(spends.length * 0.1) - 1)] : Infinity;
    S.loaded = true;
    renderAll();
  }

  A.registerSection({ id: 'customers', label: 'Customers', icon: I.users, order: 6, render: render });
})();

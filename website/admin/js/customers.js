/* U Angel Foods admin — Customers & admins section. */
(function () {
  'use strict';
  var A = window.Admin;
  if (!A || !A.registerSection) return;
  var esc = A.escapeHtml;
  var I = A.icons;
  var PAGE = 50;

  var S;

  function locText(c) { return [c.city, c.state].filter(Boolean).join(', '); }

  function filtered() {
    var q = S.q.toLowerCase();
    var rows = S.rows.filter(function (c) {
      if (S.onlyAdmins && !c.is_admin) return false;
      if (!q) return true;
      return [c.name, c.email, c.phone, c.city, c.state].some(function (v) { return v && String(v).toLowerCase().indexOf(q) >= 0; });
    });
    var by = {
      newest: function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); },
      spent: function (a, b) { return (Number(b.total_spent) || 0) - (Number(a.total_spent) || 0); },
      orders: function (a, b) { return (Number(b.orders_count) || 0) - (Number(a.orders_count) || 0); },
      name: function (a, b) { return String(a.name || a.email || '').localeCompare(String(b.name || b.email || '')); }
    }[S.sort] || function () { return 0; };
    return rows.sort(by);
  }

  function rowHtml(c) {
    var n = Number(c.orders_count) || 0;
    return '<tr>' +
      '<td class="tc-first"><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="avatar" aria-hidden="true" style="width:34px;height:34px;font-size:13px">' +
        esc(((c.name || c.email || '?').trim().charAt(0) || '?').toUpperCase()) + '</span>' +
        '<div style="min-width:0"><div class="cell-main nowrap">' + esc(c.name || '—') + (c.is_admin ? ' <span class="badge badge-admin no-dot">Admin</span>' : '') + '</div></div></div></td>' +
      '<td class="tc-line">' + (c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '<span class="muted">—</span>') + '</td>' +
      '<td class="nowrap tc-inline">' + (c.phone ? '<a href="' + esc(A.telLink(c.phone)) + '">' + esc(c.phone) + '</a>' : '<span class="muted">—</span>') + '</td>' +
      (locText(c) ? '<td class="tc-inline">' : '<td class="tc-hide-card">') + esc(locText(c) || '—') + '</td>' +
      '<td class="nowrap tc-stat" data-label="Joined">' + esc(A.formatDate(c.created_at)) + '</td>' +
      '<td class="num tc-stat" data-label="Orders">' + esc(A.formatNumber(n)) + '</td>' +
      '<td class="num strong tc-stat" data-label="Spent">' + esc(A.formatNaira(c.total_spent)) + '</td>' +
      '<td class="text-right tc-actions"><button type="button" class="btn btn-ghost btn-sm" data-orders="' + esc(c.id) + '"' + (n ? '' : ' disabled') +
        ' aria-label="View orders from ' + esc(c.name || c.email || 'this customer') + '">' + I.bag + 'View orders</button></td>' +
    '</tr>';
  }

  function renderTable() {
    var list = filtered();
    var shown = list.slice(0, S.limit);
    var wrap = S.el.querySelector('.table-wrap');
    var emptyBox = S.el.querySelector('[data-empty]');
    var foot = S.el.querySelector('[data-foot]');
    var tbody = S.el.querySelector('tbody');
    if (!list.length) {
      wrap.hidden = true;
      foot.hidden = true;
      emptyBox.hidden = false;
      emptyBox.innerHTML = S.rows.length
        ? A.emptyState('No matching customers', 'Try a different search.', I.search)
        : A.emptyState('No customers yet', 'People who sign up in the app will appear here.', I.users);
      return;
    }
    wrap.hidden = false;
    emptyBox.hidden = true;
    foot.hidden = false;
    tbody.innerHTML = shown.map(rowHtml).join('');
    S.el.querySelector('[data-count]').textContent = 'Showing ' + A.formatNumber(shown.length) + ' of ' + A.formatNumber(list.length) +
      ' customer' + (list.length === 1 ? '' : 's') + (list.length !== S.rows.length ? ' (filtered from ' + A.formatNumber(S.rows.length) + ')' : '');
    S.el.querySelector('[data-more]').hidden = shown.length >= list.length;
  }

  function renderAdmins() {
    var box = S.el.querySelector('[data-admins]');
    var admins = S.rows.filter(function (c) { return c.is_admin; })
      .sort(function (a, b) { return String(a.name || a.email || '').localeCompare(String(b.name || b.email || '')); });
    if (!admins.length) { box.innerHTML = A.emptyState('No admins found', '', I.shield); return; }
    var me = A.user && A.user.id;
    box.innerHTML = admins.map(function (c) {
      var self = c.id === me;
      return '<div class="list-item" style="cursor:default">' +
        '<span class="avatar" aria-hidden="true" style="width:36px;height:36px;font-size:14px;background:var(--navy)">' + esc(((c.name || c.email || '?').trim().charAt(0) || '?').toUpperCase()) + '</span>' +
        '<span class="li-body"><span class="li-title" style="display:block">' + esc(c.name || c.email) + (self ? ' <span class="badge badge-orange no-dot">You</span>' : '') + '</span>' +
        '<span class="li-sub" style="display:block">' + esc(c.email || '') + '</span></span>' +
        (c.email ? '<button type="button" class="btn btn-ghost btn-sm" data-remove="' + esc(c.email) + '" data-self="' + (self ? '1' : '') + '" style="color:var(--red)" aria-label="Remove admin access from ' + esc(c.email) + '">Remove</button>' : '') +
      '</div>';
    }).join('');
  }

  async function loadData() {
    var res = await A.sb.rpc('admin_customers');
    S.rows = A.unwrap(res) || [];
  }

  async function reload() {
    try {
      await loadData();
      if (!S.el.isConnected) return;
      renderTable();
      renderAdmins();
    } catch (e) {
      A.toast(A.errMessage(e), 'error');
    }
  }

  async function setAdmin(email, make) {
    var res = await A.sb.rpc('admin_set_admin', { p_email: email, p_make_admin: make });
    if (res.error) throw new Error(A.errMessage(res.error));
  }

  function bindAdmins(el) {
    var form = el.querySelector('[data-admin-form]');
    var input = form.querySelector('input');
    var err = form.querySelector('[data-admin-error]');
    var btn = form.querySelector('button[type=submit]');
    input.addEventListener('input', function () { err.hidden = true; input.removeAttribute('aria-invalid'); });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      err.hidden = true;
      var email = input.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        err.textContent = 'Enter a valid email address.';
        err.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      var existing = S.rows.find(function (c) { return (c.email || '').toLowerCase() === email.toLowerCase(); });
      if (existing && existing.is_admin) {
        err.textContent = email + ' is already an admin.';
        err.hidden = false;
        return;
      }
      if (!existing) {
        err.textContent = 'No account with that email. They must sign up in the app first.';
        err.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        return;
      }
      var ok = await A.confirm('Give ' + (existing.name ? existing.name + ' (' + email + ')' : email) +
        ' full admin access?\n\nThey will be able to see all orders and customers, and change the menu.', { confirmLabel: 'Make admin', title: 'Add admin' });
      if (!ok) return;
      A.setLoading(btn, true, 'Adding…');
      try {
        await setAdmin(email, true);
        A.toast(email + ' is now an admin');
        input.value = '';
        await reload();
      } catch (e2) {
        err.textContent = A.errMessage(e2);
        err.hidden = false;
      } finally {
        A.setLoading(btn, false);
      }
    });

    el.querySelector('[data-admins]').addEventListener('click', async function (e) {
      var b = e.target.closest('[data-remove]');
      if (!b) return;
      var email = b.getAttribute('data-remove');
      var self = b.getAttribute('data-self') === '1';
      var ok = await A.confirm(self
        ? 'Remove your own admin access?\n\nYou will be signed out and won’t be able to use this dashboard again unless another admin adds you back.'
        : 'Remove admin access from ' + email + '?\n\nTheir customer account stays; they just can’t use this dashboard.',
        { danger: true, confirmLabel: 'Remove admin', title: 'Remove admin' });
      if (!ok) return;
      A.setLoading(b, true, 'Removing…');
      try {
        await setAdmin(email, false);
        A.toast('Admin access removed from ' + email);
        if (self) { A.signOut(); return; }
        await reload();
      } catch (e2) {
        A.setLoading(b, false);
        A.toast(A.errMessage(e2), 'error');
      }
    });
  }

  async function render(el, params) {
    params = params || A.getParams();
    S = { el: el, rows: [], q: params.get('q') || '', sort: 'newest', limit: PAGE, onlyAdmins: false };

    el.innerHTML =
      '<div class="page-head"><div><h1>Customers</h1><p>Everyone who has signed up in the U Angel Foods app.</p></div>' +
      '<div class="actions"><button type="button" class="btn btn-ghost btn-sm" data-reload>' + I.refresh + 'Refresh</button></div></div>' +
      '<div class="toolbar">' +
        '<label class="search"><span class="sr-only">Search customers</span>' + I.search +
          '<input class="input" type="search" data-search placeholder="Name, email, phone or city" value="' + esc(S.q) + '" autocomplete="off"></label>' +
        '<select class="select" data-sort aria-label="Sort customers">' +
          '<option value="newest">Newest first</option><option value="spent">Top spenders</option>' +
          '<option value="orders">Most orders</option><option value="name">Name A–Z</option></select>' +
        '<label class="check"><input type="checkbox" data-only-admins> Admins only</label>' +
      '</div>' +
      '<div class="card flush">' +
        '<div class="table-wrap"><table class="table table-cards"><thead><tr>' +
          '<th>Name</th><th>Email</th><th>Phone</th><th>Location</th><th>Joined</th><th class="num">Orders</th><th class="num">Total spent</th><th class="text-right"><span class="sr-only">Actions</span></th>' +
        '</tr></thead><tbody>' + A.skeletonRows(6, 8) + '</tbody></table></div>' +
        '<div data-empty hidden></div>' +
        '<div class="table-foot" data-foot hidden><span data-count></span>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-more hidden>Show more</button></div>' +
      '</div>' +
      '<section class="card section-gap" aria-labelledby="admins-h">' +
        '<div class="card-head"><div><h2 id="admins-h">Admins</h2><p class="small muted" style="margin-top:2px">People who can sign in to this dashboard.</p></div></div>' +
        '<div class="grid grid-2">' +
          '<div class="list" data-admins>' + A.skeletonBlocks(3, 'line') + '</div>' +
          '<form data-admin-form novalidate class="stack" style="gap:10px;align-content:start">' +
            '<div class="field"><label for="admin-email">Add an admin by email</label>' +
              '<div class="row" style="flex-wrap:nowrap"><input id="admin-email" class="input" type="email" autocomplete="off" placeholder="name@example.com" aria-describedby="admin-email-hint">' +
              '<button type="submit" class="btn btn-primary">' + I.plus + 'Add</button></div>' +
              '<span class="hint" id="admin-email-hint">They must already have an account in the U Angel Foods app.</span>' +
              '<span class="error-text" data-admin-error role="alert" hidden></span></div>' +
          '</form>' +
        '</div>' +
      '</section>';

    var search = el.querySelector('[data-search]');
    var sort = el.querySelector('[data-sort]');
    search.addEventListener('input', A.debounce(function () {
      S.q = search.value.trim();
      S.limit = PAGE;
      A.replaceParams({ q: S.q });
      if (S.loaded) renderTable();
    }, 200));
    sort.addEventListener('change', function () { S.sort = sort.value; if (S.loaded) renderTable(); });
    el.querySelector('[data-only-admins]').addEventListener('change', function (e) { S.onlyAdmins = e.target.checked; S.limit = PAGE; if (S.loaded) renderTable(); });
    el.querySelector('[data-more]').addEventListener('click', function () { S.limit += PAGE; renderTable(); });
    el.querySelector('[data-reload]').addEventListener('click', function () { A.rerender(); });
    el.querySelector('tbody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-orders]');
      if (b) A.navigate('orders', { customer: b.getAttribute('data-orders') });
    });
    bindAdmins(el);

    try {
      await loadData();
    } catch (e) {
      var card = el.querySelector('.card.flush');
      card.innerHTML = '';
      card.appendChild(A.errorState(A.errMessage(e), function () { A.rerender(); }));
      el.querySelector('[data-admins]').innerHTML = '<p class="muted small">Couldn’t load admins.</p>';
      return;
    }
    if (!el.isConnected) return;
    S.loaded = true;
    renderTable();
    renderAdmins();
  }

  A.registerSection({ id: 'customers', label: 'Customers', icon: I.users, order: 6, render: render });
})();

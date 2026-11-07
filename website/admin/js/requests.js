/* U Angel Foods admin — Catering & event requests section. */
(function () {
  'use strict';
  var A = window.Admin;
  if (!A || !A.registerSection) return;
  var esc = A.escapeHtml;
  var I = A.icons;
  var PAGE = 24;
  var FLOW = ['new', 'contacted', 'quoted', 'confirmed', 'completed'];
  var DEFAULT_SERVICES = ['Catering', 'Events & Celebrations'];

  var S;

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    var today = new Date(A.lagosDateKey(new Date()) + 'T12:00:00+01:00');
    var d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00+01:00');
    if (isNaN(d.getTime())) return null;
    return Math.round((d.getTime() - today.getTime()) / 86400000);
  }
  function isActive(r) { return r.status !== 'cancelled' && r.status !== 'completed'; }
  function upcomingHtml(r) {
    var n = daysUntil(r.event_date);
    if (n === null || n < 0 || n > 7 || !isActive(r)) return '';
    return '<span class="upcoming-pill">' + (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days') + '</span>';
  }
  function locText(r) { return [r.city, r.state].filter(Boolean).join(', '); }

  function cardHtml(r) {
    var up = upcomingHtml(r);
    return '<button type="button" class="req-card" data-id="' + esc(r.id) + '">' +
      '<div class="top"><div style="min-width:0"><div class="svc">' + esc(r.service) + '</div><h3>' + esc(r.event_type) + '</h3></div>' + A.badge(r.status) + '</div>' +
      '<div><div class="strong">' + esc(r.full_name) + '</div><div class="small muted">' + esc(r.phone) + (r.email ? ' \u00B7 ' + esc(r.email) : '') + '</div></div>' +
      '<div class="facts">' +
        '<div><span>Event date</span><strong class="' + (up ? 'upcoming' : '') + '">' + esc(A.formatDate(r.event_date)) + '</strong>' + up + '</div>' +
        '<div><span>Guests</span><strong>' + esc(A.formatNumber(r.guest_count)) + '</strong></div>' +
        '<div><span>Budget</span><strong>' + esc(A.formatNaira(r.budget)) + '</strong></div>' +
        '<div><span>Location</span><strong title="' + esc(locText(r)) + '">' + esc(locText(r) || '\u2014') + '</strong></div>' +
      '</div>' +
      '<div class="foot"><span>Received ' + esc(A.timeAgo(r.created_at)) + '</span><span>View details \u203A</span></div>' +
    '</button>';
  }

  function cleanTerm(t) { return String(t || '').replace(/[,()"\\]/g, ' ').replace(/\s+/g, ' ').trim(); }

  async function load(reset) {
    var seq = ++S.seq;
    var grid = S.el.querySelector('[data-grid]');
    var more = S.el.querySelector('[data-more]');
    var foot = S.el.querySelector('[data-foot]');
    var emptyBox = S.el.querySelector('[data-empty]');
    if (reset) {
      S.rows = [];
      grid.hidden = false;
      emptyBox.hidden = true;
      foot.hidden = true;
      grid.innerHTML = A.skeletonBlocks(6, 'block" style="height:220px');
    } else {
      A.setLoading(more, true, 'Loading\u2026');
    }
    try {
      var from = S.rows.length;
      var q = A.sb.from('service_requests').select('*', { count: 'exact' });
      if (S.sort === 'event') {
        q = q.gte('event_date', A.lagosDateKey(new Date())).order('event_date', { ascending: true }).order('created_at', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }
      q = q.range(from, from + PAGE - 1);
      if (S.status !== 'all') q = q.eq('status', S.status);
      if (S.service) q = q.eq('service', S.service);
      var t = cleanTerm(S.q);
      if (t) {
        var like = '"*' + t + '*"';
        q = q.or(['full_name', 'phone', 'event_type', 'email'].map(function (c) { return c + '.ilike.' + like; }).join(','));
      }
      var res = await q;
      if (seq !== S.seq) return;
      var rows = A.unwrap(res) || [];
      S.total = typeof res.count === 'number' ? res.count : from + rows.length;
      S.rows = S.rows.concat(rows);
      if (reset) grid.innerHTML = '';
      grid.insertAdjacentHTML('beforeend', rows.map(cardHtml).join(''));
      var empty = !S.rows.length;
      grid.hidden = empty;
      emptyBox.hidden = !empty;
      if (empty) {
        var filtered = S.q || S.status !== 'all' || S.service || S.sort === 'event';
        emptyBox.innerHTML = '<div class="card">' + (filtered
          ? A.emptyState('No matching requests', 'Try a different search or clear the filters.', I.search)
          : A.emptyState('No requests yet', 'Catering and event requests sent from the app will appear here.', I.party)) + '</div>';
      }
      foot.hidden = empty;
      S.el.querySelector('[data-count]').textContent = 'Showing ' + A.formatNumber(S.rows.length) + ' of ' + A.formatNumber(S.total) + ' request' + (S.total === 1 ? '' : 's');
      more.hidden = S.rows.length >= S.total;
    } catch (e) {
      if (seq !== S.seq) return;
      if (reset) {
        grid.innerHTML = '';
        grid.hidden = true;
        emptyBox.hidden = false;
        emptyBox.innerHTML = '';
        var c = document.createElement('div');
        c.className = 'card';
        c.appendChild(A.errorState(A.errMessage(e), function () { load(true); }));
        emptyBox.appendChild(c);
      } else {
        A.toast(A.errMessage(e), 'error');
      }
    } finally {
      if (!reset) A.setLoading(more, false);
    }
  }

  function replaceCard(r) {
    var i = S.rows.findIndex(function (x) { return x.id === r.id; });
    if (i >= 0) S.rows[i] = r;
    var card = S.el && S.el.querySelector('.req-card[data-id="' + r.id + '"]');
    if (card) card.outerHTML = cardHtml(r);
  }

  // ---------------------------------------------------------------------------
  // Detail
  // ---------------------------------------------------------------------------
  function detailHtml(r) {
    var up = upcomingHtml(r);
    var n = daysUntil(r.event_date);
    var idx = FLOW.indexOf(r.status);
    var next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
    var wa = A.waLink(r.phone);
    var addr = [r.address, r.city, r.state].filter(Boolean).join(', ');

    var statusBtns = '<div class="chips" role="group" aria-label="Set status">' + A.REQUEST_STATUSES.map(function (s) {
      var cur = s === r.status;
      return '<button type="button" class="chip" data-set="' + s + '" aria-pressed="' + cur + '"' + (cur ? ' disabled' : '') + '>' + esc(A.statusLabel(s)) + '</button>';
    }).join('') + '</div>';

    return '<div class="row" style="margin-bottom:14px">' + A.badge(r.status) +
        '<span class="muted small">Received ' + esc(A.formatDateTime(r.created_at)) + '</span></div>' +
      '<div class="panel" style="margin-bottom:14px"><h3>Update status</h3>' +
        (next && r.status !== 'cancelled' ? '<div class="row" style="margin-bottom:10px"><button type="button" class="btn btn-primary btn-sm" data-set="' + next + '">' + I.check + 'Mark as ' + esc(A.statusLabel(next).toLowerCase()) + '</button></div>' : '') +
        statusBtns + '</div>' +
      '<div class="detail-grid">' +
        '<div class="panel"><h3>Event</h3><dl class="kv">' +
          '<dt>Service</dt><dd>' + esc(r.service) + '</dd>' +
          '<dt>Event type</dt><dd>' + esc(r.event_type) + '</dd>' +
          '<dt>Event date</dt><dd><span class="' + (up ? 'upcoming strong' : '') + '">' + esc(A.formatDate(r.event_date)) + '</span>' + up +
            (n !== null && n < 0 ? ' <span class="small muted">(' + Math.abs(n) + ' day' + (n === -1 ? '' : 's') + ' ago)</span>' : '') + '</dd>' +
          '<dt>Guests</dt><dd>' + esc(A.formatNumber(r.guest_count)) + '</dd>' +
          '<dt>Budget</dt><dd class="strong">' + esc(A.formatNaira(r.budget)) + '</dd>' +
          '<dt>Venue</dt><dd>' + esc(addr || '\u2014') + '</dd>' +
        '</dl>' +
        (r.details ? '<div style="margin-top:12px"><div class="small muted strong" style="margin-bottom:4px">Details</div><div class="note-box">' + esc(r.details) + '</div></div>' : '') +
        '</div>' +
        '<div class="panel"><h3>Customer</h3><dl class="kv">' +
          '<dt>Name</dt><dd>' + esc(r.full_name) + '</dd>' +
          '<dt>Phone</dt><dd><a href="' + esc(A.telLink(r.phone)) + '">' + esc(r.phone) + '</a></dd>' +
          (r.email ? '<dt>Email</dt><dd><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a></dd>' : '') +
        '</dl><div class="contact-links">' +
          (r.phone ? '<a class="btn btn-ghost btn-sm" href="' + esc(A.telLink(r.phone)) + '">' + I.phone + 'Call</a>' : '') +
          (wa ? '<a class="btn btn-ghost btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener">' + I.whatsapp + 'WhatsApp</a>' : '') +
          (r.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(r.email) + '?subject=' + encodeURIComponent('Your ' + (r.event_type || 'event') + ' request \u2014 U Angel Foods') + '">' + I.mail + 'Email</a>' : '') +
        '</div></div>' +
      '</div>';
  }

  function bindDetail(m, r) {
    var busy = false;
    m.body.querySelectorAll('[data-set]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (busy) return;
        var status = b.getAttribute('data-set');
        if (status === 'cancelled') {
          var ok = await A.confirm('Mark the ' + (r.event_type || 'event') + ' request from ' + r.full_name + ' as cancelled?',
            { danger: true, title: 'Cancel this request?', confirmLabel: 'Mark cancelled', cancelLabel: 'Keep' });
          if (!ok) return;
        }
        busy = true;
        m.body.querySelectorAll('[data-set]').forEach(function (x) { x.disabled = true; });
        if (b.classList.contains('btn')) A.setLoading(b, true, 'Saving\u2026');
        try {
          var res = await A.sb.from('service_requests').update({ status: status }).eq('id', r.id).select('*');
          var data = A.unwrap(res);
          if (!data || !data.length) throw new Error('The request wasn\u2019t updated. You may not have permission, or it no longer exists.');
          Object.assign(r, data[0]);
          A.toast('Request marked as ' + A.statusLabel(r.status).toLowerCase());
          if (S) replaceCard(r);
          A.refreshBadges();
          if (m.isOpen()) { m.body.innerHTML = detailHtml(r); bindDetail(m, r); }
        } catch (e) {
          A.toast(A.errMessage(e), 'error');
          busy = false;
          if (m.isOpen()) { m.body.innerHTML = detailHtml(r); bindDetail(m, r); }
        }
      });
    });
  }

  async function openRequest(id, row) {
    var m = A.modal({
      title: 'Request', wide: true,
      body: A.skeletonBlocks(1, 'line') + A.skeletonBlocks(2, 'block'),
      onClose: function () { if (S && S.el.isConnected && A.currentSection() === 'requests') syncUrl(); }
    });
    try {
      var r = row;
      if (!r) {
        var res = await A.sb.from('service_requests').select('*').eq('id', id).maybeSingle();
        r = A.unwrap(res);
      }
      if (!m.isOpen()) return;
      if (!r) { m.body.innerHTML = A.emptyState('Request not found', 'It may have been removed, or the link is wrong.', I.alert); return; }
      m.setTitle((r.event_type || 'Request') + ' \u00B7 ' + (r.full_name || ''));
      m.body.innerHTML = detailHtml(r);
      bindDetail(m, r);
    } catch (e) {
      if (!m.isOpen()) return;
      m.body.innerHTML = '';
      m.body.appendChild(A.errorState(A.errMessage(e), function () { m.close(); openRequest(id); }));
    }
  }

  function syncUrl() {
    A.replaceParams({ status: S.status !== 'all' ? S.status : '', service: S.service, q: S.q, sort: S.sort === 'event' ? 'event' : '' });
  }

  async function loadServices(sel) {
    var names = DEFAULT_SERVICES.slice();
    try {
      var res = await A.sb.from('categories').select('name').eq('kind', 'service').is('parent_id', null).order('sort_order', { ascending: true });
      var data = A.unwrap(res) || [];
      if (data.length) names = data.map(function (c) { return c.name; });
    } catch (e) { /* fall back to defaults */ }
    if (S.service && names.indexOf(S.service) < 0) names.push(S.service);
    sel.innerHTML = '<option value="">All services</option>' + names.map(function (n) {
      return '<option value="' + esc(n) + '">' + esc(n) + '</option>';
    }).join('');
    sel.value = S.service;
  }

  async function render(el, params) {
    params = params || A.getParams();
    var status = params.get('status') || 'all';
    if (status !== 'all' && A.REQUEST_STATUSES.indexOf(status) < 0) status = 'all';
    S = { el: el, seq: 0, rows: [], total: 0, status: status, service: params.get('service') || '', q: params.get('q') || '', sort: params.get('sort') === 'event' ? 'event' : 'new' };

    var chips = [{ id: 'all', label: 'All' }].concat(A.REQUEST_STATUSES.map(function (s) { return { id: s, label: A.statusLabel(s) }; }));
    el.innerHTML =
      '<div class="page-head"><div><h1>Catering &amp; event requests</h1><p>Follow up on catering and events enquiries from the app.</p></div>' +
      '<div class="actions"><button type="button" class="btn btn-ghost btn-sm" data-reload>' + I.refresh + 'Refresh</button></div></div>' +
      '<div class="toolbar">' +
        '<label class="search"><span class="sr-only">Search requests</span>' + I.search +
          '<input class="input" type="search" data-search placeholder="Name, phone or event type" value="' + esc(S.q) + '" autocomplete="off"></label>' +
        '<select class="select" data-service aria-label="Service"><option value="">All services</option></select>' +
        '<select class="select" data-sort aria-label="Sort"><option value="new">Newest first</option><option value="event">Upcoming events first</option></select>' +
      '</div>' +
      '<div class="toolbar"><div class="chips" role="group" aria-label="Filter by status" data-chips>' + chips.map(function (c) {
        return '<button type="button" class="chip" data-status="' + c.id + '" aria-pressed="' + (S.status === c.id) + '">' + esc(c.label) + '</button>';
      }).join('') + '</div><span class="spacer"></span>' +
      '<button type="button" class="btn btn-dark btn-sm" data-new hidden>' + I.refresh + 'New requests \u2014 refresh</button></div>' +
      '<div class="grid grid-auto" data-grid></div>' +
      '<div data-empty hidden></div>' +
      '<div class="table-foot" data-foot hidden style="border:0;padding:16px 0 0"><span data-count></span>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-more hidden>Load more</button></div>';

    var search = el.querySelector('[data-search]');
    var svc = el.querySelector('[data-service]');
    var sort = el.querySelector('[data-sort]');
    sort.value = S.sort;
    loadServices(svc);

    var refresh = function () { syncUrl(); load(true); };
    search.addEventListener('input', A.debounce(function () {
      var v = search.value.trim();
      if (v === S.q) return;
      S.q = v; refresh();
    }, 350));
    search.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); S.q = search.value.trim(); refresh(); } });
    svc.addEventListener('change', function () { S.service = svc.value; refresh(); });
    sort.addEventListener('change', function () { S.sort = sort.value; refresh(); });
    el.querySelector('[data-chips]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-status]');
      if (!b) return;
      S.status = b.getAttribute('data-status');
      el.querySelectorAll('[data-chips] .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
      refresh();
    });
    el.querySelector('[data-reload]').addEventListener('click', function () { el.querySelector('[data-new]').hidden = true; load(true); });
    el.querySelector('[data-new]').addEventListener('click', function () { this.hidden = true; load(true); });
    el.querySelector('[data-more]').addEventListener('click', function () { load(false); });
    el.querySelector('[data-grid]').addEventListener('click', function (e) {
      var c = e.target.closest('.req-card[data-id]');
      if (!c) return;
      var id = c.getAttribute('data-id');
      openRequest(id, S.rows.find(function (r) { return r.id === id; }));
    });

    var onLive = function (e) {
      if (!el.isConnected) { window.removeEventListener('admin:realtime', onLive); return; }
      if (e.detail && e.detail.table === 'service_requests') el.querySelector('[data-new]').hidden = false;
    };
    window.addEventListener('admin:realtime', onLive);

    var reqParam = params.get('request');
    if (reqParam) openRequest(reqParam);
    await load(true);
  }

  A.registerSection({ id: 'requests', label: 'Requests', icon: I.party, order: 3, render: render });
})();

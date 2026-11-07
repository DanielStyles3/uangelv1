/* U Angel Foods admin — Orders section. */
(function () {
  'use strict';
  var A = window.Admin;
  if (!A || !A.registerSection) return;
  var esc = A.escapeHtml;
  var I = A.icons;
  var PAGE = 25;
  var FULFIL = ['pending', 'confirmed', 'preparing', 'on_the_way'];
  var STEPS = [
    { id: 'pending', label: 'Received' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'preparing', label: 'Preparing' },
    { id: 'on_the_way', label: 'On the way' },
    { id: 'delivered', label: 'Delivered' }
  ];
  var STATUS_CHIPS = [
    { id: 'all', label: 'All' },
    { id: 'fulfil', label: 'To fulfil' },
    { id: 'awaiting', label: 'Awaiting payment' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'cancelled', label: 'Cancelled' }
  ];
  var RANGES = { today: 0, '7d': -6, '30d': -29 };
  var LIST_COLS = 'id, user_id, status, payment_status, payment_method, total, city, phone, created_at, order_items(count)';

  var S; // per-render state

  function itemCount(o) {
    if (Array.isArray(o.order_items) && o.order_items.length && o.order_items[0].count !== undefined) return Number(o.order_items[0].count) || 0;
    if (Array.isArray(o.order_items)) return o.order_items.reduce(function (a, i) { return a + (Number(i.quantity) || 0); }, 0);
    return 0;
  }
  function customerName(o) {
    var p = S.profiles.get(o.user_id);
    return (p && (p.name || p.email)) || 'Customer';
  }

  function rowHtml(o) {
    var p = S.profiles.get(o.user_id);
    var n = itemCount(o);
    return '<tr class="clickable" tabindex="0" data-id="' + esc(o.id) + '">' +
      '<td class="tc-id"><span class="cell-main mono">#' + esc(A.shortId(o.id)) + '</span></td>' +
      '<td class="nowrap tc-date">' + esc(A.formatDate(o.created_at)) + '<div class="cell-sub">' + esc(A.formatTime(o.created_at)) + '</div></td>' +
      '<td class="tc-main"><div class="cell-main">' + esc(customerName(o)) + '</div><div class="cell-sub">' +
        esc([p && p.email !== customerName(o) ? p.email : '', o.phone, o.city].filter(Boolean).join(' \u00B7 ')) + '</div></td>' +
      '<td class="num tc-items">' + n + '<span class="tc-only"> item' + (n === 1 ? '' : 's') + '</span></td>' +
      '<td class="num strong tc-total">' + esc(A.formatNaira(o.total)) + '</td>' +
      '<td class="tc-badge">' + A.badge(o.payment_status) + '</td>' +
      '<td class="tc-badge">' + A.badge(o.status) + '</td></tr>';
  }

  function cleanTerm(t) { return String(t || '').replace(/[,()"\\]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function uuidFromHex(hex) {
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20, 32);
  }

  /** Build the PostgREST or() filter for a search term (order #, customer name/email/phone, phone, city). */
  async function searchFilter(term) {
    var t = cleanTerm(term);
    if (!t) return null;
    var like = '"*' + t + '*"';
    var parts = ['phone.ilike.' + like, 'city.ilike.' + like];
    var hex = t.replace(/^#/, '').replace(/-/g, '').toLowerCase();
    if (/^[0-9a-f]{2,32}$/.test(hex)) {
      var lo = hex + '0'.repeat(32 - hex.length);
      var hi = hex + 'f'.repeat(32 - hex.length);
      parts.push('and(id.gte.' + uuidFromHex(lo) + ',id.lte.' + uuidFromHex(hi) + ')');
    }
    var res = await A.sb.from('profiles').select('id, name, email, phone')
      .or('name.ilike.' + like + ',email.ilike.' + like + ',phone.ilike.' + like).limit(200);
    var ps = A.unwrap(res) || [];
    ps.forEach(function (p) { S.profiles.set(p.id, p); });
    if (ps.length) parts.push('user_id.in.(' + ps.map(function (p) { return p.id; }).join(',') + ')');
    return parts.join(',');
  }

  function applyFilters(q, orFilter) {
    switch (S.status) {
      case 'fulfil': q = q.eq('payment_status', 'paid').in('status', FULFIL); break;
      case 'awaiting': q = q.eq('status', 'awaiting_payment'); break;
      case 'delivered': q = q.eq('status', 'delivered'); break;
      case 'cancelled': q = q.eq('status', 'cancelled'); break;
      default: break;
    }
    if (S.payment) q = q.eq('payment_status', S.payment);
    if (RANGES[S.range] !== undefined) q = q.gte('created_at', A.startOfLagosDay(RANGES[S.range]).toISOString());
    if (S.customer) q = q.eq('user_id', S.customer);
    if (orFilter) q = q.or(orFilter);
    return q;
  }

  function syncUrl() {
    A.replaceParams({
      status: S.status !== 'all' ? S.status : '',
      payment: S.payment,
      range: S.range !== 'all' ? S.range : '',
      customer: S.customer || '',
      q: S.q
    });
  }

  async function load(reset) {
    var seq = ++S.seq;
    var tbody = S.el.querySelector('tbody');
    var foot = S.el.querySelector('[data-foot]');
    var more = S.el.querySelector('[data-more]');
    if (reset) {
      S.rows = [];
      S.total = 0;
      tbody.innerHTML = A.skeletonRows(6, 7);
      foot.hidden = true;
      S.el.querySelector('[data-empty]').hidden = true;
      S.el.querySelector('.table-wrap').hidden = false;
    } else {
      A.setLoading(more, true, 'Loading\u2026');
    }
    try {
      var orFilter = S.q ? await searchFilter(S.q) : null;
      if (seq !== S.seq) return;
      var from = S.rows.length;
      var q = A.sb.from('orders').select(LIST_COLS, { count: 'exact' })
        .order('created_at', { ascending: false }).range(from, from + PAGE - 1);
      var res = await applyFilters(q, orFilter);
      if (seq !== S.seq) return;
      var rows = A.unwrap(res) || [];
      S.total = typeof res.count === 'number' ? res.count : from + rows.length;
      await A.fetchProfiles(rows.map(function (r) { return r.user_id; }))
        .then(function (m) { m.forEach(function (v, k) { S.profiles.set(k, v); }); })
        .catch(function () { /* names are optional */ });
      if (seq !== S.seq) return;
      S.rows = S.rows.concat(rows);
      if (reset) tbody.innerHTML = '';
      tbody.insertAdjacentHTML('beforeend', rows.map(rowHtml).join(''));
      var empty = !S.rows.length;
      S.el.querySelector('.table-wrap').hidden = empty;
      var emptyBox = S.el.querySelector('[data-empty]');
      emptyBox.hidden = !empty;
      if (empty) {
        var filtered = S.q || S.status !== 'all' || S.payment || S.range !== 'all' || S.customer;
        emptyBox.innerHTML = filtered
          ? A.emptyState('No matching orders', 'Try a different search or clear the filters.', I.search)
          : A.emptyState('No orders yet', 'Orders placed in the app will appear here.', I.bag);
      }
      foot.hidden = empty;
      S.el.querySelector('[data-count]').textContent = 'Showing ' + A.formatNumber(S.rows.length) + ' of ' + A.formatNumber(S.total) + ' order' + (S.total === 1 ? '' : 's');
      more.hidden = S.rows.length >= S.total;
    } catch (e) {
      if (seq !== S.seq) return;
      if (reset) {
        tbody.innerHTML = '';
        S.el.querySelector('.table-wrap').hidden = true;
        var box = S.el.querySelector('[data-empty]');
        box.hidden = false;
        box.innerHTML = '';
        box.appendChild(A.errorState(A.errMessage(e), function () { load(true); }));
      } else {
        A.toast(A.errMessage(e), 'error');
      }
    } finally {
      if (!reset) A.setLoading(more, false);
    }
  }

  function updateRow(order) {
    var i = S.rows.findIndex(function (r) { return r.id === order.id; });
    if (i >= 0) S.rows[i] = Object.assign({}, S.rows[i], { status: order.status, payment_status: order.payment_status });
    var tr = S.el && S.el.querySelector('tr[data-id="' + order.id + '"]');
    if (tr && i >= 0) tr.outerHTML = rowHtml(S.rows[i]);
  }

  // ---------------------------------------------------------------------------
  // Order detail
  // ---------------------------------------------------------------------------
  function customizationsHtml(list) {
    if (!Array.isArray(list) || !list.length) return '';
    var groups = { topping: [], side: [] };
    list.forEach(function (c) {
      var k = c && c.type === 'side' ? 'side' : 'topping';
      groups[k].push(esc(c && c.name) + (Number(c && c.price) ? ' (+' + esc(A.formatNaira(c.price)) + ')' : ''));
    });
    var out = [];
    if (groups.topping.length) out.push('<div class="meta"><strong>Add-ons:</strong> ' + groups.topping.join(', ') + '</div>');
    if (groups.side.length) out.push('<div class="meta"><strong>Extras:</strong> ' + groups.side.join(', ') + '</div>');
    return out.join('');
  }

  function stepperHtml(o) {
    if (o.status === 'cancelled') return '';
    var cur = STEPS.findIndex(function (s) { return s.id === o.status; });
    return '<div class="stepper" role="group" aria-label="Order progress">' + STEPS.map(function (s, i) {
      var done = cur >= 0 && i <= cur;
      var clickable = i !== cur;
      return '<button type="button" class="step' + (done ? ' done' : '') + (i === cur ? ' current' : '') + (clickable ? ' clickable' : '') +
        '" data-step="' + s.id + '"' + (clickable ? ' title="Set status to ' + esc(s.label) + '"' : ' disabled aria-current="step"') + '>' +
        '<span class="dot">' + (done ? I.check : (i + 1)) + '</span><span>' + esc(s.label) + '</span></button>';
    }).join('') + '</div>';
  }

  function detailHtml(o, p) {
    var items = Array.isArray(o.order_items) ? o.order_items.slice() : [];
    var cur = STEPS.findIndex(function (s) { return s.id === o.status; });
    var next = o.status === 'awaiting_payment' ? STEPS[1] : (cur >= 0 && cur < STEPS.length - 1 ? STEPS[cur + 1] : null);
    var terminal = o.status === 'cancelled' || o.status === 'delivered';
    var name = (p && p.name) || 'Customer';
    var phone = o.phone || (p && p.phone) || '';
    var email = p && p.email;

    var head = '<div class="row" style="margin-bottom:14px">' + A.badge(o.status) + A.badge(o.payment_status) +
      '<span class="muted small">Placed ' + esc(A.formatDateTime(o.created_at)) + '</span></div>';

    var notices = '';
    if (o.status === 'cancelled') {
      notices += '<div class="alert alert-error" style="margin-bottom:14px">' + I.x + '<span>This order was cancelled.' +
        (o.payment_status === 'paid' ? ' It was paid \u2014 make sure the refund was issued in the Paystack dashboard.' : '') + '</span></div>';
    } else if (o.status === 'awaiting_payment') {
      notices += '<div class="alert alert-warn" style="margin-bottom:14px">' + I.clock + '<span>Waiting for the customer to complete payment' +
        (o.payment_method === 'paystack' ? ' on Paystack' : '') + '. Payment status is updated automatically.</span></div>';
    }

    var actions = '';
    if (!terminal) {
      actions = '<div class="row detail-actions" style="margin-bottom:16px">' +
        (next ? '<button type="button" class="btn btn-primary" data-set="' + next.id + '">' + I.check + 'Mark as ' + esc(next.label.toLowerCase()) + '</button>' : '') +
        '<button type="button" class="btn btn-ghost" data-cancel style="color:var(--red)">' + I.x + 'Cancel order</button></div>';
    }

    var itemsHtml = items.length ? items.map(function (it) {
      var img = it.image_url
        ? '<img class="thumb" src="' + esc(it.image_url) + '" alt="" loading="lazy">'
        : '<span class="thumb" aria-hidden="true">\uD83C\uDF7D\uFE0F</span>';
      return '<div class="item">' + img + '<div class="info"><div class="name">' + esc(it.name) + '</div>' +
        '<div class="meta">' + esc(it.quantity) + ' \u00D7 ' + esc(A.formatNaira(it.unit_price)) + '</div>' +
        customizationsHtml(it.customizations) + '</div>' +
        '<div class="price">' + esc(A.formatNaira(it.line_total)) + '</div></div>';
    }).join('') : '<p class="muted">No items recorded for this order.</p>';

    var waUrl = A.waLink(phone);
    var contact = '<dl class="kv">' +
      '<dt>Name</dt><dd>' + esc(name) + '</dd>' +
      (email ? '<dt>Email</dt><dd><a href="mailto:' + esc(email) + '">' + esc(email) + '</a></dd>' : '') +
      (phone ? '<dt>Phone</dt><dd><a href="' + esc(A.telLink(phone)) + '">' + esc(phone) + '</a></dd>' : '') +
      (p && p.phone && phone && p.phone !== phone ? '<dt>Profile phone</dt><dd><a href="' + esc(A.telLink(p.phone)) + '">' + esc(p.phone) + '</a></dd>' : '') +
      '</dl>' +
      '<div class="contact-links">' +
        (phone ? '<a class="btn btn-ghost btn-sm" href="' + esc(A.telLink(phone)) + '">' + I.phone + 'Call</a>' : '') +
        (waUrl ? '<a class="btn btn-ghost btn-sm" href="' + esc(waUrl) + '" target="_blank" rel="noopener">' + I.whatsapp + 'WhatsApp</a>' : '') +
        (email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(email) + '">' + I.mail + 'Email</a>' : '') +
        (o.user_id ? '<button type="button" class="btn btn-ghost btn-sm" data-customer-orders>' + I.bag + 'All their orders</button>' : '') +
      '</div>';

    var address = [o.delivery_address, o.city, o.state].filter(Boolean).join(', ');
    var delivery = '<p>' + (address ? esc(address) : '<span class="muted">No address</span>') + '</p>' +
      (o.note ? '<div style="margin-top:10px"><div class="small muted strong" style="margin-bottom:4px">Customer note</div><div class="note-box">' + esc(o.note) + '</div></div>' : '');

    var payment = '<dl class="kv">' +
      '<dt>Method</dt><dd>' + esc(A.statusLabel(o.payment_method)) + '</dd>' +
      '<dt>Status</dt><dd>' + A.badge(o.payment_status) + '</dd>' +
      (o.paystack_reference ? '<dt>Reference</dt><dd class="mono" style="word-break:break-all">' + esc(o.paystack_reference) + '</dd>' : '') +
      (o.paid_at ? '<dt>Paid at</dt><dd>' + esc(A.formatDateTime(o.paid_at)) + '</dd>' : '') +
      '</dl><p class="small muted" style="margin-top:10px">Payment status is set by Paystack and can\u2019t be changed here.</p>';

    return head + notices + stepperHtml(o) + actions +
      '<div class="detail-grid">' +
        '<div class="panel"><h3>Items (' + items.length + ')</h3><div class="items">' + itemsHtml + '</div>' +
          '<div class="totals"><div><span>Subtotal</span><span>' + esc(A.formatNaira(o.subtotal)) + '</span></div>' +
          '<div><span>Delivery fee</span><span>' + esc(A.formatNaira(o.delivery_fee)) + '</span></div>' +
          '<div class="grand"><span>Total</span><span>' + esc(A.formatNaira(o.total)) + '</span></div></div></div>' +
        '<div class="stack" style="gap:12px">' +
          '<div class="panel"><h3>Customer</h3>' + contact + '</div>' +
          '<div class="panel"><h3>Delivery</h3>' + delivery + '</div>' +
          '<div class="panel"><h3>Payment</h3>' + payment + '</div>' +
        '</div>' +
      '</div>';
  }

  async function setStatus(order, status) {
    var res = await A.sb.from('orders').update({ status: status }).eq('id', order.id).select('id, status, payment_status');
    var data = A.unwrap(res);
    if (!data || !data.length) throw new Error('The order wasn\u2019t updated. You may not have permission, or it no longer exists.');
    order.status = data[0].status;
    order.payment_status = data[0].payment_status;
    return order;
  }

  function stepLabel(id) {
    var s = STEPS.find(function (x) { return x.id === id; });
    return s ? s.label : A.statusLabel(id);
  }

  function bindDetail(m, order, profile) {
    var body = m.body;
    var busy = false;
    function setBusy(on) {
      busy = on;
      body.querySelectorAll('button[data-set], button[data-step], button[data-cancel]').forEach(function (b) {
        if (on) b.setAttribute('disabled', ''); else if (!b.hasAttribute('aria-current')) b.removeAttribute('disabled');
      });
    }
    async function change(status, btn) {
      if (busy) return;
      var curIdx = STEPS.findIndex(function (s) { return s.id === order.status; });
      var newIdx = STEPS.findIndex(function (s) { return s.id === status; });
      if (status === 'cancelled') {
        var paid = order.payment_status === 'paid';
        var ok = await A.confirm(
          'Cancel order #' + A.shortId(order.id) + ' (' + A.formatNaira(order.total) + ')?' +
          (paid ? '\n\nThis order has been PAID. Cancelling here does not refund the customer \u2014 issue the refund in your Paystack dashboard.' : '') +
          '\n\nThe customer will see the order as cancelled.',
          { danger: true, title: 'Cancel this order?', confirmLabel: 'Cancel order', cancelLabel: 'Keep order' });
        if (!ok) return;
      } else if (newIdx >= 0 && curIdx >= 0 && newIdx < curIdx) {
        if (!await A.confirm('Move order #' + A.shortId(order.id) + ' back to \u201C' + stepLabel(status) + '\u201D?', { confirmLabel: 'Move back' })) return;
      } else if (order.payment_status !== 'paid' && order.payment_method === 'paystack' &&
                 (order.status === 'awaiting_payment' || order.status === 'pending')) {
        if (!await A.confirm('This order hasn\u2019t been paid on Paystack yet (payment: ' + A.statusLabel(order.payment_status) +
          '). Continue to \u201C' + stepLabel(status) + '\u201D anyway?', { confirmLabel: 'Continue anyway' })) return;
      }
      setBusy(true);
      if (btn) A.setLoading(btn, true, 'Saving\u2026');
      try {
        await setStatus(order, status);
        A.toast('Order #' + A.shortId(order.id) + ' \u2192 ' + A.statusLabel(order.status));
        if (S) updateRow(order);
        A.refreshBadges();
        if (m.isOpen()) { body.innerHTML = detailHtml(order, profile); bindDetail(m, order, profile); }
      } catch (e) {
        A.toast(A.errMessage(e), 'error');
        if (btn) A.setLoading(btn, false);
        setBusy(false);
      }
    }
    body.querySelectorAll('[data-set]').forEach(function (b) {
      b.addEventListener('click', function () { change(b.getAttribute('data-set'), b); });
    });
    body.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () { if (!b.disabled) change(b.getAttribute('data-step'), null); });
    });
    var c = body.querySelector('[data-cancel]');
    if (c) c.addEventListener('click', function () { change('cancelled', c); });
    var co = body.querySelector('[data-customer-orders]');
    if (co) co.addEventListener('click', function () { m.close(); A.navigate('orders', { customer: order.user_id }); });
  }

  async function openOrder(id) {
    var m = A.modal({
      title: 'Order #' + A.shortId(id),
      wide: true,
      body: '<div aria-busy="true">' + A.skeletonBlocks(1, 'line') + A.skeletonBlocks(2, 'block') + '</div>',
      onClose: function () { if (S && S.el.isConnected && A.currentSection() === 'orders') syncUrl(); }
    });
    try {
      var res = await A.sb.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
      var order = A.unwrap(res);
      if (!m.isOpen()) return;
      if (!order) { m.body.innerHTML = A.emptyState('Order not found', 'It may have been removed, or the link is wrong.', I.alert); return; }
      var map = await A.fetchProfiles([order.user_id]).catch(function () { return new Map(); });
      var profile = map.get(order.user_id) || null;
      if (!m.isOpen()) return;
      m.body.innerHTML = detailHtml(order, profile);
      bindDetail(m, order, profile);
    } catch (e) {
      if (!m.isOpen()) return;
      m.body.innerHTML = '';
      m.body.appendChild(A.errorState(A.errMessage(e), function () { m.close(); openOrder(id); }));
    }
  }
  A.openOrder = openOrder;

  // ---------------------------------------------------------------------------
  // Page
  // ---------------------------------------------------------------------------
  function chipsHtml() {
    return STATUS_CHIPS.map(function (c) {
      return '<button type="button" class="chip" data-status="' + c.id + '" aria-pressed="' + (S.status === c.id) + '">' + esc(c.label) + '</button>';
    }).join('');
  }

  async function render(el, params) {
    params = params || A.getParams();
    var status = params.get('status') || 'all';
    if (!STATUS_CHIPS.some(function (c) { return c.id === status; })) status = 'all';
    var payment = params.get('payment') || '';
    if (A.PAYMENT_STATUSES.indexOf(payment) < 0) payment = '';
    var range = params.get('range') || 'all';
    if (RANGES[range] === undefined) range = 'all';
    S = {
      el: el, seq: 0, rows: [], total: 0, profiles: new Map(),
      q: params.get('q') || '', status: status, payment: payment, range: range,
      customer: params.get('customer') || null
    };

    el.innerHTML =
      '<div class="page-head"><div><h1>Orders</h1><p>Track, fulfil and update customer orders.</p></div>' +
      '<div class="actions"><button type="button" class="btn btn-ghost btn-sm" data-reload>' + I.refresh + 'Refresh</button></div></div>' +
      '<div class="toolbar">' +
        '<label class="search"><span class="sr-only">Search orders</span>' + I.search +
          '<input class="input" type="search" data-search placeholder="Order #, customer, phone or city" value="' + esc(S.q) + '" autocomplete="off"></label>' +
        '<select class="select" data-payment aria-label="Payment status">' +
          '<option value="">All payments</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option>' +
          '<option value="failed">Failed</option><option value="refunded">Refunded</option></select>' +
        '<select class="select" data-range aria-label="Date range">' +
          '<option value="all">All time</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select>' +
      '</div>' +
      '<div class="toolbar"><div class="chips" role="group" aria-label="Filter by status" data-chips>' + chipsHtml() + '</div>' +
        '<div data-customer-chip></div><span class="spacer"></span>' +
        '<button type="button" class="btn btn-dark btn-sm" data-new hidden>' + I.refresh + 'New orders \u2014 refresh</button></div>' +
      '<div class="card flush">' +
        '<div class="table-wrap"><table class="table table-cards"><thead><tr>' +
          '<th>Order #</th><th>Date</th><th>Customer</th><th class="num">Items</th><th class="num">Total</th><th>Payment</th><th>Status</th>' +
        '</tr></thead><tbody></tbody></table></div>' +
        '<div data-empty hidden></div>' +
        '<div class="table-foot" data-foot hidden><span data-count></span>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-more hidden>Load more</button></div>' +
      '</div>';

    var search = el.querySelector('[data-search]');
    var paySel = el.querySelector('[data-payment]');
    var rangeSel = el.querySelector('[data-range]');
    paySel.value = S.payment;
    rangeSel.value = S.range;

    var refresh = function () { syncUrl(); load(true); };
    search.addEventListener('input', A.debounce(function () {
      var v = search.value.trim();
      if (v === S.q) return;
      S.q = v;
      refresh();
    }, 350));
    search.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); S.q = search.value.trim(); refresh(); } });
    paySel.addEventListener('change', function () { S.payment = paySel.value; refresh(); });
    rangeSel.addEventListener('change', function () { S.range = rangeSel.value; refresh(); });
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

    var tbody = el.querySelector('tbody');
    var openRow = function (tr) { if (tr) openOrder(tr.getAttribute('data-id')); };
    tbody.addEventListener('click', function (e) { openRow(e.target.closest('tr[data-id]')); });
    tbody.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(e.target.closest('tr[data-id]')); }
    });

    // Customer filter chip (from Customers → View orders).
    if (S.customer) {
      var chipBox = el.querySelector('[data-customer-chip]');
      var renderChip = function (label) {
        chipBox.innerHTML = '<button type="button" class="chip chip-remove" aria-label="Remove customer filter: ' + esc(label) + '">' +
          I.user + 'Customer: ' + esc(label) + ' ' + I.x + '</button>';
        chipBox.firstChild.addEventListener('click', function () { S.customer = null; chipBox.innerHTML = ''; refresh(); });
      };
      renderChip('\u2026');
      A.fetchProfiles([S.customer]).then(function (m) {
        var p = m.get(S.customer);
        if (S.customer && chipBox.isConnected) renderChip((p && (p.name || p.email)) || A.shortId(S.customer));
      }).catch(function () { renderChip(A.shortId(S.customer)); });
    }

    // Realtime: offer a refresh when orders arrive / change.
    var onLive = function (e) {
      if (!el.isConnected) { window.removeEventListener('admin:realtime', onLive); return; }
      var d = e.detail || {};
      if (d.table !== 'orders') return;
      if (d.type === 'INSERT') el.querySelector('[data-new]').hidden = false;
      else if (d.type === 'UPDATE' && d.record && d.record.id) {
        var i = S.rows.findIndex(function (r) { return r.id === d.record.id; });
        if (i >= 0 && d.record.status) updateRow(d.record);
      }
    };
    window.addEventListener('admin:realtime', onLive);

    var orderParam = params.get('order');
    if (orderParam) openOrder(orderParam);
    await load(true);
  }

  A.registerSection({ id: 'orders', label: 'Orders', icon: I.bag, order: 2, render: render });
})();

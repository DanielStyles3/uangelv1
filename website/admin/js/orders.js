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
    // "All orders" = real orders only. Unpaid checkouts and cancelled orders stay out of the way
    // (kept in the database, one tap away under their own chips).
    { id: 'all', label: 'All orders' },
    { id: 'fulfil', label: 'To fulfil' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'awaiting', label: 'Unpaid checkouts' },
    { id: 'cancelled', label: 'Cancelled' }
  ];
  var RANGES = { today: 0, '7d': -6, '30d': -29 };
  var LIST_COLS = 'id, user_id, status, payment_status, payment_method, total, balance_due, balance_collected_at, city, phone, created_at, order_items(count)';

  var S; // per-render state

  /* Pay on delivery: the delivery fee is paid on Paystack, the rider collects balance_due (the items). */
  function isPod(o) { return o && o.payment_method === 'pay_on_delivery'; }
  function needsCollecting(o) { return isPod(o) && !o.balance_collected_at && Number(o.balance_due) > 0 && o.status !== 'cancelled'; }
  function podBadge(o) {
    if (!isPod(o)) return '';
    return o.balance_collected_at
      ? A.badge('success', 'Pay on delivery · collected')
      : A.badge('warn', 'Pay on delivery · collect ' + A.formatNaira(o.balance_due));
  }
  /* Orders that need an online payment before the kitchen starts. */
  function paysOnline(o) { return o.payment_method === 'paystack' || isPod(o); }

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
      '<td class="tc-badge">' + A.badge(o.payment_status) + (isPod(o) ? '<div style="margin-top:4px">' + podBadge(o) + '</div>' : '') + '</td>' +
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
      default: q = q.not('status', 'in', '(cancelled,awaiting_payment)'); break;
    }
    if (S.payment) q = q.eq('payment_status', S.payment);
    if (RANGES[S.range] !== undefined) q = q.gte('created_at', A.startOfLagosDay(RANGES[S.range]).toISOString());
    if (S.customer) q = q.eq('user_id', S.customer);
    if (orFilter) q = q.or(orFilter);
    return q;
  }

  function syncUrl() {
    if (!S) return;
    A.replaceParams({
      view: 'list',
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
    if (!S) return;
    var i = S.rows.findIndex(function (r) { return r.id === order.id; });
    if (i >= 0) S.rows[i] = Object.assign({}, S.rows[i], { status: order.status, payment_status: order.payment_status, balance_collected_at: order.balance_collected_at });
    var tr = S.el && S.el.querySelector('tr[data-id="' + order.id + '"]');
    if (tr && i >= 0) tr.outerHTML = rowHtml(S.rows[i]);
  }

  // ---------------------------------------------------------------------------
  // Order detail
  // ---------------------------------------------------------------------------
  function customizationsHtml(list) {
    if (!Array.isArray(list) || !list.length) return '';
    var groups = { option: [], topping: [], side: [] };
    list.forEach(function (c) {
      if (!c) return;
      // Cake choices (size, flavour…) and typed answers (message on the cake) come first, one per line.
      // (and the number on a number cake, with its price)
      var k = c.type === 'option' || c.type === 'text' || c.type === 'number' ? 'option' : c.type === 'side' ? 'side' : 'topping';
      groups[k].push(esc(c.name) + (Number(c.price) ? ' (+' + esc(A.formatNaira(c.price)) + ')' : ''));
    });
    var out = [];
    if (groups.option.length) out.push('<div class="meta" style="background:#FBE7EF;color:#7a2347;border-radius:10px;padding:8px 10px;margin:6px 0"><strong>Customised:</strong><br>' + groups.option.join('<br>') + '</div>');
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

    var head = '<div class="row" style="margin-bottom:14px">' + A.badge(o.status) + A.badge(o.payment_status) + podBadge(o) +
      '<span class="muted small">Placed ' + esc(A.formatDateTime(o.created_at)) + '</span></div>';

    var notices = '';
    if (o.status === 'cancelled') {
      notices += '<div class="alert alert-error" style="margin-bottom:14px">' + I.x + '<span>This order was cancelled.' +
        (o.payment_status === 'paid' ? ' It was paid \u2014 make sure the refund was issued in the Paystack dashboard.' : '') + '</span></div>';
    } else if (o.status === 'awaiting_payment') {
      notices += '<div class="alert alert-warn" style="margin-bottom:14px">' + I.clock + '<span>Waiting for the customer to complete payment' +
        (isPod(o) ? ' of the delivery fee on Paystack' : o.payment_method === 'paystack' ? ' on Paystack' : '') + '. Payment status is updated automatically.</span></div>';
    } else if (needsCollecting(o) && o.payment_status === 'paid') {
      notices += '<div class="alert alert-warn" style="margin-bottom:14px">' + I.clock + '<span>Pay on delivery: the delivery fee (' +
        esc(A.formatNaira(o.online_amount != null ? o.online_amount : o.delivery_fee)) + ') was paid on Paystack. The rider must collect <strong>' +
        esc(A.formatNaira(o.balance_due)) + '</strong> (cash or transfer) on delivery.</span></div>';
    }

    var actions = '';
    if (!terminal) {
      actions = '<div class="row detail-actions" style="margin-bottom:16px">' +
        (next ? '<button type="button" class="btn btn-primary" data-set="' + next.id + '">' + I.check + 'Mark as ' + esc(next.label.toLowerCase()) + '</button>' : '') +
        '<button type="button" class="btn btn-ghost" data-cancel style="color:var(--red)">' + I.x + 'Cancel order</button></div>';
    }

    function itemRow(it) {
      var img = it.image_url
        ? '<img class="thumb" src="' + esc(it.image_url) + '" alt="" loading="lazy">'
        : '<span class="thumb" aria-hidden="true">\uD83C\uDF7D\uFE0F</span>';
      return '<div class="item">' + img + '<div class="info"><div class="name">' + esc(it.name) + '</div>' +
        '<div class="meta">' + esc(it.quantity) + ' \u00D7 ' + esc(A.formatNaira(it.unit_price)) + '</div>' +
        customizationsHtml(it.customizations) + '</div>' +
        '<div class="price">' + esc(A.formatNaira(it.line_total)) + '</div></div>';
    }
    // Mixed carts: the customer chose two deliveries (today + tomorrow) or everything tomorrow.
    function runHead(title, sub) {
      return '<div class="dl-run"><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
    }
    var itemsHtml;
    if (!items.length) itemsHtml = '<p class="muted">No items recorded for this order.</p>';
    else if (o.delivery_plan === 'split') {
      var today = items.filter(function (it) { return it.delivery_day !== 'tomorrow'; });
      var tomorrow = items.filter(function (it) { return it.delivery_day === 'tomorrow'; });
      itemsHtml = runHead('Deliver today', today.length + ' item' + (today.length === 1 ? '' : 's')) + today.map(itemRow).join('') +
        runHead('Deliver tomorrow', 'Groceries / Local Market \u00B7 ' + tomorrow.length + ' item' + (tomorrow.length === 1 ? '' : 's')) + tomorrow.map(itemRow).join('');
    } else {
      itemsHtml = (o.delivery_plan === 'together' ? runHead('Deliver everything tomorrow', 'The customer chose one delivery (the order includes groceries / Local Market items)') : '') +
        items.map(itemRow).join('');
    }

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
      (o.note ? '<div style="margin-top:10px"><div class="small muted strong" style="margin-bottom:4px">Customer note</div><div class="note-box" style="white-space:pre-wrap">' + esc(o.note) + '</div></div>' : '');

    var payment = '<dl class="kv">' +
      '<dt>Method</dt><dd>' + esc(A.statusLabel(o.payment_method)) + '</dd>' +
      '<dt>Status</dt><dd>' + A.badge(o.payment_status) + '</dd>' +
      (o.paystack_reference ? '<dt>Reference</dt><dd class="mono" style="word-break:break-all">' + esc(o.paystack_reference) + '</dd>' : '') +
      (o.paid_at ? '<dt>Paid at</dt><dd>' + esc(A.formatDateTime(o.paid_at)) + '</dd>' : '') +
      (isPod(o)
        ? '<dt>Paid online</dt><dd>' + esc(A.formatNaira(o.online_amount != null ? o.online_amount : o.delivery_fee)) + ' (delivery fee)</dd>' +
          '<dt>Collect on delivery</dt><dd>' + esc(A.formatNaira(o.balance_due)) +
            (o.balance_collected_at ? ' \u00b7 collected ' + esc(A.formatDateTime(o.balance_collected_at)) : ' \u00b7 not collected yet') + '</dd>'
        : '') +
      '</dl><p class="small muted" style="margin-top:10px">Payment status is set by Paystack and can\u2019t be changed here.</p>' +
      (needsCollecting(o) && o.payment_status === 'paid'
        ? '<button type="button" class="btn btn-primary btn-sm" data-collect style="margin-top:10px">' + I.check + 'Mark balance collected (' + esc(A.formatNaira(o.balance_due)) + ')</button>'
        : '');

    return head + notices + stepperHtml(o) + actions +
      '<div class="detail-grid">' +
        '<div class="panel"><h3>Items (' + items.length + ')</h3><div class="items">' + itemsHtml + '</div>' +
          '<div class="totals"><div><span>Subtotal</span><span>' + esc(A.formatNaira(o.subtotal)) + '</span></div>' +
          '<div><span>' + (o.delivery_plan === 'split' ? 'Delivery (2 deliveries)' : o.delivery_plan === 'together' ? 'Delivery (all tomorrow)' : 'Delivery fee') + '</span><span>' + esc(A.formatNaira(o.delivery_fee)) + '</span></div>' +
          '<div class="grand"><span>Total</span><span>' + esc(A.formatNaira(o.total)) + '</span></div>' +
          (isPod(o)
            ? '<div><span>Paid online (delivery)</span><span>' + esc(A.formatNaira(o.online_amount != null ? o.online_amount : o.delivery_fee)) + '</span></div>' +
              '<div><span>Rider collects</span><span>' + esc(A.formatNaira(o.balance_due)) + '</span></div>'
            : '') +
          '</div></div>' +
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
      body.querySelectorAll('button[data-set], button[data-step], button[data-cancel], button[data-collect]').forEach(function (b) {
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
      } else if (order.payment_status !== 'paid' && paysOnline(order) &&
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
        if (typeof m.onChanged === 'function') m.onChanged(order);
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
    var bc = body.querySelector('[data-collect]');
    if (bc) bc.addEventListener('click', async function () {
      if (busy) return;
      if (!await A.confirm('Has the rider collected ' + A.formatNaira(order.balance_due) + ' for order #' + A.shortId(order.id) + '?',
        { title: 'Mark balance collected?', confirmLabel: 'Mark collected' })) return;
      setBusy(true);
      A.setLoading(bc, true, 'Saving…');
      try {
        order.balance_collected_at = A.unwrap(await A.sb.rpc('admin_mark_balance_collected', { p_order_id: order.id }));
        A.toast('Order #' + A.shortId(order.id) + ': ' + A.formatNaira(order.balance_due) + ' collected');
        if (S) updateRow(order);
        if (typeof m.onChanged === 'function') m.onChanged(order);
        A.refreshBadges();
        if (m.isOpen()) { body.innerHTML = detailHtml(order, profile); bindDetail(m, order, profile); }
      } catch (e) {
        A.toast(A.errMessage(e), 'error');
        A.setLoading(bc, false);
        setBusy(false);
      }
    });
    var co = body.querySelector('[data-customer-orders]');
    if (co) co.addEventListener('click', function () { m.close(); A.navigate('orders', { customer: order.user_id }); });
  }

  /** Opens the order detail window. onChanged(order) runs after a status change (board refresh). */
  async function openOrder(id, onChanged) {
    var m = A.modal({
      title: 'Order #' + A.shortId(id),
      wide: true,
      body: '<div aria-busy="true">' + A.skeletonBlocks(1, 'line') + A.skeletonBlocks(2, 'block') + '</div>',
      onClose: function () { if (S && S.el.isConnected && A.currentSection() === 'orders') syncUrl(); }
    });
    m.onChanged = onChanged;
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

  function viewToggle(current) {
    return '<div class="ob-views" role="group" aria-label="Orders view">' +
      '<button type="button" data-view-mode="board" aria-pressed="' + (current === 'board') + '">' + I.grid + 'Board</button>' +
      '<button type="button" data-view-mode="list" aria-pressed="' + (current === 'list') + '">' + I.filter + 'List</button></div>';
  }
  function bindToggle(el) {
    el.querySelector('.ob-views').addEventListener('click', function (e) {
      var b = e.target.closest('[data-view-mode]');
      if (b && b.getAttribute('aria-pressed') !== 'true') A.navigate('orders', { view: b.getAttribute('data-view-mode') });
    });
  }

  /* Board by default; the list opens with ?view=list or when a filter/search is in the link. */
  async function render(el, params) {
    params = params || A.getParams();
    var view = params.get('view');
    if (view !== 'board' && view !== 'list') {
      view = ['status', 'payment', 'range', 'customer', 'q'].some(function (k) { return params.get(k); }) ? 'list' : 'board';
    }
    if (view === 'board') { S = null; return renderBoard(el, params); }
    return renderList(el, params);
  }

  // ---------------------------------------------------------------------------
  // Board: one column per status, one button to move an order to the next step
  // ---------------------------------------------------------------------------
  var BOARD = [
    { id: 'awaiting_payment', label: 'Awaiting payment', hint: 'Not paid yet (last 2 days)', tone: 'amber', next: null },
    { id: 'pending', label: 'New (paid)', hint: 'Confirm to start', tone: 'orange', next: 'confirmed', nextLabel: 'Confirm' },
    { id: 'confirmed', label: 'Confirmed', hint: 'Start preparing', tone: 'teal', next: 'preparing', nextLabel: 'Start preparing' },
    { id: 'preparing', label: 'Preparing', hint: 'Being packed', tone: 'blue', next: 'on_the_way', nextLabel: 'Send out' },
    { id: 'on_the_way', label: 'On the way', hint: 'With the rider', tone: 'purple', next: 'delivered', nextLabel: 'Delivered' },
    { id: 'delivered', label: 'Delivered', hint: 'Orders from today and yesterday', tone: 'green', next: null }
  ];
  var LATE_MIN = { pending: 30, confirmed: 60, preparing: 90, on_the_way: 120 };

  function waited(o) { return Math.max(0, Math.round((Date.now() - new Date(o.paid_at || o.created_at).getTime()) / 60000)); }
  function waitText(m) { return m < 1 ? 'just now' : m < 60 ? m + ' min' : m < 1440 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : Math.floor(m / 1440) + 'd'; }

  async function renderBoard(el, params) {
    var B = { el: el, rows: [], profiles: new Map(), q: '', busy: {}, seq: 0 };
    el.innerHTML =
      '<div class="page-head"><div><h1>Orders</h1><p>Move each order along as it happens. Customers see the new status in the app.</p></div>' +
        '<div class="actions">' + viewToggle('board') + '<button type="button" class="btn btn-ghost btn-sm" data-reload>' + I.refresh + 'Refresh</button></div></div>' +
      '<div class="toolbar"><label class="search"><span class="sr-only">Search orders on the board</span>' + I.search +
        '<input class="input" type="search" data-board-search placeholder="Order #, customer, phone or area" autocomplete="off"></label>' +
        '<span class="ob-live">Live · updates automatically</span></div>' +
      '<div class="ob-scroll"><div class="ob-board" data-board>' +
        BOARD.map(function (c) { return '<section class="ob-col"><div class="ob-col-h"><span class="ob-dot ' + c.tone + '"></span><span>' + esc(c.label) + '</span></div>' + A.skeletonBlocks(2, 'ob-sk') + '</section>'; }).join('') +
      '</div></div>';
    bindToggle(el);

    var boardEl = el.querySelector('[data-board]');
    async function load() {
      var seq = ++B.seq;
      try {
        var cols = 'id, user_id, status, payment_status, payment_method, total, balance_due, balance_collected_at, city, delivery_address, phone, created_at, paid_at, order_items(name, quantity)';
        var since48 = new Date(Date.now() - 2 * 86400000).toISOString();
        var res = await Promise.all([
          A.sb.from('orders').select(cols).in('status', ['pending', 'confirmed', 'preparing', 'on_the_way']).order('created_at', { ascending: true }).limit(500),
          A.sb.from('orders').select(cols).eq('status', 'awaiting_payment').gte('created_at', since48).order('created_at', { ascending: false }).limit(100),
          A.sb.from('orders').select(cols).eq('status', 'delivered').gte('created_at', A.startOfLagosDay(-1).toISOString()).order('created_at', { ascending: false }).limit(200)
        ]);
        if (seq !== B.seq) return;
        var delivered = (A.unwrap(res[2]) || []).slice(0, 60);
        B.rows = (A.unwrap(res[0]) || []).concat(A.unwrap(res[1]) || [], delivered);
        var map = await A.fetchProfiles(B.rows.map(function (r) { return r.user_id; })).catch(function () { return new Map(); });
        map.forEach(function (v, k) { B.profiles.set(k, v); });
        if (seq !== B.seq) return;
        draw();
      } catch (e) {
        if (seq !== B.seq) return;
        boardEl.innerHTML = '';
        boardEl.appendChild(A.errorState(A.errMessage(e), load));
      }
    }

    function nameOf(o) { var p = B.profiles.get(o.user_id); return (p && (p.name || p.email)) || 'Customer'; }
    function itemsText(o) {
      var list = Array.isArray(o.order_items) ? o.order_items : [];
      var txt = list.slice(0, 3).map(function (i) { return (Number(i.quantity) || 1) + '× ' + String(i.name || '').split(' – ')[0]; }).join(', ');
      return txt + (list.length > 3 ? ' +' + (list.length - 3) + ' more' : '');
    }
    function matches(o) {
      if (!B.q) return true;
      var p = B.profiles.get(o.user_id) || {};
      return [A.shortId(o.id), o.id, nameOf(o), p.email, o.phone, o.city, o.delivery_address].join(' ').toLowerCase().indexOf(B.q) !== -1;
    }
    function card(o, col) {
      var mins = waited(o);
      var late = LATE_MIN[o.status] && mins > LATE_MIN[o.status];
      var age = col.id === 'delivered' ? A.formatTime(o.created_at) : col.id === 'awaiting_payment' ? 'Started ' + waitText(minsAgo(o.created_at)) + ' ago' : waitText(mins) + (late ? ' · late' : '');
      var paid = o.payment_status === 'paid';
      var btn = col.next
        ? '<button type="button" class="ob-next ' + (col.next === 'delivered' ? 'green' : '') + '" data-advance="' + esc(o.id) + '"' + (B.busy[o.id] ? ' disabled' : '') + '>' + esc(B.busy[o.id] ? 'Saving…' : col.nextLabel + ' →') + '</button>'
        : col.id === 'delivered' ? '<span class="ob-chip done">Done</span>' : '<span class="ob-chip wait">Waiting</span>';
      return '<article class="ob-card' + (late ? ' late' : '') + '" tabindex="0" data-open="' + esc(o.id) + '" aria-label="Order ' + esc(A.shortId(o.id)) + ', ' + esc(nameOf(o)) + '">' +
        '<div class="ob-top"><span class="ob-id">#' + esc(A.shortId(o.id)) + '</span><span class="ob-age">' + esc(age) + '</span></div>' +
        '<div><div class="ob-who">' + esc(nameOf(o)) + '</div><div class="ob-where">' + esc([o.city, o.phone].filter(Boolean).join(' · ')) + '</div></div>' +
        '<div class="ob-items">' + esc(itemsText(o)) + '</div>' +
        (isPod(o) ? '<div>' + podBadge(o) + '</div>' : '') +
        '<div class="ob-bot"><span><span class="ob-total">' + esc(A.formatNaira(o.total)) + '</span> <span class="ob-chip ' + (paid ? 'paid">Paid' : 'unpaid">Unpaid') + '</span></span>' + btn + '</div></article>';
    }
    function minsAgo(iso) { return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); }

    function draw() {
      boardEl.innerHTML = BOARD.map(function (col) {
        var list = B.rows.filter(function (o) { return o.status === col.id && matches(o); });
        if (col.id !== 'awaiting_payment' && col.id !== 'delivered') list.sort(function (a, b) { return waited(b) - waited(a); });
        return '<section class="ob-col" aria-label="' + esc(col.label) + ', ' + list.length + ' orders">' +
          '<div class="ob-col-h"><span class="ob-dot ' + col.tone + '"></span><span>' + esc(col.label) + '<small>' + esc(col.hint) + '</small></span><span class="ob-n">' + list.length + '</span></div>' +
          (list.length ? list.map(function (o) { return card(o, col); }).join('') : '<p class="ob-empty">' + (B.q ? 'No matches' : 'Nothing here') + '</p>') +
        '</section>';
      }).join('');
    }

    async function advance(id) {
      var o = B.rows.find(function (r) { return r.id === id; });
      if (!o || B.busy[id]) return;
      var col = BOARD.find(function (c) { return c.id === o.status; });
      if (!col || !col.next) return;
      if (o.payment_status !== 'paid' && paysOnline(o)) {
        if (!await A.confirm('Order #' + A.shortId(o.id) + ' hasn’t been paid on Paystack yet. Move it to “' + stepLabel(col.next) + '” anyway?', { confirmLabel: 'Move anyway' })) return;
      }
      B.busy[id] = true; draw();
      try {
        await setStatus(o, col.next);
        A.toast('#' + A.shortId(o.id) + ' → ' + A.statusLabel(o.status) + '. The customer can see it in the app.');
        A.refreshBadges();
      } catch (e) {
        A.toast(A.errMessage(e), 'error');
      } finally {
        delete B.busy[id];
        if (el.isConnected) draw();
      }
    }

    boardEl.addEventListener('click', function (e) {
      var a = e.target.closest('[data-advance]');
      if (a) { e.stopPropagation(); if (!a.disabled) advance(a.getAttribute('data-advance')); return; }
      var c = e.target.closest('[data-open]');
      if (c) openOrder(c.getAttribute('data-open'), function () { load(); });
    });
    boardEl.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open]')) { e.preventDefault(); openOrder(e.target.getAttribute('data-open'), function () { load(); }); }
    });
    el.querySelector('[data-board-search]').addEventListener('input', A.debounce(function (e) { B.q = e.target.value.trim().toLowerCase(); draw(); }, 150));
    el.querySelector('[data-reload]').addEventListener('click', load);

    // Live updates + keep the "waiting" times fresh.
    var reloadSoon = A.debounce(load, 800);
    var onLive = function (e) {
      if (!el.isConnected) { window.removeEventListener('admin:realtime', onLive); return; }
      if ((e.detail || {}).table === 'orders') reloadSoon();
    };
    window.addEventListener('admin:realtime', onLive);
    var tick = setInterval(function () { if (!el.isConnected) { clearInterval(tick); return; } if (!document.hidden) draw(); }, 60000);

    var orderParam = params.get('order');
    if (orderParam) openOrder(orderParam, function () { load(); });
    await load();
  }

  async function renderList(el, params) {
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
      '<div class="actions">' + viewToggle('list') + '<button type="button" class="btn btn-ghost btn-sm" data-reload>' + I.refresh + 'Refresh</button></div></div>' +
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

    bindToggle(el);
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

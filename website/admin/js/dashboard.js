/* U Angel Foods admin — Dashboard section. */
(function () {
  'use strict';
  var A = window.Admin;
  if (!A || !A.registerSection) return;
  var esc = A.escapeHtml;
  var I = A.icons;

  function statCard(o) {
    var tag = o.href ? 'a' : 'div';
    return '<' + tag + ' class="stat"' + (o.href ? ' href="' + esc(o.href) + '"' : '') + '>' +
      '<div class="stat-icon ' + (o.tone || '') + '">' + o.icon + '</div>' +
      '<div class="stat-body"><div class="stat-label">' + esc(o.label) + '</div>' +
      // Long amounts get a smaller size on phones and may only break after a thousands separator.
      '<div class="stat-value' + (String(o.value).length >= 12 ? ' is-long' : '') + '" title="' + esc(o.value) + '">' +
        esc(o.value).replace(/,/g, ',<wbr>') + '</div>' +
      (o.sub ? '<div class="stat-sub">' + esc(o.sub) + '</div>' : '') + '</div></' + tag + '>';
  }

  function renderStats(box, s) {
    var hasProducts = A.getSections().some(function (x) { return x.id === 'products'; });
    box.innerHTML = [
      statCard({ label: 'Revenue (30 days)', value: A.formatNaira(s.revenue_paid_30d), sub: 'Paid orders', icon: I.money, tone: 'green' }),
      statCard({ label: 'Revenue (all time)', value: A.formatNaira(s.revenue_paid_total), sub: A.formatNumber(s.orders_total) + ' orders in total', icon: I.chart, tone: 'teal' }),
      statCard({ label: 'Orders today', value: A.formatNumber(s.orders_today), icon: I.bag, tone: '', href: '#/orders?range=today' }),
      statCard({ label: 'Orders to fulfil', value: A.formatNumber(s.orders_to_fulfil), sub: 'Paid, not yet delivered', icon: I.truck, tone: 'blue', href: '#/orders?status=fulfil' }),
      statCard({ label: 'Awaiting payment', value: A.formatNumber(s.awaiting_payment), icon: I.clock, tone: 'amber', href: '#/orders?status=awaiting' }),
      statCard({ label: 'New requests', value: A.formatNumber(s.requests_new), sub: A.formatNumber(s.requests_total) + ' requests in total', icon: I.party, tone: 'purple', href: '#/requests?status=new' }),
      statCard({ label: 'Customers', value: A.formatNumber(s.customers), icon: I.users, tone: 'navy', href: '#/customers' }),
      statCard({ label: 'Products', value: A.formatNumber(s.products), icon: I.box, tone: '', href: hasProducts ? '#/products' : '' })
    ].join('');
  }

  // ---- 14-day paid revenue chart (inline SVG) ----
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    var m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
  }
  function shortNaira(v) {
    if (v >= 1e6) return '₦' + (Math.round(v / 1e5) / 10) + 'm';
    if (v >= 1e3) return '₦' + (Math.round(v / 100) / 10) + 'k';
    return '₦' + Math.round(v);
  }

  function renderChart(box, rows) {
    var days = [];
    for (var i = 13; i >= 0; i--) {
      var d = A.startOfLagosDay(-i);
      var noon = new Date(d.getTime() + 12 * 3600000);
      days.push({ key: A.lagosDateKey(noon), date: noon, total: 0, count: 0 });
    }
    var byKey = {};
    days.forEach(function (d) { byKey[d.key] = d; });
    rows.forEach(function (o) {
      var k = A.lagosDateKey(o.paid_at || o.created_at);
      if (byKey[k]) { byKey[k].total += Number(o.total) || 0; byKey[k].count += 1; }
    });
    var sum = days.reduce(function (a, d) { return a + d.total; }, 0);
    var cnt = days.reduce(function (a, d) { return a + d.count; }, 0);
    var head = box.querySelector('[data-chart-total]');
    if (head) head.innerHTML = '<span class="chart-total">' + esc(A.formatNaira(sum)) + '</span> <span class="muted small">from ' + esc(A.formatNumber(cnt)) + ' paid order' + (cnt === 1 ? '' : 's') + '</span>';
    var body = box.querySelector('[data-chart]');
    if (!sum) {
      body.innerHTML = A.emptyState('No paid orders yet', 'Paid revenue for the last 14 days will appear here.', I.chart);
      return;
    }
    // Size the viewBox to the real width so text stays ~11px on phones (no tiny scaled-down labels).
    var avail = Math.round(body.clientWidth || box.clientWidth || 560);
    var W = Math.max(280, Math.min(560, avail)), H = W < 420 ? 200 : 230, L = 46, R = 8, T = 12, B = 30;
    var cw = W - L - R, ch = H - T - B;
    var max = niceMax(Math.max.apply(null, days.map(function (d) { return d.total; })));
    var slot = cw / days.length;
    var bw = Math.max(6, slot * 0.62);
    // Label every Nth day so "26 Oct" labels (~40px) never overlap; always label today.
    var every = Math.max(2, Math.ceil(44 / slot));
    var out = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Paid revenue per day for the last 14 days">';
    for (var g = 0; g <= 4; g++) {
      var y = T + ch - (ch * g / 4);
      out += '<line class="grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/>';
      out += '<text class="axis" x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(shortNaira(max * g / 4)) + '</text>';
    }
    days.forEach(function (d, idx) {
      var bh = d.total > 0 ? Math.max(3, ch * d.total / max) : 2;
      var x = L + slot * idx + (slot - bw) / 2;
      var y = T + ch - bh;
      var label = d.date.toLocaleDateString('en-NG', { timeZone: A.TZ, weekday: 'short', day: 'numeric', month: 'short' });
      out += '<rect class="bar' + (d.total > 0 ? '' : ' zero') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4">' +
        '<title>' + esc(label + ': ' + A.formatNaira(d.total) + ' (' + d.count + ' order' + (d.count === 1 ? '' : 's') + ')') + '</title></rect>';
      var fromEnd = days.length - 1 - idx;
      if (fromEnd % every === 0 && (fromEnd === 0 || fromEnd >= every)) {
        var dl = d.date.toLocaleDateString('en-NG', { timeZone: A.TZ, day: 'numeric', month: 'short' });
        out += '<text class="axis" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(idx === days.length - 1 ? 'Today' : dl) + '</text>';
      }
    });
    out += '</svg>';
    body.innerHTML = out;
  }

  function customerCell(o, profiles) {
    var p = profiles.get(o.user_id);
    var name = (p && (p.name || p.email)) || o.phone || 'Guest';
    return '<div class="cell-main">' + esc(name) + '</div>' + (p && p.email && p.name ? '<div class="cell-sub">' + esc(p.email) + '</div>' : '');
  }
  function itemCount(o) {
    var c = o.order_items && o.order_items[0] && o.order_items[0].count;
    return Number(c) || 0;
  }

  async function loadRecentOrders(card) {
    var tbody = card.querySelector('tbody');
    try {
      var res = await A.sb.from('orders')
        .select('id, user_id, status, payment_status, total, phone, created_at, order_items(count)')
        .order('created_at', { ascending: false }).limit(8);
      var rows = A.unwrap(res) || [];
      if (!rows.length) {
        card.querySelector('.table-wrap').outerHTML = A.emptyState('No orders yet', 'New orders from the app will show up here.', I.bag);
        return;
      }
      var profiles = await A.fetchProfiles(rows.map(function (r) { return r.user_id; })).catch(function () { return new Map(); });
      tbody.innerHTML = rows.map(function (o) {
        var n = itemCount(o);
        return '<tr class="clickable" tabindex="0" data-id="' + esc(o.id) + '">' +
          '<td class="tc-id"><span class="cell-main mono">#' + esc(A.shortId(o.id)) + '</span><div class="cell-sub">' + n + ' item' + (n === 1 ? '' : 's') + '</div></td>' +
          '<td class="tc-main">' + customerCell(o, profiles) + '</td>' +
          '<td class="num strong tc-total">' + esc(A.formatNaira(o.total)) + '</td>' +
          '<td class="tc-badge">' + A.badge(o.payment_status) + '</td>' +
          '<td class="tc-badge">' + A.badge(o.status) + '</td>' +
          '<td class="nowrap tc-time" title="' + esc(A.formatDateTime(o.created_at)) + '">' + esc(A.timeAgo(o.created_at)) + '</td></tr>';
      }).join('');
      var open = function (tr) { if (tr) A.navigate('orders', { order: tr.getAttribute('data-id') }); };
      tbody.addEventListener('click', function (e) { open(e.target.closest('tr[data-id]')); });
      tbody.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e.target.closest('tr[data-id]')); }
      });
    } catch (e) {
      var wrap = card.querySelector('.table-wrap');
      wrap.innerHTML = '';
      wrap.appendChild(A.errorState(A.errMessage(e), function () { A.rerender(); }));
    }
  }

  async function loadRequests(card) {
    var list = card.querySelector('.list');
    try {
      var res = await A.sb.from('service_requests')
        .select('id, service, event_type, full_name, event_date, guest_count, budget, created_at, status')
        .eq('status', 'new').order('created_at', { ascending: false }).limit(5);
      var rows = A.unwrap(res) || [];
      if (!rows.length) {
        list.outerHTML = A.emptyState('No new requests', 'New catering and event requests will appear here.', I.party);
        return;
      }
      list.innerHTML = rows.map(function (r) {
        return '<button type="button" class="list-item" data-id="' + esc(r.id) + '">' +
          '<span class="stat-icon purple" style="width:40px;height:40px">' + (/cater/i.test(r.service || '') ? I.chef : I.party) + '</span>' +
          '<span class="li-body"><span class="li-title" style="display:block">' + esc(r.event_type || r.service) + ' · ' + esc(r.full_name) + '</span>' +
          '<span class="li-sub" style="display:block">' + esc(A.formatDate(r.event_date)) + ' · ' + esc(A.formatNumber(r.guest_count)) + ' guests · ' + esc(A.formatNaira(r.budget)) + '</span></span>' +
          '<span class="small muted nowrap">' + esc(A.timeAgo(r.created_at)) + '</span></button>';
      }).join('');
      list.addEventListener('click', function (e) {
        var b = e.target.closest('[data-id]');
        if (b) A.navigate('requests', { request: b.getAttribute('data-id') });
      });
    } catch (e) {
      list.innerHTML = '';
      list.appendChild(A.errorState(A.errMessage(e), function () { A.rerender(); }));
    }
  }

  async function loadChart(card) {
    try {
      var since = A.startOfLagosDay(-13).toISOString();
      var res = await A.sb.from('orders').select('total, paid_at, created_at')
        .eq('payment_status', 'paid').gte('paid_at', since).order('paid_at', { ascending: true }).limit(5000);
      var rows = A.unwrap(res) || [];
      renderChart(card, rows);
      // Redraw when the card width changes (rotation / resize) so labels keep fitting.
      var lastW = card.clientWidth;
      var onResize = A.debounce(function () {
        if (!card.isConnected) { window.removeEventListener('resize', onResize); return; }
        if (Math.abs(card.clientWidth - lastW) < 8) return;
        lastW = card.clientWidth;
        renderChart(card, rows);
      }, 200);
      window.addEventListener('resize', onResize);
    } catch (e) {
      var b = card.querySelector('[data-chart]');
      b.innerHTML = '';
      b.appendChild(A.errorState(A.errMessage(e), function () { A.rerender(); }));
    }
  }

  async function render(el) {
    var who = (A.profile && A.profile.name) ? A.profile.name.split(/\s+/)[0] : '';
    el.innerHTML =
      '<div class="page-head"><div><h1>Dashboard</h1><p>' + (who ? 'Welcome back, ' + esc(who) + '. ' : '') + 'Here’s what’s happening at U Angel Foods.</p></div>' +
      '<div class="actions"><button type="button" class="btn btn-ghost btn-sm" data-refresh>' + I.refresh + 'Refresh</button></div></div>' +
      '<div class="grid grid-4" data-stats>' + A.skeletonBlocks(8, 'stat-sk') + '</div>' +
      '<div class="layout-2 section-gap">' +
        '<section class="card" data-chart-card aria-labelledby="dash-chart-h"><div class="card-head"><div><h2 id="dash-chart-h">Paid revenue · last 14 days</h2><div data-chart-total class="small muted" style="margin-top:4px">&nbsp;</div></div></div>' +
          '<div data-chart><span class="skeleton" style="height:200px"></span></div></section>' +
        '<section class="card" data-req-card aria-labelledby="dash-req-h"><div class="card-head"><h2 id="dash-req-h">New catering &amp; event requests</h2><a class="btn btn-ghost btn-sm" href="#/requests?status=new">View all</a></div>' +
          '<div class="list">' + A.skeletonBlocks(4, 'line') + '</div></section>' +
      '</div>' +
      '<section class="card flush section-gap" data-orders-card aria-labelledby="dash-orders-h"><div class="card-head" style="padding-bottom:14px;margin-bottom:0"><h2 id="dash-orders-h">Recent orders</h2><a class="btn btn-ghost btn-sm" href="#/orders">View all orders</a></div>' +
        '<div class="table-wrap"><table class="table table-cards"><thead><tr><th>Order</th><th>Customer</th><th class="num">Total</th><th>Payment</th><th>Status</th><th>Time</th></tr></thead>' +
        '<tbody>' + A.skeletonRows(5, 6) + '</tbody></table></div></section>';

    el.querySelector('[data-refresh]').addEventListener('click', function () { A.rerender(); });

    var statsBox = el.querySelector('[data-stats]');
    var statsP = A.refreshBadges().then(function (s) {
      if (s) renderStats(statsBox, s);
      else {
        statsBox.innerHTML = '';
        statsBox.style.display = 'block';
        statsBox.appendChild(A.errorState('Couldn’t load the numbers.', function () { A.rerender(); }));
      }
    });

    // Live refresh of the dashboard when orders / requests change.
    var onLive = A.debounce(function () {
      if (!el.isConnected) { window.removeEventListener('admin:realtime', onLive); return; }
      A.rerender();
    }, 1500);
    window.addEventListener('admin:realtime', onLive);

    await Promise.all([
      statsP,
      loadChart(el.querySelector('[data-chart-card]')),
      loadRequests(el.querySelector('[data-req-card]')),
      loadRecentOrders(el.querySelector('[data-orders-card]'))
    ]);
  }

  A.registerSection({ id: 'dashboard', label: 'Dashboard', icon: I.dashboard, order: 1, render: render });
})();

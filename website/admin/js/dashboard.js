/* U Angel Foods admin — Dashboard.
 * "Needs your attention" first, then key numbers for a chosen period (vs the period before),
 * a sales trend, sales by category, best sellers and busiest times. Styles: css/insights.css (db-). */
(function () {
  'use strict';
  var A = window.Admin;
  if (!A || !A.registerSection) return;
  var esc = A.escapeHtml;
  var I = A.icons;
  var DAY = 86400000;
  var LAGOS_OFFSET = 3600000; // Africa/Lagos is UTC+1 all year (no daylight saving)
  var PERIODS = { today: 1, '7d': 7, '30d': 30 };
  var ACTIVE = ['awaiting_payment', 'pending', 'confirmed', 'preparing', 'on_the_way'];

  /* ---------------- Helpers ---------------- */

  function lagos(d) { var x = new Date(new Date(d).getTime() + LAGOS_OFFSET); return { hour: x.getUTCHours(), dow: (x.getUTCDay() + 6) % 7 }; }
  function shortNaira(v) {
    if (v >= 1e6) return '₦' + (Math.round(v / 1e5) / 10) + 'm';
    if (v >= 1e3) return '₦' + Math.round(v / 1e3) + 'k';
    return '₦' + Math.round(v);
  }
  function hourLabel(h) { return (h % 12 || 12) + (h < 12 ? 'am' : 'pm'); }
  function minsSince(iso) { return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); }
  function waitText(m) { return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; }
  function greeting() {
    var h = lagos(new Date()).hour;
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
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

  function delta(cur, prev, upIsGood) {
    if (!prev) return '<span class="db-flat">No earlier data</span>';
    var pct = (cur - prev) / prev * 100;
    if (Math.abs(pct) < 0.5) return '<span class="db-flat">● Same</span>';
    var up = pct > 0, good = upIsGood === false ? !up : up;
    return '<span class="' + (good ? 'db-up' : 'db-down') + '">' + (up ? '▲' : '▼') + ' ' + Math.abs(pct).toFixed(0) + '%</span>';
  }

  /* ---------------- Page ---------------- */

  async function render(el, params) {
    params = params || A.getParams();
    var periodKey = PERIODS[params.get('period')] ? params.get('period') : '7d';
    var days = PERIODS[periodKey];
    var periodName = { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days' }[periodKey];
    var prevLabel = days === 1 ? 'vs yesterday' : 'vs previous ' + days + ' days';
    var who = (A.profile && A.profile.name) ? A.profile.name.split(/\s+/)[0] : '';

    el.innerHTML =
      '<div class="page-head db-head"><div><h1>' + esc(greeting()) + (who ? ', ' + esc(who) : '') + '</h1><p>Here’s how U Angel Foods is doing.</p></div>' +
        '<div class="db-head-tools"><span class="db-live">Live</span>' +
        '<div class="db-periods" role="group" aria-label="Time period">' +
          [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days']].map(function (p) {
            var on = p[0] === periodKey;
            return '<button type="button" data-period="' + p[0] + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '">' + p[1] + '</button>';
          }).join('') +
        '</div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-refresh>' + I.refresh + 'Refresh</button></div></div>' +

      '<section aria-labelledby="db-attn-h"><div class="db-sec-h"><h2 id="db-attn-h">Needs your attention</h2><span>Click a card to deal with it</span></div>' +
        '<div class="db-attn" data-attn>' + A.skeletonBlocks(4, 'db-sk-task') + '</div></section>' +

      '<section class="db-kpis" aria-label="Key numbers, ' + esc(periodName) + '" data-kpis>' + A.skeletonBlocks(4, 'db-sk-kpi') + '</section>' +

      '<div class="db-row">' +
        '<section class="card db-card" aria-labelledby="db-trend-h"><div class="db-card-h"><h2 id="db-trend-h">Sales ' + (days === 1 ? 'by hour today' : 'per day') + '</h2>' +
          '<div class="db-legend"><span><i class="db-key-cur"></i>' + esc(periodName) + '</span><span><i class="db-key-prev"></i>' + (days === 1 ? 'Yesterday' : 'Previous ' + days + ' days') + '</span></div></div>' +
          '<div class="db-chart" data-trend><span class="skeleton" style="height:220px;display:block"></span></div></section>' +
        '<section class="card db-card" aria-labelledby="db-cat-h"><div class="db-card-h"><h2 id="db-cat-h">Sales by category</h2><span>' + esc(periodName) + '</span></div>' +
          '<div class="db-cats" data-cats>' + A.skeletonBlocks(5, 'line') + '</div></section>' +
      '</div>' +

      '<div class="db-row">' +
        '<section class="card db-card" aria-labelledby="db-top-h"><div class="db-card-h"><h2 id="db-top-h">Best sellers</h2><span>' + esc(periodName) + '</span></div>' +
          '<div class="db-tops" data-tops>' + A.skeletonBlocks(5, 'line') + '</div></section>' +
        '<section class="card db-card" aria-labelledby="db-heat-h"><div class="db-card-h"><h2 id="db-heat-h">Busiest times</h2><span>Paid orders, last 30 days</span></div>' +
          '<div class="db-chart" data-heat><span class="skeleton" style="height:200px;display:block"></span></div>' +
          '<div class="db-heat-key" aria-hidden="true">Fewer <i class="s1"></i><i class="s2"></i><i class="s3"></i><i class="s4"></i><i class="s5"></i><i class="s6"></i> More</div></section>' +
      '</div>';

    el.querySelector('[data-refresh]').addEventListener('click', function () { A.rerender(); });
    el.querySelector('.db-periods').addEventListener('click', function (e) {
      var b = e.target.closest('[data-period]');
      if (b && b.getAttribute('data-period') !== periodKey) A.navigate('dashboard', { period: b.getAttribute('data-period') });
    });
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-go]');
      if (!t) return;
      var q = t.getAttribute('data-q');
      A.navigate(t.getAttribute('data-go'), q ? Object.fromEntries(new URLSearchParams(q)) : undefined);
    });

    // Live: refresh when orders / requests change.
    var onLive = A.debounce(function () {
      if (!el.isConnected) { window.removeEventListener('admin:realtime', onLive); return; }
      A.rerender();
    }, 2500);
    window.addEventListener('admin:realtime', onLive);

    var curStart = A.startOfLagosDay(-(days - 1));
    var prevStart = A.startOfLagosDay(-(days * 2 - 1));
    var heatStart = A.startOfLagosDay(-29);

    await Promise.all([
      loadAttention(el.querySelector('[data-attn]')),
      loadSales(el, days, curStart, prevStart, prevLabel),
      loadItems(el, curStart),
      loadHeat(el.querySelector('[data-heat]'), heatStart)
    ]);
  }

  /* ---------------- Needs attention ---------------- */

  async function loadAttention(box) {
    try {
      var res = await Promise.all([
        A.sb.from('orders').select('id, status, created_at, paid_at').in('status', ACTIVE).order('created_at', { ascending: true }).limit(2000),
        A.refreshBadges()
      ]);
      var rows = A.unwrap(res[0]) || [];
      var stats = res[1] || {};
      var newPaid = rows.filter(function (o) { return o.status === 'pending'; });
      var oldest = newPaid.reduce(function (m, o) { return Math.max(m, minsSince(o.paid_at || o.created_at)); }, 0);
      var since48 = Date.now() - 2 * DAY;
      var awaiting = rows.filter(function (o) { return o.status === 'awaiting_payment' && new Date(o.created_at).getTime() >= since48; });
      var kitchen = rows.filter(function (o) { return o.status === 'confirmed' || o.status === 'preparing'; });
      var road = rows.filter(function (o) { return o.status === 'on_the_way'; });
      var reqNew = Number(stats.requests_new) || 0;

      box.innerHTML =
        task(newPaid.length, 'New paid orders to confirm', newPaid.length ? 'Oldest waiting ' + waitText(oldest) : 'All caught up', 'orange', I.bag, oldest > 30, 'orders', 'view=board') +
        task(kitchen.length + road.length, 'Orders in progress', kitchen.length + ' being prepared · ' + road.length + ' on the way', 'blue', I.truck, false, 'orders', 'view=board') +
        task(awaiting.length, 'Waiting for payment', 'Started checkout in the last 2 days, not paid yet', 'amber', I.clock, false, 'orders', 'view=board') +
        task(reqNew, 'New catering & event requests', reqNew ? 'Call them back with a quote' : 'All caught up', 'purple', I.party, false, 'requests', 'status=new');
    } catch (e) {
      box.innerHTML = '';
      box.appendChild(A.errorState(A.errMessage(e), function () { A.rerender(); }));
    }
  }
  function task(n, title, sub, tone, icon, urgent, go, q) {
    return '<button type="button" class="db-task' + (urgent ? ' urgent' : '') + '" data-go="' + go + '"' + (q ? ' data-q="' + esc(q) + '"' : '') + '>' +
      '<span class="db-task-ic ' + tone + '">' + icon + '</span>' +
      '<span class="db-task-body"><b>' + A.formatNumber(n) + '</b><span>' + esc(title) + '</span><small>' + esc(sub) + '</small></span></button>';
  }

  /* ---------------- KPIs + trend ---------------- */

  async function loadSales(el, days, curStart, prevStart, prevLabel) {
    var kpiBox = el.querySelector('[data-kpis]'), trendBox = el.querySelector('[data-trend]');
    try {
      var rows = await fetchAll(function () {
        return A.sb.from('orders').select('id, total, delivery_fee, online_amount, balance_due, balance_collected_at, payment_method, status, payment_status, created_at, paid_at')
          .gte('created_at', prevStart.toISOString()).order('created_at', { ascending: true });
      });
      var cs = curStart.getTime(), ps = prevStart.getTime();
      function when(o) { return new Date(o.paid_at || o.created_at).getTime(); }
      // Money actually received (same rule as order_amount_received() in schema.sql): Paystack
      // orders count their total once paid. Pay-on-delivery orders count the delivery fee once
      // it's paid online, plus the balance once an admin marks it collected (dated by paid_at,
      // to keep it simple).
      function amount(o) {
        if (o.payment_method !== 'pay_on_delivery') return Number(o.total || 0);
        var online = Number(o.online_amount != null ? o.online_amount : o.delivery_fee) || 0;
        return online + (o.balance_collected_at ? Number(o.balance_due || 0) : 0);
      }
      function summarize(from, to) {
        var started = rows.filter(function (o) { var t = new Date(o.created_at).getTime(); return t >= from && t < to; });
        var paid = rows.filter(function (o) { var t = when(o); return o.payment_status === 'paid' && t >= from && t < to; });
        var rev = paid.reduce(function (s, o) { return s + amount(o); }, 0);
        var unpaid = started.filter(function (o) { return o.payment_status !== 'paid'; }).length;
        return { rev: rev, orders: paid.length, aov: paid.length ? rev / paid.length : 0, drop: started.length ? unpaid / started.length : 0, started: started.length };
      }
      var cur = summarize(cs, Infinity), prev = summarize(ps, cs);
      kpiBox.innerHTML =
        kpi('Sales (paid)', A.formatNaira(cur.rev), delta(cur.rev, prev.rev), prevLabel) +
        kpi('Paid orders', A.formatNumber(cur.orders), delta(cur.orders, prev.orders), prevLabel) +
        kpi('Average order', A.formatNaira(cur.aov), delta(cur.aov, prev.aov), prevLabel) +
        kpi('Not paid / dropped', Math.round(cur.drop * 100) + '%', delta(cur.drop, prev.drop, false), 'of ' + A.formatNumber(cur.started) + ' orders started');

      // Buckets: hours today (7am–10pm) or days.
      var labels = [], curB = [], prevB = [], lastIdx;
      if (days === 1) {
        for (var h = 7; h <= 22; h++) { labels.push(hourLabel(h)); curB.push(0); prevB.push(0); }
        rows.forEach(function (o) {
          if (o.payment_status !== 'paid') return;
          var t = when(o), hr = lagos(t).hour;
          if (hr < 7 || hr > 22) return;
          if (t >= cs) curB[hr - 7] += amount(o);
          else if (t >= ps) prevB[hr - 7] += amount(o);
        });
        lastIdx = Math.max(0, Math.min(15, lagos(new Date()).hour - 7));
      } else {
        for (var i = 0; i < days; i++) {
          var d = new Date(cs + i * DAY + 12 * 3600000);
          labels.push(i === days - 1 ? 'Today' : d.toLocaleDateString('en-NG', { timeZone: A.TZ, day: 'numeric', month: 'short' }));
          curB.push(0); prevB.push(0);
        }
        rows.forEach(function (o) {
          if (o.payment_status !== 'paid') return;
          var t = when(o);
          if (t >= cs) { var k = Math.floor((t - cs) / DAY); if (k < days) curB[k] += amount(o); }
          else if (t >= ps) { var j = Math.floor((t - ps) / DAY); if (j < days) prevB[j] += amount(o); }
        });
        lastIdx = days - 1;
      }
      var draw = function () { drawTrend(trendBox, labels, curB, prevB, lastIdx, days === 1 ? 'Yesterday' : 'Before'); };
      draw();
      redrawOnResize(trendBox, draw);
    } catch (e) {
      kpiBox.innerHTML = '';
      kpiBox.appendChild(A.errorState(A.errMessage(e), function () { A.rerender(); }));
      trendBox.innerHTML = '';
    }
  }
  function kpi(label, value, d, sub) {
    return '<div class="card db-kpi"><span class="db-kpi-l">' + esc(label) + '</span><div class="db-kpi-v">' + esc(value) + '</div>' +
      '<div class="db-kpi-d">' + d + '<small>' + esc(sub) + '</small></div></div>';
  }

  function redrawOnResize(box, draw) {
    var lastW = box.clientWidth;
    var onResize = A.debounce(function () {
      if (!box.isConnected) { window.removeEventListener('resize', onResize); return; }
      if (Math.abs(box.clientWidth - lastW) < 8) return;
      lastW = box.clientWidth; draw();
    }, 200);
    window.addEventListener('resize', onResize);
  }

  function drawTrend(box, labels, cur, prev, lastIdx, prevName) {
    var total = cur.reduce(function (a, b) { return a + b; }, 0) + prev.reduce(function (a, b) { return a + b; }, 0);
    if (!total) { box.innerHTML = A.emptyState('No paid orders yet', 'Sales for this period will appear here.', I.chart); return; }
    var W = Math.max(280, Math.round(box.clientWidth || 560)), H = 240, L = 52, R = 12, T = 14, B = 28;
    var cw = W - L - R, ch = H - T - B, n = labels.length;
    var max = Math.max.apply(null, cur.slice(0, lastIdx + 1).concat(prev));
    var p10 = Math.pow(10, Math.floor(Math.log10(max || 1))), m = (max || 1) / p10;
    var nice = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p10;
    var x = function (i) { return L + (n === 1 ? cw / 2 : cw * i / (n - 1)); };
    var y = function (v) { return T + ch - ch * v / nice; };
    var out = '<svg class="db-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Sales trend">';
    for (var g = 0; g <= 4; g++) {
      var gy = T + ch * g / 4;
      out += '<line class="db-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '"/>' +
        '<text class="db-axis" x="' + (L - 8) + '" y="' + (gy + 4) + '" text-anchor="end">' + esc(shortNaira(nice * (4 - g) / 4)) + '</text>';
    }
    var every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(cw / 64))));
    labels.forEach(function (lb, i) {
      if ((n - 1 - i) % every === 0) out += '<text class="db-axis" x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lb) + '</text>';
    });
    function path(arr, upto) {
      var d = '';
      for (var i = 0; i <= upto; i++) d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(arr[i]).toFixed(1);
      return d;
    }
    out += '<path class="db-prev" d="' + path(prev, n - 1) + '"/>';
    out += '<path class="db-area" d="' + path(cur, lastIdx) + 'L' + x(lastIdx).toFixed(1) + ' ' + (T + ch) + 'L' + x(0).toFixed(1) + ' ' + (T + ch) + 'Z"/>';
    out += '<path class="db-cur" d="' + path(cur, lastIdx) + '"/>';
    out += '<circle class="db-dot" cx="' + x(lastIdx).toFixed(1) + '" cy="' + y(cur[lastIdx]).toFixed(1) + '" r="4.5"/>';
    out += '<line class="db-xh" data-xh x1="0" x2="0" y1="' + T + '" y2="' + (T + ch) + '"/><circle class="db-dot" data-xd r="4.5" style="opacity:0"/>';
    out += '<rect data-hit x="' + L + '" y="' + T + '" width="' + cw + '" height="' + ch + '" fill="transparent"/></svg><div class="db-tip" data-tip></div>';
    box.innerHTML = out;

    var svgEl = box.querySelector('svg'), tip = box.querySelector('[data-tip]'), xh = box.querySelector('[data-xh]'), xd = box.querySelector('[data-xd]');
    function show(clientX) {
      var px = clientX - svgEl.getBoundingClientRect().left;
      var i = Math.max(0, Math.min(lastIdx, Math.round((px - L) / (cw / Math.max(1, n - 1)))));
      xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.style.opacity = 1;
      xd.setAttribute('cx', x(i)); xd.setAttribute('cy', y(cur[i])); xd.style.opacity = 1;
      tip.innerHTML = esc(labels[i]) + '<b>' + esc(A.formatNaira(cur[i])) + '</b>' + esc(prevName + ': ' + A.formatNaira(prev[i]));
      tip.style.left = Math.min(W - 80, Math.max(80, x(i))) + 'px';
      tip.style.top = y(cur[i]) + 'px';
      tip.classList.add('show');
    }
    function hide() { tip.classList.remove('show'); xh.style.opacity = 0; xd.style.opacity = 0; }
    var hit = box.querySelector('[data-hit]');
    hit.addEventListener('mousemove', function (e) { show(e.clientX); });
    hit.addEventListener('mouseleave', hide);
    hit.addEventListener('touchstart', function (e) { if (e.touches[0]) show(e.touches[0].clientX); }, { passive: true });
    hit.addEventListener('touchmove', function (e) { if (e.touches[0]) show(e.touches[0].clientX); }, { passive: true });
    hit.addEventListener('touchend', function () { setTimeout(hide, 1500); });
  }

  /* ---------------- Categories + best sellers ---------------- */

  async function loadItems(el, curStart) {
    var catBox = el.querySelector('[data-cats]'), topBox = el.querySelector('[data-tops]');
    try {
      var res = await Promise.all([
        fetchAll(function () {
          return A.sb.from('order_items')
            .select('menu_id, name, image_url, quantity, line_total, orders!inner(payment_status, paid_at, payment_method, balance_collected_at)')
            .eq('orders.payment_status', 'paid').gte('orders.paid_at', curStart.toISOString()).order('id');
        }),
        fetchAll(function () { return A.sb.from('menu').select('id, category_id').order('id'); }),
        fetchAll(function () { return A.sb.from('categories').select('id, name, parent_id, sort_order').order('id'); })
      ]);
      // Pay-on-delivery items only count once the rider has collected the money.
      var items = res[0].filter(function (it) {
        var o = it.orders || {};
        return o.payment_method !== 'pay_on_delivery' || !!o.balance_collected_at;
      }), menu = res[1], cats = res[2];
      var catById = {}, mainOfMenu = {};
      cats.forEach(function (c) { catById[c.id] = c; });
      menu.forEach(function (m) {
        var c = catById[m.category_id];
        mainOfMenu[m.id] = c ? (c.parent_id ? catById[c.parent_id] : c) : null;
      });

      // Sales by main category
      var byCat = {}, total = 0;
      items.forEach(function (it) {
        var main = it.menu_id ? mainOfMenu[it.menu_id] : null;
        var key = main ? main.id : 'other';
        if (!byCat[key]) byCat[key] = { name: main ? main.name : 'Removed products', v: 0, order: main ? main.sort_order : 1e9 };
        byCat[key].v += Number(it.line_total || 0);
        total += Number(it.line_total || 0);
      });
      var catRows = Object.keys(byCat).map(function (k) { return byCat[k]; }).sort(function (a, b) { return b.v - a.v; });
      if (!catRows.length) catBox.innerHTML = A.emptyState('No sales yet', 'Sales by category will appear here.', I.tag);
      else {
        var mx = catRows[0].v || 1;
        catBox.innerHTML = catRows.map(function (r) {
          return '<div class="db-cat"><b>' + esc(r.name) + '</b><span>' + esc(A.formatNaira(r.v)) + '</span>' +
            '<div class="db-bar"><i style="width:' + (r.v / mx * 100).toFixed(1) + '%"></i></div>' +
            '<small>' + Math.round(r.v / (total || 1) * 100) + '% of sales</small></div>';
        }).join('');
      }

      // Best sellers
      var byProd = {};
      items.forEach(function (it) {
        var key = it.menu_id || ('n:' + it.name);
        var main = it.menu_id ? mainOfMenu[it.menu_id] : null;
        if (!byProd[key]) byProd[key] = { id: it.menu_id, name: it.name, img: it.image_url, cat: main ? main.name : '', q: 0, rev: 0 };
        byProd[key].q += Number(it.quantity || 0);
        byProd[key].rev += Number(it.line_total || 0);
      });
      var tops = Object.keys(byProd).map(function (k) { return byProd[k]; }).sort(function (a, b) { return b.rev - a.rev; }).slice(0, 6);
      if (!tops.length) { topBox.innerHTML = A.emptyState('No sales yet', 'Your best-selling products will appear here.', I.star); return; }
      topBox.innerHTML = '<table class="db-table"><thead><tr><th class="db-rank"><span class="sr-only">Rank</span></th><th>Product</th><th class="num">Sold</th><th class="num">Sales</th></tr></thead><tbody>' +
        tops.map(function (p, i) {
          var img = p.img ? '<img src="' + esc(p.img) + '" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'db-noimg\'}))">' : '<span class="db-noimg"></span>';
          return '<tr><td class="db-rank">' + (i + 1) + '</td><td><div class="db-prod">' + img + '<span>' + esc(p.name) + (p.cat ? '<small>' + esc(p.cat) + '</small>' : '') + '</span></div></td>' +
            '<td class="num">' + A.formatNumber(p.q) + '</td><td class="num"><b>' + esc(A.formatNaira(p.rev)) + '</b></td></tr>';
        }).join('') + '</tbody></table>';
    } catch (e) {
      catBox.innerHTML = ''; catBox.appendChild(A.errorState(A.errMessage(e), function () { A.rerender(); }));
      topBox.innerHTML = '';
    }
  }

  /* ---------------- Busiest times ---------------- */

  async function loadHeat(box, since) {
    try {
      var rows = await fetchAll(function () {
        return A.sb.from('orders').select('paid_at').eq('payment_status', 'paid').gte('paid_at', since.toISOString()).order('paid_at');
      });
      var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], H0 = 8, H1 = 21;
      var grid = DAYS.map(function () { var a = []; for (var h = H0; h <= H1; h++) a.push(0); return a; });
      rows.forEach(function (o) {
        var p = lagos(o.paid_at);
        if (p.hour >= H0 && p.hour <= H1) grid[p.dow][p.hour - H0]++;
      });
      var mx = Math.max.apply(null, grid.map(function (r) { return Math.max.apply(null, r); }));
      if (!mx) { box.innerHTML = A.emptyState('Not enough orders yet', 'Once orders come in, you’ll see your busiest days and hours here.', I.clock); return; }
      var draw = function () {
        var W = Math.max(260, Math.round(box.clientWidth || 420)), cols = H1 - H0 + 1, L = 34, T = 4, B = 20;
        var cell = Math.min(28, (W - L) / cols), gap = 2, H = T + 7 * cell + B;
        var out = '<svg class="db-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Paid orders by day of week and hour">';
        grid.forEach(function (row, di) {
          out += '<text class="db-axis" x="' + (L - 6) + '" y="' + (T + di * cell + cell / 2 + 4) + '" text-anchor="end">' + DAYS[di] + '</text>';
          row.forEach(function (v, hi) {
            var step = v ? Math.min(6, 1 + Math.floor(v / mx * 5.999)) : 0;
            out += '<rect class="db-hc s' + step + '" x="' + (L + hi * cell + gap / 2).toFixed(1) + '" y="' + (T + di * cell + gap / 2).toFixed(1) + '" width="' + (cell - gap).toFixed(1) + '" height="' + (cell - gap).toFixed(1) + '" rx="4"' +
              ' data-t="' + DAYS[di] + ' ' + hourLabel(H0 + hi) + '|' + v + ' order' + (v === 1 ? '' : 's') + '"><title>' + DAYS[di] + ' ' + hourLabel(H0 + hi) + ': ' + v + '</title></rect>';
          });
        });
        [8, 12, 16, 20].forEach(function (hr) {
          out += '<text class="db-axis" x="' + (L + (hr - H0) * cell + cell / 2).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + hourLabel(hr) + '</text>';
        });
        out += '</svg><div class="db-tip" data-tip></div>';
        box.innerHTML = out;
        var tip = box.querySelector('[data-tip]'), svgEl = box.querySelector('svg');
        svgEl.addEventListener('mousemove', function (e) {
          var t = e.target.getAttribute && e.target.getAttribute('data-t');
          if (!t) { tip.classList.remove('show'); return; }
          var parts = t.split('|'), br = box.getBoundingClientRect(), cr = e.target.getBoundingClientRect();
          tip.innerHTML = esc(parts[0]) + '<b>' + esc(parts[1]) + '</b>';
          tip.style.left = (cr.left - br.left + cr.width / 2) + 'px'; tip.style.top = (cr.top - br.top) + 'px';
          tip.classList.add('show');
        });
        svgEl.addEventListener('mouseleave', function () { tip.classList.remove('show'); });
      };
      draw();
      redrawOnResize(box, draw);
    } catch (e) {
      box.innerHTML = ''; box.appendChild(A.errorState(A.errMessage(e), function () { A.rerender(); }));
    }
  }

  A.registerSection({ id: 'dashboard', label: 'Dashboard', icon: I.dashboard, order: 1, render: render });
})();

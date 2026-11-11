/* U Angel Foods admin — Affiliates.
 * Summary tiles, applications, commissions to review (confirm each order's per-item %),
 * the withdrawals waiting to be paid (copy bank details, mark as paid, reject),
 * and the affiliates list with search, block / unblock and a details side panel (balances,
 * bank account, recent commissions, withdrawal history).
 * Data contract: supabase/affiliates.sql + supabase/affiliate-review.sql. Styles: css/manage.css (af- + cu-) + css/categories.css (cg-). */
(function () {
  'use strict';
  var A = window.Admin;
  if (!A || !A.registerSection) return;
  var esc = A.escapeHtml;
  var I = A.icons;
  var PAGE = 50;
  var AV = ['#9D174D', '#0F5B78', '#166534', '#7A4419', '#6B21A8', '#9A3412', '#181C2E'];
  var ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';
  var COPY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var HOW = 'People apply in the app and get their code once you approve them here. ' +
    'Customers who sign up with an affiliate’s code stay linked to that affiliate. ' +
    'The affiliate earns commission on the items of every order those customers pay for (not delivery or Christmas giving packs), worked out per product: up to 5%, set for each product in Products. ' +
    'Commission is pending until the order is delivered. You check and confirm it in “Commissions to review” (you can change the % for each item) before it can be withdrawn; ' +
    'confirmed commission becomes withdrawable 7 days after delivery. ' +
    'Affiliates request withdrawals of ₦2,000 or more in the app; you send the money by bank transfer, then mark the request as paid here.';

  var S;

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function nameOf(a) { return (a && (a.name || a.email)) || 'Affiliate'; }
  function initials(a) { return nameOf(a).trim().split(/\s+/).map(function (x) { return x.charAt(0); }).join('').slice(0, 2).toUpperCase() || '?'; }
  function avColor(a) { var h = 0, s = String(a.user_id || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return AV[Math.abs(h) % AV.length]; }
  function byId(id) { return S.rows.find(function (a) { return a.user_id === id; }) || null; }
  function sum(list, key) { return list.reduce(function (s, x) { return s + num(x[key]); }, 0); }
  function statusChip(a) {
    if (a.status === 'pending') return A.badge('warn', 'Waiting for approval');
    if (a.status === 'rejected') return A.badge('cancelled', 'Not approved');
    return a.status === 'blocked' ? A.badge('danger', 'Blocked') : A.badge('success', 'Active');
  }
  function isMember(a) { return a.status === 'active' || a.status === 'blocked'; }
  function pendingList() { return S.rows.filter(function (a) { return a.status === 'pending'; }); }
  function commissionChip(c) {
    if (c.status === 'cancelled') return A.badge('cancelled', 'Cancelled');
    if (c.status === 'pending') return A.badge('pending', 'Awaiting delivery');
    if (!c.reviewed_at) return A.badge('warn', 'Being reviewed');
    if (c.available_at && new Date(c.available_at).getTime() > Date.now()) return A.badge('warn', 'On hold until ' + A.formatDate(c.available_at));
    return A.badge('success', 'Earned');
  }
  function pct(rate) { return Math.round(num(rate) * 1000) / 10; }
  function round2(n) { return Math.round(n * 100) / 100; }
  function needsReview(c) { return !c.reviewed_at && c.status !== 'cancelled'; }
  function itemsOf(c) { return Array.isArray(c.items) ? c.items : []; }
  function reviewChip(c) {
    return c.status === 'pending' ? A.badge('pending', 'Awaiting delivery') : A.badge('warn', 'Delivered · to review');
  }
  var COMM_COLS = 'id, affiliate_id, order_id, customer_id, base_amount, rate, amount, status, available_at, created_at, items, reviewed_at, admin_note';
  function withdrawalChip(w) {
    if (w.status === 'paid') return A.badge('paid', 'Paid');
    if (w.status === 'rejected') return A.badge('danger', 'Rejected');
    return A.badge('warn', 'Waiting to be paid');
  }
  function bankText(w, a) {
    return 'Bank: ' + (w.bank_name || '—') + '\nAccount number: ' + (w.account_number || '—') + '\nAccount name: ' + (w.account_name || '—') +
      '\nAmount: ' + A.formatNaira(w.amount) + (a ? '\nAffiliate: ' + nameOf(a) + ' (' + a.code + ')' : '');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove();
      if (ok) resolve(); else reject(new Error('Couldn’t copy. Select the text and copy it manually.'));
    });
  }

  /* ---------------- Data ---------------- */

  async function load() {
    var r = await Promise.all([
      A.sb.rpc('admin_affiliates'),
      A.sb.from('withdrawals').select('id, affiliate_id, amount, status, bank_name, account_number, account_name, admin_note, created_at, processed_at')
        .eq('status', 'requested').order('created_at', { ascending: true }).limit(500),
      A.sb.from('commissions').select(COMM_COLS)
        .is('reviewed_at', null).neq('status', 'cancelled').order('created_at', { ascending: true }).limit(500)
    ]);
    S.rows = A.unwrap(r[0]) || [];
    S.waiting = A.unwrap(r[1]) || [];
    // The review list is optional: if supabase/affiliate-review.sql isn't run yet the rest of the page still works.
    if (r[2].error) { S.reviews = []; S.reviewErr = A.errMessage(r[2].error); }
    else { S.reviews = r[2].data || []; S.reviewErr = ''; }
  }

  async function reload() {
    try { await load(); } catch (e) { A.toast(A.errMessage(e), 'error'); return; }
    if (S.el.isConnected) renderAll();
  }

  /* ---------------- Rendering ---------------- */

  function tilesHtml() {
    var rows = S.rows;
    var active = rows.filter(function (a) { return a.status === 'active'; }).length;
    var blocked = rows.filter(function (a) { return a.status === 'blocked'; }).length;
    var waiting = pendingList().length;
    function tile(label, value, sub) { return '<div class="card cu-tile"><span>' + esc(label) + '</span><b>' + esc(value) + '</b><small>' + esc(sub) + '</small></div>'; }
    return tile('Active affiliates', A.formatNumber(active),
        [waiting ? waiting + ' waiting for approval' : '', blocked ? blocked + ' blocked' : ''].filter(Boolean).join(' · ') || 'all approved') +
      tile('Customers referred', A.formatNumber(sum(rows, 'referrals')), 'signed up with a code') +
      tile('Commission earned', A.formatNaira(sum(rows, 'total_earned')), A.formatNaira(sum(rows, 'pending')) + ' more awaiting delivery') +
      tile('Owed now', A.formatNaira(sum(rows, 'available')), A.formatNaira(sum(rows, 'on_hold')) + ' on hold (7 days or being reviewed)' +
        (S.reviews.length ? ' · ' + S.reviews.length + ' to review' : '')) +
      tile('Withdrawals waiting', A.formatNumber(S.waiting.length), S.waiting.length ? A.formatNaira(sum(S.waiting, 'amount')) + ' to pay' : 'Nothing to pay');
  }

  function appsHtml() {
    var list = pendingList();
    if (!list.length) return '';
    return '<div class="card-head"><h2>Applications <span class="af-count">' + list.length + '</span></h2>' +
      '<span class="muted small">Approve to give them a code they can share. Reject with a short reason; they see it in the app and can apply again.</span></div>' +
      '<div class="af-apps">' + list.map(function (a) {
        var facts = [
          a.customer_since ? 'Customer since ' + A.formatDate(a.customer_since) : '',
          A.formatNumber(num(a.paid_orders)) + ' paid order' + (num(a.paid_orders) === 1 ? '' : 's'),
          'Applied ' + A.timeAgo(a.created_at)
        ].filter(Boolean).join(' · ');
        return '<div class="af-app" data-aid="' + esc(a.user_id) + '">' +
          '<button type="button" class="af-app-who" data-open="' + esc(a.user_id) + '">' +
            '<span class="cu-av" style="background:' + avColor(a) + '" aria-hidden="true">' + esc(initials(a)) + '</span>' +
            '<span class="af-app-txt"><b>' + esc(nameOf(a)) + '</b>' +
              '<small>' + esc([a.email, a.phone].filter(Boolean).join(' · ') || 'No contact details') + '</small>' +
              '<small>' + esc(facts) + '</small></span></button>' +
          '<div class="af-acts">' +
            '<button type="button" class="btn btn-success btn-sm" data-approve="' + esc(a.user_id) + '">' + I.check + 'Approve</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-decline="' + esc(a.user_id) + '">' + I.x + 'Reject</button>' +
          '</div></div>';
      }).join('') + '</div>';
  }

  function orderRef(orderId) {
    var label = 'Order #' + esc(A.shortId(orderId));
    return typeof A.openOrder === 'function' && orderId
      ? '<button type="button" class="af-link" data-order="' + esc(orderId) + '">' + label + '</button>'
      : '<span>' + label + '</span>';
  }

  function reviewsHtml() {
    var list = S.reviews;
    var head = '<div class="card-head"><h2>Commissions to review' + (list.length ? ' <span class="af-count">' + list.length + '</span>' : '') + '</h2>';
    if (S.reviewErr) {
      return head + '</div><p class="cg-warn af-rv-msg">Couldn’t load commissions to review: ' + esc(S.reviewErr) +
        (/reviewed_at|items|column/i.test(S.reviewErr) ? ' Run supabase/affiliate-review.sql in the Supabase SQL Editor, then refresh.' : '') + '</p>';
    }
    if (!list.length) {
      return head + '</div><p class="muted small af-rv-msg">All commissions are confirmed. New ones appear here when a referred customer pays for an order.</p>';
    }
    var delivered = list.filter(function (c) { return c.status === 'earned'; }).length;
    return head + '<span class="muted small">Oldest first. Check each order’s items and confirm the commission; affiliates can only withdraw confirmed commission' +
        (delivered ? ' (' + delivered + ' delivered and waiting for you)' : '') + '.</span></div>' +
      '<div class="table-wrap"><table class="table table-cards af-rtable"><thead><tr>' +
      '<th>Affiliate</th><th>Order</th><th>Status</th><th class="num">Items total</th><th class="num">Commission (est.)</th><th><span class="sr-only">Actions</span></th>' +
      '</tr></thead><tbody>' + list.map(function (c) {
        var a = byId(c.affiliate_id) || {};
        var n = itemsOf(c).length;
        return '<tr data-cid="' + esc(c.id) + '">' +
          '<td class="af-r-who"><div class="cell-main">' + esc(nameOf(a)) + '</div><div class="cell-sub">' + esc(a.code || '') + (a.status === 'blocked' ? ' · Blocked' : '') + '</div></td>' +
          '<td class="af-r-order nowrap">' + orderRef(c.order_id) + '<div class="cell-sub">' + esc(A.formatDate(c.created_at)) +
            (n ? ' · ' + n + ' item' + (n === 1 ? '' : 's') : '') + '</div></td>' +
          '<td class="af-r-st">' + reviewChip(c) + '</td>' +
          '<td class="num af-r-n" data-label="Items total">' + esc(A.formatNaira(c.base_amount)) + '</td>' +
          '<td class="num af-r-n" data-label="Commission (est.)"><b>' + esc(A.formatNaira(c.amount)) + '</b><div class="cell-sub">' + esc(String(pct(c.rate))) + '% overall</div></td>' +
          '<td class="af-r-acts"><button type="button" class="btn btn-primary btn-sm" data-rv="' + esc(c.id) + '">Review</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function waitingHtml() {
    if (!S.waiting.length) {
      return '<div class="card-head"><h2>Withdrawals to pay</h2></div>' +
        A.emptyState('No withdrawals waiting', 'When an affiliate asks to withdraw their commission (₦2,000 or more), the request appears here with their bank details.', I.money);
    }
    return '<div class="card-head"><h2>Withdrawals to pay</h2><span class="muted small">Oldest first. Send the money by bank transfer, then mark it as paid.</span></div>' +
      '<div class="table-wrap"><table class="table table-cards af-wtable"><thead><tr>' +
      '<th>Affiliate</th><th>Bank</th><th>Account number</th><th>Account name</th><th class="num">Amount</th><th>Requested</th><th><span class="sr-only">Actions</span></th>' +
      '</tr></thead><tbody>' + S.waiting.map(function (w) {
        var a = byId(w.affiliate_id) || {};
        return '<tr data-wid="' + esc(w.id) + '">' +
          '<td class="af-w-who"><div class="cell-main">' + esc(nameOf(a)) + '</div><div class="cell-sub">' + esc(a.code || '') + (a.status === 'blocked' ? ' · Blocked' : '') + '</div></td>' +
          '<td class="af-w-bank" data-label="Bank">' + esc(w.bank_name || '—') + '</td>' +
          '<td class="af-w-acct nowrap" data-label="Account number"><b class="af-mono">' + esc(w.account_number || '—') + '</b></td>' +
          '<td class="af-w-name" data-label="Account name">' + esc(w.account_name || '—') + '</td>' +
          '<td class="num af-w-amt"><b>' + esc(A.formatNaira(w.amount)) + '</b></td>' +
          '<td class="nowrap af-w-date" data-label="Requested">' + esc(A.formatDate(w.created_at)) + '<div class="cell-sub">' + esc(A.timeAgo(w.created_at)) + '</div></td>' +
          '<td class="af-w-acts"><div class="af-acts">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-copy="' + esc(w.id) + '">' + COPY + 'Copy bank details</button>' +
            '<button type="button" class="btn btn-success btn-sm" data-pay="' + esc(w.id) + '">' + I.check + 'Mark as paid</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-reject="' + esc(w.id) + '">' + I.x + 'Reject</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function filtered() {
    var q = S.q.toLowerCase();
    if (!q) return S.rows;
    return S.rows.filter(function (a) {
      return [a.name, a.email, a.phone, a.code].some(function (v) { return v && String(v).toLowerCase().indexOf(q) >= 0; });
    });
  }

  function rowHtml(a) {
    var blocked = a.status === 'blocked';
    var act = a.status === 'pending'
      ? '<button type="button" class="btn btn-ghost btn-sm" data-review="' + esc(a.user_id) + '">Review</button>'
      : isMember(a) ? '<button type="button" class="btn btn-ghost btn-sm" data-block="' + esc(a.user_id) + '">' + (blocked ? 'Unblock' : 'Block') + '</button>' : '';
    return '<tr class="clickable" tabindex="0" data-id="' + esc(a.user_id) + '">' +
      '<td class="af-a-who"><div class="cu-who"><span class="cu-av" style="background:' + avColor(a) + '" aria-hidden="true">' + esc(initials(a)) + '</span>' +
        '<span><b>' + esc(nameOf(a)) + '</b></span></div></td>' +
      '<td class="af-a-contact"><div>' + esc(a.email || '—') + '</div>' + (a.phone ? '<div class="cell-sub">' + esc(a.phone) + '</div>' : '') + '</td>' +
      '<td class="af-a-code" data-label="Code">' + (a.code ? '<b class="af-mono">' + esc(a.code) + '</b>' : '<span class="muted">—</span>') + '</td>' +
      '<td class="af-a-st">' + statusChip(a) + '</td>' +
      '<td class="num af-a-n" data-label="Referrals">' + A.formatNumber(num(a.referrals)) + '</td>' +
      '<td class="num af-a-n" data-label="Total earned"><b>' + esc(A.formatNaira(a.total_earned)) + '</b></td>' +
      '<td class="num af-a-n" data-label="Available">' + esc(A.formatNaira(a.available)) + '</td>' +
      '<td class="num af-a-n" data-label="Paid out">' + esc(A.formatNaira(a.withdrawn)) + '</td>' +
      '<td class="nowrap af-a-date" data-label="Joined">' + esc(A.formatDate(a.created_at)) + '</td>' +
      '<td class="af-a-acts">' + act + '</td></tr>';
  }

  function renderTable() {
    var box = S.el.querySelector('[data-table]');
    var list = filtered(), shown = list.slice(0, S.limit);
    if (!list.length) {
      box.innerHTML = S.rows.length ? A.emptyState('No matching affiliates', 'Try a different name, email or code.', I.search)
        : A.emptyState('No affiliates yet', HOW, I.users);
      return;
    }
    box.innerHTML = '<div class="table-wrap"><table class="table table-cards af-atable"><thead><tr>' +
      '<th>Affiliate</th><th>Email / phone</th><th>Code</th><th>Status</th><th class="num">Referrals</th><th class="num">Total earned</th>' +
      '<th class="num">Available</th><th class="num">Paid out</th><th>Joined</th><th><span class="sr-only">Actions</span></th>' +
      '</tr></thead><tbody>' + shown.map(rowHtml).join('') + '</tbody></table></div>' +
      '<div class="table-foot"><span>Showing ' + A.formatNumber(shown.length) + ' of ' + A.formatNumber(list.length) + '</span>' +
      (shown.length < list.length ? '<button type="button" class="btn btn-ghost btn-sm" data-more>Show more</button>' : '') + '</div>';
  }

  function renderAll() {
    var active = S.rows.filter(function (a) { return a.status === 'active'; }).length;
    var apps = pendingList().length;
    var revs = S.reviews.length;
    S.el.querySelector('[data-sub]').textContent = (apps ? apps + ' application' + (apps === 1 ? '' : 's') + ' to review · ' : '') +
      (revs ? revs + ' commission' + (revs === 1 ? '' : 's') + ' to review · ' : '') +
      active + ' active affiliate' + (active === 1 ? '' : 's') + ' · ' + S.waiting.length + ' withdrawal' + (S.waiting.length === 1 ? '' : 's') + ' to pay';
    S.el.querySelector('[data-tiles]').innerHTML = tilesHtml();
    var appsBox = S.el.querySelector('[data-apps]');
    appsBox.innerHTML = appsHtml();
    appsBox.hidden = !apps;
    var revBox = S.el.querySelector('[data-reviews]');
    revBox.innerHTML = reviewsHtml();
    revBox.classList.toggle('af-rv-card', revs > 0);
    revBox.hidden = false;
    S.el.querySelector('[data-waiting]').innerHTML = waitingHtml();
    renderTable();
  }

  /* ---------------- Withdrawals ---------------- */

  function findWaiting(id) { return S.waiting.find(function (w) { return w.id === id; }) || null; }

  function copyBank(w, btn) {
    copyText(bankText(w, byId(w.affiliate_id))).then(function () {
      A.toast('Bank details copied', 'success');
      if (btn) { var old = btn.innerHTML; btn.innerHTML = I.check + 'Copied'; setTimeout(function () { if (btn.isConnected) btn.innerHTML = old; }, 1600); }
    }, function (e) { A.toast(A.errMessage(e), 'error'); });
  }

  function settle(w, paid) {
    var a = byId(w.affiliate_id) || {};
    var form = document.createElement('form');
    form.className = 'cg-form af-form';
    form.noValidate = true;
    form.innerHTML =
      (paid
        ? '<p class="cg-warn" style="margin:0">Send ' + esc(A.formatNaira(w.amount)) + ' to the account below first. Marking it as paid tells ' + esc(nameOf(a)) + ' the money is on its way and can’t be undone.</p>'
        : '<p class="cu-note">The ' + esc(A.formatNaira(w.amount)) + ' goes back to ' + esc(nameOf(a)) + '’s available balance and they can request again. Tell them why in the note; they see it in the app.</p>') +
      '<div class="af-bank"><div><span>Bank</span><b>' + esc(w.bank_name || '—') + '</b></div>' +
        '<div><span>Account number</span><b class="af-mono">' + esc(w.account_number || '—') + '</b></div>' +
        '<div><span>Account name</span><b>' + esc(w.account_name || '—') + '</b></div>' +
        '<div><span>Amount</span><b>' + esc(A.formatNaira(w.amount)) + '</b></div></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-copy-in style="align-self:flex-start">' + COPY + 'Copy bank details</button>' +
      '<div class="field"><label for="af-note">' + (paid ? 'Note <span class="cg-opt">(optional, e.g. transfer reference)</span>' : 'Reason <span class="cg-req" aria-hidden="true">*</span>') + '</label>' +
        '<textarea id="af-note" class="textarea" maxlength="300" rows="3" placeholder="' + (paid ? 'e.g. Paid via GTBank, ref 12345' : 'e.g. The account name doesn’t match your profile. Please update your bank details.') + '"></textarea>' +
        '<span class="cg-err" data-err role="alert"></span></div>' +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';
    form.querySelector('[data-copy-in]').addEventListener('click', function () { copyBank(w, this); });
    var note = form.querySelector('#af-note');
    note.addEventListener('input', function () { form.querySelector('[data-err]').textContent = ''; note.removeAttribute('aria-invalid'); });

    var busy = false;
    async function go(close) {
      if (busy) return;
      var text = note.value.trim();
      if (!paid && !text) {
        form.querySelector('[data-err]').textContent = 'Add a short reason so the affiliate knows what to fix.';
        note.setAttribute('aria-invalid', 'true');
        note.focus();
        return;
      }
      busy = true;
      try {
        var res = await A.sb.rpc('admin_set_withdrawal', { p_id: w.id, p_status: paid ? 'paid' : 'rejected', p_note: text || null });
        if (res.error) throw new Error(A.errMessage(res.error));
        close();
        A.toast(paid ? 'Marked as paid: ' + A.formatNaira(w.amount) + ' to ' + nameOf(a) : 'Withdrawal rejected. The money is back in their balance.', 'success');
        await reload();
      } finally { busy = false; }
    }
    var m = A.modal({
      title: paid ? 'Mark withdrawal as paid' : 'Reject withdrawal', body: form, className: 'modal-confirm',
      actions: [
        { label: 'Cancel', variant: 'ghost' },
        { label: paid ? 'I’ve sent it, mark as paid' : 'Reject withdrawal', variant: paid ? 'success' : 'danger', loadingLabel: 'Saving…', onClick: function (close) { return go(close); } }
      ]
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); var b = m.el.querySelector('.modal-actions .btn:last-child'); if (b && !b.disabled) b.click(); });
  }

  /* ---------------- Commission review ---------------- */

  function findReview(id) { return S.reviews.find(function (c) { return c.id === id; }) || null; }

  function openReview(c, onDone) {
    var a = byId(c.affiliate_id) || {};
    var items = itemsOf(c);
    var form = document.createElement('form');
    form.className = 'cg-form af-form';
    form.noValidate = true;
    form.innerHTML =
      '<p class="cu-note">' + esc(nameOf(a)) + (a.code ? ' (' + esc(a.code) + ')' : '') + ' · ' + orderRef(c.order_id) + ' · paid ' + esc(A.formatDate(c.created_at)) + ' · ' + reviewChip(c) + '</p>' +
      (c.status === 'pending'
        ? '<p class="cu-note">This order hasn’t been delivered yet. You can confirm now; the commission becomes withdrawable 7 days after delivery, and it is cancelled automatically if the order is cancelled or refunded.</p>'
        : '<p class="cu-note">Delivered. Once you confirm, it becomes withdrawable ' +
            (c.available_at && new Date(c.available_at).getTime() > Date.now() ? 'on ' + esc(A.formatDate(c.available_at)) + ' (7 days after delivery)' : 'straight away (the 7-day hold has passed)') + '.</p>') +
      (items.length
        ? '<div class="field"><span class="cg-lbl" id="af-rv-lbl">Commission per item <span class="cg-opt">(0–50%)</span></span>' +
            '<div class="af-rv-items" role="group" aria-labelledby="af-rv-lbl">' +
              '<div class="af-rv-row af-rv-headrow" aria-hidden="true"><span>Item</span><span>%</span><span>Commission</span></div>' +
              items.map(function (it, i) {
                return '<div class="af-rv-row">' +
                  '<span class="af-rv-name"><b>' + esc(it.name || 'Item') + ' × ' + esc(String(num(it.quantity) || 1)) + '</b><small>' + esc(A.formatNaira(it.line_total)) + '</small></span>' +
                  '<span class="af-rv-pct"><label class="sr-only" for="af-rv-' + i + '">Commission % for ' + esc(it.name || 'item') + '</label>' +
                    '<input id="af-rv-' + i + '" class="input" type="number" inputmode="decimal" min="0" max="50" step="0.1" data-i="' + i + '" value="' + esc(String(pct(it.rate))) + '" aria-describedby="af-rv-err">' +
                    '<i aria-hidden="true">%</i></span>' +
                  '<b class="af-rv-amt" data-amt="' + i + '">' + esc(A.formatNaira(it.amount)) + '</b></div>';
              }).join('') +
              '<div class="af-rv-row af-rv-total"><span>Total commission <small>on ' + esc(A.formatNaira(c.base_amount)) + ' of items</small></span><span></span><b data-total aria-live="polite"></b></div>' +
            '</div>' +
            '<span class="cg-err" id="af-rv-err" data-err role="alert"></span>' +
            '<div class="af-rv-quick"><button type="button" class="btn btn-ghost btn-sm" data-all="0">Set all to 0%</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-all="5">Set all to 5%</button></div></div>'
        : '<p class="cg-warn" style="margin:0">This commission (' + esc(A.formatNaira(c.amount)) + ') was recorded before per-item breakdowns, so there are no items to confirm. ' +
            'Confirming it here would set it to ₦0, so it can’t be confirmed from this screen.</p>') +
      '<div class="field"><label for="af-rv-note">Note <span class="cg-opt">(optional, the affiliate sees it in the app)</span></label>' +
        '<textarea id="af-rv-note" class="textarea" maxlength="300" rows="2" placeholder="e.g. Cakes earn 2% because of their lower margin."></textarea></div>' +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';
    var noteEl = form.querySelector('#af-rv-note');
    noteEl.value = c.admin_note || '';
    var inputs = [].slice.call(form.querySelectorAll('input[data-i]'));
    var errEl = form.querySelector('[data-err]');

    // Returns the percents, or null when any is invalid (and marks those inputs).
    function read(mark) {
      var bad = 0, out = inputs.map(function (inp) {
        var raw = String(inp.value).trim().replace(',', '.');
        var p = raw === '' ? NaN : Number(raw);
        var ok = isFinite(p) && p >= 0 && p <= 50;
        if (!ok) bad++;
        if (mark) { if (ok) inp.removeAttribute('aria-invalid'); else inp.setAttribute('aria-invalid', 'true'); }
        return ok ? Math.round(p * 100) / 100 : null;
      });
      return bad ? null : out;
    }
    function paint() {
      var total = 0;
      inputs.forEach(function (inp) {
        var i = Number(inp.getAttribute('data-i'));
        var raw = String(inp.value).trim().replace(',', '.');
        var p = raw === '' ? NaN : Number(raw);
        var ok = isFinite(p) && p >= 0 && p <= 50;
        var amt = ok ? round2(num(items[i].line_total) * p / 100) : 0;
        total += amt;
        form.querySelector('[data-amt="' + i + '"]').textContent = ok ? A.formatNaira(amt) : '—';
      });
      var t = form.querySelector('[data-total]');
      if (t) t.textContent = A.formatNaira(round2(total));
      return round2(total);
    }
    form.addEventListener('input', function (e) {
      if (!e.target.matches('input[data-i]')) return;
      if (errEl.textContent && read(true)) errEl.textContent = '';
      paint();
    });
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-all]');
      if (b) {
        inputs.forEach(function (inp) { inp.value = b.getAttribute('data-all'); inp.removeAttribute('aria-invalid'); });
        errEl.textContent = '';
        paint();
        return;
      }
      var o = e.target.closest('[data-order]');
      if (o && typeof A.openOrder === 'function') A.openOrder(o.getAttribute('data-order'));
    });
    if (items.length) paint();

    var busy = false;
    async function go(close) {
      if (busy) return;
      var percents = read(true);
      if (!percents) {
        errEl.textContent = 'Enter a % between 0 and 50 for every item (e.g. 2.5).';
        var first = form.querySelector('input[aria-invalid="true"]');
        if (first) first.focus();
        return;
      }
      var total = paint();
      busy = true;
      try {
        var res = await A.sb.rpc('admin_review_commission', {
          p_id: c.id,
          p_rates: percents.map(function (p) { return Math.round(p * 100) / 10000; }),
          p_note: noteEl.value.trim() || null
        });
        if (res.error) throw new Error(A.errMessage(res.error));
        var saved = Array.isArray(res.data) ? res.data[0] : res.data;
        close();
        A.toast('Commission confirmed: ' + A.formatNaira(saved && saved.amount != null ? saved.amount : total) + ' for ' + nameOf(a), 'success');
        if (A.refreshBadges) A.refreshBadges();
        await reload();
        if (onDone) onDone();
      } finally { busy = false; }
    }
    var m = A.modal({
      title: 'Review commission · #' + A.shortId(c.order_id), body: form, className: 'modal-confirm af-rv-modal',
      actions: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Confirm commission', variant: 'success', disabled: !items.length, loadingLabel: 'Saving…', onClick: function (close) { return go(close); } }
      ]
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); var b = m.el.querySelector('.modal-actions .btn:last-child'); if (b && !b.disabled) b.click(); });
    return m;
  }

  /* ---------------- Approve / reject applications ---------------- */

  async function approve(a, btn) {
    var ok = await A.confirm('Approve ' + nameOf(a) + '?\n\nThey get their own invite code straight away and earn ' +
      (Math.round(num(a.rate) * 1000) / 10) + '% on the items in every order their referred customers pay for.',
      { title: 'Approve affiliate', confirmLabel: 'Approve' });
    if (!ok) return false;
    if (btn) A.setLoading(btn, true, 'Approving…');
    var res = await A.sb.rpc('admin_review_affiliate', { p_user: a.user_id, p_approve: true, p_note: null });
    if (btn && btn.isConnected) A.setLoading(btn, false);
    if (res.error) { A.toast(A.errMessage(res.error), 'error'); await reload(); return false; }
    A.toast(nameOf(a) + ' is approved. Their code is ' + (res.data && res.data.code ? res.data.code : 'ready') + '.', 'success');
    if (A.refreshBadges) A.refreshBadges();
    await reload();
    return true;
  }

  function decline(a, onDone) {
    var form = document.createElement('form');
    form.className = 'cg-form af-form';
    form.noValidate = true;
    form.innerHTML =
      '<p class="cu-note">' + esc(nameOf(a)) + ' won’t get a code. They see your reason in the app and can apply again later.</p>' +
      '<div class="field"><label for="af-why">Reason <span class="cg-req" aria-hidden="true">*</span></label>' +
        '<textarea id="af-why" class="textarea" maxlength="300" rows="3" placeholder="e.g. Please add your phone number to your profile, then apply again."></textarea>' +
        '<span class="cg-err" data-err role="alert"></span></div>' +
      '<button type="submit" hidden aria-hidden="true" tabindex="-1"></button>';
    var note = form.querySelector('#af-why');
    note.addEventListener('input', function () { form.querySelector('[data-err]').textContent = ''; note.removeAttribute('aria-invalid'); });
    var busy = false;
    async function go(close) {
      if (busy) return;
      var text = note.value.trim();
      if (!text) {
        form.querySelector('[data-err]').textContent = 'Add a short reason so they know what to do.';
        note.setAttribute('aria-invalid', 'true');
        note.focus();
        return;
      }
      busy = true;
      try {
        var res = await A.sb.rpc('admin_review_affiliate', { p_user: a.user_id, p_approve: false, p_note: text });
        if (res.error) throw new Error(A.errMessage(res.error));
        close();
        A.toast('Application rejected. ' + nameOf(a) + ' will see your reason in the app.', 'success');
        if (A.refreshBadges) A.refreshBadges();
        await reload();
        if (onDone) onDone();
      } finally { busy = false; }
    }
    var m = A.modal({
      title: 'Reject application', body: form, className: 'modal-confirm',
      actions: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Reject application', variant: 'danger', loadingLabel: 'Saving…', onClick: function (close) { return go(close); } }
      ]
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); var b = m.el.querySelector('.modal-actions .btn:last-child'); if (b && !b.disabled) b.click(); });
  }

  /* ---------------- Block / unblock ---------------- */

  async function setBlocked(a, btn) {
    var block = a.status !== 'blocked';
    var ok = await A.confirm(block
      ? 'Block ' + nameOf(a) + ' (' + a.code + ')?\n\nTheir code stops working for new sign-ups, new orders from their customers earn no commission and they can’t request withdrawals. Commission already recorded stays, and you can unblock them at any time.'
      : 'Unblock ' + nameOf(a) + ' (' + a.code + ')?\n\nTheir code works again and their customers’ new orders earn commission again.',
      { danger: block, title: block ? 'Block affiliate' : 'Unblock affiliate', confirmLabel: block ? 'Block' : 'Unblock' });
    if (!ok) return false;
    if (btn) A.setLoading(btn, true, block ? 'Blocking…' : 'Unblocking…');
    var res = await A.sb.from('affiliates').update({ status: block ? 'blocked' : 'active' }).eq('user_id', a.user_id).select('user_id, status');
    if (btn && btn.isConnected) A.setLoading(btn, false);
    if (res.error || !res.data || !res.data.length) {
      A.toast(res.error ? A.errMessage(res.error) : 'Couldn’t update this affiliate. Check you are still signed in as an admin.', 'error');
      return false;
    }
    a.status = res.data[0].status;
    A.toast(block ? nameOf(a) + ' is blocked' : nameOf(a) + ' is active again', 'success');
    if (S.el.isConnected) renderAll();
    return true;
  }

  /* ---------------- Details panel ---------------- */

  async function openDetails(a) {
    var body = document.createElement('div');
    body.className = 'cg-form';
    function paintHead() {
      return '<div class="cu-prof"><span class="cu-av big" style="background:' + avColor(a) + '" aria-hidden="true">' + esc(initials(a)) + '</span>' +
        '<div><b>' + esc(nameOf(a)) + '</b><small>' + (a.code ? 'Code <span class="af-mono af-code">' + esc(a.code) + '</span> · ' : '') + statusChip(a) + '</small></div></div>';
    }
    body.innerHTML =
      '<div data-head>' + paintHead() + '</div>' +
      '<div class="cu-actions">' +
        (a.phone ? '<a class="btn btn-ghost btn-sm" href="' + esc(A.waLink(a.phone)) + '" target="_blank" rel="noopener">' + I.whatsapp + 'WhatsApp</a>' +
          '<a class="btn btn-ghost btn-sm" href="' + esc(A.telLink(a.phone)) + '">' + I.phone + 'Call</a>' : '') +
        (a.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(a.email) + '">' + I.mail + 'Email</a>' : '') +
      '</div>' +
      (a.status === 'pending'
        ? '<div class="af-review"><div><b>Waiting for your approval</b><small>Applied ' + esc(A.timeAgo(a.created_at)) +
            (a.customer_since ? ' · customer since ' + esc(A.formatDate(a.customer_since)) : '') + ' · ' + A.formatNumber(num(a.paid_orders)) + ' paid order' + (num(a.paid_orders) === 1 ? '' : 's') + '</small></div>' +
          '<div class="af-acts"><button type="button" class="btn btn-success btn-sm" data-approve-in>' + I.check + 'Approve</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-decline-in>' + I.x + 'Reject</button></div></div>'
        : a.status === 'rejected'
          ? '<p class="cg-warn" style="margin:0">Not approved' + (a.reviewed_at ? ' on ' + esc(A.formatDate(a.reviewed_at)) : '') + (a.review_note ? '. Reason: ' + esc(a.review_note) : '') + '. They can apply again from the app.</p>'
          : '') +
      '<p class="cu-note">' + esc([a.phone, a.email].filter(Boolean).join(' · ') || 'No contact details') + ' · ' + (isMember(a) ? 'Affiliate since ' : 'Applied ') + esc(A.formatDate(isMember(a) && a.reviewed_at ? a.reviewed_at : a.created_at)) +
        ' · Commission rate ' + esc(String(Math.round(num(a.rate) * 1000) / 10)) + '%</p>' +
      '<div class="cu-stats"><div><span>Customers referred</span><b>' + A.formatNumber(num(a.referrals)) + '</b></div>' +
        '<div><span>Total earned</span><b>' + esc(A.formatNaira(a.total_earned)) + '</b></div>' +
        '<div><span>Paid out</span><b>' + esc(A.formatNaira(a.withdrawn)) + '</b></div></div>' +
      '<div class="cu-stats"><div><span>Awaiting delivery</span><b>' + esc(A.formatNaira(a.pending)) + '</b></div>' +
        '<div><span>On hold (7 days)</span><b>' + esc(A.formatNaira(a.on_hold)) + '</b></div>' +
        '<div><span>Available now</span><b>' + esc(A.formatNaira(a.available)) + '</b></div></div>' +
      '<div class="field"><span class="cg-lbl">Bank account</span>' + (a.account_number
        ? '<div class="af-bank"><div><span>Bank</span><b>' + esc(a.bank_name || '—') + '</b></div><div><span>Account number</span><b class="af-mono">' + esc(a.account_number) + '</b></div>' +
          '<div><span>Account name</span><b>' + esc(a.account_name || '—') + '</b></div></div>'
        : '<p class="cu-note">Not added yet. They add it in the app before their first withdrawal.</p>') + '</div>' +
      '<div data-history>' + A.skeletonBlocks(3, 'line') + '</div>' +
      (isMember(a)
        ? '<div class="cu-adminrow"><div><b>Affiliate account active</b><small>Switch off to block their code, new commission and withdrawals.</small></div>' +
          '<button type="button" class="pp-switch" role="switch" aria-checked="' + (a.status !== 'blocked') + '" data-active aria-label="Affiliate account active"><i></i></button></div>'
        : '');

    var m = A.modal({
      title: nameOf(a), body: body, className: 'cg-drawer',
      actions: [{ label: 'Close', variant: 'ghost', onClick: function (close) { close(); } }]
    });

    var sw = body.querySelector('[data-active]');
    if (sw) sw.addEventListener('click', async function () {
      sw.disabled = true;
      await setBlocked(a);
      sw.disabled = false;
      sw.setAttribute('aria-checked', String(a.status !== 'blocked'));
      body.querySelector('[data-head]').innerHTML = paintHead();
    });
    var ap = body.querySelector('[data-approve-in]');
    if (ap) ap.addEventListener('click', async function () { if (await approve(a, ap)) m.close(); });
    var dc = body.querySelector('[data-decline-in]');
    if (dc) dc.addEventListener('click', function () { decline(a, function () { m.close(); }); });

    var hist = body.querySelector('[data-history]');
    try {
      var r = await Promise.all([
        A.sb.from('commissions').select(COMM_COLS)
          .eq('affiliate_id', a.user_id).order('created_at', { ascending: false }).limit(20),
        A.sb.from('withdrawals').select('id, amount, status, bank_name, account_number, admin_note, created_at, processed_at')
          .eq('affiliate_id', a.user_id).order('created_at', { ascending: false }).limit(20)
      ]);
      var comms = A.unwrap(r[0]) || [], wds = A.unwrap(r[1]) || [];
      if (!m.isOpen()) return;
      var canOpen = typeof A.openOrder === 'function';
      hist.className = 'cg-form';
      hist.innerHTML =
        '<div class="field"><span class="cg-lbl">Recent commissions</span>' + (comms.length
          ? '<div class="af-list">' + comms.map(function (c) {
              var sub = '<small>' + esc(A.formatDate(c.created_at)) + ' · ' + esc(String(pct(c.rate))) + '% of ' + esc(A.formatNaira(c.base_amount)) +
                (c.reviewed_at ? ' · confirmed ' + esc(A.formatDate(c.reviewed_at)) : '') + '</small>' +
                (c.admin_note ? '<small class="af-note">Note: ' + esc(c.admin_note) + '</small>' : '');
              var end = '<b>' + esc(A.formatNaira(c.amount)) + '</b>' + commissionChip(c);
              if (needsReview(c)) {
                // Not a single button here: the row holds two controls (order link + Review).
                return '<div class="af-li af-li-rv"><span class="af-li-main">' + orderRef(c.order_id) + sub + '</span>' +
                  '<span class="af-li-end">' + end + '<button type="button" class="btn btn-primary btn-sm" data-rv="' + esc(c.id) + '">Review</button></span></div>';
              }
              var tag = canOpen ? 'button type="button" data-order="' + esc(c.order_id) + '"' : 'div';
              return '<' + tag + ' class="af-li"><span class="af-li-main">Order #' + esc(A.shortId(c.order_id)) + sub + '</span>' +
                '<span class="af-li-end">' + end + '</span></' + (canOpen ? 'button' : 'div') + '>';
            }).join('') + '</div>' + (comms.length === 20 ? '<span class="cg-help">Showing the latest 20.</span>' : '')
          : '<p class="cu-note">No commission yet. It appears here when a customer they referred pays for an order.</p>') + '</div>' +
        '<div class="field"><span class="cg-lbl">Withdrawals</span>' + (wds.length
          ? '<div class="af-list">' + wds.map(function (w) {
              return '<div class="af-li"><span class="af-li-main">' + esc(A.formatDate(w.created_at)) +
                '<small>' + esc([w.bank_name, w.account_number].filter(Boolean).join(' · ') || '—') +
                (w.processed_at ? ' · ' + (w.status === 'paid' ? 'paid ' : 'handled ') + esc(A.formatDate(w.processed_at)) : '') + '</small>' +
                (w.admin_note ? '<small class="af-note">Note: ' + esc(w.admin_note) + '</small>' : '') + '</span>' +
                '<span class="af-li-end"><b>' + esc(A.formatNaira(w.amount)) + '</b>' + withdrawalChip(w) + '</span></div>';
            }).join('') + '</div>'
          : '<p class="cu-note">No withdrawals yet.</p>') + '</div>';
      hist.addEventListener('click', function (e) {
        var rv = e.target.closest('[data-rv]');
        if (rv) {
          var c = comms.find(function (x) { return x.id === rv.getAttribute('data-rv'); });
          if (c) openReview(c, function () { m.close(); var fresh = byId(a.user_id); if (fresh) openDetails(fresh); });
          return;
        }
        var o = e.target.closest('[data-order]');
        if (o && canOpen) A.openOrder(o.getAttribute('data-order'));
      });
    } catch (e) {
      hist.innerHTML = '';
      hist.appendChild(A.errorState(A.errMessage(e), function () { m.close(); openDetails(a); }));
    }
  }

  /* ---------------- Page ---------------- */

  async function render(el, params) {
    params = params || A.getParams();
    S = { el: el, rows: [], waiting: [], reviews: [], reviewErr: '', q: params.get('q') || '', limit: PAGE };

    el.innerHTML =
      '<div class="page-head"><div><h1>Affiliates</h1><p data-sub>People who share their code and earn commission on the customers they bring.</p></div>' +
        '<div class="actions"><button type="button" class="btn btn-ghost btn-sm" data-reload>' + I.refresh + 'Refresh</button></div></div>' +
      '<p class="pp-note">' + esc(HOW) + '</p>' +
      '<div class="cu-tiles af-tiles" data-tiles>' + A.skeletonBlocks(5, 'cu-sk') + '</div>' +
      '<div class="card flush af-card af-apps-card" data-apps hidden></div>' +
      '<div class="card flush af-card" data-reviews hidden></div>' +
      '<div class="card flush af-card" data-waiting><div class="table-wrap"><table class="table"><tbody>' + A.skeletonRows(2, 5) + '</tbody></table></div></div>' +
      '<h2 class="af-h2">All affiliates</h2>' +
      '<div class="toolbar"><label class="search"><span class="sr-only">Search affiliates</span>' + I.search +
        '<input class="input" type="search" data-search placeholder="Name, email or code" value="' + esc(S.q) + '" autocomplete="off"></label></div>' +
      '<div class="card flush" data-table><div class="table-wrap"><table class="table"><tbody>' + A.skeletonRows(5, 6) + '</tbody></table></div></div>';

    el.querySelector('[data-reload]').addEventListener('click', function () { A.rerender(); });

    var search = el.querySelector('[data-search]');
    search.addEventListener('input', A.debounce(function () {
      S.q = search.value.trim(); S.limit = PAGE;
      A.replaceParams({ q: S.q });
      if (S.loaded) renderTable();
    }, 200));

    el.querySelector('[data-waiting]').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled || !S.loaded) return;
      var v, w;
      if ((v = b.getAttribute('data-copy')) && (w = findWaiting(v))) return copyBank(w, b);
      if ((v = b.getAttribute('data-pay')) && (w = findWaiting(v))) return settle(w, true);
      if ((v = b.getAttribute('data-reject')) && (w = findWaiting(v))) return settle(w, false);
    });

    el.querySelector('[data-reviews]').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled || !S.loaded) return;
      var v, c;
      if ((v = b.getAttribute('data-rv')) && (c = findReview(v))) return openReview(c);
      if ((v = b.getAttribute('data-order')) && typeof A.openOrder === 'function') return A.openOrder(v);
    });

    el.querySelector('[data-apps]').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled || !S.loaded) return;
      var v, a;
      if ((v = b.getAttribute('data-approve')) && (a = byId(v))) return approve(a, b);
      if ((v = b.getAttribute('data-decline')) && (a = byId(v))) return decline(a);
      if ((v = b.getAttribute('data-open')) && (a = byId(v))) return openDetails(a);
    });

    var table = el.querySelector('[data-table]');
    table.addEventListener('click', function (e) {
      if (!S.loaded) return;
      var b = e.target.closest('[data-block]');
      if (b) { var x = byId(b.getAttribute('data-block')); if (x && !b.disabled) setBlocked(x, b); return; }
      var rv = e.target.closest('[data-review]');
      if (rv) { var y = byId(rv.getAttribute('data-review')); if (y) openDetails(y); return; }
      if (e.target.closest('[data-more]')) { S.limit += PAGE; renderTable(); return; }
      var tr = e.target.closest('tr[data-id]');
      if (tr) { var a = byId(tr.getAttribute('data-id')); if (a) openDetails(a); }
    });
    table.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-id]')) {
        e.preventDefault();
        var a = byId(e.target.getAttribute('data-id'));
        if (a) openDetails(a);
      }
    });

    try {
      await load();
    } catch (e) {
      if (!el.isConnected) return;
      var msg = A.errMessage(e);
      if (/admin_affiliates|withdrawals|schema cache|does not exist/i.test(msg)) msg = 'Affiliates need supabase/affiliates.sql. Run it in the Supabase SQL Editor, then refresh.';
      el.querySelector('[data-tiles]').innerHTML = '';
      el.querySelector('[data-waiting]').hidden = true;
      table.innerHTML = '';
      table.appendChild(A.errorState(msg, function () { A.rerender(); }));
      return;
    }
    if (!el.isConnected) return;
    S.loaded = true;
    renderAll();
  }

  A.registerSection({
    id: 'affiliates', label: 'Affiliates', icon: ICON, order: 6.5, render: render,
    // Applications to review + withdrawals to pay.
    badge: function (st) { return num(st && st.affiliates_pending) + num(st && st.withdrawals_waiting); }
  });
})();

/* U Angel Foods admin — Affiliates.
 * Summary tiles, the withdrawals waiting to be paid (copy bank details, mark as paid, reject),
 * and the affiliates list with search, block / unblock and a details side panel (balances,
 * bank account, recent commissions, withdrawal history).
 * Data contract: supabase/affiliates.sql. Styles: css/manage.css (af- + cu-) + css/categories.css (cg-). */
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
  var HOW = 'Customers who sign up with an affiliate’s code are linked to that affiliate for 12 months. ' +
    'The affiliate earns 5% of the items total of every order those customers pay for (not delivery or Christmas giving packs). ' +
    'Commission is pending until the order is delivered, then becomes withdrawable 7 days later. ' +
    'Affiliates request withdrawals of ₦2,000 or more in the app; you send the money by bank transfer, then mark the request as paid here.';

  var S;

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function nameOf(a) { return (a && (a.name || a.email)) || 'Affiliate'; }
  function initials(a) { return nameOf(a).trim().split(/\s+/).map(function (x) { return x.charAt(0); }).join('').slice(0, 2).toUpperCase() || '?'; }
  function avColor(a) { var h = 0, s = String(a.user_id || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return AV[Math.abs(h) % AV.length]; }
  function byId(id) { return S.rows.find(function (a) { return a.user_id === id; }) || null; }
  function sum(list, key) { return list.reduce(function (s, x) { return s + num(x[key]); }, 0); }
  function statusChip(a) {
    return a.status === 'blocked' ? A.badge('danger', 'Blocked') : A.badge('success', 'Active');
  }
  function commissionChip(c) {
    if (c.status === 'cancelled') return A.badge('cancelled', 'Cancelled');
    if (c.status === 'pending') return A.badge('pending', 'Awaiting delivery');
    if (c.available_at && new Date(c.available_at).getTime() > Date.now()) return A.badge('warn', 'On hold until ' + A.formatDate(c.available_at));
    return A.badge('success', 'Earned');
  }
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
        .eq('status', 'requested').order('created_at', { ascending: true }).limit(500)
    ]);
    S.rows = A.unwrap(r[0]) || [];
    S.waiting = A.unwrap(r[1]) || [];
  }

  async function reload() {
    try { await load(); } catch (e) { A.toast(A.errMessage(e), 'error'); return; }
    if (S.el.isConnected) renderAll();
  }

  /* ---------------- Rendering ---------------- */

  function tilesHtml() {
    var rows = S.rows;
    var active = rows.filter(function (a) { return a.status === 'active'; }).length;
    var blocked = rows.length - active;
    function tile(label, value, sub) { return '<div class="card cu-tile"><span>' + esc(label) + '</span><b>' + esc(value) + '</b><small>' + esc(sub) + '</small></div>'; }
    return tile('Active affiliates', A.formatNumber(active), blocked ? blocked + ' blocked' : rows.length + ' in total') +
      tile('Customers referred', A.formatNumber(sum(rows, 'referrals')), 'signed up with a code') +
      tile('Commission earned', A.formatNaira(sum(rows, 'total_earned')), A.formatNaira(sum(rows, 'pending')) + ' more awaiting delivery') +
      tile('Owed now', A.formatNaira(sum(rows, 'available')), A.formatNaira(sum(rows, 'on_hold')) + ' still on hold (7 days)') +
      tile('Withdrawals waiting', A.formatNumber(S.waiting.length), S.waiting.length ? A.formatNaira(sum(S.waiting, 'amount')) + ' to pay' : 'Nothing to pay');
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
    return '<tr class="clickable" tabindex="0" data-id="' + esc(a.user_id) + '">' +
      '<td class="af-a-who"><div class="cu-who"><span class="cu-av" style="background:' + avColor(a) + '" aria-hidden="true">' + esc(initials(a)) + '</span>' +
        '<span><b>' + esc(nameOf(a)) + '</b></span></div></td>' +
      '<td class="af-a-contact"><div>' + esc(a.email || '—') + '</div>' + (a.phone ? '<div class="cell-sub">' + esc(a.phone) + '</div>' : '') + '</td>' +
      '<td class="af-a-code" data-label="Code"><b class="af-mono">' + esc(a.code) + '</b></td>' +
      '<td class="af-a-st">' + statusChip(a) + '</td>' +
      '<td class="num af-a-n" data-label="Referrals">' + A.formatNumber(num(a.referrals)) + '</td>' +
      '<td class="num af-a-n" data-label="Total earned"><b>' + esc(A.formatNaira(a.total_earned)) + '</b></td>' +
      '<td class="num af-a-n" data-label="Available">' + esc(A.formatNaira(a.available)) + '</td>' +
      '<td class="num af-a-n" data-label="Paid out">' + esc(A.formatNaira(a.withdrawn)) + '</td>' +
      '<td class="nowrap af-a-date" data-label="Joined">' + esc(A.formatDate(a.created_at)) + '</td>' +
      '<td class="af-a-acts"><button type="button" class="btn btn-ghost btn-sm" data-block="' + esc(a.user_id) + '">' + (blocked ? 'Unblock' : 'Block') + '</button></td></tr>';
  }

  function renderTable() {
    var box = S.el.querySelector('[data-table]');
    var list = filtered(), shown = list.slice(0, S.limit);
    if (!list.length) {
      box.innerHTML = S.rows.length ? A.emptyState('No matching affiliates', 'Try a different name, email or code.', I.search)
        : A.emptyState('No affiliates yet', 'Anyone can join the affiliate programme from the app and get a code to share. ' + HOW, I.users);
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
    S.el.querySelector('[data-sub]').textContent = active + ' active affiliate' + (active === 1 ? '' : 's') + ' · ' + S.waiting.length + ' withdrawal' + (S.waiting.length === 1 ? '' : 's') + ' to pay';
    S.el.querySelector('[data-tiles]').innerHTML = tilesHtml();
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
        '<div><b>' + esc(nameOf(a)) + '</b><small>Code <span class="af-mono af-code">' + esc(a.code) + '</span> · ' + statusChip(a) + '</small></div></div>';
    }
    body.innerHTML =
      '<div data-head>' + paintHead() + '</div>' +
      '<div class="cu-actions">' +
        (a.phone ? '<a class="btn btn-ghost btn-sm" href="' + esc(A.waLink(a.phone)) + '" target="_blank" rel="noopener">' + I.whatsapp + 'WhatsApp</a>' +
          '<a class="btn btn-ghost btn-sm" href="' + esc(A.telLink(a.phone)) + '">' + I.phone + 'Call</a>' : '') +
        (a.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(a.email) + '">' + I.mail + 'Email</a>' : '') +
      '</div>' +
      '<p class="cu-note">' + esc([a.phone, a.email].filter(Boolean).join(' · ') || 'No contact details') + ' · Affiliate since ' + esc(A.formatDate(a.created_at)) +
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
      '<div class="cu-adminrow"><div><b>Affiliate account active</b><small>Switch off to block their code, new commission and withdrawals.</small></div>' +
        '<button type="button" class="pp-switch" role="switch" aria-checked="' + (a.status !== 'blocked') + '" data-active aria-label="Affiliate account active"><i></i></button></div>';

    var m = A.modal({
      title: nameOf(a), body: body, className: 'cg-drawer',
      actions: [{ label: 'Close', variant: 'ghost', onClick: function (close) { close(); } }]
    });

    body.querySelector('[data-active]').addEventListener('click', async function () {
      var sw = this;
      sw.disabled = true;
      await setBlocked(a);
      sw.disabled = false;
      sw.setAttribute('aria-checked', String(a.status !== 'blocked'));
      body.querySelector('[data-head]').innerHTML = paintHead();
    });

    var hist = body.querySelector('[data-history]');
    try {
      var r = await Promise.all([
        A.sb.from('commissions').select('id, order_id, base_amount, rate, amount, status, available_at, created_at')
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
              var tag = canOpen ? 'button type="button" data-order="' + esc(c.order_id) + '"' : 'div';
              return '<' + tag + ' class="af-li"><span class="af-li-main">Order #' + esc(A.shortId(c.order_id)) +
                '<small>' + esc(A.formatDate(c.created_at)) + ' · ' + esc(String(Math.round(num(c.rate) * 1000) / 10)) + '% of ' + esc(A.formatNaira(c.base_amount)) + '</small></span>' +
                '<span class="af-li-end"><b>' + esc(A.formatNaira(c.amount)) + '</b>' + commissionChip(c) + '</span></' + (canOpen ? 'button' : 'div') + '>';
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
    S = { el: el, rows: [], waiting: [], q: params.get('q') || '', limit: PAGE };

    el.innerHTML =
      '<div class="page-head"><div><h1>Affiliates</h1><p data-sub>People who share their code and earn commission on the customers they bring.</p></div>' +
        '<div class="actions"><button type="button" class="btn btn-ghost btn-sm" data-reload>' + I.refresh + 'Refresh</button></div></div>' +
      '<p class="pp-note">' + esc(HOW) + '</p>' +
      '<div class="cu-tiles af-tiles" data-tiles>' + A.skeletonBlocks(5, 'cu-sk') + '</div>' +
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

    var table = el.querySelector('[data-table]');
    table.addEventListener('click', function (e) {
      if (!S.loaded) return;
      var b = e.target.closest('[data-block]');
      if (b) { var x = byId(b.getAttribute('data-block')); if (x && !b.disabled) setBlocked(x, b); return; }
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

  A.registerSection({ id: 'affiliates', label: 'Affiliates', icon: ICON, order: 6.5, render: render });
})();

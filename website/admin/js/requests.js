/* U Angel Foods admin — Catering & event requests.
 * Summary tiles, a "coming up" strip of confirmed events, a board (one column per stage) or a
 * list by event date, and a side panel per request: progress, WhatsApp / call / email with
 * ready messages, event details, the quote (vs their budget) and team notes.
 * Styles: css/manage.css (rq-), board pieces from css/insights.css (ob-), drawer from categories.css. */
(function () {
  'use strict';
  var A = window.Admin;
  if (!A || !A.registerSection) return;
  var esc = A.escapeHtml;
  var I = A.icons;
  var DAY = 86400000;
  var STAGES = [
    { id: 'new', label: 'New', hint: 'Call them back', tone: 'orange', next: 'contacted', nextLabel: 'Mark contacted' },
    { id: 'contacted', label: 'Contacted', hint: 'Send a quote', tone: 'blue', next: 'quoted', nextLabel: 'Quote sent' },
    { id: 'quoted', label: 'Quote sent', hint: 'Waiting for a yes', tone: 'purple', next: 'confirmed', nextLabel: 'Confirmed' },
    { id: 'confirmed', label: 'Confirmed', hint: 'Booked, get ready', tone: 'teal', next: 'completed', nextLabel: 'Done' },
    { id: 'completed', label: 'Completed', hint: 'Events in the last 30 days', tone: 'green', next: null }
  ];
  var VIEWS = [['board', 'Board'], ['dates', 'By event date'], ['cancelled', 'Cancelled']];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var S;

  /* ---------------- Helpers ---------------- */

  function stage(id) { return STAGES.find(function (s) { return s.id === id; }); }
  function eventDate(r) { return r.event_date ? new Date(String(r.event_date).slice(0, 10) + 'T12:00:00+01:00') : null; }
  function daysUntil(r) {
    var d = eventDate(r);
    if (!d || isNaN(d.getTime())) return null;
    var today = new Date(A.lagosDateKey(new Date()) + 'T12:00:00+01:00');
    return Math.round((d.getTime() - today.getTime()) / DAY);
  }
  function whenText(n) { return n == null ? '' : n < 0 ? Math.abs(n) + ' day' + (n === -1 ? '' : 's') + ' ago' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days'; }
  function hoursSince(iso) { return (Date.now() - new Date(iso).getTime()) / 3600000; }
  function sentText(iso) { var h = hoursSince(iso); return h < 1 ? Math.max(1, Math.round(h * 60)) + ' min ago' : h < 48 ? Math.round(h) + 'h ago' : Math.round(h / 24) + ' days ago'; }
  function dateParts(r) { var d = eventDate(r); return d ? { wd: WD[d.getUTCDay()], day: d.getUTCDate(), mon: MON[d.getUTCMonth()], year: d.getUTCFullYear() } : null; }
  /** Catering over several days: " → 5 Dec 2027 (1 year)", or '' for one day. */
  function untilText(r) {
    // "Specific dates": list them (first one is already shown as the event date).
    if (r.event_dates && r.event_dates.length > 1) {
      var ds = r.event_dates.map(function (x) { var d = new Date(String(x).slice(0, 10) + 'T12:00:00+01:00'); return WD[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; });
      return ' + ' + (ds.length - 1) + ' more date' + (ds.length === 2 ? '' : 's') + ' (' + ds.slice(1, 7).join(', ') + (ds.length > 7 ? ', …' : '') + ')';
    }
    if (!r.end_date) return '';
    var s = eventDate(r), e = new Date(String(r.end_date).slice(0, 10) + 'T12:00:00+01:00');
    if (!s || isNaN(e.getTime())) return '';
    var days = Math.round((e.getTime() - s.getTime()) / DAY) + 1, len;
    if (days >= 360) { var y = Math.round(days / 365); len = y + ' year' + (y === 1 ? '' : 's'); }
    else if (days >= 28) { var mo = Math.round(days / 30.4); len = mo + ' month' + (mo === 1 ? '' : 's'); }
    else if (days >= 7 && days % 7 === 0) { len = (days / 7) + ' week' + (days === 7 ? '' : 's'); }
    else len = days + ' day' + (days === 1 ? '' : 's');
    return ' → ' + e.getUTCDate() + ' ' + MON[e.getUTCMonth()] + ' ' + e.getUTCFullYear() + ' (' + len + ')';
  }
  function value(r) { return Number(r.quote_amount) || Number(r.budget) || 0; }
  function isOpen(r) { return r.status !== 'completed' && r.status !== 'cancelled'; }
  function shortService(r) { return /cater/i.test(r.service || '') ? 'Catering' : 'Event'; }
  function firstName(r) { return String(r.full_name || '').trim().split(/\s+/)[0] || 'there'; }
  function waUrl(r, text) { var base = A.waLink(r.phone); return base ? base + (text ? '?text=' + encodeURIComponent(text) : '') : ''; }
  function stagePill(id) {
    var s = stage(id);
    return s ? '<span class="rq-pill ' + s.tone + '">' + esc(s.label) + '</span>' : '<span class="rq-pill grey">Cancelled</span>';
  }
  function matches(r) {
    if (S.service && r.service !== S.service) return false;
    var q = S.q.trim().toLowerCase();
    return !q || [r.full_name, r.phone, r.email, r.event_type, r.service, r.city, r.state, r.address].some(function (v) { return v && String(v).toLowerCase().indexOf(q) !== -1; });
  }

  /* ---------------- Data ---------------- */

  async function load() {
    var rows = [], from = 0, step = 1000;
    for (;;) {
      var res = await A.sb.from('service_requests').select('*').order('created_at', { ascending: false }).range(from, from + step - 1);
      if (res.error) throw res.error;
      rows = rows.concat(res.data || []);
      if (!res.data || res.data.length < step) break;
      from += step;
    }
    S.rows = rows;
  }

  /* ---------------- Rendering ---------------- */

  function renderAll() {
    var el = S.el;
    el.querySelector('[data-tiles]').innerHTML = tilesHtml();
    el.querySelector('[data-strip]').innerHTML = stripHtml();
    el.querySelector('[data-views]').innerHTML = VIEWS.map(function (v) {
      return '<button type="button" data-view="' + v[0] + '" aria-pressed="' + (S.view === v[0]) + '">' + esc(v[1]) + '</button>';
    }).join('');
    renderList();
  }

  function tilesHtml() {
    var news = S.rows.filter(function (r) { return r.status === 'new'; });
    var oldest = news.reduce(function (m, r) { return Math.max(m, hoursSince(r.created_at)); }, 0);
    var soon = S.rows.filter(function (r) { var n = daysUntil(r); return r.status === 'confirmed' && n != null && n >= 0 && n <= 30; });
    var open = S.rows.filter(isOpen).reduce(function (s, r) { return s + value(r); }, 0);
    var quoted = S.rows.filter(function (r) { return ['quoted', 'confirmed', 'completed'].indexOf(r.status) !== -1; }).length;
    var won = S.rows.filter(function (r) { return r.status === 'confirmed' || r.status === 'completed'; }).length;
    function tile(label, v, sub, hot) { return '<div class="card cu-tile' + (hot ? ' rq-hot' : '') + '"><span>' + esc(label) + '</span><b>' + esc(v) + '</b><small>' + esc(sub) + '</small></div>'; }
    return tile('New, not called yet', A.formatNumber(news.length), news.length ? 'Oldest waiting ' + sentText(new Date(Date.now() - oldest * 3600000).toISOString()).replace(' ago', '') : 'All caught up', oldest > 24) +
      tile('Events in the next 30 days', A.formatNumber(soon.length), 'Confirmed and booked') +
      tile('Open requests worth', A.formatNaira(open), 'Your quotes, or their budget if not quoted') +
      tile('Quotes accepted', quoted ? Math.round(won / quoted * 100) + '%' : '—', won + ' of ' + quoted + ' quotes became bookings');
  }

  function stripHtml() {
    var list = S.rows.filter(function (r) { var n = daysUntil(r); return r.status === 'confirmed' && n != null && n >= 0 && n <= 30; })
      .sort(function (a, b) { return daysUntil(a) - daysUntil(b); });
    if (!list.length) return '<p class="rq-none">No confirmed events in the next 30 days.</p>';
    return list.map(function (r) {
      var p = dateParts(r), n = daysUntil(r);
      return '<button type="button" class="rq-day' + (n <= 7 ? ' soon' : '') + '" data-open="' + esc(r.id) + '">' +
        '<span class="rq-date"><small>' + esc(p.mon.toUpperCase()) + '</small><b>' + p.day + '</b></span>' +
        '<span class="rq-day-info"><b>' + esc(r.event_type) + '</b><small>' + esc(r.full_name) + ' · ' + A.formatNumber(r.guest_count) + ' guests</small>' +
        '<span class="rq-count' + (n <= 7 ? ' soon' : '') + '">' + esc(whenText(n)) + '</span></span></button>';
    }).join('');
  }

  function renderList() {
    var box = S.el.querySelector('[data-list]');
    if (S.view === 'board') {
      box.innerHTML = '<div class="ob-scroll"><div class="rq-board">' + STAGES.map(function (st) {
        var list = S.rows.filter(function (r) {
          if (r.status !== st.id || !matches(r)) return false;
          if (st.id === 'completed') { var n = daysUntil(r); return n == null || n >= -30; }
          return true;
        });
        list.sort(st.id === 'new'
          ? function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); }
          : function (a, b) { return (daysUntil(a) == null ? 1e9 : daysUntil(a)) - (daysUntil(b) == null ? 1e9 : daysUntil(b)); });
        return '<section class="ob-col" aria-label="' + esc(st.label) + ', ' + list.length + ' requests">' +
          '<div class="ob-col-h"><span class="ob-dot ' + st.tone + '"></span><span>' + esc(st.label) + '<small>' + esc(st.hint) + '</small></span><span class="ob-n">' + list.length + '</span></div>' +
          (list.length ? list.map(cardHtml).join('') : '<p class="ob-empty">' + (S.q || S.service ? 'No matches' : 'Nothing here') + '</p>') + '</section>';
      }).join('') + '</div></div>';
      return;
    }
    var cancelled = S.view === 'cancelled';
    var list = S.rows.filter(function (r) { return matches(r) && (cancelled ? r.status === 'cancelled' : r.status !== 'cancelled'); });
    list.sort(cancelled
      ? function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); }
      : function (a, b) { return String(a.event_date || '').localeCompare(String(b.event_date || '')); });
    if (!list.length) { box.innerHTML = '<div class="card">' + A.emptyState(cancelled ? 'No cancelled requests' : 'No requests match', '', I.calendar) + '</div>'; return; }
    var html = '', last = '';
    list.forEach(function (r) {
      var p = dateParts(r), n = daysUntil(r);
      var month = p ? p.mon + ' ' + p.year : 'No date';
      if (!cancelled && month !== last) { html += '<div class="rq-month">' + esc(month.toUpperCase()) + '</div>'; last = month; }
      html += '<button type="button" class="rq-row" data-open="' + esc(r.id) + '">' +
        '<span class="rq-date' + (n != null && n < 0 ? ' past' : n != null && n <= 7 ? ' soon' : '') + '"><small>' + esc(p ? p.wd.toUpperCase() : '') + '</small><b>' + (p ? p.day : '?') + '</b></span>' +
        '<span class="rq-row-main"><b>' + esc(r.event_type) + ' · ' + esc(r.full_name) + '</b><small>' + A.formatNumber(r.guest_count) + ' guests · ' + esc([r.city, r.state].filter(Boolean).join(', ')) + esc(untilText(r)) + (n != null ? ' · ' + esc(whenText(n)) : '') + '</small></span>' +
        '<span class="rq-row-r">' + stagePill(r.status) + '<b>' + esc(A.formatNaira(value(r))) + '</b></span></button>';
    });
    box.innerHTML = '<div class="card flush rq-cal">' + html + '</div>';
  }

  function cardHtml(r) {
    var st = stage(r.status), n = daysUntil(r), p = dateParts(r);
    var late = r.status === 'new' && hoursSince(r.created_at) > 24;
    var right = r.status === 'new' ? 'Sent ' + sentText(r.created_at) + (late ? ' · call today' : '') : (n != null ? whenText(n) : '');
    return '<article class="rq-card' + (late ? ' late' : '') + '" tabindex="0" data-open="' + esc(r.id) + '" aria-label="' + esc(r.event_type + ', ' + r.full_name) + '">' +
      '<div class="rq-top"><span class="rq-svc ' + (shortService(r) === 'Catering' ? 'cat' : 'ev') + '">' + shortService(r) + '</span><span class="rq-age">' + esc(right) + '</span></div>' +
      '<div><div class="rq-t">' + esc(r.event_type) + '</div><div class="rq-who">' + esc(r.full_name) + (r.city ? ' · ' + esc(r.city) : '') + '</div></div>' +
      '<div class="rq-facts">' + (p ? '<span>📅 ' + esc(p.wd + ' ' + p.day + ' ' + p.mon) + esc(untilText(r)) + (r.event_time ? ', ' + esc(r.event_time.toLowerCase()) : '') + '</span>' : '') + '<span>👥 ' + A.formatNumber(r.guest_count) + ' guests</span>' +
        (n != null && n >= 0 && n <= 14 && isOpen(r) ? '<span class="rq-count soon">' + esc(whenText(n)) + '</span>' : '') + '</div>' +
      '<div class="rq-bot"><span class="rq-money">' + esc(A.formatNaira(value(r))) + '<small>' + (r.quote_amount != null ? 'Quoted' : 'Their budget') + '</small></span>' +
        (st && st.next ? '<button type="button" class="ob-next' + (st.next === 'completed' ? ' green' : '') + '" data-advance="' + esc(r.id) + '">' + esc(st.nextLabel) + ' →</button>' : '<span class="ob-chip done">Done</span>') +
      '</div></article>';
  }

  /* ---------------- Status ---------------- */

  async function setStatus(r, status) {
    if (status === 'cancelled') {
      var ok = await A.confirm('Cancel the ' + (r.event_type || 'event') + ' request from ' + r.full_name + '?\n\nThey will see it as cancelled in the app.',
        { danger: true, title: 'Cancel this request?', confirmLabel: 'Cancel request', cancelLabel: 'Keep' });
      if (!ok) return false;
    }
    var res = await A.sb.from('service_requests').update({ status: status }).eq('id', r.id).select('*');
    var data = res.error ? null : res.data;
    if (res.error || !data || !data.length) { A.toast(res.error ? A.errMessage(res.error) : 'The request wasn’t updated. You may not have permission.', 'error'); return false; }
    Object.assign(r, data[0]);
    A.toast(status === 'cancelled' ? 'Request cancelled' : 'Moved to ' + stage(status).label + '. The customer sees it in the app.', 'success');
    A.refreshBadges();
    if (S && S.el.isConnected) renderAll();
    return true;
  }

  /* ---------------- Detail panel ---------------- */

  function openRequest(r) {
    var body = document.createElement('div');
    body.className = 'cg-form rq-detail';
    var m = A.modal({ title: (r.event_type || 'Request') + ' · ' + (r.full_name || ''), body: body, className: 'cg-drawer', actions: [] });
    var notes = null, notesErr = null;

    function templates() {
      var p = dateParts(r), when = p ? p.day + ' ' + p.mon : 'your date';
      var quote = r.quote_amount != null ? A.formatNaira(r.quote_amount) : '';
      return [
        ['Thanks, we’ll call you', 'Hello ' + firstName(r) + ', this is U Angel Foods. Thank you for your ' + String(r.event_type || 'event').toLowerCase() + ' request for ' + when + '. We’ll call you shortly to go through the details.'],
        ['Here’s your quote', 'Hello ' + firstName(r) + ', here is your quote from U Angel Foods for ' + A.formatNumber(r.guest_count) + ' guests on ' + when + (quote ? ': ' + quote : '') + '. Let us know if you have any questions.'],
        ['See you on the day', 'Hello ' + firstName(r) + ', we’re all set for ' + when + '. Our team will arrive in good time. See you then!']
      ];
    }

    function paint() {
      var st = stage(r.status), idx = STAGES.indexOf(st), n = daysUntil(r), p = dateParts(r);
      var addr = [r.address, r.city, r.state].filter(Boolean).join(', ');
      var perGuest = Number(r.guest_count) ? Number(r.budget) / Number(r.guest_count) : 0;
      body.innerHTML =
        '<div class="rq-sub">' + esc(r.service) + ' · Sent ' + esc(A.formatDateTime(r.created_at)) + ' · ' + stagePill(r.status) + '</div>' +
        (r.status === 'cancelled'
          ? '<div class="cg-warn">This request was cancelled. <button type="button" class="link-btn" data-set="new">Reopen it</button></div>'
          : '<div class="field"><span class="cg-lbl">Progress</span><div class="rq-steps">' + STAGES.map(function (s, i) {
              return '<button type="button" class="rq-step' + (i < idx ? ' done' : i === idx ? ' cur' : '') + '" data-set="' + s.id + '"' + (i === idx ? ' aria-current="step" disabled' : '') + '>' + esc(s.label) + '</button>';
            }).join('') + '</div><span class="cg-help">Tap a step to move the request. The customer sees the status in the app.</span></div>') +
        '<div class="field"><span class="cg-lbl">Get in touch</span><div class="cu-actions">' +
          (r.phone ? '<a class="btn btn-ghost btn-sm" href="' + esc(waUrl(r)) + '" target="_blank" rel="noopener">' + I.whatsapp + 'WhatsApp</a>' +
            '<a class="btn btn-ghost btn-sm" href="' + esc(A.telLink(r.phone)) + '">' + I.phone + 'Call</a>' : '') +
          (r.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(r.email) + '?subject=' + encodeURIComponent('Your ' + (r.event_type || 'event') + ' request – U Angel Foods') + '">' + I.mail + 'Email</a>' : '') +
          '</div><span class="cg-help">' + esc([r.phone, r.email].filter(Boolean).join(' · ')) + '</span>' +
          (r.phone ? '<div class="rq-tpls"><span class="cg-help">Ready WhatsApp messages:</span>' + templates().map(function (t) {
            return '<a class="rq-tpl" href="' + esc(waUrl(r, t[1])) + '" target="_blank" rel="noopener" title="' + esc(t[1]) + '">' + esc(t[0]) + '</a>';
          }).join('') + '</div>' : '') + '</div>' +
        '<dl class="rq-kv">' +
          '<dt>' + (r.end_date || (r.event_dates && r.event_dates.length > 1) ? 'Dates' : 'Event date') + '</dt><dd>' + (p ? esc(p.wd + ', ' + p.day + ' ' + p.mon + ' ' + p.year) + esc(untilText(r)) + (n != null ? ' · <b>' + esc(whenText(n)) + '</b>' : '') : '—') + '</dd>' +
          (r.event_time ? '<dt>Time of day</dt><dd>' + esc(r.event_time) + '</dd>' : '') +
          '<dt>Guests</dt><dd>' + A.formatNumber(r.guest_count) + '</dd>' +
          (r.needs && r.needs.length ? '<dt>They need</dt><dd>' + esc(r.needs.join(', ')) + '</dd>' : '') +
          '<dt>Their budget</dt><dd>' + esc(A.formatNaira(r.budget)) + (perGuest ? ' <span class="cg-help">(' + esc(A.formatNaira(Math.round(perGuest))) + ' per guest)</span>' : '') + '</dd>' +
          '<dt>Venue</dt><dd>' + esc(addr || '—') + (r.venue_type ? ' · ' + esc(r.venue_type.toLowerCase()) : '') + '</dd>' +
          (r.details ? '<dt>Their notes</dt><dd>' + esc(r.details) + '</dd>' : '') +
        '</dl>' +
        '<div class="field"><label class="cg-lbl" for="rq-quote">Your quote</label>' +
          '<div class="rq-quote"><div class="pp-money"><span aria-hidden="true">₦</span><input id="rq-quote" class="input" inputmode="decimal" autocomplete="off" placeholder="Amount you quoted" value="' + (r.quote_amount != null ? esc(String(Number(r.quote_amount))) : '') + '"></div>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-save-quote>Save quote</button></div>' +
          '<span class="rq-cmp" data-cmp></span></div>' +
        '<div class="field"><label class="cg-lbl" for="rq-note">Notes for the team</label>' +
          '<textarea id="rq-note" class="textarea" rows="2" maxlength="2000" placeholder="e.g. Called, wants a tasting on Saturday"></textarea>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-add-note style="align-self:flex-start">Add note</button>' +
          '<div class="rq-notes" data-notes>' + notesHtml() + '</div></div>';
      compare();
      var actions = [];
      if (r.status !== 'cancelled' && r.status !== 'completed') actions.push({ label: 'Cancel request', variant: 'danger', onClick: function () { change('cancelled'); } });
      actions.push({ label: 'Close', variant: 'ghost', onClick: function (close) { close(); } });
      if (st && st.next) actions.push({ label: st.nextLabel, variant: 'primary', onClick: function () { change(st.next); } });
      m.setActions(actions);
    }

    function notesHtml() {
      if (notesErr) return '<p class="cg-help">' + esc(notesErr) + '</p>';
      if (notes === null) return A.skeletonBlocks(2, 'line');
      if (!notes.length) return '<p class="cg-help">No notes yet.</p>';
      return notes.map(function (n) {
        return '<div class="rq-note">' + esc(n.body) + '<small>' + esc(n.author_name || 'Admin') + ' · ' + esc(A.timeAgo(n.created_at)) +
          '<button type="button" class="link-btn" data-del-note="' + esc(n.id) + '">Delete</button></small></div>';
      }).join('');
    }
    function compare() {
      var box = body.querySelector('[data-cmp]'), input = body.querySelector('#rq-quote');
      if (!box || !input) return;
      var v = Number(String(input.value).replace(/[,\s₦]/g, ''));
      var budget = Number(r.budget) || 0;
      box.className = 'rq-cmp';
      if (!input.value.trim() || !isFinite(v)) { box.textContent = ''; return; }
      if (v > budget) { box.textContent = A.formatNaira(v - budget) + ' above their budget'; box.classList.add('over'); }
      else { box.textContent = 'Within their budget'; box.classList.add('ok'); }
    }

    async function change(status) {
      var ok = await setStatus(r, status);
      if (ok && m.isOpen()) { m.setTitle((r.event_type || 'Request') + ' · ' + (r.full_name || '')); paint(); }
    }

    async function loadNotes() {
      var res = await A.sb.from('request_notes').select('id, body, author_name, created_at').eq('request_id', r.id).order('created_at', { ascending: false });
      if (res.error) { notes = []; notesErr = /request_notes/.test(A.errMessage(res.error)) ? 'Notes need the updated supabase/schema.sql. Run it in Supabase to turn them on.' : A.errMessage(res.error); }
      else notes = res.data || [];
      var box = body.querySelector('[data-notes]');
      if (box && m.isOpen()) box.innerHTML = notesHtml();
    }

    body.addEventListener('input', function (e) { if (e.target.id === 'rq-quote') compare(); });
    body.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-set]');
      if (b && !b.disabled) { change(b.getAttribute('data-set')); return; }

      if (e.target.closest('[data-save-quote]')) {
        var btn = e.target.closest('[data-save-quote]'), raw = body.querySelector('#rq-quote').value.replace(/[,\s₦]/g, '');
        var amount = raw ? Number(raw) : null;
        if (amount != null && (!isFinite(amount) || amount < 0)) { A.toast('Enter the quote as a number, e.g. 450000.', 'error'); return; }
        A.setLoading(btn, true, 'Saving…');
        var res = await A.sb.from('service_requests').update({ quote_amount: amount == null ? null : Math.round(amount * 100) / 100 }).eq('id', r.id).select('*');
        A.setLoading(btn, false);
        if (res.error || !res.data || !res.data.length) {
          var msg = res.error ? A.errMessage(res.error) : 'Not saved.';
          A.toast(/quote_amount/.test(msg) ? 'Quotes need the updated supabase/schema.sql. Run it in Supabase first.' : 'Couldn’t save the quote: ' + msg, 'error');
          return;
        }
        Object.assign(r, res.data[0]);
        A.toast(amount == null ? 'Quote removed' : 'Quote saved', 'success');
        if (r.status === 'new' || r.status === 'contacted') {
          if (await A.confirm('Move this request to “Quote sent”?', { confirmLabel: 'Yes, quote sent', cancelLabel: 'Not yet' })) { await change('quoted'); return; }
        }
        renderAll();
        paint();
        return;
      }

      if (e.target.closest('[data-add-note]')) {
        var nb = e.target.closest('[data-add-note]'), ta = body.querySelector('#rq-note'), text = ta.value.trim();
        if (!text) { ta.focus(); return; }
        A.setLoading(nb, true, 'Adding…');
        var ins = await A.sb.from('request_notes')
          .insert({ request_id: r.id, body: text, author_id: A.user && A.user.id, author_name: (A.profile && (A.profile.name || A.profile.email)) || 'Admin' })
          .select('id, body, author_name, created_at').single();
        A.setLoading(nb, false);
        if (ins.error) { A.toast(/request_notes/.test(A.errMessage(ins.error)) ? 'Notes need the updated supabase/schema.sql. Run it in Supabase first.' : 'Couldn’t add the note: ' + A.errMessage(ins.error), 'error'); return; }
        notes = [ins.data].concat(notes || []);
        ta.value = '';
        body.querySelector('[data-notes]').innerHTML = notesHtml();
        return;
      }

      var d = e.target.closest('[data-del-note]');
      if (d) {
        if (!await A.confirm('Delete this note?', { danger: true, confirmLabel: 'Delete note' })) return;
        var del = await A.sb.from('request_notes').delete().eq('id', d.getAttribute('data-del-note'));
        if (del.error) { A.toast('Couldn’t delete: ' + A.errMessage(del.error), 'error'); return; }
        notes = (notes || []).filter(function (n) { return n.id !== d.getAttribute('data-del-note'); });
        body.querySelector('[data-notes]').innerHTML = notesHtml();
      }
    });

    paint();
    loadNotes();
  }

  /* ---------------- Page ---------------- */

  async function loadServices(sel) {
    var names = ['Catering', 'Events & Celebrations'];
    try {
      var res = await A.sb.from('categories').select('name').eq('kind', 'service').is('parent_id', null).order('sort_order', { ascending: true });
      var data = A.unwrap(res) || [];
      if (data.length) names = data.map(function (c) { return c.name; });
    } catch (e) { /* fall back */ }
    if (S.service && names.indexOf(S.service) < 0) names.push(S.service);
    sel.innerHTML = '<option value="">All services</option>' + names.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
    sel.value = S.service;
  }

  function syncUrl() { A.replaceParams({ view: S.view !== 'board' ? S.view : '', service: S.service, q: S.q }); }

  async function render(el, params) {
    params = params || A.getParams();
    var view = params.get('view');
    // Old links (?status=new) still work: they open the board.
    S = { el: el, rows: [], view: VIEWS.some(function (v) { return v[0] === view; }) ? view : (params.get('status') === 'cancelled' ? 'cancelled' : 'board'),
          service: params.get('service') || '', q: params.get('q') || '' };

    el.innerHTML =
      '<div class="page-head"><div><h1>Catering &amp; event requests</h1><p>Call back, send a quote, and track every event to the day.</p></div>' +
        '<div class="actions"><div class="ob-views rq-views" role="group" aria-label="View" data-views></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-reload>' + I.refresh + 'Refresh</button></div></div>' +
      '<div class="cu-tiles" data-tiles>' + A.skeletonBlocks(4, 'cu-sk') + '</div>' +
      '<section class="rq-coming" aria-labelledby="rq-coming-h"><div class="db-sec-h"><h2 id="rq-coming-h">Coming up</h2><span>Confirmed events, soonest first</span></div>' +
        '<div class="rq-strip" data-strip></div></section>' +
      '<div class="toolbar"><label class="search"><span class="sr-only">Search requests</span>' + I.search +
        '<input class="input" type="search" data-search placeholder="Name, phone, event or area" value="' + esc(S.q) + '" autocomplete="off"></label>' +
        '<select class="select" data-service aria-label="Service"><option value="">All services</option></select></div>' +
      '<div data-list>' + A.skeletonBlocks(3, 'block') + '</div>';

    var search = el.querySelector('[data-search]'), svc = el.querySelector('[data-service]');
    loadServices(svc);
    search.addEventListener('input', A.debounce(function () { S.q = search.value.trim(); syncUrl(); if (S.loaded) renderList(); }, 200));
    svc.addEventListener('change', function () { S.service = svc.value; syncUrl(); if (S.loaded) renderList(); });
    el.querySelector('[data-reload]').addEventListener('click', function () { A.rerender(); });
    el.querySelector('[data-views]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-view]');
      if (!b || !S.loaded) return;
      S.view = b.getAttribute('data-view'); syncUrl(); renderAll();
    });
    el.addEventListener('click', async function (e) {
      var a = e.target.closest('[data-advance]');
      if (a) {
        e.stopPropagation();
        var r = S.rows.find(function (x) { return x.id === a.getAttribute('data-advance'); });
        var st = r && stage(r.status);
        if (st && st.next) { a.disabled = true; a.textContent = 'Saving…'; if (!(await setStatus(r, st.next))) renderAll(); }
        return;
      }
      var o = e.target.closest('[data-open]');
      if (o) { var row = S.rows.find(function (x) { return x.id === o.getAttribute('data-open'); }); if (row) openRequest(row); }
    });
    el.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('article[data-open]')) {
        e.preventDefault();
        var row = S.rows.find(function (x) { return x.id === e.target.getAttribute('data-open'); });
        if (row) openRequest(row);
      }
    });

    var reloadSoon = A.debounce(async function () {
      if (!el.isConnected) return;
      try { await load(); if (el.isConnected) renderAll(); } catch (e) { /* keep what we have */ }
    }, 800);
    var onLive = function (e) {
      if (!el.isConnected) { window.removeEventListener('admin:realtime', onLive); return; }
      if (e.detail && e.detail.table === 'service_requests') reloadSoon();
    };
    window.addEventListener('admin:realtime', onLive);

    try {
      await load();
    } catch (e) {
      var box = el.querySelector('[data-list]');
      box.innerHTML = '';
      box.appendChild(A.errorState(A.errMessage(e), function () { A.rerender(); }));
      el.querySelector('[data-tiles]').innerHTML = '';
      return;
    }
    if (!el.isConnected) return;
    S.loaded = true;
    renderAll();
    var reqParam = params.get('request');
    if (reqParam) {
      var r = S.rows.find(function (x) { return x.id === reqParam; });
      if (r) openRequest(r); else A.toast('That request wasn’t found.', 'error');
    }
  }

  A.registerSection({ id: 'requests', label: 'Requests', icon: I.party, order: 3, render: render });
})();

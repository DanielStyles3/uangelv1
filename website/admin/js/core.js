/*
 * U Angel Foods — Admin core.
 * Creates window.Admin (Supabase client, auth, shell, router, UI helpers).
 * Section scripts (loaded after this file) call Admin.registerSection(...).
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://rembodejacmfbeohvmhl.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_gQ92ZGE8a1mKL3SLLWB0Dw_knNnJDVg';
  var TZ = 'Africa/Lagos';
  var BUCKET = 'catalog';

  var Admin = window.Admin = window.Admin || {};
  Admin.SUPABASE_URL = SUPABASE_URL;
  Admin.TZ = TZ;
  Admin.user = null;
  Admin.profile = null;
  Admin.stats = null;

  // ---------------------------------------------------------------------------
  // Supabase client (created immediately so section files can read Admin.sb)
  // ---------------------------------------------------------------------------
  try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      Admin.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    } else {
      Admin.sb = null;
    }
  } catch (e) {
    Admin.sb = null;
  }

  // ---------------------------------------------------------------------------
  // Small DOM utils
  // ---------------------------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Create an element from an HTML string (first element). */
  function h(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms == null ? 250 : ms);
    };
  }

  // ---------------------------------------------------------------------------
  // Icons (inline SVG strings, 24x24 stroke icons)
  // ---------------------------------------------------------------------------
  function svg(paths, extra) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' + (extra || '') + '>' + paths + '</svg>';
  }
  var icons = {
    home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>'),
    dashboard: svg('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>'),
    bag: svg('<path d="M6 7h12l1 13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1L6 7z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/>'),
    inbox: svg('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    box: svg('<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>'),
    grid: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    tag: svg('<path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
    users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    money: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'),
    chart: svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    truck: svg('<path d="M1 4h14v12H1z"/><path d="M15 9h4l3 3v4h-7"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>'),
    trash: svg('<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>'),
    refresh: svg('<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'),
    phone: svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>'),
    whatsapp: svg('<path d="M3 21l1.65-4.95A8.5 8.5 0 1 1 8 19.5L3 21z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2L9 9.5z"/>'),
    mail: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>'),
    map: svg('<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
    image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
    upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>'),
    external: svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>'),
    alert: svg('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'),
    chevronRight: svg('<path d="m9 18 6-6-6-6"/>'),
    chevronDown: svg('<path d="m6 9 6 6 6-6"/>'),
    arrowLeft: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
    filter: svg('<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>'),
    logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
    star: svg('<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'),
    party: svg('<path d="M5.8 11.3 2 22l10.7-3.8"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="M11 13 9 11c-.7-.7-1.9-.3-2.1.7L5.8 11.3"/>'),
    chef: svg('<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6z"/><path d="M6 17h12"/>')
  };
  Admin.icons = icons;

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------
  function formatNaira(n) {
    var v = Number(n);
    if (n === null || n === undefined || n === '' || !isFinite(v)) v = 0;
    var kobo = Math.round(Math.abs(v) * 100) % 100 !== 0;
    var s = Math.abs(v).toLocaleString('en-NG', {
      minimumFractionDigits: kobo ? 2 : 0,
      maximumFractionDigits: kobo ? 2 : 0
    });
    return (v < 0 ? '-' : '') + '₦' + s;
  }
  function formatNumber(n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    return v.toLocaleString('en-NG');
  }
  function toDate(iso) {
    if (!iso) return null;
    var d;
    if (iso instanceof Date) d = iso;
    // Plain dates (event_date) are calendar days: anchor at Lagos noon so they never shift.
    else if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) d = new Date(iso + 'T12:00:00+01:00');
    else d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  function formatDate(iso) {
    var d = toDate(iso);
    if (!d) return '—';
    return d.toLocaleDateString('en-NG', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
  }
  function formatTime(iso) {
    var d = toDate(iso);
    if (!d) return '—';
    return d.toLocaleTimeString('en-NG', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
  }
  function formatDateTime(iso) {
    var d = toDate(iso);
    if (!d) return '—';
    return formatDate(d) + ', ' + formatTime(d);
  }
  /** "YYYY-MM-DD" of the given date in Africa/Lagos. */
  function lagosDateKey(iso) {
    var d = toDate(iso || new Date());
    if (!d) return '';
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return o.year + '-' + o.month + '-' + o.day;
  }
  /** Date object for 00:00 Lagos time, `offsetDays` days from today (negative = past). Lagos is UTC+1, no DST. */
  function startOfLagosDay(offsetDays) {
    var key = lagosDateKey(new Date());
    var d = new Date(key + 'T00:00:00+01:00');
    d.setTime(d.getTime() + (offsetDays || 0) * 86400000);
    return d;
  }
  function timeAgo(iso) {
    var d = toDate(iso);
    if (!d) return '—';
    var s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 45) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    var hr = Math.round(m / 60);
    if (hr < 24) return hr + (hr === 1 ? ' hr ago' : ' hrs ago');
    var days = Math.round(hr / 24);
    if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
    return formatDate(d);
  }
  function shortId(id) { return id ? String(id).slice(0, 8).toUpperCase() : ''; }

  Admin.formatNaira = formatNaira;
  Admin.formatNumber = formatNumber;
  Admin.formatDate = formatDate;
  Admin.formatTime = formatTime;
  Admin.formatDateTime = formatDateTime;
  Admin.timeAgo = timeAgo;
  Admin.lagosDateKey = lagosDateKey;
  Admin.startOfLagosDay = startOfLagosDay;
  Admin.shortId = shortId;
  Admin.escapeHtml = escapeHtml;
  Admin.debounce = debounce;
  Admin.h = h;
  Admin.$ = $;
  Admin.$all = $all;

  // ---------------------------------------------------------------------------
  // Status labels & badges
  // ---------------------------------------------------------------------------
  var STATUS_LABELS = {
    awaiting_payment: 'Awaiting payment',
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    on_the_way: 'On the way',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    'new': 'New',
    contacted: 'Contacted',
    quoted: 'Quoted',
    completed: 'Completed',
    paid: 'Paid',
    unpaid: 'Unpaid',
    failed: 'Failed',
    refunded: 'Refunded',
    paystack: 'Paystack',
    pay_on_delivery: 'Pay on delivery (delivery fee via Paystack)',
    cash: 'Cash on delivery',
    transfer: 'Bank transfer'
  };
  Admin.STATUS_LABELS = STATUS_LABELS;
  Admin.ORDER_STATUSES = ['awaiting_payment', 'pending', 'confirmed', 'preparing', 'on_the_way', 'delivered', 'cancelled'];
  Admin.PAYMENT_STATUSES = ['unpaid', 'paid', 'failed', 'refunded'];
  Admin.REQUEST_STATUSES = ['new', 'contacted', 'quoted', 'confirmed', 'completed', 'cancelled'];

  function statusLabel(s) {
    if (!s) return '—';
    return STATUS_LABELS[s] || String(s).replace(/_/g, ' ').replace(/^\w/, function (c) { return c.toUpperCase(); });
  }
  /** Badge HTML for any order / request / payment status. */
  function badge(status, label) {
    var cls = String(status || 'neutral').replace(/[^a-z0-9_-]/gi, '');
    return '<span class="badge badge-' + cls + '">' + escapeHtml(label || statusLabel(status)) + '</span>';
  }
  Admin.statusLabel = statusLabel;
  Admin.badge = badge;
  Admin.statusBadge = badge;
  Admin.paymentBadge = badge;

  // ---------------------------------------------------------------------------
  // Contact links
  // ---------------------------------------------------------------------------
  function phoneDigits(phone) { return String(phone || '').replace(/\D/g, ''); }
  /** WhatsApp link: digits only, Nigerian local numbers (0XXXXXXXXXX) converted to 234XXXXXXXXXX. */
  function waLink(phone) {
    var d = phoneDigits(phone);
    if (!d) return '';
    if (d.length === 11 && d.charAt(0) === '0') d = '234' + d.slice(1);
    return 'https://wa.me/' + d;
  }
  function telLink(phone) {
    var p = String(phone || '').replace(/[^\d+]/g, '');
    return p ? 'tel:' + p : '';
  }
  Admin.waLink = waLink;
  Admin.telLink = telLink;
  /** Buttons row: call / WhatsApp / email. */
  Admin.contactLinks = function (phone, email) {
    var out = [];
    if (phone) {
      out.push('<a class="btn btn-ghost btn-sm" href="' + escapeHtml(telLink(phone)) + '">' + icons.phone + 'Call</a>');
      out.push('<a class="btn btn-ghost btn-sm" href="' + escapeHtml(waLink(phone)) + '" target="_blank" rel="noopener">' + icons.whatsapp + 'WhatsApp</a>');
    }
    if (email) out.push('<a class="btn btn-ghost btn-sm" href="mailto:' + escapeHtml(email) + '">' + icons.mail + 'Email</a>');
    return out.length ? '<div class="contact-links">' + out.join('') + '</div>' : '';
  };

  // ---------------------------------------------------------------------------
  // States: skeleton, empty, error
  // ---------------------------------------------------------------------------
  Admin.skeletonRows = function (rows, cols) {
    var out = '';
    for (var r = 0; r < (rows || 5); r++) {
      out += '<tr aria-hidden="true">';
      for (var c = 0; c < (cols || 4); c++) {
        out += '<td><span class="skeleton line" style="width:' + (40 + ((r * 7 + c * 13) % 50)) + '%"></span></td>';
      }
      out += '</tr>';
    }
    return out;
  };
  Admin.skeletonBlocks = function (n, cls) {
    var out = '';
    for (var i = 0; i < (n || 3); i++) out += '<div class="skeleton ' + (cls || 'block') + '" aria-hidden="true"></div>';
    return out;
  };
  Admin.emptyState = function (title, text, icon) {
    return '<div class="empty">' + (icon || icons.inbox) +
      '<h3>' + escapeHtml(title || 'Nothing here yet') + '</h3>' +
      (text ? '<p>' + escapeHtml(text) + '</p>' : '') + '</div>';
  };
  Admin.errorState = function (message, onRetry) {
    var el = h('<div class="error-box" role="alert">' + icons.alert +
      '<div><strong>Something went wrong</strong><div class="small">' + escapeHtml(message || 'Please try again.') + '</div></div></div>');
    if (onRetry) {
      var b = h('<button type="button" class="btn btn-ghost btn-sm">' + icons.refresh + 'Try again</button>');
      b.addEventListener('click', onRetry);
      el.appendChild(b);
    }
    return el;
  };

  /** Turn a Supabase / JS error into a readable sentence. */
  function errMessage(err) {
    if (!err) return 'Something went wrong. Please try again.';
    var m = typeof err === 'string' ? err : (err.message || err.error_description || err.msg || String(err));
    if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Network error. Check your internet connection and try again.';
    if (/jwt expired|invalid jwt|refresh token/i.test(m)) return 'Your session has expired. Please sign in again.';
    if (/admins only|permission denied|row-level security/i.test(m)) return 'You don’t have permission to do that.';
    return m;
  }
  Admin.errMessage = errMessage;

  /** Throws a readable Error if a Supabase response has an error; returns data. */
  Admin.unwrap = function (res) {
    if (res && res.error) throw new Error(errMessage(res.error));
    return res ? res.data : null;
  };

  /** Put a button in a loading state (or restore it). */
  Admin.setLoading = function (btn, loading, text) {
    if (!btn) return;
    if (loading) {
      if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + escapeHtml(text || 'Working…');
    } else {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      if (btn.dataset.label) { btn.innerHTML = btn.dataset.label; delete btn.dataset.label; }
    }
  };

  // ---------------------------------------------------------------------------
  // Toasts
  // ---------------------------------------------------------------------------
  function toast(message, type, opts) {
    type = type || 'success';
    var box = $('#toasts');
    if (!box) return;
    var el = h('<div class="toast toast-' + escapeHtml(type) + '" role="' + (type === 'error' ? 'alert' : 'status') + '">' +
      '<span class="dot" aria-hidden="true"></span><span class="msg"></span>' +
      '<button type="button" aria-label="Dismiss">×</button></div>');
    $('.msg', el).textContent = String(message == null ? '' : message);
    var remove = function () {
      if (!el.isConnected) return;
      el.classList.add('leaving');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    };
    $('button', el).addEventListener('click', remove);
    box.appendChild(el);
    while (box.children.length > 4) box.removeChild(box.firstElementChild);
    setTimeout(remove, (opts && opts.duration) || (type === 'error' ? 6500 : 3800));
  }
  Admin.toast = toast;

  // ---------------------------------------------------------------------------
  // Modal & confirm
  // ---------------------------------------------------------------------------
  var modalStack = [];
  function modal(opts) {
    opts = opts || {};
    var previousFocus = document.activeElement;
    var titleId = 'modal-title-' + Math.random().toString(36).slice(2, 8);
    // Confirm dialogs render as a bottom sheet on phones; everything else as a full-screen sheet (see admin.css).
    var overlay = h('<div class="modal-overlay' + (/\bmodal-confirm\b/.test(opts.className || '') ? ' is-sheet' : '') + '"></div>');
    var dlg = h('<div class="modal' + (opts.wide ? ' wide' : '') + (opts.className ? ' ' + escapeHtml(opts.className) : '') +
      '" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="' + titleId + '">' +
      '<div class="modal-head"><h2 id="' + titleId + '"></h2>' +
      '<button type="button" class="icon-btn" data-close aria-label="Close">' + icons.x + '</button></div>' +
      '<div class="modal-body"></div></div>');
    $('h2', dlg).textContent = opts.title || '';
    var bodyEl = $('.modal-body', dlg);
    if (opts.body instanceof Node) bodyEl.appendChild(opts.body);
    else if (opts.body != null) bodyEl.innerHTML = String(opts.body);

    var closed = false;
    var api = { el: dlg, body: bodyEl, overlay: overlay };
    function close(result) {
      if (closed) return;
      closed = true;
      var i = modalStack.indexOf(api);
      if (i >= 0) modalStack.splice(i, 1);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (!modalStack.length) document.body.classList.remove('modal-open');
      if (previousFocus && previousFocus.focus && previousFocus.isConnected) {
        try { previousFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
      if (typeof opts.onClose === 'function') {
        try { opts.onClose(result); } catch (e) { console.warn(e); }
      }
    }
    api.close = close;
    api.isOpen = function () { return !closed; };
    api.setTitle = function (t) { $('h2', dlg).textContent = t || ''; };

    api.setActions = function (actions) {
      var old = $('.modal-actions', dlg);
      if (old) old.parentNode.removeChild(old);
      if (!actions || !actions.length) return;
      var bar = h('<div class="modal-actions"></div>');
      actions.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-' + (a.variant || 'ghost');
        b.innerHTML = (a.icon || '') + escapeHtml(a.label || 'OK');
        if (a.disabled) b.disabled = true;
        b.addEventListener('click', function () {
          if (typeof a.onClick !== 'function') { close(); return; }
          var r;
          try { r = a.onClick(close, b); } catch (e) { toast(errMessage(e), 'error'); return; }
          if (r && typeof r.then === 'function') {
            Admin.setLoading(b, true, a.loadingLabel || 'Working…');
            r.then(function () { Admin.setLoading(b, false); }, function (e) {
              Admin.setLoading(b, false);
              toast(errMessage(e), 'error');
            });
          }
        });
        bar.appendChild(b);
      });
      dlg.appendChild(bar);
    };
    api.setActions(opts.actions);

    $('[data-close]', dlg).addEventListener('click', function () { close(); });
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay && opts.dismissible !== false) close();
    });
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    modalStack.push(api);

    // Focus first form control, else the dialog's close button.
    setTimeout(function () {
      var f = $('[autofocus]', bodyEl) || $('input:not([type=hidden]):not([disabled]), select, textarea', bodyEl) || dlg;
      if (f) try { f.focus(); } catch (e) { /* ignore */ }
    }, 30);
    return api;
  }
  Admin.modal = modal;
  Admin.closeAllModals = function () {
    modalStack.slice().forEach(function (m) { m.close(); });
  };

  function confirmDialog(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var answered = false;
      var body = opts.html ? String(message) : '<p style="white-space:pre-line">' + escapeHtml(message) + '</p>';
      modal({
        title: opts.title || (opts.danger ? 'Are you sure?' : 'Please confirm'),
        body: body,
        className: 'modal-confirm',
        onClose: function () { if (!answered) resolve(false); },
        actions: [
          { label: opts.cancelLabel || 'Cancel', variant: 'ghost', onClick: function (close) { answered = true; resolve(false); close(); } },
          { label: opts.confirmLabel || (opts.danger ? 'Delete' : 'Confirm'), variant: opts.danger ? 'danger' : 'primary',
            onClick: function (close) { answered = true; resolve(true); close(); } }
        ]
      });
    });
  }
  Admin.confirm = confirmDialog;

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (modalStack.length) {
        e.preventDefault();
        modalStack[modalStack.length - 1].close();
      } else if (document.body.classList.contains('nav-open')) {
        closeNav();
      }
    } else if (e.key === 'Tab' && modalStack.length) {
      // Keep focus inside the top-most dialog.
      var dlg = modalStack[modalStack.length - 1].el;
      var f = $all('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', dlg)
        .filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ---------------------------------------------------------------------------
  // Storage upload
  // ---------------------------------------------------------------------------
  var IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  Admin.uploadImage = function (file, folder) {
    return Promise.resolve().then(function () {
      if (!Admin.sb) throw new Error('Not connected to Supabase.');
      if (!file) throw new Error('Choose an image first.');
      var ext = IMAGE_TYPES[String(file.type || '').toLowerCase()];
      if (!ext) throw new Error('Please choose a JPG, PNG or WebP image.');
      if (file.size > 5 * 1024 * 1024) throw new Error('Image is too large (max 5 MB).');
      var base = String(file.name || 'image').replace(/\.[^.]+$/, '');
      var slug = base.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'image';
      var dir = String(folder || 'uploads').replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9/_-]/g, '-') || 'uploads';
      var path = dir + '/' + Date.now() + '-' + slug + '.' + ext;
      return Admin.sb.storage.from(BUCKET).upload(path, file, {
        contentType: file.type, cacheControl: '31536000', upsert: false
      }).then(function (res) {
        if (res.error) throw new Error(errMessage(res.error));
        var pub = Admin.sb.storage.from(BUCKET).getPublicUrl(path);
        return (pub && pub.data && pub.data.publicUrl) || (SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path);
      });
    });
  };

  // ---------------------------------------------------------------------------
  // Shared data helpers
  // ---------------------------------------------------------------------------
  var profileCache = new Map();
  /** Fetch profiles (id, name, email, phone) for the given user ids. Returns Map id → profile. */
  Admin.fetchProfiles = function (ids) {
    var unique = Array.from(new Set((ids || []).filter(Boolean)));
    var missing = unique.filter(function (id) { return !profileCache.has(id); });
    var chunks = [];
    for (var i = 0; i < missing.length; i += 100) chunks.push(missing.slice(i, i + 100));
    return Promise.all(chunks.map(function (chunk) {
      return Admin.sb.from('profiles').select('id, name, email, phone').in('id', chunk).then(function (res) {
        if (res.error) throw new Error(errMessage(res.error));
        (res.data || []).forEach(function (p) { profileCache.set(p.id, p); });
      });
    })).then(function () {
      var m = new Map();
      unique.forEach(function (id) { if (profileCache.has(id)) m.set(id, profileCache.get(id)); });
      return m;
    });
  };
  Admin.clearProfileCache = function () { profileCache.clear(); };

  // ---------------------------------------------------------------------------
  // Sections & router
  // ---------------------------------------------------------------------------
  var sections = {};
  var BADGE_KEYS = { orders: 'orders_to_fulfil', requests: 'requests_new' };
  var appShown = false;
  var renderSeq = 0;

  Admin.registerSection = function (def) {
    try {
      if (!def || !def.id || typeof def.render !== 'function') {
        console.warn('Admin.registerSection: invalid section', def);
        return;
      }
      sections[def.id] = {
        id: String(def.id),
        label: def.label || def.id,
        icon: def.icon || icons.grid,
        order: typeof def.order === 'number' ? def.order : 99,
        render: def.render,
        badge: def.badge
      };
      if (appShown) {
        buildNav();
        if (parseHash().id === def.id) renderRoute();
      }
    } catch (e) {
      console.warn('Admin.registerSection failed', e);
    }
  };
  Admin.getSections = function () { return sortedSections().slice(); };

  function sortedSections() {
    return Object.keys(sections).map(function (k) { return sections[k]; })
      .sort(function (a, b) { return a.order - b.order || a.label.localeCompare(b.label); });
  }

  function parseHash() {
    var raw = (location.hash || '').replace(/^#/, '');
    if (raw.charAt(0) !== '/') return { id: '', params: new URLSearchParams() };
    raw = raw.slice(1);
    var q = raw.indexOf('?');
    var id = q >= 0 ? raw.slice(0, q) : raw;
    var params = new URLSearchParams(q >= 0 ? raw.slice(q + 1) : '');
    return { id: decodeURIComponent(id.replace(/\/+$/, '')), params: params };
  }
  function buildHash(id, params) {
    var qs = '';
    if (params) {
      var sp = params instanceof URLSearchParams ? params : new URLSearchParams();
      if (!(params instanceof URLSearchParams)) {
        Object.keys(params).forEach(function (k) {
          if (params[k] !== undefined && params[k] !== null && params[k] !== '') sp.set(k, params[k]);
        });
      }
      qs = sp.toString();
    }
    return '#/' + encodeURIComponent(id) + (qs ? '?' + qs : '');
  }
  /** Current route params (URLSearchParams). */
  Admin.getParams = function () { return parseHash().params; };
  Admin.currentSection = function () { return parseHash().id; };

  /** Navigate to a section; optional params object → hash query (#/orders?customer=…). */
  Admin.navigate = function (id, params) {
    var target = buildHash(id, params);
    if (location.hash === target) renderRoute();
    else location.hash = target;
  };
  /** Change the current route's query without re-rendering. */
  Admin.replaceParams = function (params) {
    var target = buildHash(parseHash().id || defaultSectionId(), params);
    try { history.replaceState(null, '', target); } catch (e) { /* ignore */ }
  };

  function defaultSectionId() {
    if (sections.dashboard) return 'dashboard';
    var s = sortedSections()[0];
    return s ? s.id : 'dashboard';
  }

  function buildNav() {
    var nav = $('#nav');
    if (!nav) return;
    var current = parseHash().id;
    nav.innerHTML = sortedSections().map(function (s) {
      return '<a href="#/' + escapeHtml(encodeURIComponent(s.id)) + '" data-id="' + escapeHtml(s.id) + '"' +
        (s.id === current ? ' class="active" aria-current="page"' : '') + '>' +
        s.icon + '<span>' + escapeHtml(s.label) + '</span>' +
        '<span class="nav-badge" data-badge-for="' + escapeHtml(s.id) + '" hidden></span></a>';
    }).join('');
    if (Admin.stats) applyBadges(Admin.stats);
  }

  function setActive(id) {
    $all('#nav a').forEach(function (a) {
      var on = a.getAttribute('data-id') === id;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function renderRoute() {
    if (!appShown) return;
    var r = parseHash();
    if (!r.id) {
      try { history.replaceState(null, '', buildHash(defaultSectionId())); } catch (e) { /* ignore */ }
      r = parseHash();
    }
    var sec = sections[r.id];
    var content = $('#content');
    content.innerHTML = ''; // detach the old section first so its modal onClose handlers see it as gone
    Admin.closeAllModals();
    closeNav();
    setActive(r.id);
    var title = sec ? sec.label : 'Not found';
    $('#topbar-title').textContent = title;
    document.title = title + ' · U Angel Admin';

    var el = document.createElement('div');
    el.className = 'section section-' + r.id.replace(/[^a-z0-9_-]/gi, '');
    content.appendChild(el);
    window.scrollTo(0, 0);
    var seq = ++renderSeq;

    if (!sec) {
      el.innerHTML = '<div class="card">' + Admin.emptyState('Section not available',
        'This part of the admin isn’t available right now.', icons.alert) +
        '<div class="row" style="justify-content:center;padding-bottom:20px"><a class="btn btn-primary" href="#/' +
        escapeHtml(defaultSectionId()) + '">Go to dashboard</a></div></div>';
      return;
    }
    var onErr = function (e) {
      console.warn('Section "' + r.id + '" failed to render:', e);
      if (seq !== renderSeq || !el.isConnected) return;
      el.innerHTML = '';
      el.appendChild(Admin.errorState(errMessage(e), function () { renderRoute(); }));
    };
    try {
      var p = sec.render(el, r.params);
      if (p && typeof p.then === 'function') p.then(null, onErr);
    } catch (e) { onErr(e); }
  }
  Admin.rerender = renderRoute;
  window.addEventListener('hashchange', function () { if (appShown) renderRoute(); });

  // ---------------------------------------------------------------------------
  // Badges
  // ---------------------------------------------------------------------------
  function applyBadges(stats) {
    var total = 0;
    $all('[data-badge-for]').forEach(function (b) {
      var id = b.getAttribute('data-badge-for');
      var sec = sections[id];
      var n = 0;
      if (sec && typeof sec.badge === 'function') { try { n = Number(sec.badge(stats)) || 0; } catch (e) { n = 0; } }
      else if (BADGE_KEYS[id]) n = Number(stats && stats[BADGE_KEYS[id]]) || 0;
      if (n > 0) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = false; total += n; }
      else b.hidden = true;
      b.setAttribute('aria-label', n + ' pending');
    });
    var tb = $('#topbar-badge');
    if (tb) { tb.hidden = total <= 0; tb.textContent = total > 99 ? '99+' : String(total); tb.setAttribute('aria-label', total + ' items need attention'); }
  }

  var badgesInFlight = null;
  /** Re-fetch admin_stats() and update the sidebar counts. Resolves with the stats (or null). */
  Admin.refreshBadges = function () {
    if (!Admin.sb || !Admin.user) return Promise.resolve(null);
    if (badgesInFlight) return badgesInFlight;
    badgesInFlight = Admin.sb.rpc('admin_stats').then(function (res) {
      badgesInFlight = null;
      if (res.error) { console.warn('admin_stats failed:', res.error.message); return null; }
      Admin.stats = res.data || {};
      applyBadges(Admin.stats);
      try { window.dispatchEvent(new CustomEvent('admin:stats', { detail: Admin.stats })); } catch (e) { /* ignore */ }
      return Admin.stats;
    }, function (e) {
      badgesInFlight = null;
      console.warn('admin_stats failed:', e);
      return null;
    });
    return badgesInFlight;
  };
  var badgesSoon = debounce(function () { Admin.refreshBadges(); }, 600);

  // ---------------------------------------------------------------------------
  // Realtime (optional; RLS decides what comes through)
  // ---------------------------------------------------------------------------
  var channel = null;
  var pollTimer = null;
  function emit(detail) {
    try { window.dispatchEvent(new CustomEvent('admin:realtime', { detail: detail })); } catch (e) { /* ignore */ }
  }
  function startRealtime() {
    stopRealtime();
    pollTimer = setInterval(function () { if (!document.hidden) Admin.refreshBadges(); }, 60000);
    try {
      channel = Admin.sb.channel('admin-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, function (p) {
          badgesSoon();
          toast('New order received', 'info');
          emit({ table: 'orders', type: 'INSERT', record: p && p['new'] });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, function (p) {
          badgesSoon();
          emit({ table: 'orders', type: 'UPDATE', record: p && p['new'] });
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_requests' }, function (p) {
          badgesSoon();
          toast('New catering / event request', 'info');
          emit({ table: 'service_requests', type: 'INSERT', record: p && p['new'] });
        })
        .subscribe();
    } catch (e) {
      channel = null;
    }
  }
  function stopRealtime() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (channel) {
      try { Admin.sb.removeChannel(channel); } catch (e) { /* ignore */ }
      channel = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Mobile nav
  // ---------------------------------------------------------------------------
  function openNav() {
    document.body.classList.add('nav-open');
    var b = $('#nav-open'); if (b) b.setAttribute('aria-expanded', 'true');
    var first = $('#nav a'); if (first) first.focus();
  }
  function closeNav() {
    if (!document.body.classList.contains('nav-open')) return;
    document.body.classList.remove('nav-open');
    var b = $('#nav-open'); if (b) b.setAttribute('aria-expanded', 'false');
  }

  // ---------------------------------------------------------------------------
  // Horizontal-scroll hint for wide tables: .scroll-l / .scroll-r on .table-wrap
  // when there is more content to that side (styled as edge shadows).
  // ---------------------------------------------------------------------------
  function updateScrollHint(w) {
    var max = w.scrollWidth - w.clientWidth;
    w.classList.toggle('scroll-l', max > 2 && w.scrollLeft > 2);
    w.classList.toggle('scroll-r', max > 2 && w.scrollLeft < max - 2);
  }
  function updateScrollHints() { $all('.table-wrap').forEach(updateScrollHint); }
  var scrollHintsSoon = debounce(updateScrollHints, 120);
  document.addEventListener('scroll', function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('table-wrap')) updateScrollHint(t);
  }, true);
  window.addEventListener('resize', scrollHintsSoon);
  if (window.MutationObserver) {
    new MutationObserver(scrollHintsSoon).observe(document.documentElement, { childList: true, subtree: true });
  }
  Admin.updateScrollHints = updateScrollHints;

  // Leaving the phone layout with the menu open: drop the open state (and its scroll lock).
  window.addEventListener('resize', debounce(function () {
    if (window.innerWidth > 900) closeNav();
  }, 150));

  // ---------------------------------------------------------------------------
  // Auth screens
  // ---------------------------------------------------------------------------
  function show(which) {
    $('#boot').hidden = which !== 'boot';
    $('#login').hidden = which !== 'login';
    $('#app').hidden = which !== 'app';
  }
  function loginAlert(msg, type) {
    var a = $('#login-alert');
    if (!msg) { a.hidden = true; a.textContent = ''; return; }
    a.className = 'alert alert-' + (type || 'error');
    a.setAttribute('role', type === 'error' || !type ? 'alert' : 'status');
    a.textContent = msg;
    a.hidden = false;
  }
  function showLogin(msg, type) {
    appShown = false;
    stopRealtime();
    Admin.closeAllModals();
    show('login');
    document.title = 'Sign in · U Angel Admin';
    loginAlert(msg || '', type);
    var btn = $('#login-submit');
    Admin.setLoading(btn, false);
    var email = $('#login-email');
    setTimeout(function () { if (email && !email.value) email.focus(); }, 30);
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'A';
    return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
  }

  function showApp() {
    appShown = true;
    show('app');
    var p = Admin.profile || {};
    var name = p.name || (Admin.user && Admin.user.email) || 'Admin';
    $('#user-name').textContent = name;
    $('#user-email').textContent = p.email || (Admin.user && Admin.user.email) || '';
    $('#user-avatar').textContent = initials(name);
    buildNav();
    renderRoute();
    Admin.refreshBadges();
    startRealtime();
  }

  var NOT_ADMIN = 'This account doesn’t have admin access.';

  /** Check that the signed-in user is an admin; show the app or the login screen. */
  function enterWithUser(user) {
    return Admin.sb.from('profiles').select('id, name, email, phone, is_admin').eq('id', user.id).maybeSingle()
      .then(function (res) {
        if (res.error) {
          // Could be a network error — keep the session, let them retry.
          showLogin('Couldn’t check your account: ' + errMessage(res.error));
          return false;
        }
        if (!res.data || !res.data.is_admin) {
          Admin.user = null;
          Admin.profile = null;
          return Admin.sb.auth.signOut().catch(function () { /* ignore */ }).then(function () {
            showLogin(NOT_ADMIN);
            return false;
          });
        }
        Admin.user = user;
        Admin.profile = res.data;
        showApp();
        return true;
      }, function (e) {
        showLogin('Couldn’t check your account: ' + errMessage(e));
        return false;
      });
  }

  function friendlyAuthError(err) {
    var m = (err && err.message) || '';
    if (/invalid login credentials/i.test(m)) return 'Wrong email or password. Please try again.';
    if (/email not confirmed/i.test(m)) return 'Please confirm your email address first (check your inbox).';
    if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a minute and try again.';
    return errMessage(err);
  }

  var signingOut = false;
  Admin.signOut = function () {
    signingOut = true;
    var u = Admin.user;
    Admin.user = null;
    Admin.profile = null;
    Admin.stats = null;
    profileCache.clear();
    stopRealtime();
    return Admin.sb.auth.signOut().catch(function () { /* ignore */ }).then(function () {
      signingOut = false;
      $('#login-password').value = '';
      showLogin(u ? 'You’ve been signed out.' : '', 'info');
    });
  };

  function showRecoveryModal() {
    var form = h('<form novalidate class="stack">' +
      '<p class="muted">Choose a new password for your account.</p>' +
      '<div class="field"><label for="new-pw">New password</label>' +
      '<input id="new-pw" class="input" type="password" autocomplete="new-password" minlength="6" required></div>' +
      '<div class="field"><label for="new-pw2">Confirm new password</label>' +
      '<input id="new-pw2" class="input" type="password" autocomplete="new-password" minlength="6" required></div>' +
      '<div class="alert alert-error" role="alert" hidden></div></form>');
    var m = modal({
      title: 'Set a new password',
      body: form,
      actions: [
        { label: 'Later', variant: 'ghost' },
        { label: 'Save password', variant: 'primary', onClick: function (close) {
          var a = $('.alert', form);
          var p1 = $('#new-pw', form).value, p2 = $('#new-pw2', form).value;
          a.hidden = true;
          if (p1.length < 6) { a.textContent = 'Use at least 6 characters.'; a.hidden = false; return; }
          if (p1 !== p2) { a.textContent = 'The passwords don’t match.'; a.hidden = false; return; }
          return Admin.sb.auth.updateUser({ password: p1 }).then(function (res) {
            if (res.error) { a.textContent = errMessage(res.error); a.hidden = false; return; }
            toast('Password updated');
            close();
          });
        } }
      ]
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); $('.modal-actions .btn-primary', m.el).click(); });
  }

  function bindLogin() {
    var form = $('#login-form');
    var email = $('#login-email');
    var pw = $('#login-password');
    var submit = $('#login-submit');
    var toggle = $('#pw-toggle');

    toggle.addEventListener('click', function () {
      var showing = pw.type === 'text';
      pw.type = showing ? 'password' : 'text';
      toggle.setAttribute('aria-pressed', String(!showing));
      toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      toggle.innerHTML = showing
        ? svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>')
        : svg('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>');
      pw.focus();
    });

    [email, pw].forEach(function (i) { i.addEventListener('input', function () { i.removeAttribute('aria-invalid'); }); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      loginAlert('');
      var em = email.value.trim();
      var pass = pw.value;
      if (!em || !/^\S+@\S+\.\S+$/.test(em)) {
        email.setAttribute('aria-invalid', 'true');
        loginAlert('Please enter a valid email address.');
        email.focus();
        return;
      }
      if (!pass) {
        pw.setAttribute('aria-invalid', 'true');
        loginAlert('Please enter your password.');
        pw.focus();
        return;
      }
      if (!Admin.sb) { loginAlert('Couldn’t connect to the server. Check your connection and reload the page.'); return; }
      Admin.setLoading(submit, true, 'Signing in…');
      Admin.sb.auth.signInWithPassword({ email: em, password: pass }).then(function (res) {
        if (res.error || !res.data || !res.data.user) {
          Admin.setLoading(submit, false);
          loginAlert(friendlyAuthError(res.error));
          return;
        }
        pw.value = '';
        return enterWithUser(res.data.user).then(function () { Admin.setLoading(submit, false); });
      }).catch(function (err) {
        Admin.setLoading(submit, false);
        loginAlert(friendlyAuthError(err));
      });
    });

    $('#forgot-btn').addEventListener('click', function () {
      var em = email.value.trim();
      if (!em || !/^\S+@\S+\.\S+$/.test(em)) {
        email.setAttribute('aria-invalid', 'true');
        loginAlert('Enter your email address above, then tap “Forgot password?” again.', 'info');
        email.focus();
        return;
      }
      if (!Admin.sb) { loginAlert('Couldn’t connect to the server.'); return; }
      var btn = $('#forgot-btn');
      btn.disabled = true;
      Admin.sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + '/admin/' }).then(function (res) {
        btn.disabled = false;
        if (res.error) { loginAlert(friendlyAuthError(res.error)); return; }
        loginAlert('If an account exists for ' + em + ', a password reset link is on its way. Check your inbox.', 'success');
      }).catch(function (err) {
        btn.disabled = false;
        loginAlert(friendlyAuthError(err));
      });
    });
  }

  function bindShell() {
    $('#sign-out').addEventListener('click', function () { Admin.signOut(); });
    $('#nav-open').addEventListener('click', function () {
      if (document.body.classList.contains('nav-open')) closeNav(); else openNav();
    });
    $('#backdrop').addEventListener('click', closeNav);
    var navClose = $('#nav-close');
    if (navClose) navClose.addEventListener('click', function () {
      closeNav();
      var b = $('#nav-open'); if (b) b.focus();
    });
    $('#nav').addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-id]');
      if (!a) return;
      // Re-clicking the current section re-renders it (acts as refresh).
      if (parseHash().id === a.getAttribute('data-id') && location.hash === a.getAttribute('href')) {
        e.preventDefault();
        renderRoute();
      }
      closeNav();
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && appShown) badgesSoon();
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  var started = false;
  Admin.start = function () {
    if (started) return;
    started = true;
    bindLogin();
    bindShell();
    if (!Admin.sb) {
      showLogin('Couldn’t load the Supabase library. Check your internet connection and reload the page.');
      return;
    }
    Admin.sb.auth.onAuthStateChange(function (event) {
      // Never await Supabase calls inside this callback; defer instead.
      if (event === 'SIGNED_OUT') {
        setTimeout(function () {
          if (signingOut) return;
          if (appShown) {
            Admin.user = null;
            Admin.profile = null;
            showLogin('Your session ended. Please sign in again.', 'info');
          }
        }, 0);
      } else if (event === 'PASSWORD_RECOVERY') {
        setTimeout(showRecoveryModal, 300);
      }
    });
    Admin.sb.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (session && session.user) return enterWithUser(session.user);
      showLogin();
    }).catch(function (e) {
      showLogin(errMessage(e));
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Admin.start);
  } else {
    setTimeout(Admin.start, 0);
  }
})();

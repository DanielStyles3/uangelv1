/* U Angel Foods admin: App settings.
 * Everything about the customer app that used to need a developer: contact details, delivery fees
 * and Pay on delivery, the Christmas campaign, wording, form lists, extra checkout questions and
 * the Help FAQ. Stored in public.site_settings (key 'app'); the app updates live when you save.
 * DEFAULTS must match lib/appConfig.ts in the app. */
(function () {
  'use strict';
  var A = window.Admin;
  if (!A || !A.registerSection) return;
  var esc = A.escapeHtml;
  var KEY = 'app';
  var ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/><path d="M3 8h2M3 12h2M19 8h2M19 12h2"/></svg>';

  var DEFAULT_FAQ = [
    { q: 'How do I place an order?', a: 'Browse categories on Home or search, add items to your cart, then tap Checkout and pay securely with Paystack.' },
    { q: 'How can I pay?', a: 'Pay everything online with Paystack (card, bank transfer or USSD), or choose Pay on delivery: you pay the delivery fee online first, then pay for your items to the rider in cash or by transfer. Your order is confirmed once Paystack confirms the online payment.' },
    { q: 'I closed the payment page — what now?', a: 'Nothing is lost. You go back to checkout and your cart stays exactly as it was, so you can change it and pay when you’re ready. Not ready yet? In your cart, tap "Save" and find it later in Profile → My orders → Active. If money did leave your account, we confirm the order automatically.' },
    { q: 'How much is delivery?', a: '₦2,000 per order, or ₦5,000 if your order has anything from Groceries & Essentials or The Local Market.' },
    { q: 'When will The Local Market items arrive?', a: 'The Local Market uses standard next-day delivery.' },
    { q: 'How do I book catering or an event?', a: 'Open Catering on Home and choose Corporate Catering, Food Stands or Events (then your type of event). Send a request with your date, guests, budget and location, and our team will contact you with a quote. Track it in Profile → Catering & event requests.' },
    { q: 'Can I pick up my order?', a: 'No. We deliver every order to your door. Set your address in Profile → Delivery address.' },
    { q: 'Can I cancel an order?', a: "You can cancel an order while it is awaiting payment. Paid orders can't be cancelled in the app." },
    { q: 'How do I change my delivery address or phone number?', a: 'Profile → Delivery address / Personal details.' },
    { q: 'I forgot my password.', a: 'On the Sign in screen tap "Forgot password?". We\'ll email you a 6-digit code; enter it in the app with your new password.' },
    { q: 'How do I delete my account?', a: 'Profile → Delete account. This permanently removes your account and data.' }
  ];

  var DEFAULTS = {
    contact: { phone: '0704 905 5555', email: 'uangelfoods@gmail.com', instagram: 'uangelfoods' },
    delivery: { standardFee: 2000, marketFee: 5000, areaNote: 'We deliver to your door across Lagos.', payOnDelivery: true },
    campaign: { goal: 10000, endsAt: '2026-12-25T23:59:00+01:00' },
    texts: {
      charityLine: 'This order helps feed someone in need. U Are An Angel.',
      searchHint: 'Search cakes, drinks, groceries…',
      topRated: 'Top Rated',
      orderAgain: 'Order again',
      orderAgainSub: 'Your recent favourites',
      servicesEyebrow: 'CATERING & EVENTS',
      servicesTitle: 'Planning something special?',
      servicesBody: "Weddings, birthdays, church & corporate. Tell us your budget and we'll call you with a quote.",
      emptyCartTitle: 'Your cart is empty',
      emptyCartBody: 'Cakes, drinks, market fresh and more. Add something you love.',
      checkoutPayNote: 'Your order is confirmed as soon as the online payment goes through.',
      requestSentSteps: [
        { title: 'We call you within 24 hours', text: 'on the number you gave us' },
        { title: 'You get a quote', text: 'on WhatsApp, with menu options' },
        { title: 'You confirm', text: 'and we handle everything on the day' }
      ]
    },
    lists: {
      serviceNeeds: ['Food', 'Drinks', 'Cake', 'Decor', 'Chairs & canopies', 'Waiters', 'MC / DJ', 'Food stands'],
      cakeGuests: [50, 100, 150, 200, 300, 500],
      cakeTiers: ['1 tier', '2 tiers', '3 tiers', '4+ tiers', 'Not sure']
    },
    checkoutQuestions: [],
    faq: []
  };

  // Wording fields: [key, label, where it shows, long?]
  var TEXTS = [
    ['charityLine', 'Charity line', 'Product page, under the price', false],
    ['searchHint', 'Search box hint', 'Home and Search', false],
    ['topRated', '“Top Rated” row title', 'Home', false],
    ['orderAgain', '“Order again” row title', 'Home', false],
    ['orderAgainSub', '“Order again” subtitle', 'Home', false],
    ['servicesEyebrow', 'Catering banner: small label', 'Bottom of Home', false],
    ['servicesTitle', 'Catering banner: title', 'Bottom of Home', false],
    ['servicesBody', 'Catering banner: text', 'Bottom of Home', true],
    ['emptyCartTitle', 'Empty cart: title', 'Cart', false],
    ['emptyCartBody', 'Empty cart: text', 'Cart', true],
    ['checkoutPayNote', 'Payment note', 'Checkout, under the payment options', true]
  ];
  var Q_KINDS = { text: 'Box to type in', single: 'Pick one', multi: 'Pick any' };

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function errMsg(e) { return (e && (e.message || e.error_description)) || 'Something went wrong'; }
  function merge(base, over) {
    if (over == null || typeof over !== typeof base) return clone(base);
    if (Array.isArray(base)) return Array.isArray(over) ? clone(over) : clone(base);
    if (base && typeof base === 'object') { var o = {}; Object.keys(base).forEach(function (k) { o[k] = merge(base[k], over[k]); }); return o; }
    return typeof over === 'string' ? (over.trim() ? over : base) : over;
  }
  function uid() { return 'q' + Math.random().toString(36).slice(2, 10); }
  // "2026-12-25T23:59:00+01:00" ⇄ the date + time inputs (Lagos time).
  function splitIso(iso) { var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso || ''); return m ? [m[1], m[2]] : ['', '']; }

  async function render(el) {
    el.innerHTML =
      '<div class="page-head"><div><h1>App settings</h1><p>Change the customer app without a developer: contacts, delivery fees, payment options, wording, forms and help. The app updates within seconds of saving.</p></div>' +
        '<div class="actions"><button type="button" class="btn btn-primary" data-save>Save changes</button></div></div>' +
      '<div data-body>' + A.skeletonBlocks(3, 'pr-sk') + '</div>';

    var res = await A.sb.from('site_settings').select('value').eq('key', KEY).maybeSingle();
    if (!el.isConnected) return;
    var body = el.querySelector('[data-body]');
    if (res.error) { body.innerHTML = ''; body.appendChild(A.errorState(errMsg(res.error), function () { A.rerender(); })); return; }
    var d = merge(DEFAULTS, res.data && res.data.value);
    if (!d.faq.length) d.faq = clone(DEFAULT_FAQ);
    var dirty = false;

    function card(title, help, inner) {
      return '<section class="card cg-form" style="padding:22px;margin-bottom:16px;max-width:900px"><h3 style="margin:0">' + title + '</h3>' +
        (help ? '<p class="cg-help" style="margin:2px 0 6px">' + help + '</p>' : '') + inner + '</section>';
    }
    function field(name, label, value, opts) {
      opts = opts || {};
      var id = 'as-' + name.replace(/\W/g, '-');
      return '<div class="field"><label for="' + id + '">' + esc(label) + (opts.where ? ' <span class="cg-opt">· ' + esc(opts.where) + '</span>' : '') + '</label>' +
        (opts.long
          ? '<textarea id="' + id + '" class="textarea" rows="2" data-k="' + name + '">' + esc(value) + '</textarea>'
          : '<input id="' + id + '" class="input" data-k="' + name + '"' + (opts.mode ? ' inputmode="' + opts.mode + '"' : '') + (opts.type ? ' type="' + opts.type + '"' : '') + ' value="' + esc(value) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>') +
        (opts.help ? '<span class="cg-help">' + esc(opts.help) + '</span>' : '') + '</div>';
    }

    function paint() {
      var end = splitIso(d.campaign.endsAt);
      body.innerHTML =
        card('Contact details', 'Used for WhatsApp and call buttons across the app (Help, requests, wedding cakes).',
          '<div class="pp-two">' + field('contact.phone', 'Phone / WhatsApp number', d.contact.phone, { ph: '0704 905 5555', mode: 'tel' }) +
            field('contact.email', 'Email', d.contact.email, { mode: 'email' }) + '</div>' +
          field('contact.instagram', 'Instagram handle', d.contact.instagram, { ph: 'uangelfoods' })) +

        card('Delivery & payment', 'What customers are charged for delivery (products with their own fee keep it). The app and the server both use these.',
          '<div class="pp-two">' + field('delivery.standardFee', 'Standard delivery fee (₦)', d.delivery.standardFee, { mode: 'numeric' }) +
            field('delivery.marketFee', 'Groceries & Local Market delivery fee (₦)', d.delivery.marketFee, { mode: 'numeric' }) + '</div>' +
          field('delivery.areaNote', 'Where you deliver', d.delivery.areaNote, { where: 'Delivery address screen' }) +
          '<div class="pp-avail"><div><b>Offer “Pay on delivery”</b><small>Customers pay the delivery fee online and the rest to the rider. Switch off to accept online payment only.</small></div>' +
            '<button type="button" class="pp-switch" role="switch" aria-checked="' + !!d.delivery.payOnDelivery + '" data-pod aria-label="Pay on delivery"><i></i></button></div>') +

        card('Christmas campaign', 'The pre-order goal and when the campaign ends (it disappears from the app after this).',
          '<div class="pp-two">' + field('campaign.goal', 'Goal (pre-orders)', d.campaign.goal, { mode: 'numeric' }) +
            '<div class="field"><label for="as-end">Ends (Lagos time)</label><div style="display:flex;gap:8px"><input id="as-end" class="input" type="date" data-end-date value="' + esc(end[0]) + '"><input class="input" type="time" data-end-time value="' + esc(end[1]) + '" aria-label="End time"></div></div></div>') +

        card('Wording', 'The main texts customers read. Leave one empty to use the original.',
          TEXTS.map(function (t) { return field('texts.' + t[0], t[1], d.texts[t[0]], { where: t[2], long: t[3] }); }).join('') +
          '<div class="field"><span class="cg-lbl">After a catering request: “What happens next”</span>' +
            d.texts.requestSentSteps.map(function (s, i) {
              return '<div class="pp-two" style="margin-top:6px">' +
                '<input class="input" data-step="' + i + '" data-part="title" value="' + esc(s.title) + '" aria-label="Step ' + (i + 1) + ' title">' +
                '<input class="input" data-step="' + i + '" data-part="text" value="' + esc(s.text) + '" aria-label="Step ' + (i + 1) + ' detail"></div>';
            }).join('') + '</div>') +

        card('Form choices', 'One per line. These are the quick options customers tap.',
          field('lists.serviceNeeds', 'Catering request: “What do you need?”', d.lists.serviceNeeds.join('\n'), { long: true }) +
          '<div class="pp-two">' + field('lists.cakeGuests', 'Wedding cake enquiry: guest numbers', d.lists.cakeGuests.join(', '), { help: 'Numbers, separated by commas.' }) +
            field('lists.cakeTiers', 'Wedding cake enquiry: tiers', d.lists.cakeTiers.join('\n'), { long: true }) + '</div>') +

        card('Checkout questions', 'Extra questions customers answer at checkout, e.g. “How did you hear about us?” or “Gate code”. Answers show on the order.',
          (d.checkoutQuestions.length ? d.checkoutQuestions.map(function (q, i) {
            return '<div class="cg-tree-g"><div class="cg-tree-row"><span class="cg-tree-dot"></span><b>' + esc(q.question) + '</b><small>' + Q_KINDS[q.kind] + (q.required ? ' · required' : ' · optional') +
              (q.kind !== 'text' ? ' · ' + esc(q.choices.join(', ')) : '') + '</small><span class="cg-tree-sp"></span>' +
              '<button type="button" class="cg-edit" data-cq-move="' + i + '" data-dir="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">↑</button>' +
              '<button type="button" class="cg-edit" data-cq-move="' + i + '" data-dir="1"' + (i === d.checkoutQuestions.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓</button>' +
              '<button type="button" class="cg-edit" data-cq-edit="' + i + '">Edit</button>' +
              '<button type="button" class="cg-edit" data-cq-del="' + i + '" style="color:var(--red)">Delete</button></div></div>';
          }).join('') : '<p class="cg-help">No extra questions. Checkout asks only the address and phone.</p>') +
          '<div><button type="button" class="btn btn-ghost btn-sm" data-cq-add>+ Add a question</button></div>') +

        card('Help & FAQ', 'The questions and answers on the app’s Help screen.',
          d.faq.map(function (f, i) {
            return '<div class="cg-tree-g"><div class="field"><div style="display:flex;gap:6px;align-items:center"><input class="input" data-faq="' + i + '" data-part="q" value="' + esc(f.q) + '" aria-label="Question ' + (i + 1) + '">' +
              '<button type="button" class="cg-edit" data-faq-move="' + i + '" data-dir="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">↑</button>' +
              '<button type="button" class="cg-edit" data-faq-move="' + i + '" data-dir="1"' + (i === d.faq.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓</button>' +
              '<button type="button" class="cg-edit" data-faq-del="' + i + '" style="color:var(--red)" aria-label="Delete">×</button></div>' +
              '<textarea class="textarea" rows="2" data-faq="' + i + '" data-part="a" aria-label="Answer ' + (i + 1) + '">' + esc(f.a) + '</textarea></div></div>';
          }).join('') +
          '<div><button type="button" class="btn btn-ghost btn-sm" data-faq-add>+ Add a question</button></div>');
    }

    // Read every input back into d (called before repaints and on save).
    function collect() {
      Array.prototype.forEach.call(body.querySelectorAll('[data-k]'), function (inp) {
        var path = inp.getAttribute('data-k').split('.'), v = inp.value;
        var o = d; for (var i = 0; i < path.length - 1; i++) o = o[path[i]];
        var k = path[path.length - 1];
        if (k === 'standardFee' || k === 'marketFee' || k === 'goal') o[k] = Number(String(v).replace(/[^\d.]/g, '')) || 0;
        else if (k === 'serviceNeeds' || k === 'cakeTiers') o[k] = v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        else if (k === 'cakeGuests') o[k] = v.split(/[,\s]+/).map(Number).filter(function (n) { return n > 0; });
        else o[k] = v;
      });
      var de = body.querySelector('[data-end-date]'), dt = body.querySelector('[data-end-time]');
      if (de && de.value) d.campaign.endsAt = de.value + 'T' + (dt.value || '23:59') + ':00+01:00';
      Array.prototype.forEach.call(body.querySelectorAll('[data-step]'), function (inp) { d.texts.requestSentSteps[+inp.getAttribute('data-step')][inp.getAttribute('data-part')] = inp.value; });
      Array.prototype.forEach.call(body.querySelectorAll('[data-faq]'), function (inp) { d.faq[+inp.getAttribute('data-faq')][inp.getAttribute('data-part')] = inp.value; });
    }

    function questionForm(q) {
      return new Promise(function (resolve) {
        var f = document.createElement('form'); f.className = 'cg-form'; f.noValidate = true;
        var kind = q ? q.kind : 'text';
        f.innerHTML =
          '<div class="field"><label for="cq-q">Question</label><input id="cq-q" name="question" class="input" maxlength="120" value="' + esc(q ? q.question : '') + '" placeholder="e.g. How did you hear about us?"></div>' +
          '<div class="field"><label for="cq-k">Type</label><select id="cq-k" name="kind" class="select">' +
            Object.keys(Q_KINDS).map(function (k) { return '<option value="' + k + '"' + (k === kind ? ' selected' : '') + '>' + Q_KINDS[k] + '</option>'; }).join('') + '</select></div>' +
          '<div class="field" data-ch' + (kind === 'text' ? ' hidden' : '') + '><label for="cq-c">Choices (one per line)</label><textarea id="cq-c" name="choices" class="textarea" rows="4" placeholder="Instagram&#10;A friend&#10;Google">' + esc(q && q.choices ? q.choices.join('\n') : '') + '</textarea></div>' +
          '<div class="field" data-ph' + (kind === 'text' ? '' : ' hidden') + '><label for="cq-p">Example for customers (optional)</label><input id="cq-p" name="placeholder" class="input" value="' + esc(q && q.placeholder || '') + '"></div>' +
          '<label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="required"' + (q && q.required ? ' checked' : '') + '> Customers must answer this</label><button type="submit" hidden></button>';
        f.elements.kind.addEventListener('change', function () { var t = f.elements.kind.value === 'text'; f.querySelector('[data-ch]').hidden = t; f.querySelector('[data-ph]').hidden = !t; });
        var done = false;
        function submit(close) {
          var question = f.elements.question.value.trim(), k = f.elements.kind.value;
          var choices = f.elements.choices.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
          if (!question) { f.elements.question.focus(); return; }
          if (k !== 'text' && choices.length < 2) { A.toast('Add at least two choices, one per line.', 'error'); return; }
          done = true; close();
          resolve({ id: q ? q.id : uid(), question: question, kind: k, choices: k === 'text' ? [] : choices, required: f.elements.required.checked,
            placeholder: k === 'text' ? (f.elements.placeholder.value.trim() || null) : null });
        }
        var mm = A.modal({ title: q ? 'Edit question' : 'New checkout question', body: f, onClose: function () { if (!done) resolve(null); },
          actions: [{ label: 'Cancel', variant: 'ghost', onClick: function (c) { c(); } }, { label: 'Done', variant: 'primary', onClick: function (c) { submit(c); } }] });
        f.addEventListener('submit', function (e) { e.preventDefault(); submit(mm.close); });
      });
    }

    body.addEventListener('input', function () { dirty = true; });
    body.addEventListener('click', async function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      var v;
      if (b.hasAttribute('data-pod')) { d.delivery.payOnDelivery = !d.delivery.payOnDelivery; b.setAttribute('aria-checked', String(d.delivery.payOnDelivery)); dirty = true; return; }
      collect();
      if (b.hasAttribute('data-cq-add')) { var nq = await questionForm(null); if (nq) { d.checkoutQuestions.push(nq); dirty = true; paint(); } return; }
      if ((v = b.getAttribute('data-cq-edit')) != null) { var eq = await questionForm(d.checkoutQuestions[+v]); if (eq) { d.checkoutQuestions[+v] = eq; dirty = true; paint(); } return; }
      if ((v = b.getAttribute('data-cq-del')) != null) { d.checkoutQuestions.splice(+v, 1); dirty = true; paint(); return; }
      if ((v = b.getAttribute('data-cq-move')) != null) { var i = +v, j = i + Number(b.getAttribute('data-dir')); d.checkoutQuestions.splice(j, 0, d.checkoutQuestions.splice(i, 1)[0]); dirty = true; paint(); return; }
      if (b.hasAttribute('data-faq-add')) { d.faq.push({ q: '', a: '' }); dirty = true; paint(); var last = body.querySelectorAll('[data-part="q"]'); if (last.length) last[last.length - 1].focus(); return; }
      if ((v = b.getAttribute('data-faq-del')) != null) { d.faq.splice(+v, 1); dirty = true; paint(); return; }
      if ((v = b.getAttribute('data-faq-move')) != null) { var a = +v, z = a + Number(b.getAttribute('data-dir')); d.faq.splice(z, 0, d.faq.splice(a, 1)[0]); dirty = true; paint(); return; }
    });

    var saveBtn = el.querySelector('[data-save]');
    saveBtn.addEventListener('click', async function () {
      collect();
      if (!d.contact.phone.replace(/\D/g, '')) { A.toast('Enter the phone number.', 'error'); return; }
      if (!(d.delivery.standardFee > 0) || !(d.delivery.marketFee > 0)) { A.toast('Enter both delivery fees.', 'error'); return; }
      d.faq = d.faq.filter(function (f) { return f.q.trim() && f.a.trim(); });
      A.setLoading(saveBtn, true, 'Saving…');
      var r = await A.sb.from('site_settings').upsert({ key: KEY, value: d, updated_at: new Date().toISOString() }).select('key').single();
      A.setLoading(saveBtn, false);
      if (r.error) { A.toast('Couldn’t save: ' + errMsg(r.error), 'error'); return; }
      dirty = false;
      A.toast('Saved. The app updates in a few seconds.', 'success');
      paint();
    });
    window.addEventListener('beforeunload', function (e) { if (dirty && el.isConnected) { e.preventDefault(); e.returnValue = ''; } });

    paint();
  }

  A.registerSection({ id: 'app-settings', label: 'App settings', icon: ICON, order: 5.7, render: render });
})();

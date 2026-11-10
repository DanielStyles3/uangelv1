/* U Angel Foods — referral invite page (/r/CODE → r.html).
 * Reads the code from the URL, checks it with the public referral_code_info RPC and shows
 * either the invite (with the inviter's first name) or a friendly "link isn't working" message. */
(function () {
  'use strict';
  var URL_RPC = 'https://rembodejacmfbeohvmhl.supabase.co/rest/v1/rpc/referral_code_info';
  var KEY = 'sb_publishable_gQ92ZGE8a1mKL3SLLWB0Dw_knNnJDVg';

  function $(id) { return document.getElementById(id); }

  function readCode() {
    var m = location.pathname.match(/^\/r\/([^\/?#]+)/i);
    var raw = m ? m[1] : (new URLSearchParams(location.search).get('code') || '');
    try { raw = decodeURIComponent(raw); } catch (e) { /* keep raw */ }
    return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  function show(which) {
    $('rf-loading').hidden = true;
    $('rf-valid').hidden = which !== 'valid';
    $('rf-invalid').hidden = which !== 'invalid';
  }

  function showInvalid(code) {
    if (!code) {
      $('rf-invalid-text').textContent = 'This link doesn’t include a referral code. You can still download the app and order: every order helps feed someone in need.';
    }
    document.title = 'Invite link not working · U Angel Foods';
    show('invalid');
  }

  function showValid(code, firstName) {
    var title = $('rf-title');
    title.textContent = '';
    var who = (firstName || '').trim();
    if (who) {
      title.appendChild(document.createTextNode(who + ' invited you to '));
      document.title = who + ' invited you to U Angel Foods';
    } else {
      title.appendChild(document.createTextNode('You’ve been invited to '));
    }
    var b = document.createElement('b');
    b.textContent = 'U Angel Foods';
    title.appendChild(b);

    $('rf-code').textContent = code;
    Array.prototype.forEach.call(document.querySelectorAll('[data-code]'), function (el) { el.textContent = code; });
    show('valid');
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(t);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  function bindCopy(code) {
    var btn = $('rf-copy'), label = $('rf-copy-label'), live = $('rf-copied'), timer;
    btn.addEventListener('click', function () {
      copy(code).then(function () {
        label.textContent = 'Copied';
        live.textContent = 'Code ' + code + ' copied';
      }, function () {
        label.textContent = 'Copy failed';
        live.textContent = 'Couldn’t copy. The code is ' + code;
      }).then(function () {
        clearTimeout(timer);
        timer = setTimeout(function () { label.textContent = 'Copy code'; }, 2000);
      });
    });
  }

  function start() {
    var code = readCode();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) { showInvalid(code); return; }
    bindCopy(code);

    var ctrl = window.AbortController ? new AbortController() : null;
    var timeout = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
    fetch(URL_RPC, {
      method: 'POST',
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ p_code: code }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (rows) {
      clearTimeout(timeout);
      var row = Array.isArray(rows) ? rows[0] : rows;
      if (row && row.valid) showValid(code, row.first_name);
      else showInvalid(code);
    }).catch(function () {
      // Couldn't check (offline / server error): still show the code so the invite isn't lost.
      clearTimeout(timeout);
      showValid(code, '');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

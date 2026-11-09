/* U Angel Foods admin — Website: the top section (hero) of uangelfoods.com.
 * Tag line, headline (+ orange part), intro text and the three photo cards with captions.
 * Stored in public.site_settings (key 'website_hero'); the site reads it on page load.
 * Banners under the hero come from Promotions (same as the app). */
(function () {
  'use strict';
  var A = window.Admin;
  if (!A || !A.registerSection) return;
  var esc = A.escapeHtml;
  var KEY = 'website_hero';
  var IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var SLOTS = ['Big photo (left)', 'Top-right photo', 'Bottom photo'];
  var ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
  var DEFAULTS = {
    tag: '♥ Every menu item purchased feeds someone in need',
    title: 'Good food that',
    highlight: 'feeds someone in need.',
    subtitle: 'U Angel Foods serves high-quality food and beverages to the public, and uses the proceeds to fund our outreach programs that feed and care for those in need. Not through donations, but through excellence in business.',
    photos: [
      { url: 'https://uangelfoods.com/assets/photos/cake.jpg', caption: 'Birthday cakes' },
      { url: 'https://uangelfoods.com/assets/photos/drinks.jpg', caption: 'Fruit-infused drinks' },
      { url: 'https://uangelfoods.com/assets/photos/juice.jpg', caption: 'Served chilled' }
    ]
  };

  function errMsg(e) { return (e && (e.message || e.error_description)) || 'Something went wrong'; }

  async function render(el) {
    var d = JSON.parse(JSON.stringify(DEFAULTS));
    var files = [null, null, null], objUrls = [null, null, null];

    el.innerHTML =
      '<div class="page-head"><div><h1>Website</h1><p>The top of uangelfoods.com: headline, intro and photos.</p></div>' +
        '<div class="actions"><a class="btn btn-ghost" href="/" target="_blank" rel="noopener">View website</a></div></div>' +
      '<p class="pp-note">Changes show on the website as soon as you save. The coloured banners under this section are the same as the app’s and are edited in <a href="#/promotions">Promotions</a>.</p>' +
      '<div data-body>' + A.skeletonBlocks(2, 'pr-sk') + '</div>';

    var res = await A.sb.from('site_settings').select('value').eq('key', KEY).maybeSingle();
    if (!el.isConnected) return;
    var body = el.querySelector('[data-body]');
    if (res.error) {
      body.innerHTML = '';
      body.appendChild(A.errorState(/site_settings/.test(errMsg(res.error))
        ? 'The website settings table is missing. Run the latest supabase/schema.sql, then refresh.'
        : errMsg(res.error), function () { A.rerender(); }));
      return;
    }
    if (res.data && res.data.value) {
      var v = res.data.value;
      ['tag', 'title', 'highlight', 'subtitle'].forEach(function (k) { if (typeof v[k] === 'string') d[k] = v[k]; });
      if (Array.isArray(v.photos)) v.photos.slice(0, 3).forEach(function (p, i) { if (p) d.photos[i] = { url: p.url || d.photos[i].url, caption: p.caption || '' }; });
    }

    body.innerHTML =
      '<form class="card cg-form" style="padding:22px;max-width:860px" novalidate>' +
        '<div class="field"><label for="wh-tag">Small line above the headline</label>' +
          '<input id="wh-tag" name="tag" class="input" maxlength="80" value="' + esc(d.tag) + '"></div>' +
        '<div class="pp-two">' +
          '<div class="field"><label for="wh-title">Headline <span class="cg-req" aria-hidden="true">*</span></label>' +
            '<input id="wh-title" name="title" class="input" maxlength="60" value="' + esc(d.title) + '"><span class="cg-err" data-err="title" role="alert"></span></div>' +
          '<div class="field"><label for="wh-hl">Headline, orange part</label>' +
            '<input id="wh-hl" name="highlight" class="input" maxlength="60" value="' + esc(d.highlight) + '"></div>' +
        '</div>' +
        '<div class="field"><span class="cg-lbl">Headline preview</span><div data-hpreview style="font-size:26px;font-weight:700;line-height:1.2"></div></div>' +
        '<div class="field"><label for="wh-sub">Intro text</label>' +
          '<textarea id="wh-sub" name="subtitle" class="input" rows="4" maxlength="400" style="resize:vertical;min-height:96px">' + esc(d.subtitle) + '</textarea>' +
          '<span class="cg-help" data-count></span></div>' +
        '<div class="field"><span class="cg-lbl">Photos</span>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px">' +
            SLOTS.map(function (label, i) {
              return '<div style="border:1px solid var(--line, #E6E6EA);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:10px">' +
                '<b style="font-size:13px">' + esc(label) + '</b>' +
                '<div style="aspect-ratio:4/5;border-radius:12px;overflow:hidden;background:#F6F6F8"><img data-img="' + i + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></div>' +
                '<label class="btn btn-ghost btn-sm" style="justify-content:center" tabindex="0" role="button" for="wh-file-' + i + '">Change photo</label>' +
                '<input type="file" id="wh-file-' + i + '" class="cg-file" accept="image/jpeg,image/png,image/webp" data-file="' + i + '">' +
                '<span class="cg-err" data-err="photo' + i + '" role="alert"></span>' +
                '<input class="input" maxlength="40" placeholder="Caption" aria-label="Caption for ' + esc(label) + '" data-caption="' + i + '" value="' + esc(d.photos[i].caption) + '">' +
              '</div>';
            }).join('') +
          '</div></div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">' +
          '<button type="button" class="btn btn-ghost" data-reset>Restore original</button>' +
          '<button type="submit" class="btn btn-primary" data-save>Save changes</button>' +
        '</div>' +
      '</form>';

    var form = body.querySelector('form');
    function q(s) { return form.querySelector(s); }
    function paint() {
      q('[data-hpreview]').innerHTML = esc(d.title) + ' <span style="color:#FD652A">' + esc(d.highlight) + '</span>';
      q('[data-count]').textContent = d.subtitle.length + ' / 400 characters';
      d.photos.forEach(function (p, i) { q('[data-img="' + i + '"]').src = objUrls[i] || p.url; });
    }
    paint();

    form.addEventListener('input', function (e) {
      var n = e.target.name;
      if (n === 'tag' || n === 'title' || n === 'highlight' || n === 'subtitle') { d[n] = e.target.value; if (n === 'title') q('[data-err="title"]').textContent = ''; paint(); }
      var c = e.target.getAttribute('data-caption');
      if (c !== null) d.photos[Number(c)].caption = e.target.value;
    });
    form.addEventListener('change', function (e) {
      var i = e.target.getAttribute('data-file');
      if (i === null) return;
      i = Number(i);
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      var err = q('[data-err="photo' + i + '"]');
      err.textContent = '';
      if (!file) return;
      if (IMG_TYPES.indexOf(file.type) === -1) { err.textContent = 'Please choose a JPEG, PNG or WebP image.'; return; }
      if (file.size > 5 * 1024 * 1024) { err.textContent = 'That image is larger than 5 MB.'; return; }
      if (objUrls[i]) URL.revokeObjectURL(objUrls[i]);
      files[i] = file; objUrls[i] = URL.createObjectURL(file);
      paint();
    });
    Array.prototype.forEach.call(form.querySelectorAll('label[for^="wh-file-"]'), function (l) {
      l.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); form.querySelector('#' + l.getAttribute('for')).click(); } });
    });

    q('[data-reset]').addEventListener('click', async function () {
      if (!await A.confirm('Put back the original headline, text and photos? This replaces what is on the website now.', { confirmLabel: 'Restore original' })) return;
      d = JSON.parse(JSON.stringify(DEFAULTS));
      files = [null, null, null];
      objUrls.forEach(function (u) { if (u) URL.revokeObjectURL(u); });
      objUrls = [null, null, null];
      ['tag', 'title', 'highlight'].forEach(function (k) { q('[name="' + k + '"]').value = d[k]; });
      q('[name="subtitle"]').value = d.subtitle;
      d.photos.forEach(function (p, i) { q('[data-caption="' + i + '"]').value = p.caption; });
      paint();
      save();
    });

    var busy = false;
    async function save() {
      if (busy) return;
      if (!d.title.trim()) { q('[data-err="title"]').textContent = 'Enter a headline.'; q('[name="title"]').focus(); return; }
      busy = true;
      var btn = q('[data-save]');
      A.setLoading(btn, true, 'Saving…');
      try {
        for (var i = 0; i < 3; i++) {
          if (!files[i]) continue;
          try { d.photos[i].url = await A.uploadImage(files[i], 'website'); }
          catch (e) { A.toast('Photo upload failed: ' + errMsg(e), 'error'); return; }
          files[i] = null;
        }
        var value = {
          tag: d.tag.trim(), title: d.title.trim(), highlight: d.highlight.trim(), subtitle: d.subtitle.trim(),
          photos: d.photos.map(function (p) { return { url: p.url, caption: (p.caption || '').trim() }; })
        };
        var r = await A.sb.from('site_settings').upsert({ key: KEY, value: value, updated_at: new Date().toISOString() }).select('key').single();
        if (r.error) { A.toast('Couldn’t save: ' + errMsg(r.error), 'error'); return; }
        A.toast('Saved. The website is updated.', 'success');
      } finally {
        busy = false;
        A.setLoading(btn, false);
      }
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });
  }

  A.registerSection({ id: 'website', label: 'Website', icon: ICON, order: 5.6, render: render });
})();

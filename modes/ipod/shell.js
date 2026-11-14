/* iPod mode — shell.
 *
 * A shell mode never carries content of its own. This script reads the page it is
 * on and re-presents it (Figma Portfolio-v2, designs 3:269):
 *
 *   every page   a browser header with the address, the mode (ghost) and theme
 *                (moon) buttons; the site nav steps aside
 *   portfolio    the click-wheel player, built from the project cards already in
 *                the HTML (title, link, NDA flag, status)
 *   documents    case studies, about, resume, the NDA gate and 404 open as a window
 *                over the player. The player behind is built from the portfolio's
 *                cards, fetched from /portfolio/, and is inert.
 *
 * Everything it adds is removed again by unmount(), and the page's own content is
 * moved back where it was, so the visitor can switch back to Professional in place.
 * Registered with the mode engine (modes/modes.js).
 */
(function () {
  'use strict';
  if (!window.SiteModes) return;

  var doc = document, root = doc.documentElement;
  var added = [];            // nodes this shell inserted, removed on unmount
  var moved = [];            // [node, parent, nextSibling] to put back on unmount
  var cleanups = [];         // listeners / observers to detach on unmount

  function el(tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function on(target, type, fn, opts) { target.addEventListener(type, fn, opts); cleanups.push(function () { target.removeEventListener(type, fn, opts); }); }
  function insertBefore(node, ref) { ref.parentNode.insertBefore(node, ref); added.push(node); }
  function prepend(node, parent) { parent.insertBefore(node, parent.firstChild); added.push(node); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  /* Display and wheel icons: Font Awesome Free (CC BY 4.0, fontawesome.com), the
     glyphs the Figma file uses: FA5 lock, arrow-left; FA6 play, forward, backward.
     Sized as Figma sets them (font-size = icon height). The header's buttons are
     borrowed from the nav instead (see buildHeader). */
  var FA = {
    lock: [448, 512, 'M400 224h-24v-72C376 68.2 307.8 0 224 0S72 68.2 72 152v72H48c-26.5 0-48 21.5-48 48v192c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V272c0-26.5-21.5-48-48-48zm-104 0H152v-72c0-39.7 32.3-72 72-72s72 32.3 72 72v72z'],
    arrowLeft: [448, 512, 'M257.5 445.1l-22.2 22.2c-9.4 9.4-24.6 9.4-33.9 0L7 273c-9.4-9.4-9.4-24.6 0-33.9L201.4 44.7c9.4-9.4 24.6-9.4 33.9 0l22.2 22.2c9.5 9.5 9.3 25-.4 34.3L136.6 216H424c13.3 0 24 10.7 24 24v32c0 13.3-10.7 24-24 24H136.6l120.5 114.8c9.8 9.3 10 24.8.4 34.3z'],
    play: [384, 512, 'M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80L0 432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z'],
    forward: [512, 512, 'M52.5 440.6c-9.5 7.9-22.8 9.7-34.1 4.4S0 428.4 0 416L0 96C0 83.6 7.2 72.3 18.4 67s24.5-3.6 34.1 4.4L224 214.3l0 41.7 0 41.7L52.5 440.6zM256 352l0-96 0-128 0-32c0-12.4 7.2-23.7 18.4-29s24.5-3.6 34.1 4.4l192 160c7.3 6.1 11.5 15.1 11.5 24.6s-4.2 18.5-11.5 24.6l-192 160c-9.5 7.9-22.8 9.7-34.1 4.4s-18.4-16.6-18.4-29l0-64z'],
    backward: [512, 512, 'M459.5 440.6c9.5 7.9 22.8 9.7 34.1 4.4s18.4-16.6 18.4-29l0-320c0-12.4-7.2-23.7-18.4-29s-24.5-3.6-34.1 4.4L288 214.3l0 41.7 0 41.7L459.5 440.6zM256 352l0-96 0-128 0-32c0-12.4-7.2-23.7-18.4-29s-24.5-3.6-34.1 4.4l-192 160C4.2 237.5 0 246.5 0 256s4.2 18.5 11.5 24.6l192 160c9.5 7.9 22.8 9.7 34.1 4.4s18.4-16.6 18.4-29l0-64z']
  };
  function icon(name, size, cls) {
    var g = FA[name], w = Math.round(g[0] / 512 * size * 100) / 100;
    return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 ' + g[0] + ' ' + g[1] + '" width="' + w + '" height="' + size +
      '" aria-hidden="true" focusable="false"><path fill="currentColor" d="' + g[2] + '"/></svg>';
  }

  var professional = (window.SiteModes.modes().filter(function (m) { return m.id === 'professional'; })[0] || { label: 'Professional' }).label;
  var feedback = makeFeedback();

  /* ================= header (Figma 16:20594) ================= */

  // type: 'landing' (address) or 'window' (page title + close)
  //
  // The buttons are Professional's own: the nav's ghost and moon are cloned, so they
  // carry the same Supernova classes (sn-btn-icon-secondary sm), icons, sizes and
  // states. Only what they do changes here. Close uses the same button and icon set.
  function navButton(sel) {
    var src = doc.querySelector('nav ' + sel);
    if (!src) return null;
    var b = src.cloneNode(true);
    b.removeAttribute('id'); b.removeAttribute('title'); b.hidden = false;
    return b;
  }
  function buildHeader(type, title, closeHref) {
    var h = el('div', 'ipod-header' + (type === 'window' ? ' ipod-header--window' : ''));
    var inner = el('div', 'ipod-header-inner');
    var host = el('p', 'ipod-host');
    var site = window.SiteModes.site();
    if (type === 'window') {
      // Figma 16:20571: a breadcrumb, site > page; the site links back to the player
      host.innerHTML = '<a class="ipod-host-link" href="' + esc(closeHref) + '">' + esc(site) + '</a> <span>&gt; ' + esc(title) + '</span>';
    } else {
      var name = site.split('.')[0];
      host.innerHTML = '<span class="ipod-host-name">' + esc(name) + '</span>' + esc(site.slice(name.length));
      host.setAttribute('aria-hidden', 'true'); // decoration: an address bar
    }
    inner.appendChild(host);

    var ghost = navButton('.nav-mode-toggle');
    if (ghost) {
      ghost.classList.add('ipod-mode-exit'); // keeps .nav-mode-toggle: the nav's narrow-screen sizing applies too
      ghost.setAttribute('aria-label', 'Switch to ' + professional + ' mode');
      ghost.addEventListener('click', function () { window.SiteModes.set('professional', { focusMain: true }); });
      inner.appendChild(ghost);
    }

    var theme = navButton('.nav-dark-mode');
    if (theme) {
      // keeps .nav-dark-mode for its icon swap; theme.js binds only the nav's (the first)
      theme.classList.add('ipod-theme');
      theme.addEventListener('click', function () {
        var real = doc.querySelector('nav .nav-dark-mode');   // the site's toggle owns the logic
        if (real) real.click();
      });
      inner.appendChild(theme);
    }

    if (type === 'window') {
      var close = el('a', 'sn-btn-icon sn-btn-icon-secondary sn-btn-icon-sm ipod-close',
        // Figma draws close at 24 (ghost and moon at 16); same line icon family as the nav's
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>');
      close.href = closeHref;
      close.setAttribute('aria-label', 'Close window, back to the iPod');
      inner.appendChild(close);
    }
    h.appendChild(inner);
    return h;
  }

  function syncThemeButtons() {
    var dark = root.getAttribute('data-theme') === 'dark';
    Array.prototype.forEach.call(doc.querySelectorAll('.ipod-theme'), function (b) {
      b.setAttribute('aria-pressed', String(dark));
      b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  /* ================= the player ================= */

  var STATE_KEY = 'ipod-player';
  var CHART = 'Judy’s top hits';
  var MENU_TITLE = 'Playlists';

  // Read the project cards: the one source of what the player lists.
  function readTracks(from) {
    return Array.prototype.map.call(from.querySelectorAll('#projects .project-card'), function (card) {
      var label = card.querySelector('.card-label');
      var status = card.querySelector('.card-status-badge');
      return {
        id: card.id,
        label: label ? label.textContent.trim() : card.id,
        href: card.getAttribute('href'),
        locked: card.hasAttribute('data-protected'),
        status: status ? status.textContent.trim() : null
      };
    });
  }

  // interactive: false builds a still picture of the player (the backdrop behind a window)
  function buildPlayer(tracks, state, interactive) {
    var home = el('section', 'ipod-home' + (interactive ? '' : ' ipod-home--backdrop'));
    if (interactive) { home.id = 'ipod-home'; home.setAttribute('aria-label', 'Case studies'); }
    home.innerHTML =
      '<div class="ipod-player">' +
        '<div class="ipod-display"></div>' +
        '<div class="ipod-wheel" role="group" aria-label="Click wheel">' +
          '<button type="button" class="ipod-spoke ipod-spoke--menu" data-action="menu" aria-label="Menu, go back">MENU</button>' +
          '<button type="button" class="ipod-spoke ipod-spoke--prev" data-action="prev" aria-label="Previous item">' + icon('backward', 32) + '</button>' +
          '<button type="button" class="ipod-center" data-action="select" aria-label="Select"' + (interactive ? ' aria-describedby="ipod-keys"' : '') + '></button>' +
          '<button type="button" class="ipod-spoke ipod-spoke--next" data-action="next" aria-label="Next item">' + icon('forward', 32) + '</button>' +
          '<button type="button" class="ipod-spoke ipod-spoke--play" data-action="select" aria-label="Play (opens the selected item)">' + icon('play', 32) + '</button>' +
        '</div>' +
      '</div>' +
      '<p class="ipod-notes"><span>Drag around the ring to scroll.</span> <span>Click a row or the center button to select.</span> <span>MENU goes back. Supports keyboard nav.</span></p>' +
      (interactive
        ? '<p class="mode-sr-only" id="ipod-keys">Keyboard: Up and Down arrows move. Enter or Right arrow opens. Left arrow or Escape goes back. Home and End jump to the first or last item.</p>' +
          '<p class="mode-sr-only" id="ipod-live" aria-live="polite" aria-atomic="true"></p>'
        : '');

    var player = home.querySelector('.ipod-player');
    var display = home.querySelector('.ipod-display');
    var wheel = home.querySelector('.ipod-wheel');
    var live = home.querySelector('#ipod-live');
    var items = [], listEl = null;

    function trackCount(n) { return n + (n === 1 ? ' track' : ' tracks'); }
    function itemsFor(level) {
      if (level === 'menu') {
        return [
          { kind: 'chart', label: CHART, count: tracks.length, sr: trackCount(tracks.length) },
          { kind: 'link', label: 'About the artist', href: '/about/', chip: '--' }
        ];
      }
      return tracks.map(function (t) { return { kind: 'track', label: t.label, href: t.href, track: t }; });
    }
    function save() { if (interactive) { try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {} } }
    function announce(msg) { if (!live) return; live.textContent = ''; requestAnimationFrame(function () { live.textContent = msg; }); }
    function rowHasFocus() { var a = doc.activeElement; return !!(a && a.classList && a.classList.contains('ipod-row')); }
    function describe(i) {
      var it = items[i]; if (!it) return '';
      var bits = [it.label];
      if (it.sr) bits.push(it.sr);
      if (it.track && it.track.locked) bits.push('Password required');
      if (it.track && it.track.status) bits.push(it.track.status);
      return bits.join(', ') + ', ' + (i + 1) + ' of ' + items.length;
    }
    function chipsFor(it) {
      var h = '';
      if (it.kind === 'chart') h += '<span class="ipod-chip"><span aria-hidden="true">' + it.count + '</span><span class="mode-sr-only">' + it.sr + '</span></span>';
      if (it.chip) h += '<span class="ipod-chip" aria-hidden="true">' + it.chip + '</span>';
      // Figma shows no status chip; the card's status is still read out
      if (it.track && it.track.status) h += '<span class="mode-sr-only">, ' + esc(it.track.status) + '</span>';
      if (it.track && it.track.locked) h += '<span class="ipod-chip ipod-chip--icon">' + icon('lock', 12) + '<span class="mode-sr-only">Password required</span></span>';
      return h;
    }

    function render() {
      items = itemsFor(state.level);
      if (state.focus >= items.length) state.focus = 0;
      var inTracks = state.level === 'tracks';
      var title = inTracks ? CHART : MENU_TITLE;
      display.innerHTML =
        '<div class="ipod-display-content">' +
          '<div class="ipod-display-header">' +
            '<div class="ipod-crumb-row"><p class="ipod-crumb">' + (inTracks ? 'Music &gt; ' + MENU_TITLE : 'Music') + '</p>' +
              (inTracks ? '<button type="button" class="ipod-back" aria-label="Back to ' + MENU_TITLE + '">' + icon('arrowLeft', 14) + '<span>Back</span></button>' : '') +
            '</div>' +
            '<p class="ipod-title">' + esc(title) + '</p>' +
          '</div>' +
          '<ul class="ipod-list" aria-label="' + esc(title) + '"' + (interactive ? ' aria-describedby="ipod-keys"' : '') + '></ul>' +
        '</div>';
      listEl = display.querySelector('.ipod-list');
      items.forEach(function (it, i) {
        var li = el('li');
        var row = el('button', 'ipod-row');
        row.type = 'button';
        row.innerHTML = '<span class="ipod-row-num" aria-hidden="true">' + (i + 1) + '.</span><span class="ipod-row-label">' + esc(it.label) + '</span>' + chipsFor(it);
        if (interactive) {
          row.addEventListener('click', function () { feedback.unlock(); state.focus = i; select(); });
          row.addEventListener('focus', function () { if (state.focus !== i) { state.focus = i; paint(); } });
        }
        li.appendChild(row); listEl.appendChild(li);
      });
      var back = display.querySelector('.ipod-back');
      if (back && interactive) back.addEventListener('click', function () { feedback.unlock(); goBack(); });
      paint();
    }
    function paint() {
      Array.prototype.forEach.call(listEl.querySelectorAll('.ipod-row'), function (r, i) {
        var onIt = i === state.focus;
        r.classList.toggle('is-focused', onIt);
        r.tabIndex = onIt ? 0 : -1;
        if (onIt) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current');
      });
      var row = listEl.querySelectorAll('.ipod-row')[state.focus];
      if (row && !interactive) row.scrollIntoView({ block: 'nearest' });
      save();
    }
    function focusRow(i) {
      state.focus = i; paint();
      var row = listEl.querySelectorAll('.ipod-row')[i];
      if (!row) return;
      row.scrollIntoView({ block: 'nearest' });
      if (rowHasFocus()) row.focus({ preventScroll: true });   // a screen reader reads the row itself
      else announce(describe(i));                               // focus is on the wheel: say what changed
    }
    function move(delta) {
      if (!items.length) return;
      feedback.tick();
      focusRow((state.focus + delta + items.length) % items.length);
    }
    function select() {
      feedback.unlock();
      var it = items[state.focus]; if (!it) return;
      if (it.kind === 'chart') {
        var wasOnRow = rowHasFocus();
        state.level = 'tracks'; state.focus = 0;
        feedback.select(); render();
        if (wasOnRow) listEl.querySelector('.ipod-row').focus();
        else announce(CHART + ', ' + trackCount(items.length) + '. ' + describe(0));
        return;
      }
      if (it.href) { feedback.select(); save(); location.assign(it.href); }
    }
    function goBack() {
      if (state.level !== 'tracks') return;
      var wasOnRow = rowHasFocus();
      state.level = 'menu'; state.focus = 0;
      feedback.back(); render();
      if (wasOnRow) listEl.querySelector('.ipod-row').focus();
      else announce(MENU_TITLE + '. ' + describe(0));
    }

    if (interactive) {
      // One key handler for the whole player: works from the list or the wheel.
      on(player, 'keydown', function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        var onRow = e.target.classList && e.target.classList.contains('ipod-row');
        feedback.unlock();
        switch (e.key) {
          case 'ArrowDown': move(1); break;
          case 'ArrowUp': move(-1); break;
          case 'Home': feedback.tick(); focusRow(0); break;
          case 'End': feedback.tick(); focusRow(items.length - 1); break;
          case 'ArrowRight': select(); break;
          case 'Enter': case ' ': if (!onRow) return; select(); break;
          case 'ArrowLeft': case 'Escape': case 'Backspace': if (state.level !== 'tracks') return; goBack(); break;
          default: return;
        }
        e.preventDefault();
      });
      // Wheel buttons, plus drag-around-the-ring scrolling on top of them.
      var dragged = false;
      wheel.addEventListener('click', function (e) {
        var b = e.target.closest('[data-action]'); if (!b) return;
        if (dragged) { dragged = false; return; }
        feedback.unlock();
        var a = b.getAttribute('data-action');
        if (a === 'menu') goBack(); else if (a === 'next') move(1); else if (a === 'prev') move(-1); else select();
      });
      var dragging = false, last = null, acc = 0, STEP = 0.45;
      var angle = function (e) {
        var r = wheel.getBoundingClientRect();
        return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
      };
      wheel.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.ipod-center')) return;
        feedback.unlock(); dragging = true; last = angle(e); acc = 0; dragged = false;
      });
      on(window, 'pointermove', function (e) {
        if (!dragging) return;
        var a = angle(e), d = a - last;
        if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
        last = a; acc += d;
        while (acc > STEP) { move(1); acc -= STEP; dragged = true; }
        while (acc < -STEP) { move(-1); acc += STEP; dragged = true; }
      });
      on(window, 'pointerup', function () { dragging = false; last = null; });
    }

    // Both Figma device variants keep their proportions and scale down only if they must.
    function fit() {
      player.style.zoom = ''; player.style.maxWidth = '';
      if (!player.offsetWidth) return;
      player.style.maxWidth = 'none';
      var cs = getComputedStyle(home);
      var room = home.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var z = Math.min(1, room / player.offsetWidth);
      if (z < 1) player.style.zoom = String(Math.floor(z * 1000) / 1000);
    }
    on(window, 'resize', fit);
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(fit); ro.observe(home); cleanups.push(function () { ro.disconnect(); }); }

    render();
    return { home: home, fit: fit, focusCurrent: function () {
      var row = listEl && listEl.querySelectorAll('.ipod-row')[state.focus];
      if (row && doc.contains(row)) row.focus({ preventScroll: true });
    } };
  }

  /* ================= landing: /portfolio/ ================= */

  function mountLanding() {
    var projects = doc.getElementById('projects');
    var tracks = readTracks(doc);
    if (!tracks.length) return;
    var state = { level: 'menu', focus: 0 };
    try { var saved = JSON.parse(sessionStorage.getItem(STATE_KEY)); if (saved && saved.level) state = saved; } catch (e) {}
    // Back from a window (#slug): that track, focused.
    var hashIdx = tracks.map(function (t) { return t.id; }).indexOf(decodeURIComponent((location.hash || '').slice(1)));
    if (hashIdx > -1) state = { level: 'tracks', focus: hashIdx };

    var p = buildPlayer(tracks, state, true);
    insertBefore(p.home, projects);
    p.fit();
    if (hashIdx > -1) {
      // wait for load: the browser's own jump to the #fragment would take focus away
      var go = function () { setTimeout(p.focusCurrent, 0); };
      if (doc.readyState === 'complete') go(); else on(window, 'load', go, { once: true });
    }
  }

  /* ================= documents: a window over the player ================= */

  function mountWindow() {
    var main = doc.getElementById('main');
    if (!main) return;
    var slug = (location.pathname.match(/^\/(?:private\/)?projects\/([^/]+)\//) || [])[1];
    var closeHref = '/portfolio/' + (slug ? '#' + slug : '');
    var title = (doc.title || '').split(' — ')[0].trim();

    // the player behind: a still picture, built from the live portfolio cards
    var behind = el('div', 'ipod-behind');
    behind.setAttribute('inert', '');
    behind.setAttribute('aria-hidden', 'true');
    insertBefore(behind, main);
    if (window.fetch && window.DOMParser) {
      fetch('/portfolio/', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
        if (!html || !doc.contains(behind)) return;
        var tracks = readTracks(new DOMParser().parseFromString(html, 'text/html'));
        if (!tracks.length) return;
        var idx = tracks.map(function (t) { return t.id; }).indexOf(slug);
        var p = buildPlayer(tracks, idx > -1 ? { level: 'tracks', focus: idx } : { level: 'menu', focus: slug ? 0 : 1 }, false);
        behind.appendChild(p.home);
        p.fit();
      }).catch(function () { /* no backdrop; the window still works */ });
    }

    // the window: header + the page's own content, moved in (and back on unmount)
    var overlay = el('div', 'ipod-overlay');
    var win = el('div', 'ipod-window');
    win.appendChild(buildHeader('window', title, closeHref));
    var content = el('div', 'ipod-window-content');
    var body = el('div', 'ipod-window-body');
    body.tabIndex = 0;
    body.setAttribute('role', 'region');
    body.setAttribute('aria-label', title);
    var bar = el('div', 'ipod-scrollbar', '<div class="ipod-scrollbar-thumb"></div>');
    bar.setAttribute('aria-hidden', 'true');
    content.appendChild(body); content.appendChild(bar);
    win.appendChild(content);
    overlay.appendChild(win);

    Array.prototype.slice.call(main.childNodes).forEach(function (n) {
      moved.push([n, main, null]);
      body.appendChild(n);
    });
    main.appendChild(overlay); added.push(overlay);
    root.classList.add('ipod-has-window');
    cleanups.push(function () { root.classList.remove('ipod-has-window'); });

    // Esc closes the window, unless the image viewer is open (it has its own Esc)
    on(doc, 'keydown', function (e) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      var lb = doc.getElementById('lightbox');
      if (lb && lb.classList.contains('active')) return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      location.assign(closeHref);
    });

    mountScrollbar(body, bar);
  }

  // A drawn scrollbar that mirrors the body's native scroll (Figma 9:1258).
  function mountScrollbar(body, bar) {
    var thumb = bar.firstChild;
    var PAD = 2, MIN = 48;
    function metrics() {
      var track = bar.clientHeight - 2 * PAD;
      var h = Math.max(MIN, track * body.clientHeight / body.scrollHeight);
      return { track: track, h: h, max: body.scrollHeight - body.clientHeight };
    }
    function sync() {
      var m = metrics();
      bar.classList.toggle('is-idle', m.max <= 1);
      if (m.max <= 1) return;
      thumb.style.height = m.h + 'px';
      thumb.style.transform = 'translateY(' + ((m.track - m.h) * body.scrollTop / m.max) + 'px)';
    }
    on(body, 'scroll', sync, { passive: true });
    on(window, 'resize', sync);
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(sync);
      ro.observe(body);
      Array.prototype.forEach.call(body.children, function (c) { ro.observe(c); });
      cleanups.push(function () { ro.disconnect(); });
    }
    on(body, 'load', sync, true); // images arriving change the height
    thumb.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var m = metrics(), y0 = e.clientY, s0 = body.scrollTop;
      thumb.classList.add('is-dragging');
      try { thumb.setPointerCapture(e.pointerId); } catch (err) {}
      function moveTo(ev) { body.scrollTop = s0 + (ev.clientY - y0) * m.max / Math.max(1, m.track - m.h); }
      function up() {
        thumb.classList.remove('is-dragging');
        thumb.removeEventListener('pointermove', moveTo);
        thumb.removeEventListener('pointerup', up);
        thumb.removeEventListener('pointercancel', up);
      }
      thumb.addEventListener('pointermove', moveTo);
      thumb.addEventListener('pointerup', up);
      thumb.addEventListener('pointercancel', up);
    });
    bar.addEventListener('pointerdown', function (e) {
      if (e.target === thumb) return;
      var r = thumb.getBoundingClientRect();
      body.scrollBy({ top: (e.clientY < r.top ? -1 : 1) * body.clientHeight * 0.9, behavior: 'smooth' });
    });
    sync();
  }

  /* ================= feedback: click sound + haptics ================= */

  function makeFeedback() {
    var ctx = null;
    var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    var iosLabel = null, lastIos = 0;
    function unlock() {
      try {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        else if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { ctx = null; }
    }
    function click(freq, dur) {
      if (!ctx) return;
      try {
        var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.01);
      } catch (e) {}
    }
    // Android: Vibration API. iOS 18+: toggling a hidden native switch plays the
    // system tick, but only inside a tap, never while dragging.
    function buzz(ms) {
      if (!coarse) return;
      try {
        if (typeof navigator.vibrate === 'function') { navigator.vibrate(ms); return; }
        var now = Date.now(); if (now - lastIos < 35) return; lastIos = now;
        if (!iosLabel) {
          iosLabel = el('label');
          iosLabel.setAttribute('aria-hidden', 'true');
          iosLabel.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
          iosLabel.innerHTML = '<input type="checkbox" switch tabindex="-1">';
          doc.body.appendChild(iosLabel); added.push(iosLabel);
        }
        iosLabel.click();
      } catch (e) {}
    }
    return {
      unlock: unlock,
      tick: function () { buzz(12); click(1100, 0.03); },
      select: function () { buzz(18); click(600, 0.05); },
      back: function () { buzz(14); click(780, 0.045); }
    };
  }

  /* ================= lifecycle ================= */

  function mount() {
    var content = doc.querySelector('.page-content');
    var landing = !!doc.getElementById('projects');
    var header = buildHeader('landing');
    if (!landing) { header.setAttribute('inert', ''); header.setAttribute('aria-hidden', 'true'); } // behind the window
    if (content) prepend(header, content);
    if (landing) mountLanding();
    else mountWindow();
    syncThemeButtons();
    var mo = new MutationObserver(syncThemeButtons);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    cleanups.push(function () { mo.disconnect(); });
  }

  function unmount() {
    cleanups.splice(0).forEach(function (fn) { fn(); });
    // the page's own content goes back first, in its original order
    moved.splice(0).forEach(function (m) { m[1].insertBefore(m[0], m[2]); });
    added.splice(0).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
  }

  window.SiteModes.register('ipod', { mount: mount, unmount: unmount });
})();

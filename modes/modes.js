/* Copyright (c) 2026 Judy Wu. All rights reserved. See LICENSE. */
/* Site modes — the engine.
 *
 * A mode is a second way to present the same pages. Professional is the base;
 * every other mode is listed in modes/modes.json and adds its own stylesheets and,
 * for a shell mode, a script that rebuilds the page's layout from the content
 * already on it. This file:
 *
 *   - wires the nav's bao button (the easter egg) to the registry's "toggle" mode,
 *   - switches modes in place (no reload): loads the new mode's assets, then flips
 *     <html data-mode>, then lets the old shell clean up and the new one mount,
 *   - remembers the visitor's choice (localStorage, key from the registry), so the
 *     next visit opens in the mode they left in,
 *   - tidies a ?mode= link out of the address bar once the boot script has used it,
 *   - counts mode switches in GoatCounter as events.
 *
 * The first-paint choice is made by the inline boot script in the shared head
 * (scripts/partials/head.html); this file only takes over after parsing.
 *
 * Shell modes register a lifecycle with SiteModes.register(id, { mount, unmount }).
 * mount() runs whenever the mode becomes active on a page, unmount() when it stops.
 * Both must be safe to call again (a visitor can flip back and forth).
 *
 * See modes/README.md for how to add a mode.
 */
(function () {
  'use strict';

  var doc = document, root = doc.documentElement;
  var config;
  try { config = JSON.parse(doc.getElementById('site-modes').textContent); } catch (e) { return; }

  var byId = {};
  config.modes.forEach(function (m) { byId[m.id] = m; });

  var shells = {};          // id -> { mount, unmount }
  var mounted = null;       // id of the shell currently mounted
  var loading = {};         // id -> Promise for its assets

  function current() { return root.getAttribute('data-mode') || config['default']; }

  function store(id) {
    try { localStorage.setItem(config.storageKey, id); } catch (e) { /* storage blocked: the mode just won't persist */ }
  }

  /* ---------- assets ---------- */

  function assetsOf(id) { return doc.querySelectorAll('[data-mode-asset="' + id + '"]'); }

  function loadCss(id, href) {
    return new Promise(function (resolve) {
      var l = doc.createElement('link');
      l.rel = 'stylesheet'; l.media = 'screen'; l.href = href;
      l.setAttribute('data-mode-asset', id);
      l.onload = l.onerror = function () { resolve(); };
      doc.head.appendChild(l);
    });
  }

  function loadScript(id, src) {
    return new Promise(function (resolve) {
      var s = doc.createElement('script');
      s.src = src; s.setAttribute('data-mode-asset', id);
      s.onload = s.onerror = function () { resolve(); };
      doc.head.appendChild(s);
    });
  }

  // Loads whatever of a mode's stylesheets and script isn't on the page yet. Checked
  // per file: leaving a mode removes its stylesheets but keeps its script (so its
  // registration survives), and coming back must put the stylesheets back.
  function ensureAssets(id) {
    if (loading[id]) return loading[id];
    var m = byId[id], jobs = [];
    (m.css || []).forEach(function (h) {
      if (!doc.querySelector('link[data-mode-asset="' + id + '"][href="' + h + '"]')) jobs.push(loadCss(id, h));
    });
    if (m.shell && !doc.querySelector('script[data-mode-asset="' + id + '"]')) jobs.push(loadScript(id, m.shell));
    return (loading[id] = Promise.all(jobs));
  }

  function dropAssets(id) {
    // Stylesheets go (they would restyle the page); the script stays loaded so its
    // registration survives a switch back.
    Array.prototype.forEach.call(assetsOf(id), function (el) {
      if (el.tagName === 'LINK') el.parentNode.removeChild(el);
    });
    loading[id] = null;
  }

  /* ---------- shell lifecycle ---------- */

  function syncShell() {
    var id = current();
    if (mounted && mounted !== id && shells[mounted]) {
      try { shells[mounted].unmount(); } catch (e) { console.warn('[modes] unmount failed', e); }
      mounted = null;
    }
    if (mounted !== id && shells[id]) {
      try { shells[id].mount(); mounted = id; } catch (e) { console.warn('[modes] mount failed', e); }
    }
  }

  function register(id, api) {
    shells[id] = api;
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', syncShell, { once: true });
    else syncShell();
  }

  /* ---------- switching ---------- */

  function setMode(id, opts) {
    opts = opts || {};
    if (!byId[id]) return Promise.resolve();
    var from = current();
    if (id === from) return Promise.resolve();
    return ensureAssets(id).then(function () {
      root.setAttribute('data-mode', id);
      dropAssets(from);
      store(id);
      syncShell();
      announce(byId[id].label + ' mode on');
      count(id);
      doc.dispatchEvent(new CustomEvent('sitemode:change', { detail: { from: from, to: id } }));
      if (opts.focusMain) {
        var main = doc.getElementById('main');
        if (main) main.focus({ preventScroll: false });
      }
    });
  }

  function count(id) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: 'mode-' + id, title: 'Switched to ' + byId[id].label + ' mode', event: true });
      }
    } catch (e) { /* analytics is best-effort */ }
  }

  /* ---------- the nav's bao button: a hidden easter egg ---------- */

  var live = null;

  // One polite live region for mode changes, outside the nav (a mode may hide the nav).
  function announce(msg) {
    if (!live) {
      live = doc.createElement('p');
      live.className = 'mode-sr-only';
      live.setAttribute('aria-live', 'polite');
      doc.body.appendChild(live);
    }
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 50);
  }

  function buildToggle() {
    var btn = doc.querySelector('nav .nav-mode-toggle');
    var target = byId[config.toggle];
    if (!btn || !target || target.id === config['default']) return;
    btn.setAttribute('aria-label', 'Switch to ' + target.label + ' mode');
    btn.addEventListener('click', function () { setMode(target.id, { focusMain: true }); });
    btn.hidden = false;
  }

  /* ---------- tidy a ?mode= link ---------- */

  function tidyUrl() {
    try {
      var u = new URL(location.href);
      if (!u.searchParams.has('mode')) return;
      u.searchParams.delete('mode');
      history.replaceState(history.state, '', u.pathname + (u.search || '') + u.hash);
    } catch (e) { /* old browser: leave the URL as it is */ }
  }

  window.SiteModes = {
    register: register,
    set: setMode,
    current: current,
    modes: function () { return config.modes.slice(); },
    site: function () { return config.site || location.hostname; }
  };

  function init() {
    buildToggle();
    tidyUrl();
    syncShell();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

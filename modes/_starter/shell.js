/* Copyright (c) 2026 Judy Wu. All rights reserved. See LICENSE. */
/* <Mode name> mode — shell.   (starter: only SHELL modes need this file)
 *
 * Re-present the page that is already there. Read content from the DOM, never
 * hard-code it: the pages are the single source of truth, and check-modes.js
 * fails a mode that drops any of their words.
 *
 * mount() runs when the mode turns on, unmount() when it turns off. Both can run
 * many times on one page, so remove everything mount() added.
 */
(function () {
  'use strict';
  if (!window.SiteModes) return;

  var added = [];

  function mount() {
    // e.g. var main = document.getElementById('main'); ... build, then added.push(node)
  }

  function unmount() {
    added.splice(0).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
  }

  window.SiteModes.register('starter', { mount: mount, unmount: unmount });
})();

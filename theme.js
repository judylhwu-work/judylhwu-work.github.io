document.addEventListener('DOMContentLoaded', function () {
  var btn = document.querySelector('.nav-dark-mode');
  if (!btn) return;

  var lightLink = document.getElementById('sn-tokens-light');
  var darkLink  = document.getElementById('sn-tokens-dark');

  function applyTheme(isDark) {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (darkLink)  darkLink.disabled  = false;
      if (lightLink) lightLink.disabled = true;
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (darkLink)  darkLink.disabled  = true;
      if (lightLink) lightLink.disabled = false;
    }
  }

  // Sync token stylesheets with the state already applied by the inline FOUC script
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark');

  function stored() {
    try { return localStorage.getItem('theme'); } catch (e) { return null; }
  }

  function syncButtonState() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  syncButtonState();

  btn.addEventListener('click', function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(!isDark);
    syncButtonState();
    try { localStorage.setItem('theme', !isDark ? 'dark' : 'light'); } catch (e) {}
  });

  // Follow the OS while the visitor has not made an explicit choice. Once they
  // click the toggle, localStorage wins and OS changes are ignored.
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    var onChange = function (e) {
      if (stored()) return;
      applyTheme(e.matches);
      syncButtonState();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
});

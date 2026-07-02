document.addEventListener('DOMContentLoaded', function () {
  var btn = document.querySelector('.nav-dark-mode');
  if (!btn) return;

  var label    = btn.querySelector('.dark-mode-label');
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
    if (label) label.textContent = isDark ? 'Light mode' : 'Dark mode';
  }

  // Sync label with state already applied by the inline FOUC script
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark');

  btn.addEventListener('click', function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(!isDark);
    localStorage.setItem('theme', !isDark ? 'dark' : 'light');
  });
});

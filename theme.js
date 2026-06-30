document.addEventListener('DOMContentLoaded', function () {
  var btn = document.querySelector('.nav-dark-mode');
  if (!btn) return;

  var label = btn.querySelector('.dark-mode-label');

  function updateLabel() {
    if (!label) return;
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    label.textContent = isDark ? 'Light mode' : 'Dark mode';
  }

  updateLabel();

  btn.addEventListener('click', function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
    updateLabel();
  });
});

(function() {
  var basePath = document.currentScript.getAttribute('data-base') || '';
  var idle = basePath + 'assets/images/cursor-idle.png';
  var paw = basePath + 'assets/images/cursor-paw.png';
  new Image().src = paw;

  var c = document.createElement('img');
  c.src = idle;
  c.className = 'custom-cursor';
  c.alt = '';
  document.body.appendChild(c);

  document.addEventListener('mousemove', function(e) {
    c.style.left = e.clientX + 'px';
    c.style.top = e.clientY + 'px';
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var hovering = el && el.closest('a, button, [role="button"], input[type="submit"]');
    if (hovering) {
      c.src = paw;
      c.classList.add('is-hover');
    } else {
      c.src = idle;
      c.classList.remove('is-hover');
    }
  });
  document.addEventListener('mousedown', function() { c.src = paw; c.classList.add('is-hover'); });
  document.addEventListener('mouseup', function() { c.src = idle; c.classList.remove('is-hover'); });
})();

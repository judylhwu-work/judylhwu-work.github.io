(function () {
  const overlay = document.createElement('div');
  overlay.id = 'lightbox';
  overlay.innerHTML = [
    '<button id="lightbox-prev" aria-label="Previous image">',
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    '</button>',
    '<img id="lightbox-img" alt="">',
    '<button id="lightbox-next" aria-label="Next image">',
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    '</button>',
    '<button id="lightbox-close" aria-label="Close">',
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    '</button>',
    '<div id="lightbox-counter"></div>'
  ].join('');
  document.body.appendChild(overlay);

  const lbImg     = document.getElementById('lightbox-img');
  const lbClose   = document.getElementById('lightbox-close');
  const lbPrev    = document.getElementById('lightbox-prev');
  const lbNext    = document.getElementById('lightbox-next');
  const lbCounter = document.getElementById('lightbox-counter');

  let images = [];
  let current = 0;

  function fullSrc(src) {
    return src.replace(/w=\d+/, 'w=1920').replace(/quality=\d+/, 'quality=90');
  }

  function show(index) {
    current = (index + images.length) % images.length;
    lbImg.style.opacity = '0';
    var src = fullSrc(images[current].src);
    var next = new Image();
    next.onload = function () {
      lbImg.src = src;
      lbImg.style.opacity = '1';
    };
    next.src = src;
    lbCounter.textContent = (current + 1) + ' / ' + images.length;
    lbPrev.style.visibility = images.length > 1 ? 'visible' : 'hidden';
    lbNext.style.visibility = images.length > 1 ? 'visible' : 'hidden';
    lbCounter.style.visibility = images.length > 1 ? 'visible' : 'hidden';
  }

  function open(index) {
    show(index);
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  images = Array.from(document.querySelectorAll('.project-image, .project-image-grid img'));

  images.forEach(function (img, i) {
    img.classList.add('zoomable');
    img.addEventListener('click', function () { open(i); });
  });

  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  lbClose.addEventListener('click', close);
  lbPrev.addEventListener('click', function (e) { e.stopPropagation(); show(current - 1); });
  lbNext.addEventListener('click', function (e) { e.stopPropagation(); show(current + 1); });

  document.addEventListener('keydown', function (e) {
    if (!overlay.classList.contains('active')) return;
    if (e.key === 'Escape')     close();
    if (e.key === 'ArrowLeft')  show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
})();

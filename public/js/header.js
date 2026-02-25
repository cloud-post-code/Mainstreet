(function () {
  var menuBtn = document.getElementById('header-menu-btn');
  var header = document.querySelector('.site-header');
  var headerActions = document.getElementById('header-actions');
  if (!menuBtn || !header || !headerActions) return;

  var iconSpan = menuBtn.querySelector('.material-icons');

  function setOpen(open) {
    header.classList.toggle('nav-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (iconSpan) iconSpan.textContent = open ? 'close' : 'menu';
  }

  function isOpen() {
    return header.classList.contains('nav-open');
  }

  menuBtn.addEventListener('click', function () {
    setOpen(!isOpen());
  });

  // Close when clicking a nav link (not the auth trigger so sign-in can open panel)
  headerActions.querySelectorAll('a.header-btn').forEach(function (link) {
    link.addEventListener('click', function () {
      setOpen(false);
    });
  });

  // Close when clicking outside header
  document.addEventListener('click', function (e) {
    if (!isOpen()) return;
    if (header.contains(e.target)) return;
    setOpen(false);
  });

  // Close on escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });
})();

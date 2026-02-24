(function () {
  var IMAGES = [
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.39.51_AM-6c46718c-7cfc-4148-8fa4-21370b3935c0.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.39.57_AM-d11e21d0-bca0-4c2b-87d8-081bab731bf4.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.40.16_AM-bb7e091f-595c-4540-9fb0-673d6a7f9ab0.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.40.20_AM-c111d661-10b1-4e2c-8e57-d301f105258f.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.40.22_AM-e2aaf015-fbc1-4fd5-927c-206c61b88474.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.40.25_AM-f8eb9625-ff66-4a61-a0ac-7393b14b83dc.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.40.28_AM-74f1f8ab-c024-474f-aff6-4bf2ec8a48d0.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.40.31_AM-7dbb2da9-7308-4db9-b863-a5f75a9fa921.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.40.35_AM-f6fd5357-597c-48b1-a4af-402364fe9687.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.40.38_AM-21095ff8-9e4d-4b96-b396-c82a226f3570.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.40.40_AM-75fc027d-3799-4a0d-b592-08fb8b52c4bd.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.40.42_AM-a0ec757a-4255-4b53-b912-48656a021361.png',
    '/assets/backgrounds/Screenshot_2026-02-24_at_11.40.45_AM-b09b5aef-59f6-4102-a04e-3f0d93e07afd.png'
  ];

  var cacheBust = '?v=' + Date.now();

  function run() {
    var el = document.getElementById('site-bg-rotate');
    if (!el || IMAGES.length === 0) return;

    var lastIndex = -1;

    function setBackgroundFromScroll() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        if (lastIndex !== 0) {
          lastIndex = 0;
          el.style.backgroundImage = 'url("' + IMAGES[0] + cacheBust + '")';
        }
        return;
      }
      var progress = Math.min(1, Math.max(0, scrollTop / docHeight));
      var index = Math.min(IMAGES.length - 1, Math.floor(progress * IMAGES.length));
      if (index !== lastIndex) {
        lastIndex = index;
        el.style.backgroundImage = 'url("' + IMAGES[index] + cacheBust + '")';
      }
    }

    setBackgroundFromScroll();
    window.addEventListener('scroll', setBackgroundFromScroll, { passive: true });
    window.addEventListener('resize', setBackgroundFromScroll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

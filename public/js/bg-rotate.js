(function () {
  var BG_INTERVAL_MS = 5500;
  var IMAGES = [
    'assets/backgrounds/Screenshot_2026-02-24_at_11.39.51_AM-524cfce2-97d7-4f48-a73e-d3a3c559b91e.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.39.57_AM-fb0db13b-8435-4225-b02b-d6d84907da37.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.40.16_AM-8eb2a1ae-a22f-452e-863d-eef08051d8d9.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.40.20_AM-9e221b6c-bff8-4ed3-b329-817d41a77638.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.40.22_AM-60cbde65-7fb8-465c-bce8-239feb3d31f9.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.40.25_AM-bb1b7036-9bb3-4e2b-a999-a157bbacf1de.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.40.28_AM-f04edf9c-7ecb-4c84-9801-f7c5ac8205b6.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.40.31_AM-837a04f7-6ee7-4fa1-a038-017379c05951.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.40.35_AM-ce438142-6174-44aa-b833-969bb349ed77.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.40.38_AM-166c030e-3916-4552-93d8-ca60f4e839cb.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.40.40_AM-e8b317ba-077f-4a19-9b80-e8ea821d5d44.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.40.42_AM-cce3fe91-74a0-4f2e-8aa1-1297ba9f5fb4.png',
    'assets/backgrounds/Screenshot_2026-02-24_at_11.40.45_AM-d104ca5f-aa3e-4dbb-9d89-24862ddd7561.png'
  ];

  var cacheBust = '?v=' + Date.now();

  function run() {
    var el = document.getElementById('site-bg-rotate');
    if (!el || IMAGES.length === 0) return;
    var index = 0;
    function setNext() {
      el.style.backgroundImage = 'url("' + IMAGES[index] + cacheBust + '")';
      index = (index + 1) % IMAGES.length;
    }
    setNext();
    setInterval(setNext, BG_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

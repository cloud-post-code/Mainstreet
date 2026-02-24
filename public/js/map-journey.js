(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  var wrapper = document.getElementById('map-journey-wrapper');
  var bgEl = document.getElementById('map-journey-bg');
  var charactersEl = document.getElementById('map-journey-characters');
  var crayonEl = document.getElementById('map-crayon');
  var kidEls = document.querySelectorAll('.map-kid');

  if (!wrapper || !bgEl || !charactersEl || !crayonEl) return;

  // Multiple map backgrounds to rotate between (background layer only)
  var backgroundImages = [
    'assets/map-journey-1.png',
    'assets/map-journey-2.png',
    'assets/map-journey-3.png',
    'assets/map-journey-4.png'
  ];

  var tileHeightVh = 80;
  var vh = window.innerHeight * 0.01;
  var tileHeightPx = tileHeightVh * vh;
  var tilesBuilt = 0;
  bgEl.style.backgroundImage = 'none';

  function getRequiredTileCount() {
    var scrollH = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0,
      wrapper.offsetHeight,
      wrapper.scrollHeight,
      window.innerHeight * 4
    );
    var fromHeight = Math.ceil(scrollH / tileHeightPx) + 5;
    var minimum = 30;
    return Math.max(minimum, fromHeight);
  }

  function buildTilesToEnd() {
    var required = getRequiredTileCount();
    if (required <= tilesBuilt) return;
    for (var t = tilesBuilt; t < required; t++) {
      var tile = document.createElement('div');
      tile.className = 'map-tile' + (t % 2 === 1 ? ' map-tile--flipped' : '');
      tile.style.height = tileHeightPx + 'px';
      var bgIndex = t % backgroundImages.length;
      tile.style.backgroundImage = "url('" + backgroundImages[bgIndex] + "')";
      bgEl.appendChild(tile);
    }
    tilesBuilt = required;
  }

  buildTilesToEnd();

  // When page content grows (e.g. shop grid loads), add more tiles so background repeats to the end
  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(function () {
      buildTilesToEnd();
      ScrollTrigger.refresh();
    });
    ro.observe(wrapper);
  }

  // Path in wrapper-relative coordinates: diagonal from upper-right toward lower-left
  // Progress 0 = top of scroll, 1 = bottom of scroll
  function getPathPoint(progress, wrapWidth, wrapHeight) {
    progress = Math.max(0, Math.min(1, progress));
    var x = wrapWidth * (0.85 - progress * 0.7);
    var y = wrapHeight * (0.15 + progress * 0.65);
    return { x: x, y: y };
  }

  function getPathRotation(progress) {
    return -35 + progress * 10;
  }

  var scrollTriggerProxy = { progress: 0 };

  ScrollTrigger.create({
    trigger: wrapper,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,
    onUpdate: function (self) {
      scrollTriggerProxy.progress = self.progress;
    }
  });

  function updatePositions() {
    var progress = scrollTriggerProxy.progress;
    var w = wrapper.offsetWidth;
    var h = wrapper.offsetHeight;
    var point = getPathPoint(progress, w, h);
    var rotation = getPathRotation(progress);

    gsap.set(crayonEl, {
      left: point.x,
      top: point.y,
      xPercent: -50,
      yPercent: -50,
      rotation: rotation
    });

    // Kids spread along full path so you see one from time to time as you scroll
    var kidOffsets = [0.02, 0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86, 0.96];
    kidEls.forEach(function (el, i) {
      var offset = kidOffsets[i % kidOffsets.length];
      var p = progress - offset;
      if (p < -0.05 || p > 1.05) {
        el.style.visibility = 'hidden';
        return;
      }
      el.style.visibility = 'visible';
      var pt = getPathPoint(Math.max(0, Math.min(1, p)), w, h);
      gsap.set(el, {
        left: pt.x,
        top: pt.y,
        xPercent: -50,
        yPercent: -50
      });
    });
  }

  gsap.ticker.add(updatePositions);
  ScrollTrigger.addEventListener('refresh', updatePositions);
  function onRefresh() {
    buildTilesToEnd();
  }
  ScrollTrigger.addEventListener('refresh', onRefresh);
  window.addEventListener('resize', function () {
    buildTilesToEnd();
    ScrollTrigger.refresh();
  });
  updatePositions();

  setTimeout(function () { ScrollTrigger.refresh(); }, 1500);
  setTimeout(function () { ScrollTrigger.refresh(); }, 4000);
})();

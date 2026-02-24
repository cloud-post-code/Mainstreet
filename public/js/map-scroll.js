/**
 * Scroll-driven map journey: crayon and kid move along path as user scrolls.
 * Uses GSAP ScrollTrigger. Path and characters are positioned from SVG motion path.
 */
(function () {
  var motionPath = document.getElementById('motion-path');
  var drawnPath = document.getElementById('drawn-path');
  var crayon = document.getElementById('map-crayon');
  var kid = document.getElementById('map-kid');
  var section = document.getElementById('map-hero');

  if (!motionPath || !drawnPath || !crayon || !kid || !section) return;

  var pathLen = motionPath.getTotalLength();
  var pathDrawnLen = drawnPath.getTotalLength();
  drawnPath.style.strokeDasharray = String(pathDrawnLen);

  function pointAt(progress) {
    var p = Math.max(0, Math.min(1, progress));
    var len = p * pathLen;
    var pt = motionPath.getPointAtLength(len);
    return pt;
  }

  function angleAt(progress) {
    var p = Math.max(0, Math.min(1, progress));
    var len = p * pathLen;
    var eps = 2;
    var a = motionPath.getPointAtLength(Math.max(0, len - eps));
    var b = motionPath.getPointAtLength(Math.min(pathLen, len + eps));
    var angle = Math.atan2(b.y - a.y, b.x - a.x);
    return (angle * 180 / Math.PI) - 90;
  }

  function positionInSection(clientRect, pt) {
    var vbW = 400;
    var vbH = 300;
    var xPct = (pt.x / vbW) * 100;
    var yPct = (pt.y / vbH) * 100;
    return { x: xPct + '%', y: yPct + '%' };
  }

  function setPosition(el, pct, asCrayon) {
    var pt = pointAt(pct);
    var pos = positionInSection(section.getBoundingClientRect(), pt);
    el.style.left = pos.x;
    el.style.top = pos.y;
    if (asCrayon) {
    var deg = angleAt(pct);
    el.style.transform = 'translate(-50%, -50%) rotate(' + deg + 'deg)';
    } else {
    el.style.transform = 'translate(-50%, -50%)';
    }
  }

  function setDrawnPath(progress) {
    var p = Math.max(0, Math.min(1, progress));
    var offset = pathDrawnLen * (1 - p);
    drawnPath.style.strokeDashoffset = String(offset);
  }

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    setPosition(crayon, 0, true);
    setPosition(kid, 0.08, false);
    setDrawnPath(0);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    scrub: 1,
    onUpdate: function (self) {
      var progress = self.progress;
      setDrawnPath(progress);
      setPosition(crayon, progress, true);
      setPosition(kid, Math.min(1, progress + 0.08), false);
    }
  });

  setPosition(crayon, 0, true);
  setPosition(kid, 0.08, false);
  setDrawnPath(0);
})();

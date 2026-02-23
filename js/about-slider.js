/**
 * Company Profile slideshow – cycles through extracted slide images (no PDF).
 * Add images as assets/profile/slide-1.png, slide-2.png, etc. and matching .about-profile-slide elements.
 */
(function () {
  function init() {
    var slideshow = document.querySelector('.about-profile-slideshow');
    if (!slideshow) return;

    var track = slideshow.querySelector('.about-profile-slideshow-track');
    var slides = track ? track.querySelectorAll('.about-profile-slide') : [];
    var counterEl = slideshow.querySelector('.about-profile-slideshow-counter');
    var prevBtn = slideshow.querySelector('.about-profile-slideshow-prev');
    var nextBtn = slideshow.querySelector('.about-profile-slideshow-next');

    if (!slides.length || !counterEl || !prevBtn || !nextBtn) return;

    var total = slides.length;
    var current = 0;

    function goTo(index) {
      current = Math.max(0, Math.min(index, total - 1));
      slides.forEach(function (slide, i) {
        slide.classList.toggle('about-profile-slide-active', i === current);
      });
      counterEl.textContent = (current + 1) + ' / ' + total;
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === total - 1;
    }

    prevBtn.addEventListener('click', function () {
      goTo(current - 1);
    });
    nextBtn.addEventListener('click', function () {
      goTo(current + 1);
    });

    goTo(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

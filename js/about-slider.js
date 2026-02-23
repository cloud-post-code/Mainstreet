/**
 * Company Profile PDF slider – renders PDF pages as slides with prev/next arrows and slide counter.
 * Requires PDF.js (pdfjsLib) and assets/profile.pdf.
 */
(function () {
  var PDF_URL = 'assets/profile.pdf';

  function init() {
    var section = document.querySelector('.about-pdf-section');
    if (!section) return;

    var track = section.querySelector('.about-profile-slider-track');
    var counterEl = section.querySelector('.about-profile-slider-counter');
    var prevBtn = section.querySelector('.about-profile-slider-prev');
    var nextBtn = section.querySelector('.about-profile-slider-next');
    var fallbackEl = section.querySelector('.about-profile-slider-fallback');

    if (!track || !counterEl || !prevBtn || !nextBtn) return;

    var pdfDoc = null;
    var numPages = 0;
    var currentPage = 1;
    var scale = 1.2;
    var trackInner = track.querySelector('.about-profile-slider-inner');
    if (!trackInner) return;

    function showFallback(message) {
      if (fallbackEl) {
        fallbackEl.innerHTML = message;
        fallbackEl.hidden = false;
      }
      if (track) track.hidden = true;
      var controls = section.querySelector('.about-profile-slider-controls');
      if (controls) controls.style.display = 'none';
    }

    function updateCounter() {
      counterEl.textContent = currentPage + ' / ' + numPages;
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= numPages;
    }

    function showSlide(pageNum) {
      currentPage = Math.max(1, Math.min(pageNum, numPages));
      var slides = trackInner.querySelectorAll('.about-profile-slide');
      slides.forEach(function (slide, i) {
        slide.classList.toggle('about-profile-slide-active', i + 1 === currentPage);
      });
      updateCounter();
    }

    function renderPage(pageNum) {
      return pdfDoc.getPage(pageNum).then(function (page) {
        var viewport = page.getViewport({ scale: scale });
        var wrap = document.createElement('div');
        wrap.className = 'about-profile-slide' + (pageNum === 1 ? ' about-profile-slide-active' : '');
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        var transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
        wrap.appendChild(canvas);
        return page.render({
          canvasContext: ctx,
          transform: transform,
          viewport: viewport
        }).promise.then(function () {
          return wrap;
        });
      });
    }

    function loadPdf() {
      if (typeof pdfjsLib === 'undefined') {
        showFallback('PDF viewer could not load. <a href="' + PDF_URL + '" download>Download profile.pdf</a>.');
        return;
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjsLib.getDocument(PDF_URL).promise
        .then(function (doc) {
          pdfDoc = doc;
          numPages = doc.numPages;
          if (numPages === 0) {
            showFallback('No pages in profile. <a href="' + PDF_URL + '" download>Download profile.pdf</a>.');
            return;
          }
          var promises = [];
          for (var p = 1; p <= numPages; p++) {
            promises.push(renderPage(p));
          }
          return Promise.all(promises);
        })
        .then(function (slideEls) {
          if (!slideEls || slideEls.length === 0) return;
          trackInner.innerHTML = '';
          slideEls.forEach(function (el) {
            trackInner.appendChild(el);
          });
          track.hidden = false;
          if (fallbackEl) fallbackEl.hidden = true;
          counterEl.textContent = '1 / ' + numPages;
          prevBtn.disabled = true;
          nextBtn.disabled = numPages <= 1;
          prevBtn.addEventListener('click', function () {
            showSlide(currentPage - 1);
          });
          nextBtn.addEventListener('click', function () {
            showSlide(currentPage + 1);
          });
        })
        .catch(function () {
          showFallback('Profile PDF could not be loaded. <a href="' + PDF_URL + '" download>Download profile.pdf</a>.');
        });
    }

    loadPdf();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

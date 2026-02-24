(function () {
  var container = document.getElementById('site-map-bg');
  if (!container) return;

  var map = null;
  var rafScheduled = false;
  var lastProgress = -1;

  // Scroll path: start (top of page) and end (bottom of page) – Boston area, pan south
  var startCenter = { lat: 42.365, lng: -71.065 };
  var endCenter = { lat: 42.28, lng: -71.065 };
  var startZoom = 11;
  var endZoom = 10;

  function getScrollProgress() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return 0;
    return Math.max(0, Math.min(1, scrollTop / docHeight));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function updateMapPosition() {
    rafScheduled = false;
    if (!map) return;
    var progress = getScrollProgress();
    if (progress === lastProgress) return;
    lastProgress = progress;

    var lat = lerp(startCenter.lat, endCenter.lat, progress);
    var lng = lerp(startCenter.lng, endCenter.lng, progress);
    var zoom = lerp(startZoom, endZoom, progress);

    map.panTo({ lat: lat, lng: lng });
    map.setZoom(Math.round(zoom));
  }

  function onScroll() {
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(updateMapPosition);
    }
  }

  function loadMapsScript(apiKey, callback) {
    if (typeof google !== 'undefined' && google.maps) {
      callback();
      return;
    }
    var globalName = '__mainstreetMapBgInit';
    var done = false;
    function runInit() {
      if (done) return;
      done = true;
      if (window[globalName]) window[globalName] = null;
      callback();
    }
    window[globalName] = runInit;
    var script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey) + '&v=weekly&loading=async&callback=' + globalName;
    script.async = true;
    script.defer = true;
    script.onload = function () {
      if (typeof google !== 'undefined' && google.maps) runInit();
    };
    script.onerror = function () {
      console.warn('[map-bg] Google Maps script failed to load – check API key and that Maps JavaScript API is enabled.');
      container.style.display = 'none';
    };
    document.head.appendChild(script);
  }

  function initMap() {
    if (!container || typeof google === 'undefined' || !google.maps) return;

    var centerLat = lerp(startCenter.lat, endCenter.lat, 0);
    var centerLng = lerp(startCenter.lng, endCenter.lng, 0);

    map = new google.maps.Map(container, {
      center: { lat: centerLat, lng: centerLng },
      zoom: startZoom,
      disableDefaultUI: true,
      mapTypeControl: false,
      streetViewControl: false,
      zoomControl: false,
      fullscreenControl: false,
      scaleControl: false,
      rotateControl: false,
      panControl: false,
      gestureHandling: 'none',
      keyboardShortcuts: false,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { stylers: [{ saturation: 0.4 }, { lightness: 0.2 }] }
      ]
    });

    setTimeout(function () {
      if (map) google.maps.event.trigger(map, 'resize');
    }, 100);

    updateMapPosition();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      if (map) {
        google.maps.event.trigger(map, 'resize');
        updateMapPosition();
      }
    });
  }

  function run() {
    fetch('/api/config')
      .then(function (res) {
        if (!res.ok) {
          console.warn('[map-bg] /api/config returned', res.status, res.statusText);
          throw new Error('config ' + res.status);
        }
        return res.json();
      })
      .then(function (config) {
        var apiKey = (config && config.googleMapsApiKey) ? config.googleMapsApiKey.trim() : '';
        if (!apiKey) {
          console.warn('[map-bg] No GOOGLE_MAPS_API_KEY in config – set GOOGLE_MAPS_API_KEY in Railway (or .env) to show the map.');
          container.style.display = 'none';
          return;
        }
        loadMapsScript(apiKey, function () {
          initMap();
        });
      })
      .catch(function (err) {
        console.warn('[map-bg] Failed to load config or map:', err && err.message ? err.message : err);
        container.style.display = 'none';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

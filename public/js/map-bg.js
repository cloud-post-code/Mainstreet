(function () {
  var container = document.getElementById('site-map-bg');
  var backdrop = document.getElementById('site-map-backdrop');
  if (!container) return;

  var map = null;
  var rafId = null;

  // Scroll path: start (top) to end (bottom) – map pans so scroll pixels match map progress
  var startCenter = { lat: 42.48, lng: -71.065 };
  var endCenter = { lat: 42.12, lng: -71.065 };
  var mapZoom = 17;
  var lookAhead = 0.04; // center map slightly ahead of scroll so tiles below load sooner
  // Map moves this fraction of scroll progress (0.1 = 10x slower than 1:1)
  var mapSpeedFactor = 0.1;

  function getScrollMetrics() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var scrollHeight = document.documentElement.scrollHeight;
    var clientHeight = window.innerHeight;
    var maxScrollPx = Math.max(0, scrollHeight - clientHeight);
    return { scrollTop: scrollTop, maxScrollPx: maxScrollPx };
  }

  function getScrollProgress() {
    var m = getScrollMetrics();
    if (m.maxScrollPx <= 0) return 0;
    return Math.max(0, Math.min(1, m.scrollTop / m.maxScrollPx));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function syncMapToScroll() {
    if (!map) return;
    var m = getScrollMetrics();
    if (m.maxScrollPx <= 0) {
      map.setCenter({ lat: startCenter.lat, lng: startCenter.lng });
      return;
    }
    // Progress = scroll fraction scaled so map moves 10x slower than scroll
    var scrollProgress = Math.max(0, Math.min(1, m.scrollTop / m.maxScrollPx));
    var progress = scrollProgress * mapSpeedFactor;
    var ahead = Math.min(1, progress + lookAhead);
    var lat = lerp(startCenter.lat, endCenter.lat, ahead);
    var lng = lerp(startCenter.lng, endCenter.lng, ahead);
    map.setCenter({ lat: lat, lng: lng });
  }

  function startScrollSyncLoop() {
    function loop() {
      syncMapToScroll();
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  function showMap() {
    if (backdrop) backdrop.style.opacity = '1';
  }

  function hideMap() {
    if (backdrop) backdrop.style.opacity = '0';
  }

  if (backdrop) backdrop.style.opacity = '0';

  function loadMapsScript(apiKey, callback) {
    if (typeof google !== 'undefined' && google.maps) {
      callback();
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey) + '&v=weekly';
    script.async = true;
    script.defer = true;
    script.onload = function () {
      try {
        if (typeof google !== 'undefined' && google.maps) callback();
        else throw new Error('Maps API not available after load');
      } catch (e) {
        console.warn('[map-bg] Maps init failed:', e && e.message ? e.message : e);
        container.style.display = 'none';
      }
    };
    script.onerror = function () {
      console.warn('[map-bg] Google Maps script failed to load – check API key and that Maps JavaScript API is enabled.');
      container.style.display = 'none';
    };
    document.head.appendChild(script);
  }

  function initMap() {
    if (!container || typeof google === 'undefined' || !google.maps) return;
    try {
      var centerLat = lerp(startCenter.lat, endCenter.lat, 0);
      var centerLng = lerp(startCenter.lng, endCenter.lng, 0);

      map = new google.maps.Map(container, {
        center: { lat: centerLat, lng: centerLng },
        zoom: mapZoom,
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
        // Preload after resize so fitBounds uses correct dimensions
        (function preloadFullPath() {
          if (!map) return;
          var bounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(Math.min(startCenter.lat, endCenter.lat), Math.min(startCenter.lng, endCenter.lng)),
            new google.maps.LatLng(Math.max(startCenter.lat, endCenter.lat), Math.max(startCenter.lng, endCenter.lng))
          );
          map.fitBounds(bounds);
          google.maps.event.addListenerOnce(map, 'idle', function () {
            map.setZoom(mapZoom);
            map.setCenter({ lat: startCenter.lat, lng: startCenter.lng });
            google.maps.event.addListenerOnce(map, 'idle', function () {
              showMap();
              startScrollSyncLoop();
            });
          });
        })();
      }, 100);

      window.addEventListener('resize', function () {
        if (map) {
          google.maps.event.trigger(map, 'resize');
          syncMapToScroll();
        }
      });
    } catch (e) {
      console.warn('[map-bg] Map init error:', e && e.message ? e.message : e);
      container.style.display = 'none';
    }
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

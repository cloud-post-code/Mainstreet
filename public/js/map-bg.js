(function () {
  var container = document.getElementById('site-map-bg');
  if (!container) return;

  var map = null;
  var rafId = null;

  // Scroll path: start (top) to end (bottom) – long journey, very zoomed in
  var startCenter = { lat: 42.48, lng: -71.065 };
  var endCenter = { lat: 42.12, lng: -71.065 };
  var mapZoom = 17;
  var smoothFactor = 0.14;

  // Target center from scroll; smooth-follow updates map toward this
  var targetLat = startCenter.lat;
  var targetLng = startCenter.lng;

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
    if (!map) return;
    var progress = getScrollProgress();
    targetLat = lerp(startCenter.lat, endCenter.lat, progress);
    targetLng = lerp(startCenter.lng, endCenter.lng, progress);
  }

  function tick() {
    if (!map) return;
    var center = map.getCenter();
    if (!center) return;
    var lat = center.lat();
    var lng = center.lng();
    var newLat = lat + (targetLat - lat) * smoothFactor;
    var newLng = lng + (targetLng - lng) * smoothFactor;
    map.panTo({ lat: newLat, lng: newLng });
    var dist = Math.abs(newLat - targetLat) + Math.abs(newLng - targetLng);
    if (dist > 1e-5) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  }

  function onScroll() {
    updateMapPosition();
    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
  }

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
      }, 100);

      updateMapPosition();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', function () {
        if (map) {
          google.maps.event.trigger(map, 'resize');
          updateMapPosition();
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

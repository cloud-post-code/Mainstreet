(function () {
  const PAGE_SIZE = 9;
  const FAVORITES_KEY = 'mainstreet-favorites';
  const COMMENTS_KEY_PREFIX = 'mainstreet-comments-';
  const grid = document.getElementById('shop-grid');
  const searchInput = document.getElementById('search-input');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const scrollSentinel = document.getElementById('scroll-sentinel');
  const loadingIndicator = document.getElementById('loading-indicator');
  const noResults = document.getElementById('no-results');
  const favoritesLink = document.getElementById('favorites-link');

  let currentShareLink = '';
  let currentShareName = '';
  let currentCommentShopId = null;

  let allShops = [];
  let filteredShops = [];
  let visibleCount = 0;
  let currentCategory = 'all';
  let showFavoritesOnly = false;
  var serverFavoritesIds = null;

  var categoryDisplayNames = {
    'all': 'Main Street',
    'Clothing Boutique': 'Apparel Avenue',
    'Gifts': 'Present Parkway',
    'Vintage / Thrift': 'Secondhand Street',
    'Stationary': 'Letter Lane',
    'Home Good': 'Decor Detour'
  };

  function getCategoryDisplayName(category) {
    if (!category) return '';
    return categoryDisplayNames[category] || category;
  }

  function getFavorites() {
    if (window.getCurrentUser && window.getCurrentUser() && Array.isArray(serverFavoritesIds)) return serverFavoritesIds;
    try {
      var raw = localStorage.getItem(FAVORITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setFavorites(ids) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  }

  function fetchServerFavorites() {
    if (!window.getCurrentUser || !window.getCurrentUser()) return Promise.resolve();
    return fetch('/api/favorites', { credentials: 'include' })
      .then(function (r) {
        if (r.ok) return r.json();
        return [];
      })
      .then(function (ids) {
        serverFavoritesIds = ids;
        renderVisibleCards();
      })
      .catch(function () {
        serverFavoritesIds = [];
      });
  }

  function toggleFavorite(id) {
    if (window.getCurrentUser && window.getCurrentUser()) {
      fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ shopId: id })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && Array.isArray(serverFavoritesIds)) {
            if (data.favorited) serverFavoritesIds.push(id);
            else serverFavoritesIds = serverFavoritesIds.filter(function (x) { return x !== id; });
          }
          renderVisibleCards();
        })
        .catch(function () { renderVisibleCards(); });
      return;
    }
    var fav = getFavorites();
    var idx = fav.indexOf(id);
    if (idx === -1) fav.push(id);
    else fav.splice(idx, 1);
    setFavorites(fav);
    renderVisibleCards();
  }

  function isFavorited(id) {
    return getFavorites().indexOf(id) !== -1;
  }

  function getComments(shopId) {
    try {
      var raw = localStorage.getItem(COMMENTS_KEY_PREFIX + shopId);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setComments(shopId, comments) {
    localStorage.setItem(COMMENTS_KEY_PREFIX + shopId, JSON.stringify(comments));
  }

  function openShareModal(shop) {
    currentShareLink = (shop && shop.link) ? shop.link : '';
    currentShareName = (shop && shop.name) ? shop.name : 'Shop';
    var overlay = document.getElementById('share-modal-overlay');
    var copyBtn = document.getElementById('share-copy-btn');
    var viaBtn = document.getElementById('share-via-btn');
    if (overlay) {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
    }
    if (copyBtn) {
      copyBtn.textContent = 'Copy link';
      copyBtn.classList.remove('copied');
    }
    if (viaBtn) {
      viaBtn.style.display = navigator.share ? 'block' : 'none';
    }
  }

  function closeShareModal() {
    var overlay = document.getElementById('share-modal-overlay');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  function openCommentSidebar(shop) {
    if (!shop) return;
    currentCommentShopId = shop.id;
    var sidebar = document.getElementById('comment-sidebar');
    var titleEl = document.getElementById('comment-sidebar-title');
    var overlay = document.getElementById('comment-sidebar-overlay');
    var commentForm = document.getElementById('comment-form');
    if (titleEl) titleEl.textContent = 'Comments – ' + (shop.name || 'Shop');
    if (sidebar) {
      sidebar.classList.add('is-open');
      sidebar.setAttribute('aria-hidden', 'false');
    }
    if (overlay) {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
    }
    if (window.getCurrentUser && window.getCurrentUser()) {
      if (commentForm) commentForm.style.display = '';
      fetch('/api/shops/' + encodeURIComponent(shop.id) + '/comments', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (comments) { renderCommentListFromApi(shop.id, comments); })
        .catch(function () { renderCommentListFromApi(shop.id, []); });
    } else {
      if (commentForm) commentForm.style.display = 'none';
      renderCommentList(shop.id);
    }
    var input = document.getElementById('comment-input');
    if (input) input.value = '';
  }

  function closeCommentSidebar() {
    var sidebar = document.getElementById('comment-sidebar');
    var overlay = document.getElementById('comment-sidebar-overlay');
    if (sidebar) {
      sidebar.classList.remove('is-open');
      sidebar.setAttribute('aria-hidden', 'true');
    }
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    currentCommentShopId = null;
  }

  function renderCommentList(shopId) {
    var listEl = document.getElementById('comment-list');
    if (!listEl) return;
    var comments = getComments(shopId);
    listEl.innerHTML = '';
    var signInMsg = document.createElement('p');
    signInMsg.className = 'comment-signin-msg';
    signInMsg.textContent = 'Sign in to comment.';
    listEl.appendChild(signInMsg);
    comments.forEach(function (c) {
      var div = document.createElement('div');
      div.className = 'comment-item';
      var dateStr = (c.date || c.created_at) ? new Date(c.date || c.created_at).toLocaleDateString() : '';
      var by = (c.username) ? ' <span class="comment-item-by">' + escapeHtml(c.username) + '</span>' : '';
      div.innerHTML = '<p class="comment-item-text">' + escapeHtml(c.text) + by + '</p><p class="comment-item-date">' + escapeHtml(dateStr) + '</p>';
      listEl.appendChild(div);
    });
  }

  function renderCommentListFromApi(shopId, comments) {
    var listEl = document.getElementById('comment-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    (comments || []).forEach(function (c) {
      var div = document.createElement('div');
      div.className = 'comment-item';
      var dateStr = (c.created_at) ? new Date(c.created_at).toLocaleDateString() : '';
      var by = (c.username) ? ' <span class="comment-item-by">' + escapeHtml(c.username) + '</span>' : '';
      div.innerHTML = '<p class="comment-item-text">' + escapeHtml(c.text) + by + '</p><p class="comment-item-date">' + escapeHtml(dateStr) + '</p>';
      listEl.appendChild(div);
    });
  }

  var productLabelSets = [
    ['Blouse', 'Denim Jacket', 'Scarf', 'Handbag', 'Earrings', 'Sunglasses'],
    ['Gift Box', 'Candle Set', 'Greeting Card', 'Basket', 'Wrap', 'Bow'],
    ['Vintage Lamp', 'Retro Frame', 'Classic Bag', 'Antique Vase', 'Clock', 'Mirror'],
    ['Notebook', 'Pen Set', 'Letter Paper', 'Journal', 'Stamps', 'Envelope'],
    ['Throw Pillow', 'Ceramic Vase', 'Candle', 'Rug', 'Tray', 'Bowl'],
    ['Summer Dress', 'Blazer', 'Accessories', 'Shoes', 'Hat', 'Belt'],
    ['Ornament', 'Soap Set', 'Mug', 'Tote', 'Coaster', 'Napkin'],
    ['Leather Jacket', 'Vinyl Record', 'Typewriter', 'Mirror', 'Camera', 'Glasses'],
    ['Invitation Set', 'Calligraphy Pen', 'Wax Seal', 'Envelope', 'Ribbon', 'Tag'],
    ['Table Lamp', 'Blanket', 'Planter', 'Art Print', 'Frame', 'Shelf'],
    ['Cardigan', 'Skirt', 'Jewelry', 'Sunglasses', 'Watch', 'Bag'],
    ['Chocolate Box', 'Tea Set', 'Puzzle', 'Book', 'Card Game', 'Candle'],
    ['Denim Jeans', 'Band Tee', 'Sneakers', 'Belt', 'Cap', 'Wallet'],
    ['Desk Organizer', 'Stickers', 'Tape Roll', 'Highlighters', 'Clips', 'Ruler'],
    ['Shelf Unit', 'Throw', 'Diffuser', 'Coasters', 'Basket', 'Jar']
  ];

  function createCard(shop) {
    const card = document.createElement('article');
    card.className = 'shop-card';
    card.dataset.shopId = shop.id;

    const PLACEHOLDER_PHOTO = 'https://placehold.co/200x200/1d761e/fefff5?text=Photo';
    const rawPhotos = (shop.productPhotos && shop.productPhotos.length) ? shop.productPhotos.slice(0, 6) : [];
    const productPhotos = [];
    for (let i = 0; i < 6; i++) {
      productPhotos.push(rawPhotos[i] || PLACEHOLDER_PHOTO);
    }
    const baseLabels = (shop.productLabels && shop.productLabels.length >= 6)
      ? shop.productLabels.slice(0, 6)
      : (productLabelSets[(parseInt(shop.id, 10) - 1) % productLabelSets.length] || ['Product 1', 'Product 2', 'Product 3', 'Product 4', 'Product 5', 'Product 6']);
    const labels = baseLabels.length >= 6 ? baseLabels : baseLabels.concat(['Product 5', 'Product 6'].slice(0, 6 - baseLabels.length));

    const name = escapeHtml(shop.name || 'Shop');
    const address = escapeHtml([shop.address, shop.city].filter(Boolean).join(', ') || 'Address');
    const desc = escapeHtml(shop.description || '');
    const link = (shop.link || '#').replace(/"/g, '&quot;');
    const shopImg = (shop.shopImage || shop.logo || 'https://placehold.co/800x500/1d761e/fefff5?text=Shop').replace(/"/g, '&quot;');
    const logoUrl = (shop.logo && String(shop.logo).trim()) ? String(shop.logo).trim().replace(/"/g, '&quot;') : 'https://placehold.co/48x48/1d761e/fefff5?text=Logo';

    const favorited = isFavorited(shop.id);

    var productBlocks = '';
    for (var i = 0; i < 6; i++) {
      productBlocks +=
        '<div class="product-cell">' +
        '<img src="' + escapeHtml(productPhotos[i]) + '" alt="">' +
        '</div>';
    }

    card.innerHTML =
      '<div class="card-top-actions">' +
      '<button type="button" class="card-icon-btn card-comment-btn" data-shop-id="' + escapeHtml(shop.id) + '" aria-label="Comment"><span class="material-icons">comment</span></button>' +
      '<button type="button" class="card-icon-btn card-share-btn" data-shop-id="' + escapeHtml(shop.id) + '" aria-label="Share"><span class="material-icons">share</span></button>' +
      '<button type="button" class="card-icon-btn favorite-btn' + (favorited ? ' favorited' : '') + '" data-shop-id="' + escapeHtml(shop.id) + '" aria-label="' + (favorited ? 'Unsave' : 'Save') + ' shop">' +
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' +
      '</button></div>' +
      '<header class="shop-card-header">' +
      '<div class="shop-card-title-row">' +
      '<img class="shop-card-logo" src="' + logoUrl + '" alt="">' +
      '<h2 class="shop-card-title">' + name + '</h2>' +
      '</div>' +
      '<div class="shop-card-location">' +
      '<span class="material-icons">location_on</span>' +
      '<p>' + address + '</p></div></header>' +
      '<div class="shop-card-grid">' +
      '<section class="shop-card-left">' +
      '<div class="shop-hero-wrap">' +
      '<img src="' + shopImg + '" alt="">' +
      '</div>' +
      '<div class="shop-card-prose">' +
      '<p>' + desc + '</p></div></section>' +
      '<section class="shop-card-right">' +
      '<div class="product-grid">' + productBlocks + '</div>' +
      '<a href="' + link + '" class="view-more-btn" target="_blank" rel="noopener noreferrer">Enter Store<span class="material-icons">arrow_forward</span></a>' +
      '<div class="shop-card-stat-single">' +
      '<span class="shop-card-category">' + escapeHtml(getCategoryDisplayName(shop.category)) + '</span>' +
      '<span class="shop-card-item-count">' + (shop.productCount || (shop.productPhotos ? shop.productPhotos.length : 6)) + ' items</span>' +
      '</div></section></div>';

    const btn = card.querySelector('.favorite-btn');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(shop.id);
    });

    var shareBtnEl = card.querySelector('.card-share-btn');
    if (shareBtnEl) shareBtnEl.addEventListener('click', function () { openShareModal(shop); });
    var commentBtnEl = card.querySelector('.card-comment-btn');
    if (commentBtnEl) commentBtnEl.addEventListener('click', function () { openCommentSidebar(shop); });

    return card;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function getCategoriesWithShops() {
    var set = {};
    allShops.forEach(function (shop) {
      if (shop.category && shop.category.trim()) set[shop.category.trim()] = true;
    });
    return set;
  }

  function hideEmptyStreets() {
    var categoriesWithShops = getCategoriesWithShops();
    filterBtns.forEach(function (btn) {
      var filter = btn.dataset.filter || 'all';
      if (filter === 'all') {
        btn.classList.remove('street-empty');
      } else {
        if (categoriesWithShops[filter]) {
          btn.classList.remove('street-empty');
        } else {
          btn.classList.add('street-empty');
        }
      }
    });
    if (currentCategory !== 'all' && !categoriesWithShops[currentCategory]) {
      currentCategory = 'all';
      filterBtns.forEach(function (b) {
        b.classList.toggle('active', (b.dataset.filter || 'all') === 'all');
      });
    }
  }

  function applyFilters() {
    const query = (searchInput.value || '').trim().toLowerCase();
    const fav = getFavorites();

    filteredShops = allShops.filter(function (shop) {
      if (showFavoritesOnly && fav.indexOf(shop.id) === -1) return false;
      if (currentCategory !== 'all' && shop.category !== currentCategory) return false;
      if (query) {
        var name = (shop.name || '').toLowerCase();
        var category = (shop.category || '').toLowerCase();
        var address = (shop.address || '').toLowerCase();
        var city = (shop.city || '').toLowerCase();
        var description = (shop.description || '').toLowerCase();
        var location = (address + ' ' + city).trim();
        var match = name.indexOf(query) !== -1 || category.indexOf(query) !== -1 ||
          address.indexOf(query) !== -1 || city.indexOf(query) !== -1 ||
          location.indexOf(query) !== -1 || description.indexOf(query) !== -1;
        if (!match) return false;
      }
      return true;
    });
  }

  function renderVisibleCards() {
    applyFilters();
    visibleCount = 0;
    grid.innerHTML = '';

    var toShow = filteredShops.slice(0, PAGE_SIZE);
    visibleCount = toShow.length;

    toShow.forEach(function (shop) {
      grid.appendChild(createCard(shop));
    });

    loadingIndicator.hidden = true;
    noResults.hidden = toShow.length > 0 || filteredShops.length > 0;
    if (filteredShops.length === 0) {
      noResults.hidden = false;
      noResults.textContent = showFavoritesOnly ? 'No favorites yet. Save shops with the heart icon.' : 'No shops match your search or filters.';
    }
    observeSentinel();
  }

  function loadMore() {
    if (visibleCount >= filteredShops.length) return;
    loadingIndicator.hidden = false;
    var next = filteredShops.slice(visibleCount, visibleCount + PAGE_SIZE);
    next.forEach(function (shop) {
      grid.appendChild(createCard(shop));
    });
    visibleCount += next.length;
    loadingIndicator.hidden = true;
    observeSentinel();
  }

  function observeSentinel() {
    if (typeof IntersectionObserver === 'undefined') return;
    var observer = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting && visibleCount < filteredShops.length) loadMore();
      },
      { rootMargin: '100px', threshold: 0 }
    );
    observer.disconnect();
    if (scrollSentinel) observer.observe(scrollSentinel);
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentCategory = btn.dataset.filter || 'all';
      renderVisibleCards();
    });
  });

  searchInput.addEventListener('input', function () {
    renderVisibleCards();
  });

  searchInput.addEventListener('search', function () {
    renderVisibleCards();
  });

  favoritesLink.addEventListener('click', function (e) {
    e.preventDefault();
    showFavoritesOnly = !showFavoritesOnly;
    favoritesLink.classList.toggle('active', showFavoritesOnly);
    renderVisibleCards();
  });

  var logoLink = document.getElementById('logo-link');
  if (logoLink) {
    logoLink.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo(0, 0);
      if (searchInput) searchInput.value = '';
      currentCategory = 'all';
      showFavoritesOnly = false;
      filterBtns.forEach(function (b) { b.classList.remove('active'); if (b.dataset.filter === 'all') b.classList.add('active'); });
      if (favoritesLink) favoritesLink.classList.remove('active');
      renderVisibleCards();
    });
  }

  var shareOverlay = document.getElementById('share-modal-overlay');
  var shareClose = document.getElementById('share-modal-close');
  var shareCopyBtn = document.getElementById('share-copy-btn');
  var shareViaBtn = document.getElementById('share-via-btn');
  if (shareOverlay) shareOverlay.addEventListener('click', function (e) { if (e.target === shareOverlay) closeShareModal(); });
  if (shareClose) shareClose.addEventListener('click', closeShareModal);
  if (shareCopyBtn) {
    shareCopyBtn.addEventListener('click', function () {
      try {
        navigator.clipboard.writeText(currentShareLink || '');
        shareCopyBtn.textContent = 'Copied!';
        shareCopyBtn.classList.add('copied');
        setTimeout(function () { shareCopyBtn.textContent = 'Copy link'; shareCopyBtn.classList.remove('copied'); }, 2000);
      } catch (e) {}
    });
  }
  if (shareViaBtn) {
    shareViaBtn.addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({ title: currentShareName, url: currentShareLink }).catch(function () {});
      }
    });
  }

  var commentOverlay = document.getElementById('comment-sidebar-overlay');
  var commentClose = document.getElementById('comment-sidebar-close');
  var commentForm = document.getElementById('comment-form');
  if (commentOverlay) commentOverlay.addEventListener('click', closeCommentSidebar);
  if (commentClose) commentClose.addEventListener('click', closeCommentSidebar);
  if (commentForm) {
    commentForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!currentCommentShopId) return;
      var input = document.getElementById('comment-input');
      var text = (input && input.value && input.value.trim()) || '';
      if (!text) return;
      if (window.getCurrentUser && window.getCurrentUser()) {
        fetch('/api/shops/' + encodeURIComponent(currentCommentShopId) + '/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text: text })
        })
          .then(function (r) {
            if (r.ok) return r.json();
            throw new Error('Failed to post');
          })
          .then(function (newComment) {
            var listEl = document.getElementById('comment-list');
            if (listEl && newComment) {
              var div = document.createElement('div');
              div.className = 'comment-item';
              var dateStr = (newComment.created_at) ? new Date(newComment.created_at).toLocaleDateString() : '';
              var by = (newComment.username) ? ' <span class="comment-item-by">' + escapeHtml(newComment.username) + '</span>' : '';
              div.innerHTML = '<p class="comment-item-text">' + escapeHtml(newComment.text) + by + '</p><p class="comment-item-date">' + escapeHtml(dateStr) + '</p>';
              listEl.appendChild(div);
            }
            if (input) input.value = '';
          })
          .catch(function () {
            if (input) input.value = '';
          });
        return;
      }
      var comments = getComments(currentCommentShopId);
      comments.push({ text: text, date: new Date().toISOString() });
      setComments(currentCommentShopId, comments);
      renderCommentList(currentCommentShopId);
      if (input) input.value = '';
    });
  }

  function init() {
    fetch('/api/shops', { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allShops = Array.isArray(data) ? data : [];
        hideEmptyStreets();
        if (window.getCurrentUser && window.getCurrentUser()) {
          fetchServerFavorites();
        } else {
          renderVisibleCards();
        }
      })
      .catch(function () {
        noResults.hidden = false;
        noResults.textContent = 'Could not load shops.';
      });
    window.addEventListener('auth-change', function () {
      if (window.getCurrentUser && window.getCurrentUser()) {
        serverFavoritesIds = null;
        fetchServerFavorites();
      } else {
        serverFavoritesIds = null;
        renderVisibleCards();
      }
    });
  }

  init();
})();

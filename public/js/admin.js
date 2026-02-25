(function () {
  const creds = { credentials: 'include' };

  function getEl(id) {
    return document.getElementById(id);
  }

  function showMessage(text, isError) {
    var el = getEl('admin-message');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
    el.classList.toggle('admin-message-error', !!isError);
  }

  function handleAuthResponse(user) {
    var forbidden = getEl('admin-forbidden');
    var content = getEl('admin-content');
    if (!user || !user.is_admin) {
      if (forbidden) forbidden.hidden = false;
      if (content) content.hidden = true;
      setTimeout(function () {
        if (!window.getCurrentUser || !window.getCurrentUser()) {
          window.location.href = 'index.html';
        }
      }, 1500);
      return false;
    }
    if (forbidden) forbidden.hidden = true;
    if (content) content.hidden = false;
    return true;
  }

  function escapeHtml(s) {
    if (s == null || s === undefined) return '';
    var str = String(s);
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getProductPhotosArray(shop) {
    var raw = shop.productPhotos || shop.product_photos;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'string') {
      var trimmed = raw.trim();
      if (!trimmed) return [];
      try {
        var parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function collectProductPhotosFromRow(tr) {
    var arr = [];
    for (var i = 0; i < 6; i++) {
      var input = tr.querySelector('.admin-input-product-photo[data-photo-index="' + i + '"]');
      if (input && input.value && input.value.trim()) {
        arr.push(input.value.trim());
      }
    }
    return arr;
  }

  function buildRow(shop) {
    var tr = document.createElement('tr');
    var rowId = shop.id != null && shop.id !== '' ? String(shop.id) : '';
    tr.setAttribute('data-shop-id', rowId || 'new');
    var id = shop.id || '';
    var name = shop.name || '';
    var address = shop.address || '';
    var city = shop.city || '';
    var category = shop.category || '';
    var description = shop.description || '';
    var link = shop.link || '';
    var shopImage = shop.shopImage || shop.shop_image || '';
    var logo = shop.logo || '';
    var productCount = shop.productCount || shop.product_count || '';
    var enterStoreClicks = shop.enterStoreClicks ?? shop.enter_store_clicks ?? 0;
    var productPhotosArr = getProductPhotosArray(shop);
    var productPhotosCell = '';
    for (var i = 0; i < 6; i++) {
      var url = (productPhotosArr[i] != null && productPhotosArr[i] !== undefined) ? String(productPhotosArr[i]) : '';
      productPhotosCell += '<input type="url" class="admin-input admin-input-product-photo" data-photo-index="' + i + '" value="' + escapeHtml(url) + '" placeholder="Image ' + (i + 1) + '" aria-label="Product image ' + (i + 1) + '">';
    }
    productPhotosCell = '<td class="admin-product-photos-cell"><div class="admin-product-photos-wrap">' + productPhotosCell + '</div></td>';

    tr.innerHTML =
      '<td><input type="text" class="admin-input admin-input-id" value="' + escapeHtml(id) + '" readonly aria-label="ID"></td>' +
      '<td class="admin-enter-clicks-cell">' + escapeHtml(String(enterStoreClicks)) + '</td>' +
      '<td><input type="text" class="admin-input" data-field="name" value="' + escapeHtml(name) + '" aria-label="Name"></td>' +
      '<td><input type="text" class="admin-input" data-field="address" value="' + escapeHtml(address) + '" aria-label="Address"></td>' +
      '<td><input type="text" class="admin-input" data-field="city" value="' + escapeHtml(city) + '" aria-label="City"></td>' +
      '<td><input type="text" class="admin-input" data-field="category" value="' + escapeHtml(category) + '" aria-label="Category"></td>' +
      '<td><textarea class="admin-input admin-input-description" data-field="description" rows="2" aria-label="Description">' + escapeHtml(description) + '</textarea></td>' +
      '<td><input type="text" class="admin-input" data-field="link" value="' + escapeHtml(link) + '" aria-label="Link"></td>' +
      '<td><input type="text" class="admin-input" data-field="shop_image" value="' + escapeHtml(shopImage) + '" aria-label="Shop image URL"></td>' +
      '<td><input type="text" class="admin-input" data-field="logo" value="' + escapeHtml(logo) + '" aria-label="Logo URL"></td>' +
      '<td><input type="text" class="admin-input" data-field="product_count" value="' + escapeHtml(productCount) + '" aria-label="Product count"></td>' +
      productPhotosCell +
      '<td class="admin-actions-cell">' +
        '<button type="button" class="admin-btn admin-save-btn">Save</button> ' +
        '<button type="button" class="admin-btn admin-delete-btn">Delete</button>' +
      '</td>';

    var saveBtn = tr.querySelector('.admin-save-btn');
    var deleteBtn = tr.querySelector('.admin-delete-btn');

    saveBtn.addEventListener('click', function () {
      var rowId = tr.getAttribute('data-shop-id');
      var isNew = !rowId || rowId === 'new';
      var body = {
        name: tr.querySelector('[data-field="name"]').value,
        address: tr.querySelector('[data-field="address"]').value,
        city: tr.querySelector('[data-field="city"]').value,
        category: tr.querySelector('[data-field="category"]').value,
        description: tr.querySelector('[data-field="description"]').value,
        link: tr.querySelector('[data-field="link"]').value,
        shop_image: tr.querySelector('[data-field="shop_image"]').value,
        logo: tr.querySelector('[data-field="logo"]').value,
        product_count: tr.querySelector('[data-field="product_count"]').value,
        product_photos: collectProductPhotosFromRow(tr)
      };
      saveBtn.disabled = true;
      var url = isNew ? '/api/admin/shops' : '/api/admin/shops/' + encodeURIComponent(rowId);
      var method = isNew ? 'POST' : 'PATCH';
      fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })
        .then(function (r) {
          if (r.status === 401 || r.status === 403) {
            showMessage('Session expired or admin only.', true);
            return null;
          }
          return r.json();
        })
        .then(function (data) {
          saveBtn.disabled = false;
          if (data && data.id) {
            if (isNew) {
              tr.setAttribute('data-shop-id', data.id);
              var idInput = tr.querySelector('.admin-input-id');
              if (idInput) idInput.value = data.id;
              showMessage('Shop created.');
            } else {
              showMessage('Saved.');
            }
          } else if (data && data.error) {
            showMessage(data.error, true);
          }
        })
        .catch(function () {
          saveBtn.disabled = false;
          showMessage(isNew ? 'Create failed.' : 'Update failed.', true);
        });
    });

    deleteBtn.addEventListener('click', function () {
      var rowId = tr.getAttribute('data-shop-id');
      var isNew = !rowId || rowId === 'new';
      if (isNew) {
        tr.remove();
        showMessage('New shop row removed.');
        return;
      }
      if (!confirm('Delete this shop? This cannot be undone.')) return;
      deleteBtn.disabled = true;
      fetch('/api/admin/shops/' + encodeURIComponent(rowId), {
        method: 'DELETE',
        credentials: 'include'
      })
        .then(function (r) {
          if (r.status === 401 || r.status === 403) {
            showMessage('Session expired or admin only.', true);
            return false;
          }
          if (r.status === 204) return true;
          return r.json().then(function (data) {
            showMessage((data && data.error) || 'Delete failed', true);
            return false;
          });
        })
        .then(function (ok) {
          if (ok) {
            tr.remove();
            showMessage('Deleted.');
          } else {
            deleteBtn.disabled = false;
          }
        })
        .catch(function () {
          deleteBtn.disabled = false;
          showMessage('Delete failed.', true);
        });
    });

    return tr;
  }

  function renderTable(shops) {
    var wrap = getEl('admin-table-wrap');
    var loading = getEl('admin-loading');
    if (!wrap) return;
    if (loading) loading.hidden = true;
    wrap.hidden = false;

    var table = document.createElement('table');
    table.className = 'admin-table';
    table.setAttribute('role', 'grid');
    var thead = document.createElement('thead');
    thead.innerHTML =
      '<tr>' +
      '<th>id</th><th>Enter store clicks</th><th>name</th><th>address</th><th>city</th><th>category</th>' +
      '<th>description</th><th>link</th><th>shop_image</th><th>logo</th><th>product_count</th>' +
      '<th>Product images (1–6)</th><th></th>' +
      '</tr>';
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    (Array.isArray(shops) ? shops : []).forEach(function (shop) {
      tbody.appendChild(buildRow(shop));
    });
    table.appendChild(tbody);
    wrap.innerHTML = '';
    wrap.appendChild(table);

    var addBtn = getEl('admin-add-shop');
    if (addBtn) {
      addBtn.hidden = false;
      addBtn.onclick = function () {
        var tbody = wrap.querySelector('tbody');
        if (tbody) {
          var newRow = buildRow({ id: '' });
          tbody.insertBefore(newRow, tbody.firstChild);
          showMessage('Fill in the new row and click Save to add the shop.');
        }
      };
    }
  }

  function fetchWithTimeout(url, opts, ms) {
    ms = ms || 15000;
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, ms);
    opts = opts || {};
    opts.credentials = opts.credentials || 'include';
    opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (r) {
      clearTimeout(t);
      return r;
    }, function (err) {
      clearTimeout(t);
      throw err;
    });
  }

  function loadShops() {
    var loading = getEl('admin-loading');
    if (loading) {
      loading.hidden = false;
      loading.textContent = 'Loading shops…';
    }
    showMessage('');
    fetchWithTimeout('/api/shops', creds, 15000)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status === 503 ? 'Database unavailable' : 'Failed to load shops');
        return r.json();
      })
      .then(function (data) {
        var list = Array.isArray(data) ? data : [];
        renderTable(list);
        if (loading) loading.hidden = true;
        hideRetry();
      })
      .catch(function (err) {
        if (loading) {
          loading.hidden = true;
        }
        var msg = (err && err.name === 'AbortError') ? 'Request timed out. Check the server and try again.' : (err && err.message) || 'Could not load shops.';
        showMessage(msg, true);
        var retry = getEl('admin-retry');
        if (retry) retry.hidden = false;
      });
  }

  function hideRetry() {
    var retry = getEl('admin-retry');
    if (retry) retry.hidden = true;
  }

  function init() {
    function ensureUserThenRun(cb) {
      var user = window.getCurrentUser && window.getCurrentUser();
      if (user && typeof user === 'object') {
        cb(user);
        return;
      }
      fetchWithTimeout('/api/auth/me', creds, 10000)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (u) {
          if (u && window.setCurrentUser) window.setCurrentUser(u);
          cb(u || null);
        })
        .catch(function () { cb(null); });
    }

    ensureUserThenRun(function (user) {
      if (!handleAuthResponse(user)) return;
      loadShops();
    });

    window.addEventListener('auth-change', function () {
      handleAuthResponse(window.getCurrentUser && window.getCurrentUser());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var retryBtn = document.getElementById('admin-retry');
  if (retryBtn) retryBtn.addEventListener('click', loadShops);
})();

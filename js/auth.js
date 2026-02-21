(function () {
  const creds = { credentials: 'include' };
  let panelOpen = false;

  function getEl(id) {
    return document.getElementById(id);
  }

  function updateAuthUI() {
    const user = window.currentUser;
    const signedOut = getEl('auth-signed-out');
    const signedIn = getEl('auth-signed-in');
    const triggerLabel = getEl('auth-trigger-label');
    const trigger = getEl('auth-trigger');
    if (user) {
      if (signedOut) signedOut.hidden = true;
      if (signedIn) {
        signedIn.hidden = false;
        var un = getEl('auth-display-username');
        var em = getEl('auth-display-email');
        if (un) un.textContent = user.username || '';
        if (em) em.textContent = user.email || '';
      }
      if (triggerLabel) triggerLabel.textContent = user.username || 'Account';
      if (trigger) trigger.setAttribute('aria-label', 'Account');
    } else {
      if (signedOut) signedOut.hidden = false;
      if (signedIn) signedIn.hidden = true;
      if (triggerLabel) triggerLabel.textContent = 'Sign In';
      if (trigger) trigger.setAttribute('aria-label', 'Sign in');
    }
  }

  function setUser(user) {
    window.currentUser = user;
    updateAuthUI();
    window.dispatchEvent(new CustomEvent('auth-change', { detail: { user: user } }));
  }

  function showError(msg) {
    var el = getEl('auth-error');
    if (el) {
      el.textContent = msg || '';
      el.hidden = !msg;
    }
  }

  function openPanel() {
    var panel = getEl('auth-panel');
    var trigger = getEl('auth-trigger');
    if (panel) {
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
    }
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    panelOpen = true;
  }

  function closePanel() {
    var panel = getEl('auth-panel');
    var trigger = getEl('auth-trigger');
    if (panel) {
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
    }
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    panelOpen = false;
    showError('');
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    if (panelOpen) openPanel();
    else closePanel();
  }

  // Load current user
  fetch('/api/auth/me', creds)
    .then(function (r) {
      if (r.ok) return r.json();
      return null;
    })
    .then(function (user) {
      setUser(user);
    })
    .catch(function () {
      setUser(null);
    });

  // Trigger click
  var trigger = getEl('auth-trigger');
  if (trigger) {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });
  }

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!panelOpen) return;
    var panel = getEl('auth-panel');
    var wrap = document.querySelector('.auth-wrap');
    if (wrap && panel && !wrap.contains(e.target)) closePanel();
  });

  // Tabs: login / register
  var tabs = document.querySelectorAll('.auth-tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var t = tab.getAttribute('data-tab');
      tabs.forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-tab') === t);
      });
      var loginForm = getEl('auth-login-form');
      var registerForm = getEl('auth-register-form');
      if (loginForm) loginForm.hidden = t !== 'login';
      if (registerForm) registerForm.hidden = t !== 'register';
      showError('');
    });
  });

  // Login form
  var loginForm = getEl('auth-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = getEl('auth-login-input');
      var password = getEl('auth-login-password');
      var email_or_username = (input && input.value && input.value.trim()) || '';
      var pwd = (password && password.value) || '';
      if (!email_or_username || !pwd) {
        showError('Email/username and password are required.');
        return;
      }
      showError('');
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email_or_username: email_or_username, password: pwd })
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (r.ok) {
              setUser(data.user);
              closePanel();
              if (password) password.value = '';
            } else {
              showError(data.error || 'Sign in failed.');
            }
          });
        })
        .catch(function () {
          showError('Sign in failed. Try again.');
        });
    });
  }

  // Register form
  var registerForm = getEl('auth-register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (getEl('auth-register-email') && getEl('auth-register-email').value.trim()) || '';
      var username = (getEl('auth-register-username') && getEl('auth-register-username').value.trim()) || '';
      var password = (getEl('auth-register-password') && getEl('auth-register-password').value) || '';
      var subscribeEl = getEl('auth-subscribe-emails');
      var subscribe_emails = subscribeEl ? subscribeEl.checked : false;
      if (!email || !username || !password) {
        showError('Email, username, and password are required.');
        return;
      }
      if (password.length < 8) {
        showError('Password must be at least 8 characters.');
        return;
      }
      showError('');
      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email, username: username, password: password, subscribe_emails: subscribe_emails })
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (r.ok) {
              setUser(data.user);
              closePanel();
              if (registerForm) registerForm.reset();
            } else {
              showError(data.error || 'Registration failed.');
            }
          });
        })
        .catch(function () {
          showError('Registration failed. Try again.');
        });
    });
  }

  // Sign out
  var signout = getEl('auth-signout');
  if (signout) {
    signout.addEventListener('click', function () {
      fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        .then(function () {
          setUser(null);
          closePanel();
        })
        .catch(function () {
          setUser(null);
          closePanel();
        });
    });
  }

  window.getCurrentUser = function () {
    return window.currentUser || null;
  };
  window.setCurrentUser = setUser;
})();

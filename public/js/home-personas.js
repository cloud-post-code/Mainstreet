(function () {
  var tablist = document.querySelector('.home-personas-tabs[role="tablist"]');
  if (!tablist) return;

  var tabs = tablist.querySelectorAll('[role="tab"]');
  var panels = document.querySelectorAll('.home-persona-panel[role="tabpanel"]');
  if (!tabs.length || !panels.length) return;

  function activateTab(tab) {
    var controls = tab.getAttribute('aria-controls');
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.classList.toggle('is-active', on);
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) {
      var show = p.id === controls;
      p.hidden = !show;
      p.classList.toggle('is-active', show);
    });
  }

  function tabIndexOf(tab) {
    return Array.prototype.indexOf.call(tabs, tab);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activateTab(tab);
    });
    tab.addEventListener('keydown', function (e) {
      var i = tabIndexOf(tab);
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        next = tabs[(i + 1) % tabs.length];
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        next = tabs[(i - 1 + tabs.length) % tabs.length];
      } else if (e.key === 'Home') {
        e.preventDefault();
        next = tabs[0];
      } else if (e.key === 'End') {
        e.preventDefault();
        next = tabs[tabs.length - 1];
      }
      if (next) {
        activateTab(next);
        next.focus();
      }
    });
  });
})();

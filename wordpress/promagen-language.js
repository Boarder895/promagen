// Promagen Language — merged client runtime
(function () {
  var CFG = (typeof window !== 'undefined' && window.PROMAGEN_LANG_CFG) ? window.PROMAGEN_LANG_CFG : {
    defaultLang: 'en',
    supported: [{ code: 'en', label: 'English', dir: 'ltr' }, { code: 'ar', label: 'العربية', dir: 'rtl' }],
    rtlStylesheet: ''
  };

  function getLang() {
    try {
      return localStorage.getItem('promagen_lang') || CFG.defaultLang || 'en';
    } catch (e) {
      return CFG.defaultLang || 'en';
    }
  }

  function getDir(lang) {
    if (!lang) lang = getLang();
    return lang === 'ar' ? 'rtl' : 'ltr';
  }

  var injectedRtlId = 'promagen-rtl-css';
  function ensureRtlStylesheet(dir) {
    try {
      var existing = document.getElementById(injectedRtlId);
      if (dir === 'rtl' && CFG.rtlStylesheet) {
        if (!existing) {
          var link = document.createElement('link');
          link.id = injectedRtlId;
          link.rel = 'stylesheet';
          link.href = CFG.rtlStylesheet;
          document.head.appendChild(link);
        }
      } else {
        if (existing) existing.remove();
      }
    } catch (e) {}
  }

  function applyLang(lang) {
    var html = document.documentElement;
    if (!html) return;
    var dir = getDir(lang);
    html.setAttribute('lang', lang);
    html.setAttribute('dir', dir);
    if (dir === 'rtl') html.classList.add('rtl'); else html.classList.remove('rtl');
    ensureRtlStylesheet(dir);
    window.dispatchEvent(new CustomEvent('promagen:langapplied', { detail: { lang: lang, dir: dir } }));
  }

  function renderToolbar() {
    var root = document.querySelector('[data-promagen-langbar]');
    if (!root) return;
    var current = getLang();

    function makeBtn(item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'promagen-langbar__btn';
      btn.textContent = item.label;
      btn.setAttribute('data-lang', item.code);
      if (item.code === current) btn.setAttribute('aria-current', 'true');
      btn.addEventListener('click', function() {
        try { localStorage.setItem('promagen_lang', item.code); } catch(e){}
        applyLang(item.code);
        renderToolbar(); // refresh buttons
      });
      return btn;
    }

    // clear existing buttons except label
    while (root.lastChild && !root.lastChild.classList?.contains('promagen-langbar__label')) {
      root.removeChild(root.lastChild);
    }

    CFG.supported.forEach(function(item) {
      root.appendChild(makeBtn(item));
    });
  }

  // First run
  applyLang(getLang());
  renderToolbar();

})();

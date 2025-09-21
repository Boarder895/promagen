// Promagen Language — client runtime
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

    // Notify any listeners that language/dir has been applied
    window.dispatchEvent(new CustomEvent('promagen:langapplied', { detail: { lang: lang, dir: dir } }));
  }

  // First paint — apply immediately
  applyLang(getLang());

  // React to user changes in the shortcode toolbar
  window.addEventListener('promagen:langchange', function (ev) {
    var lang = (ev && ev.detail && ev.detail.lang) ? ev.detail.lang : getLang();
    try { localStorage.setItem('promagen_lang', lang); } catch (e) {}
    applyLang(lang);

    // Also update aria-current in the toolbar, if present
    var root = document.querySelector('[data-promagen-langbar]');
    if (root) {
      var btns = root.querySelectorAll('.promagen-langbar__btn');
      btns.forEach(function (b) { b.removeAttribute('aria-current'); });
      var active = root.querySelector('.promagen-langbar__btn[data-lang="' + lang + '"]');
      if (active) active.setAttribute('aria-current', 'true');
    }
  });

  // Example: minimal logical CSS flips that many themes need without extra files.
  // You can delete this if your theme already handles [dir="rtl"] correctly.
  var style = document.createElement('style');
  style.textContent = `
    /* Generic logical properties to help most themes */
    html[dir="rtl"] body { direction: rtl; }
    html[dir="rtl"] .alignleft { float: right; margin-left: 1rem; margin




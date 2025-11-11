'use client'

/**
 * Injects a tiny inline script that sets <html>.dark BEFORE React hydrates.
 * Reads localStorage('theme'), defaults to 'system', applies dark based on OS,
 * listens to OS changes when in system mode, and updates <meta name="theme-color">.
 */
export default function ThemeScript() {
  const code = `
  (function() {
    var key = 'theme';
    try {
      var stored = localStorage.getItem(key);
      var choice = (stored==='light'||stored==='dark'||stored==='system') ? stored : 'system';
      var mql = window.matchMedia('(prefers-color-scheme: dark)');
      var apply = function(c) {
        var dark = (c==='dark') || (c==='system' && mql.matches);
        document.documentElement.classList.toggle('dark', !!dark);
      };
      apply(choice);
      if (choice === 'system') {
        var fn = function(){ apply('system'); };
        if (mql.addEventListener) mql.addEventListener('change', fn);
        else if (mql.addListener) mql.addListener(fn);
      }
      var meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name','theme-color'); document.head.appendChild(meta); }
      var update = function() {
        var dark = document.documentElement.classList.contains('dark');
        meta.setAttribute('content', dark ? '#0b0f14' : '#ffffff');
      };
      update();
      new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch (e) { /* ignore */ }
  })();
  `.trim();

  return <script dangerouslySetInnerHTML={{ __html: code }} />
}










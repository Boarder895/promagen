<?php
/**
 * Plugin Name: Promagen Language
 * Description: Simple language tab with RTL support (Arabic) for Promagen pages via shortcode [promagen_language_tab].
 * Version: 1.0.0
 * Author: Promagen
 */

if (!defined('ABSPATH')) { exit; }

class Promagen_Language_Plugin {
    const HANDLE = 'promagen-language';
    const VERSION = '1.0.0';
    const OPTION_DEFAULT_LANG = 'promagen_default_lang'; // 'en' by default

    public function __construct() {
        add_action('init', [$this, 'register_assets']);
        add_shortcode('promagen_language_tab', [$this, 'shortcode_language_tab']);
        add_action('wp_head', [$this, 'inject_lang_bootstrap'], 1);
        add_action('admin_init', [$this, 'maybe_set_default_lang']);
    }

    public function maybe_set_default_lang() {
        if (get_option(self::OPTION_DEFAULT_LANG) === false) {
            add_option(self::OPTION_DEFAULT_LANG, 'en');
        }
    }

    public function register_assets() {
        $base_url = plugins_url('', __FILE__);
        wp_register_script(
            self::HANDLE,
            $base_url . '/embed-script.js',
            [],
            self::VERSION,
            true
        );
        // Pass defaults to JS
        wp_localize_script(self::HANDLE, 'PROMAGEN_LANG_CFG', [
            'defaultLang' => get_option(self::OPTION_DEFAULT_LANG, 'en'),
            // add more locales later as needed
            'supported'   => [
                ['code' => 'en', 'label' => 'English', 'dir' => 'ltr'],
                ['code' => 'ar', 'label' => 'العربية', 'dir' => 'rtl'],
                ['code' => 'zh', 'label' => '中文', 'dir' => 'ltr'],
                ['code' => 'es', 'label' => 'Español', 'dir' => 'ltr'],
                ['code' => 'hi', 'label' => 'हिन्दी', 'dir' => 'ltr'],
                ['code' => 'pt', 'label' => 'Português', 'dir' => 'ltr'],
                ['code' => 'fr', 'label' => 'Français', 'dir' => 'ltr'],
                ['code' => 'ru', 'label' => 'Русский', 'dir' => 'ltr'],
                ['code' => 'de', 'label' => 'Deutsch', 'dir' => 'ltr'],
                ['code' => 'ja', 'label' => '日本語', 'dir' => 'ltr'],
            ],
            // Optional: If you add a dedicated RTL stylesheet, set the URL here:
            'rtlStylesheet' => '',
        ]);
    }

    /**
     * Inject minimal bootstrap to ensure <html> has correct lang/dir early,
     * even before the main JS runs (prevents layout flicker).
     */
    public function inject_lang_bootstrap() {
        ?>
        <script>
        (function() {
          try {
            var stored = localStorage.getItem('promagen_lang');
            var lang = stored || 'en';
            var dir = (lang === 'ar') ? 'rtl' : 'ltr';
            var html = document.documentElement;
            if (html) {
              if (!html.hasAttribute('lang')) html.setAttribute('lang', lang);
              html.setAttribute('dir', dir);
              if (dir === 'rtl') { document.documentElement.classList.add('rtl'); }
              else { document.documentElement.classList.remove('rtl'); }
            }
          } catch (e) {}
        })();
        </script>
        <?php
    }

    public function shortcode_language_tab($atts = []) {
        wp_enqueue_script(self::HANDLE);

        // Simple styles (kept inline so the block looks good immediately)
        ob_start();
        ?>
        <style>
          .promagen-langbar {
            display: flex;
            gap: .5rem;
            flex-wrap: wrap;
            align-items: center;
            border: 1px solid #e5e7eb;
            padding: .5rem .75rem;
            border-radius: .5rem;
            background: #fafafa;
          }
          .promagen-langbar__label {
            font-weight: 600;
            margin-inline-end: .25rem;
          }
          .promagen-langbar__btn {
            cursor: pointer;
            border: 1px solid #e5e7eb;
            background: #fff;
            padding: .35rem .6rem;
            border-radius: .4rem;
            font-size: .9rem;
            line-height: 1;
          }
          .promagen-langbar__btn[aria-current="true"] {
            border-color: #111;
            font-weight: 700;
          }
          /* Basic RTL awareness for the bar itself */
          html[dir="rtl"] .promagen-langbar {
            direction: rtl;
          }
        </style>

        <div class="promagen-langbar" data-promagen-langbar>
          <span class="promagen-langbar__label">Language:</span>
          <!-- Buttons are injected by JS from PROMAGEN_LANG_CFG.supported -->
        </div>

        <script>
        (function() {
          if (!window.PROMAGEN_LANG_CFG) return;
          var cfg = window.PROMAGEN_LANG_CFG;
          var root = document.querySelector('[data-promagen-langbar]');
          if (!root) return;

          var current = (function(){
            try { return localStorage.getItem('promagen_lang') || cfg.defaultLang || 'en'; }
            catch(e){ return cfg.defaultLang || 'en'; }
          })();

          function makeBtn(item) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'promagen-langbar__btn';
            btn.textContent = item.label;
            btn.setAttribute('data-lang', item.code);
            if (item.code === current) btn.setAttribute('aria-current', 'true');
            btn.addEventListener('click', function() {
              try {
                localStorage.setItem('promagen_lang', item.code);
              } catch(e) {}
              // Signal to the global handler in embed-script.js
              window.dispatchEvent(new CustomEvent('promagen:langchange', { detail: { lang: item.code } }));
            });
            return btn;
          }

          // Flush and rebuild
          while (root.lastChild && !root.lastChild.classList?.contains('promagen-langbar__label')) {
            root.removeChild(root.lastChild);
          }
          cfg.supported.forEach(function(item){
            root.appendChild(makeBtn(item));
          });
        })();
        </script>
        <?php
        return ob_get_clean();
    }
}

new Promagen_Language_Plugin();


<?php
/**
 * FRONTEND — WORDPRESS
 * Plugin Name: Promagen World Clocks
 * Description: Live world clocks (ordered by today’s sunrise). Uses shared JSON from Next.js. Shortcode: [promagen_world_clocks src="https://app.promagen.com/api/world-clocks"]
 * Version: 2.0.0
 * Author: Promagen
 */

if (!defined('ABSPATH')) { exit; }

class Promagen_World_Clocks {
    const HANDLE = 'promagen-world-clocks';
    const VERSION = '2.0.0';

    public function __construct() {
        add_shortcode('promagen_world_clocks', [$this, 'shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'register_assets']);
    }

    public function register_assets() {
        $base = plugins_url('', __FILE__);
        wp_register_script(self::HANDLE, $base . '/promagen-world-clocks.js', [], self::VERSION, true);
    }

    public function shortcode($atts = []) {
        $atts = shortcode_atts([
            'src' => 'https://app.promagen.com/api/world-clocks', // default shared endpoint
        ], $atts, 'promagen_world_clocks');

        // enqueue and pass the endpoint to JS
        wp_enqueue_script(self::HANDLE);
        wp_add_inline_script(self::HANDLE, 'window.PMG_CLOCKS_ENDPOINT = ' . json_encode($atts['src']) . ';', 'before');

        ob_start(); ?>
        <style>
          .pmg-clocks { border:1px solid #e5e7eb; border-radius:12px; padding:16px; background:#fff; }
          .pmg-clocks__title { font-weight:700; margin-bottom:12px; }
          .pmg-clocks__grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
          .pmg-clock { border:1px solid #eef0f2; border-radius:10px; padding:12px; background:#fafafa; }
          .pmg-clock__name { font-weight:600; display:flex; align-items:center; gap:8px; margin-bottom:4px; }
          .pmg-clock__flag { display:inline-block; font-size:1.1rem; line-height:1; }
          .pmg-clock__time { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size:1.6rem; letter-spacing:.5px; margin-bottom:2px; }
          .pmg-clock__date { color:#4b5563; font-size:.9rem; margin-bottom:6px; }
          .pmg-clock__meta { display:flex; justify-content:space-between; color:#6b7280; font-size:.8rem; }
          @media (prefers-color-scheme: dark) {
            .pmg-clocks { background:#0b0d10; border-color:#1f2937; }
            .pmg-clocks__grid .pmg-clock { background:#0f1318; border-color:#1f2937; }
            .pmg-clock__date, .pmg-clock__meta { color:#9ca3af; }
          }
        </style>
        <div class="pmg-clocks" data-pmg-world-clocks>
          <div class="pmg-clocks__title">World Clocks (ordered by today’s sunrise)</div>
          <div class="pmg-clocks__grid" data-pmg-grid></div>
        </div>
        <?php
        return ob_get_clean();
    }
}

new Promagen_World_Clocks();

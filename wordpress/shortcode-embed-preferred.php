<?php
/**
 * Plugin Name: Promagen – Preferred Providers (Embedded)
 * Description: Embeds the personalized widget hosted on app.promagen.com via iframe.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) exit;

function promagen_preferred_embed_shortcode($atts) {
  $atts = shortcode_atts(array(
    'height' => '420',
    'url'    => 'https://app.promagen.com/widget/preferred'
  ), $atts, 'promagen_preferred_embed');

  $height = intval($atts['height']);
  $url = esc_url($atts['url']);

  ob_start(); ?>
    <div class="promagen-preferred-embed" style="max-width:100%;">
      <iframe
        src="<?php echo $url; ?>"
        style="width:100%;height:<?php echo $height; ?>px;border:0;border-radius:8px;overflow:hidden"
        loading="lazy"
        referrerpolicy="no-referrer"
      ></iframe>
      <p style="font-size:12px;color:#666;margin-top:8px">
        To personalize, please
        <a href="https://app.promagen.com/login" rel="noopener">sign in to your Promagen account</a>.
      </p>
    </div>
  <?php
  return ob_get_clean();
}
add_shortcode('promagen_preferred_embed', 'promagen_preferred_embed_shortcode');

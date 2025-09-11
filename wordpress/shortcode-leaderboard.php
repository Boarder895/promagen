<?php
/**
 * Shortcode: [promagen_leaderboard]
 */
function promagen_leaderboard_func(){
  ob_start(); ?>
  <div id="promagen-leaderboard">Loading leaderboard…</div>
  <script>
    (async function(){
      const root = document.getElementById("promagen-leaderboard");
      root.textContent = "Open app.promagen.com to view the live leaderboard (embed stub).";
    })();
  </script>
  <?php return ob_get_clean();
}
add_shortcode("promagen_leaderboard", "promagen_leaderboard_func");

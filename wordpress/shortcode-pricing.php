<?php
/**
 * Promagen Pricing Table Shortcode
 * Shortcode: [promagen_pricing promo="0|1" currency="GBP|USD"]
 * - Monthly ↔ Annual toggle
 * - Annual discount = 20% (default) or 30% when promo="1"
 * - GBP/USD toggle
 *
 * Install:
 * 1) Upload to: /wp-content/plugins/promagen-pricing/shortcode-pricing.php
 * 2) Activate in WP Admin → Plugins.
 * 3) Use: [promagen_pricing] or [promagen_pricing promo="1"]
 */

if (!defined('ABSPATH')) { exit; }

add_action('init', function () {
  add_shortcode('promagen_pricing', 'promagen_render_pricing_table');
});

function pmg_money($num, $cur) {
  // Format to whole numbers if near integer, else 2dp
  $rounded = round($num);
  $val = (abs($num - $rounded) < 0.01) ? number_format($rounded, 0) : number_format($num, 2);
  return ($cur === 'USD' ? '$' : '£') . $val;
}

function promagen_render_pricing_table($atts = [], $content = null) {
  $atts = shortcode_atts([
    'promo'    => '0',              // "1" = annual 30% off; "0" = annual 20% off
    'currency' => '',               // optional initial currency override
  ], $atts, 'promagen_pricing');

  $promoActive = ($atts['promo'] === '1');

  // Base monthly prices (authoritative)
  $monthly = [
    'GBP' => ['free' => 0.00, 'creator' => 9.99,  'pro' => 29.99, 'team' => 59.99], // team annual remains "Custom"
    'USD' => ['free' => 0.00, 'creator' => 12.99, 'pro' => 39.00, 'team' => 79.00],
  ];

  // Detect default currency (or use attribute)
  $defaultCurrency = 'GBP';
  if (!empty($atts['currency'])) {
    $c = strtoupper(trim($atts['currency']));
    if (in_array($c, ['GBP','USD'])) $defaultCurrency = $c;
  } else if (!empty($_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
    $lang2 = strtolower(substr($_SERVER['HTTP_ACCEPT_LANGUAGE'], 0, 2));
    if (in_array($lang2, ['us','en'])) { $defaultCurrency = 'USD'; }
  }

  // Annual discount rule
  $annualDiscount = $promoActive ? 0.30 : 0.20; // 30% with promo, else 20%

  // Compute annual prices from monthly * 12 * (1 - discount)
  $annual = [];
  foreach (['GBP','USD'] as $ccy) {
    $annual[$ccy] = [];
    foreach ($monthly[$ccy] as $plan => $m) {
      if ($plan === 'team') { // Team/Business stays Custom
        $annual[$ccy][$plan] = null;
      } else {
        $raw = $m * 12 * (1 - $annualDiscount);
        // Round to sensible display (no decimals if close to integer)
        $annual[$ccy][$plan] = round($raw); // clean whole-number headline price
      }
    }
  }

  // Prebuild labels
  $labels = [
    'creator' => [
      'features' => [
        'Unlimited cut & paste prompts',
        'Insert popular prompts directly',
        'Like prompts & see community ranking',
        'Refine/Remix community prompts',
        '5 API prompts / month included',
        'Unlock Prompt Packs',
        'Vote 1× per week for favourite platform',
        'Personal usage stats',
      ]
    ],
    'pro' => [
      'features' => [
        'Everything in Creator',
        '100 API prompts / month',
        'Advanced side-by-side provider comparison',
        'Unlimited Prompt Pack downloads',
        'Priority feature access & badges',
        'Early access to community packs',
      ]
    ],
    'free' => [
      'features' => [
        '30 prompts/month (cut & paste)',
        'Browse Popular Prompt Grid (read-only)',
        'View provider leaderboard',
        'No likes, packs, or voting',
      ]
    ],
    'team' => [
      'features' => [
        'Everything in Pro',
        'Multi-seat accounts & shared workspace',
        'Admin dashboard',
        'SLA & premium support',
        'Higher-volume API integrations',
      ]
    ]
  ];

  ob_start(); ?>
  <div class="pmg-pricing-wrap" data-default-currency="<?php echo esc_attr($defaultCurrency); ?>" data-promo="<?php echo $promoActive ? '1' : '0'; ?>">
    <style>
      .pmg-pricing-wrap { font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; margin:2rem 0; }
      .pmg-pricing-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
      .pmg-toggles { display:flex; gap:.5rem; align-items:center; }
      .pmg-group { display:flex; border:1px solid #e2e8f0; border-radius:999px; overflow:hidden; background:#fff; }
      .pmg-group button { padding:.5rem 1rem; border:0; background:#fff; cursor:pointer; font-weight:600; }
      .pmg-group button.active { background:#111; color:#fff; }
      .pmg-save { font-size:.75rem; font-weight:700; background:#16a34a; color:#fff; padding:.25rem .5rem; border-radius:8px; margin-left:.25rem; }
      .pmg-pricing-title { font-size:1.75rem; font-weight:700; }
      .pmg-note { font-size:.9rem; color:#475569; }

      .pmg-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1rem; margin-top:1.25rem; }
      @media (max-width:1024px){ .pmg-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (max-width:640px){  .pmg-grid{ grid-template-columns:1fr; } }

      .pmg-card { border:1px solid #e2e8f0; border-radius:16px; padding:1.25rem; background:#fff; display:flex; flex-direction:column; gap:.75rem; }
      .pmg-badge { font-size:.75rem; font-weight:700; text-transform:uppercase; letter-spacing:.02em; color:#475569; }
      .pmg-name { font-size:1.25rem; font-weight:800; }
      .pmg-price { font-size:2rem; font-weight:800; line-height:1.1; }
      .pmg-per { font-size:1rem; font-weight:700; color:#64748a; margin-left:.35rem; }
      .pmg-sub { color:#64748a; font-size:.9rem; }
      .pmg-hr { height:1px; background:#e2e8f0; margin:.5rem 0; border:0; }
      .pmg-list { margin:0; padding-left:1.1rem; display:flex; flex-direction:column; gap:.4rem; }
      .pmg-list li { list-style:disc; }
      .pmg-cta { margin-top:auto; }
      .pmg-cta a { display:inline-block; text-align:center; width:100%; border-radius:12px; padding:.75rem 1rem; text-decoration:none; font-weight:700; }
      .pmg-cta .primary { background:#111; color:#fff; }
      .pmg-cta .ghost   { background:#f8fafc; color:#111; border:1px solid #e2e8f0; }

      .pmg-card.recommended { border-color:#111; box-shadow:0 8px 24px rgba(0,0,0,.05); position:relative; }
      .pmg-card.recommended::after { content:"Recommended"; position:absolute; top:12px; right:12px; background:#111; color:#fff; font-size:.7rem; padding:.25rem .5rem; border-radius:8px; }

      .pmg-hide { display:none !important; }
      .pmg-price-line { display:flex; align-items:baseline; gap:.35rem; flex-wrap:wrap; }
    </style>

    <div class="pmg-pricing-header">
      <div>
        <div class="pmg-pricing-title">Promagen Plans</div>
        <div class="pmg-note">30 free prompts each month on the Free plan. Start your <strong>on-demand 7-day trial</strong> of Creator whenever you’re ready.</div>
      </div>

      <div class="pmg-toggles" aria-label="Pricing toggles">
        <!-- Billing toggle -->
        <div class="pmg-group pmg-billing-toggle" role="tablist" aria-label="Billing period">
          <button type="button" data-billing="monthly" class="active" aria-selected="true" role="tab">Monthly</button>
          <button type="button" data-billing="annual" aria-selected="false" role="tab">
            Annual
            <span class="pmg-save">
              Save <span class="pmg-save-num"><?php echo $promoActive ? '30' : '20'; ?></span>%
            </span>
          </button>
        </div>
        <!-- Currency toggle -->
        <div class="pmg-group pmg-currency-toggle" role="tablist" aria-label="Currency">
          <button type="button" data-currency="GBP" class="active" aria-selected="true" role="tab">£ GBP</button>
          <button type="button" data-currency="USD" aria-selected="false" role="tab">$ USD</button>
        </div>
      </div>
    </div>

    <?php
      // Precompute display strings
      $disp = [
        'GBP' => [
          'free'    => ['m' => pmg_money($monthly['GBP']['free'], 'GBP'),    'y' => pmg_money($annual['GBP']['free'], 'GBP')],
          'creator' => ['m' => pmg_money($monthly['GBP']['creator'], 'GBP'), 'y' => pmg_money($annual['GBP']['creator'], 'GBP')],
          'pro'     => ['m' => pmg_money($monthly['GBP']['pro'], 'GBP'),     'y' => pmg_money($annual['GBP']['pro'], 'GBP')],
          'team'    => ['m' => pmg_money($monthly['GBP']['team'], 'GBP'),    'y' => 'Custom'],
        ],
        'USD' => [
          'free'    => ['m' => pmg_money($monthly['USD']['free'], 'USD'),    'y' => pmg_money($annual['USD']['free'], 'USD')],
          'creator' => ['m' => pmg_money($monthly['USD']['creator'], 'USD'), 'y' => pmg_money($annual['USD']['creator'], 'USD')],
          'pro'     => ['m' => pmg_money($monthly['USD']['pro'], 'USD'),     'y' => pmg_money($annual['USD']['pro'], 'USD')],
          'team'    => ['m' => pmg_money($monthly['USD']['team'], 'USD'),    'y' => 'Custom'],
        ],
      ];
    ?>

    <div class="pmg-grid" aria-live="polite">
      <!-- Free -->
      <div class="pmg-card" data-plan="free">
        <div class="pmg-badge">Free</div>
        <div class="pmg-name">Free</div>
        <div class="pmg-price-line">
          <span class="pmg-price pmg-free-gbp-month"><?php echo esc_html($disp['GBP']['free']['m']); ?></span>
          <span class="pmg-price pmg-free-usd-month pmg-hide"><?php echo esc_html($disp['USD']['free']['m']); ?></span>
          <span class="pmg-price pmg-free-gbp-year pmg-hide"><?php echo esc_html($disp['GBP']['free']['y']); ?></span>
          <span class="pmg-price pmg-free-usd-year pmg-hide"><?php echo esc_html($disp['USD']['free']['y']); ?></span>
          <span class="pmg-per">/month</span>
        </div>
        <div class="pmg-sub">Forever</div>
        <div class="pmg-hr"></div>
        <ul class="pmg-list"><?php foreach ($labels['free']['features'] as $f) echo '<li>'.esc_html($f).'</li>'; ?></ul>
        <div class="pmg-hr"></div>
        <div class="pmg-cta"><a href="/signup" class="ghost" aria-label="Get started free">Get started</a></div>
      </div>

      <!-- Creator (Recommended) -->
      <div class="pmg-card recommended" data-plan="creator">
        <div class="pmg-badge">Creator</div>
        <div class="pmg-name">Creator</div>
        <div class="pmg-price-line">
          <span class="pmg-price pmg-creator-gbp-month"><?php echo esc_html($disp['GBP']['creator']['m']); ?></span>
          <span class="pmg-price pmg-creator-usd-month pmg-hide"><?php echo esc_html($disp['USD']['creator']['m']); ?></span>
          <span class="pmg-price pmg-creator-gbp-year pmg-hide"><?php echo esc_html($disp['GBP']['creator']['y']); ?></span>
          <span class="pmg-price pmg-creator-usd-year pmg-hide"><?php echo esc_html($disp['USD']['creator']['y']); ?></span>
          <span class="pmg-per">/month</span>
        </div>
        <div class="pmg-sub pmg-creator-annual-note pmg-hide">
          Billed annually <?php echo $promoActive ? '(limited-time 30% off)' : '(save 20%)'; ?>
        </div>
        <div class="pmg-hr"></div>
        <ul class="pmg-list"><?php foreach ($labels['creator']['features'] as $f) echo '<li>'.esc_html($f).'</li>'; ?></ul>
        <div class="pmg-hr"></div>
        <div class="pmg-cta"><a href="/signup?plan=creator" class="primary" aria-label="Choose Creator plan">Choose Creator</a></div>
        <div class="pmg-note" style="margin-top:.5rem;">On-demand 7-day trial: start the premium week when you’re ready.</div>
      </div>

      <!-- Pro -->
      <div class="pmg-card" data-plan="pro">
        <div class="pmg-badge">Pro</div>
        <div class="pmg-name">Pro</div>
        <div class="pmg-price-line">
          <span class="pmg-price pmg-pro-gbp-month"><?php echo esc_html($disp['GBP']['pro']['m']); ?></span>
          <span class="pmg-price pmg-pro-usd-month pmg-hide"><?php echo esc_html($disp['USD']['pro']['m']); ?></span>
          <span class="pmg-price pmg-pro-gbp-year pmg-hide"><?php echo esc_html($disp['GBP']['pro']['y']); ?></span>
          <span class="pmg-price pmg-pro-usd-year pmg-hide"><?php echo esc_html($disp['USD']['pro']['y']); ?></span>
          <span class="pmg-per">/month</span>
        </div>
        <div class="pmg-sub pmg-pro-annual-note pmg-hide">
          Billed annually <?php echo $promoActive ? '(limited-time 30% off)' : '(save 20%)'; ?>
        </div>
        <div class="pmg-hr"></div>
        <ul class="pmg-list"><?php foreach ($labels['pro']['features'] as $f) echo '<li>'.esc_html($f).'</li>'; ?></ul>
        <div class="pmg-hr"></div>
        <div class="pmg-cta"><a href="/signup?plan=pro" class="primary" aria-label="Choose Pro plan">Choose Pro</a></div>
      </div>

      <!-- Team/Business -->
      <div class="pmg-card" data-plan="team">
        <div class="pmg-badge">Team / Business</div>
        <div class="pmg-name">Team / Business</div>
        <div class="pmg-price-line">
          <span class="pmg-price pmg-team-gbp-month"><?php echo esc_html($disp['GBP']['team']['m']); ?></span>
          <span class="pmg-price pmg-team-usd-month pmg-hide"><?php echo esc_html($disp['USD']['team']['m']); ?></span>
          <span class="pmg-price pmg-team-gbp-year pmg-hide">Custom</span>
          <span class="pmg-price pmg-team-usd-year pmg-hide">Custom</span>
          <span class="pmg-per">/month</span>
        </div>
        <div class="pmg-sub pmg-team-annual-note pmg-hide">Custom annual agreements</div>
        <div class="pmg-hr"></div>
        <ul class="pmg-list"><?php foreach ($labels['team']['features'] as $f) echo '<li>'.esc_html($f).'</li>'; ?></ul>
        <div class="pmg-hr"></div>
        <div class="pmg-cta"><a href="/contact?topic=teams" class="ghost" aria-label="Contact sales">Contact sales</a></div>
      </div>
    </div>

    <script>
      (function(){
        const root = document.currentScript.closest('.pmg-pricing-wrap');

        // Toggles
        const currencyBtns = root.querySelectorAll('.pmg-currency-toggle button');
        const billingBtns  = root.querySelectorAll('.pmg-billing-toggle button');
        const saveNumSpan  = root.querySelector('.pmg-save-num');

        // Persist helpers
        const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch(e){ return d; } };
        const set = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };

        let currency = get('pmg_currency', root.dataset.defaultCurrency || 'GBP'); // GBP|USD
        let billing  = get('pmg_billing', 'monthly'); // monthly|annual

        function toggleActive(btns, attr, val){
          btns.forEach(b=>{
            const active = b.dataset[attr] === val;
            b.classList.toggle('active', active);
            b.setAttribute('aria-selected', active ? 'true' : 'false');
          });
        }

        function showPrice(plan, ccy, period){
          // Hide all first
          ['gbp','usd'].forEach(cur=>{
            ['month','year'].forEach(per=>{
              const el = root.querySelector(`.pmg-${plan}-${cur}-${per}`);
              if(el) el.classList.add('pmg-hide');
            });
          });
          // Show current
          const el = root.querySelector(`.pmg-${plan}-${ccy.toLowerCase()}-${period}`);
          if(el) el.classList.remove('pmg-hide');
        }

        function updateUI(){
          toggleActive(currencyBtns, 'currency', currency);
          toggleActive(billingBtns, 'billing',  billing);

          // Swap labels /month vs /year
          root.querySelectorAll('.pmg-price-line').forEach(line=>{
            const per = line.querySelector('.pmg-per');
            if(per) per.textContent = billing === 'annual' ? '/year' : '/month';
          });

          // Annual notes visibility
          [['creator','pmg-creator-annual-note'],['pro','pmg-pro-annual-note'],['team','pmg-team-annual-note']].forEach(([_,cls])=>{
            const el = root.querySelector('.'+cls);
            if(el) el.classList.toggle('pmg-hide', billing !== 'annual');
          });

          // Show the correct price nodes
          ['free','creator','pro','team'].forEach(plan=>{
            showPrice(plan, currency, billing === 'annual' ? 'year' : 'month');
          });
        }

        // Init
        updateUI();

        // Events
        currencyBtns.forEach(btn => btn.addEventListener('click', () => {
          currency = btn.dataset.currency; set('pmg_currency', currency); updateUI();
        }));
        billingBtns.forEach(btn => btn.addEventListener('click', () => {
          billing = btn.dataset.billing; set('pmg_billing', billing); updateUI();
        }));
      })();
    </script>
  </div>
  <?php
  return ob_get_clean();
}

/* Plugin header for WP */
add_action('plugins_loaded', function () {
  if (!has_action('promagen_pricing_plugin_header')) {
    /**
     * Plugin Name: Promagen Pricing Shortcode
     * Description: [promagen_pricing] shortcode with GBP/USD and Monthly/Annual (20% off or promo 30% off) toggles.
     * Version: 1.2.0
     * Author: Promagen
     */
    do_action('promagen_pricing_plugin_header');
  }
});

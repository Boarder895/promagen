"use client";
import React from "react";

/**
 * DevelopersBook
 * - Merged: "Tweak Layer Stability (Ready for Code Drop-In)"
 * - No external deps, no extra files.
 * - Keeps a children slot at the end for future additions.
 */
export function DevelopersBook(
  props: { className?: string; children?: React.ReactNode }
) {
  const cls = ((props.className ?? "") + " rounded-xl border p-4").trim();
  return (
    <div className={cls}>
      <h1 className="meta">DevelopersÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Book</h1>

      <section className="prose-doc max-w-none">
        <h2>Page Tweaks</h2>
        <h3>Tweak Layer Stability (Ready for Code Drop-In)</h3>
        <ul>
          <li>
            <strong>Contracts frozen</strong>: <code>/api/v1/providers/scores</code> and{" "}
            <code>/api/v1/exchanges/status</code> shapes must not change.
          </li>
          <li>
            <strong>Stable islands</strong>: <code>MIGBoard</code> and{" "}
            <code>ExchangesBoard</code> are isolated; tweaks attach to the reserved
            slots (header, side rails, footer).
          </li>
          <li>
            <strong>Design tokens</strong>: use <code>--row</code>, <code>--gap</code>,{" "}
            <code>--font</code> for sizing; never hardcode row or card heights.
          </li>
          <li>
            <strong>Auto-Fit Compact enforced</strong>: new UI collapses/hides in
            compact mode to preserve the no-scroll guarantee.
          </li>
          <li>
            <strong>Safe categories</strong>: hero/intro copy, rolling ticker,
            onboarding prompts, theme switch, footer links, SEO/meta, background art,
            promos, modals, keyboard hints.
          </li>
          <li>
            <strong>Feature flags</strong> allowed for progressive rollouts.
          </li>
        </ul>
        <p className="text-sm opacity-80">
          Status: <strong>Locked</strong> Ãƒâ€šÃ‚Â· Ready for code drop-in.
        </p>
      </section>

      {props.children ?? null}
    </div>
  );
}



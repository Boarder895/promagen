"use client";
import React from "react";

/**
 * UsersBook
 * - Merged: "Tweak Layer Stability (Ready for Code Drop-In)"
 * - No external deps, no extra files.
 * - Keeps a children slot at the end for future additions.
 */
export function UsersBook(
  props: { className?: string; children?: React.ReactNode }
) {
  const cls = ((props.className ?? "") + " rounded-xl border p-4").trim();
  return (
    <div className={cls}>
      <h1 className="meta">UsersÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Book</h1>

      <section className="prose-doc max-w-none">
        <h2>Page Tweaks</h2>
        <h3>Tweak Layer Stability (Ready for Code Drop-In)</h3>
        <ul>
          <li>
            Future page tweaks <strong>not connected</strong> to the
            <em> Top 20 MIG Platforms</em> or the <em>16 Exchange Cards</em> can
            be added later without disrupting the core dashboard.
          </li>
          <li>
            The two main boards are stable and wonÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢t shift; additions like
            banners, tickers, footer, or theme changes slot in <em>around</em> them.
          </li>
          <li>
            The <strong>Auto-Fit Compact</strong> layout keeps everything visible
            on a normal desktop screen; new elements auto-adjust to preserve the
            no-scroll goal.
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



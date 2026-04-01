# Why CSS translateY animations break on iOS Safari after display:none

**iOS Safari fails to start CSS keyframe animations inside containers toggled from `display:none` to `display:flex` due to a multi-factor race condition**: the browser defers layout computation more aggressively than desktop browsers, ResizeObserver fires with stale measurements (or doesn't fire at all), and WebKit historically fails to recompute `@keyframes` values when CSS variables change at animation start time. The fix requires either avoiding `display:none` entirely or using a combination of forced reflow and double-`requestAnimationFrame` bridging before starting animations. The most reliable production pattern replaces CSS `@keyframes` with the Web Animations API and uses `opacity: 0` instead of `display: none`.

---

## The race condition that kills your animation

When an element has `display:none`, WebKit creates **no RenderObject in the render tree**. The element has no layout box, no dimensions, no compositor layer — `scrollHeight`, `clientHeight`, and `offsetHeight` all return **0**. This is per spec and works the same in all browsers. The problem is what happens *after* you set `display:flex`.

Desktop browsers (Chrome, Firefox, desktop Safari) process the display change, build the render subtree, and compute layout quickly enough that by the time your ResizeObserver callback or `setTimeout` fires, valid dimensions are available. iOS Safari doesn't. It **batches style invalidations and defers layout more aggressively** as a battery and performance optimization. The result is a timeline like this:

1. JavaScript sets `display: flex` — style invalidation is *queued*, not executed
2. ResizeObserver fires (or your `setTimeout(800ms)` runs) — but layout hasn't been forced yet
3. `scrollHeight` and `clientHeight` both return **0** because no synchronous reflow has occurred
4. `--scroll-dist` is set to `0`
5. The `@keyframes` animation resolves `translateY(var(--scroll-dist))` to `translateY(0)` — no movement
6. Layout eventually completes on the next frame, but **the animation already started with the wrong values**

Your `setTimeout(800ms)` approach fails for the same reason: iOS Safari doesn't guarantee that 800ms is enough time for layout to complete, and even if it does complete, directly setting `el.style.animation` may trigger WebKit's CSS variable resolution bug where the keyframe values are resolved *before* the updated `--scroll-dist` propagates.

---

## Three WebKit bugs compound the problem

**WebKit Bug #248145 — CSS variables not recomputed in keyframes.** A confirmed WebKit bug where changing a CSS custom property value did not trigger recomputation of `@keyframes` that reference that variable. The fix (commit `5c0b3cb`) added `containsCSSVariableReferences()` detection to `StyleRuleKeyframe` and forced keyframe recomputation when custom properties change. Before this fix — and potentially still in edge cases — if `--scroll-dist` changed at the same time an animation started, **the animation used the stale value (0) rather than the updated one**. Developer Vladimir Tolstikov documented this independently, noting Safari required "deliberate timeout delay hacks" for CSS variables in animations. Ben Frain found that CSS variable changes in running animations sometimes didn't apply in Safari "until you switch tabs or switch focus away."

**WebKit Bug #250900 — ResizeObserver initial size incorrect.** The `lastReportedSize` of `ResizeObservation` was initialized to **0×0** instead of the spec-required **-1×-1**. This meant ResizeObserver might *not fire its initial callback* for elements transitioning from `display:none` (size 0×0) to visible, because the size appeared unchanged from the default. The fix guarantees at least one observation delivery, but older iOS versions still carry this bug.

**WebKit changesets r289498 and r291282 — Animation state not cleared on display:none.** WebKit did not properly clear all CSS animation state when an element was set to `display:none`. When the element became visible again, animations would not restart because the browser believed they were already running. The fix introduced `clearCSSAnimationsForStyleable()` to correctly reset animation state during display toggles.

---

## The svh unit adds another layer of unreliability

Your container uses `65svh` for its height, which introduces an additional iOS Safari-specific failure mode. **WebKit Bug #261185** (resolved) confirmed that `svh` and `dvh` units were sometimes unexpectedly equal when the Safari tab bar wasn't visible, because WebKit wasn't correctly collecting the minimum unobscured layout size. A WebKit engineer stated: *"Our small viewport units are not spec compliant currently."*

Worse, **non-Safari iOS browsers (Chrome and Firefox on iOS) have completely broken svh/lvh units** because neither Google nor Mozilla implemented WebKit's `setMinimumViewportInset`/`setMaximumViewportInset` APIs. On these browsers, `svh` behaves identically to `dvh`. When the container becomes visible, the svh-based height may resolve to an incorrect value, cascading into wrong `scrollHeight - clientHeight` calculations. The safest approach is to calculate viewport height in JavaScript using `window.visualViewport.height` and set it as a CSS variable.

---

## The correct fix: a three-part strategy

Based on the research, the most reliable approach combines three changes:

**First, replace `display:none` with `opacity: 0`.** This is the single highest-impact change. Using `opacity: 0; pointer-events: none` instead of `display: none` keeps the element in the render tree with valid layout, meaning `scrollHeight` and `clientHeight` return correct values at all times. Animations can run (invisibly) while the element is hidden. When you're ready to show it, set `opacity: 1; pointer-events: auto`. If the element must not occupy space while hidden, add `position: absolute` during the hidden state.

```css
/* Hidden state — element stays in render tree */
.scroll-container.hidden {
  opacity: 0;
  pointer-events: none;
  position: absolute;
  width: 100%;
}

/* Visible state */
.scroll-container.visible {
  opacity: 1;
  pointer-events: auto;
  position: relative;
}
```

**Second, use the Web Animations API instead of CSS `@keyframes` with CSS variables.** Safari's `@keyframes` resolution of `var()` references is unreliable. The Web Animations API (supported since **Safari 13.1 / iOS 13.4**) bypasses this entirely by accepting computed pixel values directly:

```javascript
function startAutoScroll(track, viewport) {
  // Cancel any existing animation
  track.getAnimations().forEach(a => a.cancel());
  
  const scrollDist = track.scrollHeight - viewport.clientHeight;
  if (scrollDist <= 0) return null;
  
  return track.animate(
    [
      { transform: 'translateY(0)' },
      { transform: `translateY(-${scrollDist}px)` }
    ],
    {
      duration: scrollDist * 30, // adjust speed as needed
      iterations: Infinity,
      easing: 'linear'
    }
  );
}
```

**Third, if you must use `display:none`, force reflow with the double-rAF pattern.** This ensures iOS Safari has completed at least one full paint cycle before you measure dimensions or start animations:

```javascript
function showAndAnimate(container, track) {
  container.style.display = 'flex';
  // Force synchronous reflow — critical for iOS Safari
  void container.offsetHeight;
  
  // Double-rAF ensures paint has completed
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const scrollDist = track.scrollHeight - container.clientHeight;
      // Use WAAPI, not CSS @keyframes with variables
      track.animate(
        [
          { transform: 'translateY(0)' },
          { transform: `translateY(-${scrollDist}px)` }
        ],
        { duration: scrollDist * 30, iterations: Infinity, easing: 'linear' }
      );
    });
  });
}
```

The `void container.offsetHeight` line triggers a **synchronous reflow**, forcing WebKit to build the render subtree and compute layout immediately rather than deferring it. The double `requestAnimationFrame` then waits for one full repaint cycle to complete before reading dimensions. A single `requestAnimationFrame` is insufficient because some browsers (including Safari) batch the style change into the same paint as the rAF callback.

---

## Production-ready React implementation

Here's a complete React hook that handles all iOS Safari edge cases for auto-scrolling content in a fixed-height container:

```jsx
import { useRef, useEffect, useCallback } from 'react';

function useAutoScroll({ speed = 50, enabled = true }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const animationRef = useRef(null);

  const startAnimation = useCallback(() => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport) return;

    if (animationRef.current) animationRef.current.cancel();

    const scrollDist = track.scrollHeight - viewport.clientHeight;
    if (scrollDist <= 0) return;

    animationRef.current = track.animate(
      [
        { transform: 'translateY(0)' },
        { transform: `translateY(-${scrollDist}px)` }
      ],
      { duration: (scrollDist / speed) * 1000, iterations: Infinity, easing: 'linear' }
    );
  }, [speed]);

  useEffect(() => {
    if (!enabled) {
      if (animationRef.current) animationRef.current.pause();
      return;
    }
    // Double-rAF bridge for iOS Safari
    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => startAnimation());
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (animationRef.current) animationRef.current.cancel();
    };
  }, [enabled, startAnimation]);

  // ResizeObserver for dynamic content changes
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(() => {
      if (enabled) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => startAnimation());
        });
      }
    });
    ro.observe(track);
    return () => ro.disconnect();
  }, [enabled, startAnimation]);

  return { viewportRef, trackRef };
}

// Usage — note: uses opacity, NOT display:none
function AutoScrollTicker({ items, visible }) {
  const { viewportRef, trackRef } = useAutoScroll({ speed: 50, enabled: visible });
  return (
    <div
      ref={viewportRef}
      style={{
        height: '65svh',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.3s'
      }}
    >
      <div ref={trackRef} style={{ willChange: 'transform' }}>
        {items.map((item, i) => <div key={i}>{item}</div>)}
      </div>
    </div>
  );
}
```

---

## Why each alternative approach does or doesn't work

**`will-change: transform`** does not fix this problem. It promotes the element to a compositor layer for smoother animation, but doesn't address the fundamental issue of stale layout measurements or CSS variable resolution timing. It's a performance hint, not a triggering mechanism.

**`visibility: hidden` vs `display: none`** is a partial fix. Unlike `display:none`, `visibility: hidden` keeps the element in the render tree with valid dimensions, so `scrollHeight` and `clientHeight` return correct values. However, the element still occupies layout space. Combine with `height: 0; overflow: hidden` if you need to collapse the space, though this changes the container's dimensions and requires remeasurement when shown.

**`@starting-style` + `transition-behavior: allow-discrete`** is the modern CSS solution (Safari 18+) that lets you animate *from* `display:none`. However, it only works for transitions (not `@keyframes` animations), requires iOS 18+, and doesn't solve the measurement problem — you still need valid `scrollHeight` values for your `--scroll-dist` calculation.

**Changing the React `key` prop** forces React to destroy and recreate the DOM node, effectively performing a "clone and reinsert." This reliably restarts CSS animations on all browsers including iOS Safari, but doesn't solve the measurement timing issue. You'd still need forced reflow + double-rAF before reading dimensions.

---

## Conclusion

The root cause is a **convergence of three iOS Safari behaviors**: aggressive layout deferral after `display:none` removal, buggy CSS variable resolution in `@keyframes`, and ResizeObserver measurement timing issues. No single workaround addresses all three. The robust solution eliminates each factor: **replace `display:none` with `opacity:0`** (removes the layout deferral problem entirely), **use the Web Animations API with computed pixel values** (bypasses CSS variable resolution bugs), and **wrap animation start in a double-`requestAnimationFrame`** (guarantees paint completion before measurement). The `svh` unit should be replaced with a JavaScript-calculated viewport height via `window.visualViewport.height` for maximum reliability on iOS. This combination works across all iOS Safari versions from 13.4 onward and degrades gracefully on desktop browsers where none of these workarounds are strictly necessary.
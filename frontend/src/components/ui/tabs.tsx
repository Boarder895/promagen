'use client';

// src/components/ui/tabs.tsx
import * as React from "react";
import { track } from "@/lib/analytics";
import { FOCUS_RING } from "@/lib/ui/provider-styles";

// ---- Types -------------------------------------------------------------------

/** Base contract for a tab; optional disabled for keyboard skipping. */
export type BaseTabItem = {
  id: string;
  label: string;
  disabled?: boolean;
};

/** Rich contract when items already carry their panel node. */
export type TabItem = BaseTabItem & {
  panel: React.ReactNode;
};

export type TabsOrientation = "horizontal" | "vertical";

export type TabsProps<T extends BaseTabItem> = {
  /** Items to render (readonly accepted). */
  items: ReadonlyArray<T>;

  /** ID of the element that labels the tablist (visible heading). */
  labelledBy?: string;
  /** Legacy alias used in some tests. */
  labelledById?: string;

  /**
   * Optional custom renderer for the tab element or its inner content.
   * If this returns a React element (e.g. <InpageTab />), we clone it and inject tab props.
   * If it returns non-element content (string/fragment), we wrap it in a button.
   */
  renderTab?: (item: T) => React.ReactNode;

  /**
   * Provide a panel factory when items don’t include `panel`.
   * If omitted, the component tries `("panel" in item)`.
   */
  getPanel?: (item: T, index: number) => React.ReactNode;

  /** Initial selected index (for uncontrolled mode). */
  initialIndex?: number;

  /** Uncontrolled change callback (also used in controlled mode). */
  onChange?: (item: T, index: number) => void;

  /** Controlled mode current index. If provided, Tabs becomes controlled. */
  index?: number;
  /** Controlled mode change callback. */
  onIndexChange?: (index: number, item: T) => void;

  /** Orientation for keyboard behaviour and ARIA. */
  orientation?: TabsOrientation; // default "horizontal"

  /** If true, unmount inactive panels; otherwise keep them mounted and hide. */
  unmountInactivePanels?: boolean; // default false for SR predictability

  /** Styling passthrough. */
  className?: string;

  /** Test ID controls (used by your suites). */
  listTestId?: string;        // e.g. "tablist"
  /** Legacy alias used by an earlier test. */
  ListTestId?: string;        // keep for compatibility
  tabTestIdPrefix?: string;   // e.g. "tab-"
  panelTestIdPrefix?: string; // e.g. "panel-"

  /** Announce selection changes for SRs that don’t auto-announce. */
  announceChanges?: boolean;            // default true
  /** TestId for the aria-live region (optional). */
  liveRegionTestId?: string;
};

// ---- Internal helpers --------------------------------------------------------

function isFunction(v: unknown): v is (...args: unknown[]) => unknown {
  return typeof v === "function";
}

type AnyElement = React.ReactElement<unknown>;
type ButtonProps = React.ComponentPropsWithoutRef<"button">;

// ---- Component ---------------------------------------------------------------

export function Tabs<T extends BaseTabItem>({
  items,
  labelledBy,
  labelledById,
  renderTab,
  getPanel,
  initialIndex = 0,
  onChange,
  index: controlledIndex,
  onIndexChange,
  orientation = "horizontal",
  unmountInactivePanels = false,
  className,
  listTestId,
  ListTestId,
  tabTestIdPrefix = "tabs-tab",
  panelTestIdPrefix = "tabs-panel",
  announceChanges = true,
  liveRegionTestId = "tabs-live-region",
}: TabsProps<T>) {
  const count = items.length;
  const reactId = React.useId();

  const isControlled = typeof controlledIndex === "number";
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  const [uncontrolledIndex, setUncontrolledIndex] = React.useState(() =>
    clamp(initialIndex, 0, Math.max(0, count - 1)),
  );

  const index = isControlled
    ? clamp(controlledIndex!, 0, Math.max(0, count - 1))
    : uncontrolledIndex;

  const btnRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const isDisabledAt = (i: number) => !!items[i]?.disabled;

  const nextEnabled = (start: number, dir: 1 | -1) => {
    if (count === 0) return 0;
    let i = start;
    for (let step = 0; step < count; step++) {
      i = (i + dir + count) % count;
      if (!isDisabledAt(i)) return i;
    }
    return start;
  };

  const setIndex = (i: number) => {
    const clamped = clamp(i, 0, Math.max(0, count - 1));
    if (isControlled) {
      const item = items[clamped];
      if (item) {
        onIndexChange?.(clamped, item);
        onChange?.(item, clamped);
      }
    } else {
      setUncontrolledIndex(clamped);
    }
  };

  // Live announcer (polite) text for SRs; visually hidden.
  const [announcement, setAnnouncement] = React.useState<string>("");

  // Keep focus and emit analytics on visible selection changes
  React.useEffect(() => {
    const btn = btnRefs.current[index];
    if (btn) btn.focus();

    const item = items[index];
    if (item) {
      try {
        track?.("ui.tab_select", { id: item.id, index });
      } catch {
        /* swallow analytics errors */
      }
      onChange?.(item, index);
      if (announceChanges) {
        // Defer text mutation slightly so SRs always pick it up
        setTimeout(() => setAnnouncement(`Tab selected: ${item.label}`), 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (count === 0) return;

    const isH = orientation === "horizontal";
    const isV = orientation === "vertical";

    switch (e.key) {
      case "ArrowRight":
      case "Right":
        if (!isH) break;
        e.preventDefault();
        setIndex(nextEnabled(index, 1));
        break;
      case "ArrowLeft":
      case "Left":
        if (!isH) break;
        e.preventDefault();
        setIndex(nextEnabled(index, -1));
        break;
      case "ArrowDown":
        if (!isV) break;
        e.preventDefault();
        setIndex(nextEnabled(index, 1));
        break;
      case "ArrowUp":
        if (!isV) break;
        e.preventDefault();
        setIndex(nextEnabled(index, -1));
        break;
      case "Home":
        e.preventDefault();
        setIndex(isDisabledAt(0) ? nextEnabled(0, 1) : 0);
        break;
      case "End":
        e.preventDefault();
        setIndex(isDisabledAt(count - 1) ? nextEnabled(count - 1, -1) : count - 1);
        break;
    }
  };

  const ariaLabelledBy = labelledBy ?? labelledById;
  const tablistTestId = listTestId ?? ListTestId ?? "tablist";

  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-labelledby={ariaLabelledBy}
        aria-orientation={orientation}
        onKeyDown={onKeyDown}
        data-testid={tablistTestId}
        data-prm={prefersReducedMotion ? "on" : "off"}
      >
        {items.map((item, i) => {
          const tabId = `${reactId}-tab-${i}`;
          const panelId = `${reactId}-panel-${i}`;
          const selected = i === index;
          const disabled = isDisabledAt(i);

          if (renderTab) {
            const raw = renderTab(item);

            if (React.isValidElement(raw)) {
              // We only attach a ref to intrinsic <button>; for composites we skip the ref.
              const isIntrinsicButton =
                typeof raw.type === "string" && raw.type === "button";

              const maybeRef = isIntrinsicButton
                ? (el: HTMLButtonElement | null) => {
                    btnRefs.current[i] = el;
                  }
                : undefined;

              const existingOnClick = (raw.props as { onClick?: unknown }).onClick;
              const incomingClassName = (raw.props as { className?: string }).className;

              const extraProps: Partial<ButtonProps> & Record<string, unknown> = {
                key: item.id, // ensure a unique key on the cloned element
                id: tabId,
                role: "tab",
                "aria-selected": selected,
                "aria-controls": panelId,
                "aria-disabled": disabled || undefined,
                disabled: (raw.props as { disabled?: boolean }).disabled ?? disabled,
                tabIndex: selected && !disabled ? 0 : -1,
                ref: maybeRef,
                className: [FOCUS_RING, incomingClassName].filter(Boolean).join(" "),
                "data-tab-id": item.id,
                "data-testid": `${tabTestIdPrefix}--${item.id}`,
                onClick: (e: React.MouseEvent) => {
                  if (isFunction(existingOnClick)) {
                    (existingOnClick as (ev: React.MouseEvent) => void)(e);
                  }
                  if (!disabled) setIndex(i);
                },
              };

              return React.cloneElement(raw as AnyElement, extraProps);
            }

            // Non-element content → wrap once in our button.
            return (
              <button
                key={item.id}
                id={tabId}
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                aria-disabled={disabled || undefined}
                disabled={disabled}
                tabIndex={selected && !disabled ? 0 : -1}
                ref={(el) => {
                  btnRefs.current[i] = el;
                }}
                className={FOCUS_RING}
                data-tab-id={item.id}
                data-testid={`${tabTestIdPrefix}--${item.id}`}
                onClick={() => {
                  if (!disabled) setIndex(i);
                }}
              >
                {raw}
              </button>
            );
          }

          // Default: our own button with the label.
          return (
            <button
              key={item.id}
              id={tabId}
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              tabIndex={selected && !disabled ? 0 : -1}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              className={FOCUS_RING}
              data-tab-id={item.id}
              data-testid={`${tabTestIdPrefix}--${item.id}`}
              onClick={() => {
                if (!disabled) setIndex(i);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {items.map((item, i) => {
        const tabId = `${reactId}-tab-${i}`;
        const panelId = `${reactId}-panel-${i}`;
        const selected = i === index;

        const panelFromProp =
          "panel" in item
            ? (item as Extract<T, { panel: React.ReactNode }>).panel
            : null;

        const panel = getPanel?.(item, i) ?? panelFromProp;

        if (unmountInactivePanels && !selected) {
          return null;
        }

        return (
          <div
            key={item.id}
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId}
            tabIndex={0}
            hidden={!selected}
            data-testid={`${panelTestIdPrefix}--${item.id}`}
          >
            {panel}
          </div>
        );
      })}

      {/* Polite live region for SRs; visually hidden but present in DOM */}
      {announceChanges && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid={liveRegionTestId}
          className="sr-only"
        >
          {announcement}
        </div>
      )}
    </div>
  );
}

// Keep default export for legacy imports.
export default Tabs;

/** PRM hook with feature detection and no layout shift. */
function usePrefersReducedMotion() {
  const [prm, setPrm] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrm(!!media.matches);
    update();

    // Support both modern and legacy MQL APIs without `any`
    const modern = (media as unknown as {
      addEventListener?: (type: "change", listener: () => void) => void;
      removeEventListener?: (type: "change", listener: () => void) => void;
    });

    const legacy = (media as unknown as {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    });

    if (modern.addEventListener && modern.removeEventListener) {
      modern.addEventListener("change", update);
      return () => modern.removeEventListener?.("change", update);
    }

    if (legacy.addListener && legacy.removeListener) {
      legacy.addListener(update);
      return () => legacy.removeListener?.(update);
    }
  }, []);

  return prm;
}

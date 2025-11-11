'use client';

import * as React from 'react';
import { useTabs } from './use-tabs';

type Props = {
  /** Logical id for this panel (must match the paired tab’s id) */
  id: string;
  children?: React.ReactNode;
};

/**
 * TabPanel
 * - Always stays in the DOM for a11y; visibility toggled with hidden/aria-hidden.
 * - ARIA linkage:
 *   - Tab:    id="tab-{id}"      aria-controls="panel-{id}"
 *   - Panel:  id="panel-{id}"    aria-labelledby="tab-{id}"
 */
export default function TabPanel({ id, children }: Props) {
  const { items, selectedId } = useTabs();

  // A panel is active when both the tab id and its panelId match this panel and
  // that tab is the currently selected one.
  const isActive = React.useMemo(
    () => items.some(t => t.panelId === id && t.id === selectedId),
    [items, id, selectedId]
  );

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!isActive}
      aria-hidden={!isActive}
      className="mt-4"
    >
      {children ?? null}
    </div>
  );
}

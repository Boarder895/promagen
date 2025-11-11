// Minimal, dependency-free focus helpers: trap within a node and restore focus.
export function focusTrapWithin(root: HTMLElement | null) {
  if (!root) {return () => {};}
  const focusable = () => Array.from(
    root.querySelectorAll<HTMLElement>([
      'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
      'input[type="text"]:not([disabled])', 'input[type="search"]:not([disabled])',
      'select:not([disabled])', '[tabindex]:not([tabindex="-1"])'
    ].join(','))
  );
  const first = () => focusable()[0];
  const last  = () => { const list = focusable(); return list[list.length - 1]; };

  // move focus in on open
  setTimeout(() => first()?.focus(), 0);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') {return;}
    const f = first();
    const l = last();
    if (!f || !l) {return;}
    if (e.shiftKey && document.activeElement === f) {
      l.focus(); e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === l) {
      f.focus(); e.preventDefault();
    }
  };
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}

export function restoreFocusTo(el: HTMLElement | null) {
  if (!el) {return;}
  setTimeout(() => el.focus(), 0);
}

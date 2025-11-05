import '@testing-library/jest-dom';

class RO { observe(){} unobserve(){} disconnect(){} }
(global as any).ResizeObserver = (global as any).ResizeObserver || RO;

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = function () {};
}



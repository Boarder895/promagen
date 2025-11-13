"use client";

import * as React from "react";

export type InpageTabProps = React.ComponentPropsWithoutRef<"button"> & {
  /** Visible text label used by tests: <InpageTab label="Overview" /> */
  label?: string;
  /** Optional leading node (icon/badge) */
  prefix?: React.ReactNode;
  /** Optional trailing node (counter/chevron) */
  suffix?: React.ReactNode;
};

const InpageTab = React.forwardRef<HTMLButtonElement, InpageTabProps>(
  (
    {
      label,
      prefix,
      suffix,
      type = "button",
      className,
      children,
      ...buttonProps
    },
    ref,
  ) => {
    // Build content with stable keys to silence React's warning.
    const content: React.ReactNode[] = [];

    if (prefix != null) {
      content.push(<span key="prefix">{prefix}</span>);
    }

    if (label != null) {
      content.push(<span key="label">{label}</span>);
    }

    if (children != null) {
      // If callers pass fragments/arrays, Children.toArray adds keys.
      const keyed = React.Children.toArray(children);
      content.push(<span key="children">{keyed}</span>);
    }

    if (suffix != null) {
      content.push(<span key="suffix">{suffix}</span>);
    }

    return (
      <button ref={ref} type={type} className={className} {...buttonProps}>
        {content}
      </button>
    );
  },
);

InpageTab.displayName = "InpageTab";

export default InpageTab;
export { InpageTab };

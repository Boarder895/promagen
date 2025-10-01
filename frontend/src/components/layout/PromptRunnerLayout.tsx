// src/components/layout/PromptRunnerLayout.tsx
import * as React from "react";
import clsx from "clsx";

type WithChildrenProps = React.PropsWithChildren<{ className?: string }>;

const Root: React.FC<WithChildrenProps> = ({ children, className }) => (
  <div className={clsx("grid grid-cols-1 lg:grid-cols-12 gap-6", className)}>{children}</div>
);
Root.displayName = "PromptRunnerLayout";

const Left: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <section className={clsx("lg:col-span-7 rounded-2xl bg-white shadow-card border border-slate-200 p-6", className)} {...rest}>
    {children}
  </section>
);
Left.displayName = "PromptRunnerLayout.Left";

const Right: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <aside className={clsx("lg:col-span-5 rounded-2xl bg-white shadow-card border border-slate-200 p-6", className)} {...rest}>
    <div className="sticky top-6 flex flex-col gap-4">{children}</div>
  </aside>
);
Right.displayName = "PromptRunnerLayout.Right";

const Footer: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <div className={clsx("col-span-full", className)} {...rest}>
    {children}
  </div>
);
Footer.displayName = "PromptRunnerLayout.Footer";

export const PromptRunnerLayout = Object.assign(Root, { Left, Right, Footer });
export default PromptRunnerLayout;



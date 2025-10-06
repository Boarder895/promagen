'use client';
// if you donÃ¢â‚¬â„¢t have a cn helper, I include a safe inline fallback below

type Props = {
  className?: string;
  lines?: number;     // number of skeleton lines
  rounded?: boolean;  // pill vs square
};

function classnames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/**
 * A tiny shimmering skeleton block.
 * Named export only (project rule).
 */
export function Skeleton({ className, lines = 1, rounded = true }: Props) {
  const base =
    'relative overflow-hidden bg-gray-200 dark:bg-gray-800 animate-pulse';
  const radius = rounded ? 'rounded-xl' : 'rounded-md';

  return (
    <div className={classnames('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={classnames(base, radius)}
          style={{ height: 12 + (i === 0 ? 4 : 0) }}
        />
      ))}
    </div>
  );
}


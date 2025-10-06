'use client';

interface Props { values: number[]; className?: string; }

export const Sparkline = ({ values, className }: Props) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = (1 - norm(v)) * 24;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className={className}>
      <polyline points={pts} fill="none" strokeWidth="2" />
    </svg>
  );
};


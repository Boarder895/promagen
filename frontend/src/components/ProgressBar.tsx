"use client";

export default function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-gray-200">
      <div className="h-full bg-blue-600 transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}





// frontend/src/components/ApiStatusBadge.tsx
type Props = {
  ok?: boolean;
  compact?: boolean; // <-- SiteHeader uses this
};

export default function ApiStatusBadge({ ok = true, compact = false }: Props) {
  const color = ok ? 'bg-green-500' : 'bg-red-500';
  const label = ok ? 'OK' : 'Down';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full ${compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'} bg-gray-100`}
      aria-label={`API status: ${label}`}
      title={`API status: ${label}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {!compact && <span className="font-medium">{label}</span>}
    </span>
  );
}

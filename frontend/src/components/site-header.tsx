// src/components/SiteHeader.tsx
import ApiStatusBadge from '@/components/api-status-badge';

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between p-4 border-b">
      <div className="font-semibold">Promagen</div>
      <ApiStatusBadge compact />
    </header>
  );
}








// frontend/components/Header.tsx — COMPLETE
import StatusChip from "@/components/StatusChip";
import ServiceBanner from "@/components/ServiceBanner";

export default function Header() {
  return (
    <>
      <header className="w-full border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Promagen" className="h-6 w-6" />
            <span className="font-semibold">Promagen</span>
          </div>
          <div className="flex items-center gap-4">
            <StatusChip />
          </div>
        </div>
      </header>

      {/* Shows only when degraded/down (and is dismissible) */}
      <ServiceBanner />
    </>
  );
}

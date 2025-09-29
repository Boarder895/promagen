import "@/app/globals.css";
import DocsChrome from "@/components/Books/DocsChrome";
import LeftNav from "@/components/LeftNav"; // optional; replace with your real left nav
import BuildAudit from "@/components/Books/BuildAudit"; // optional right rail widget

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocsChrome
      left={<LeftNav />}
      right={
        <div className="space-y-4">
          <BuildAudit />
        </div>
      }
    >
      {children}
    </DocsChrome>
  );
}

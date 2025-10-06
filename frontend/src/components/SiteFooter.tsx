// FRONTEND ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ NEXT.JS
// File: frontend/components/SiteFooter.tsx
export default function SiteFooter() {
  return (
    <footer className="w-full border-t bg-white">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between text-sm text-gray-600">
        <span>ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© {new Date().getFullYear()} Promagen</span>
        <a
          href="/status"
          className="underline underline-offset-2 hover:opacity-80"
        >
          Status
        </a>
      </div>
    </footer>
  );
}





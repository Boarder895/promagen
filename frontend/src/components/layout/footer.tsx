"use client";

export default function Footer() {
  return (
    <footer className="py-6 border-t text-sm text-muted-foreground">
      © {new Date().getFullYear()} Promagen
    </footer>
  );
}


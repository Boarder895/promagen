"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Item = { id: string; text: string; level: number };

export default function TOC() {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string>("");
  const pathname = usePathname();

  useEffect(() => {
    const hs = Array.from(document.querySelectorAll(".markdown-body h2, .markdown-body h3")) as HTMLHeadingElement[];
    const list: Item[] = hs.map(h => {
      if (!h.id) h.id = h.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "";
      return { id: h.id, text: h.textContent || "", level: h.tagName === "H2" ? 2 : 3 };
    });
    setItems(list);

    const io = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop);
        if (visible[0]) setActive((visible[0].target as HTMLElement).id);
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0.1 }
    );
    hs.forEach(h => io.observe(h));
    return () => io.disconnect();
  }, [pathname]);

  if (!items.length) return null;

  return (
    <nav>
      <h4>On this page</h4>
      {items.map(i => (
        <a
          key={i.id}
          href={`#${i.id}`}
          className={i.id === active ? "active" : ""}
          style={{marginLeft: i.level === 3 ? 12 : 0}}
        >
          {i.text}
        </a>
      ))}
    </nav>
  );
}

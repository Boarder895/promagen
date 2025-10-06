"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import Fuse from "fuse.js";

const PAGES = [
  { slug: "developers", title: "ðŸ“˜ Developers Book", desc: "Feature commands, paths, admin ops." },
  { slug: "users",      title: "ðŸ“™ Users Book",       desc: "User walkthrough + YouTube links." },
  { slug: "build-plan", title: "ðŸ— Build Progress Book", desc: "Whatâ€™s done vs outstanding." }
];

export default function DocsSidebar() {
  const pathname = usePathname();
  const [q, setQ] = useState("");

  const fuse = useMemo(
    () => new Fuse(PAGES, { includeScore: false, keys: ["title", "desc", "slug"], threshold: 0.4 }),
    []
  );

  const results = q ? fuse.search(q).map(r => r.item) : PAGES;

  return (
    <div>
      <h2 style={{margin: "0 0 12px"}}>Promagen Docs</h2>
      <input
        aria-label="Search docs"
        placeholder="Searchâ€¦"
        value={q}
        onChange={e => setQ(e.target.value)}
        style={{width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12}}
      />
      <nav>
        {results.map(p => {
          const href = `/docs/${p.slug}`;
          const active = pathname?.startsWith(href);
          return (
            <div key={p.slug} style={{marginBottom: 8}}>
              <Link className={`nav-link${active ? " active" : ""}`} href={href}>{p.title}</Link>
              <div style={{fontSize: 12, color: "#6b7280", marginLeft: 6}}>{p.desc}</div>
            </div>
          );
        })}
      </nav>
      <div style={{borderTop: "1px solid #eee", marginTop: 16, paddingTop: 12}}>
        <Link className={`nav-link${pathname === "/docs" ? " active" : ""}`} href="/docs">ðŸ“š Docs Home</Link>
      </div>
    </div>
  );
}




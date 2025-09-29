"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Command, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { loadClientBooks } from "./clientBooks";

function useHotkey(key: string, handler: () => void) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault(); handler();
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [key, handler]);
}

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useHotkey("k", () => setOpen(true));

  const data = loadClientBooks(); // lightweight client copy
  const entries = useMemo(() => {
    return [
      ...data.usersBook.sections.map(s => ({ label: `Users · ${s.title}`, href: `/docs/users#${s.id}` })),
      ...data.developersBook.inProgress.map(s => ({ label: `Developers · ${s.title}`, href: `/docs/developers#${s.id}` })),
      ...data.historyBook.entries.slice(0,40).map((e,i) => ({ label: `History · ${e.item}`, href: `/docs/history#e${i}` })),
    ];
  }, [data]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-[980px] px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/docs" className="font-semibold">Promagen Docs</Link>
            <nav className="hidden sm:flex items-center gap-3 text-sm">
              <Link href="/docs/users" className="opacity-80 hover:opacity-100">Users</Link>
              <Link href="/docs/developers" className="opacity-80 hover:opacity-100">Developers</Link>
              <Link href="/docs/history" className="opacity-80 hover:opacity-100">History</Link>
              <Link href="https://youtube.com" target="_blank" className="opacity-80 hover:opacity-100">Help</Link>
            </nav>
          </div>
          <button onClick={()=>setOpen(true)} className="text-sm inline-flex items-center gap-2 border rounded-xl px-3 py-1.5">
            <Search className="w-4 h-4" /> Search <span className="opacity-60 text-xs inline-flex items-center gap-0.5"><Command className="w-3 h-3" />K</span>
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4" onClick={()=>setOpen(false)}>
          <div onClick={(e)=>e.stopPropagation()} className="mx-auto max-w-[720px] bg-white rounded-2xl shadow-2xl p-3">
            <input autoFocus placeholder="Search docs…" className="w-full border rounded-xl px-3 py-2 mb-2 outline-none"
                   onKeyDown={(e)=>{ if(e.key==="Escape") setOpen(false); }}
                   onChange={(e)=>{ /* optional live filter UI */ }} />
            <ul className="max-h-[50vh] overflow-auto">
              {entries.map((r,i)=>(
                <li key={i}>
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50"
                          onClick={()=>{ setOpen(false); router.push(r.href); }}>
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

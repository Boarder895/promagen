"use client";
import { useMemo, useState } from "react";
import { youtubeEmbed } from "@/lib/video";

export default function VideoModal({ url, children }: { url: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const embed = useMemo(() => youtubeEmbed(url), [url]);

  if (!url) return null;
  if (!embed) {
    return (
      <a className="underline text-sm" href={url} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <>
      <button className="underline text-sm" onClick={() => setOpen(true)}>{children}</button>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl aspect-video overflow-hidden" onClick={(e)=>e.stopPropagation()}>
            <iframe className="w-full h-full" src={embed} allow="autoplay; fullscreen" />
          </div>
        </div>
      )}
    </>
  );
}

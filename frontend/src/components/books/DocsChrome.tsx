'use client';
import React from 'react';

export default function DocsChrome({
  left,
  children,
  right,
}: {
  left?: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-12 gap-6 px-4 py-6">
      <aside className="col-span-12 lg:col-span-3 space-y-4">{left}</aside>
      <main className="col-span-12 lg:col-span-6">
        <div className="mx-auto max-w-[780px]">{children}</div>
      </main>
      <aside className="col-span-12 lg:col-span-3 space-y-4">{right}</aside>
    </div>
  );
}



"use client";

// FRONTEND • components/ui/Toast.tsx
import React, { createContext, useContext, useState, useCallback } from "react";

type Toast = { id: number; title: string; body?: string };
type ToastCtx = { push: (t: Omit<Toast, "id">) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((arr) => [...arr, { id, ...t }]);
    // auto-dismiss after 4s
    setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-[1000]">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-2xl shadow-md bg-white ring-1 ring-gray-200 px-4 py-3 max-w-xs">
            <div className="font-medium">{t.title}</div>
            {t.body ? <div className="text-sm text-gray-600 mt-1">{t.body}</div> : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

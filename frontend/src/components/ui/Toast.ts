// src/components/ui/Toast.ts
"use client";

export function useToast() {
  // no-op stub; wire real toasts later
  return {
    push: (_opts: { title: string; body?: string }) => {
      void _opts; // mark as used to satisfy lint
    },
  };
}
export default useToast;







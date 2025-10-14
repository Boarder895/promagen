"use client";
export function useToast() {
  // no-op stub; wire real toasts later
  return { push: (_: { title: string; body?: string }) => {} };
}
export default useToast;

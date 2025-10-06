// FRONTEND ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ NEXT.JS
// File: frontend/lib/cn.ts
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}





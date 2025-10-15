// frontend/src/types/next-link.d.ts
// Loosen typing to avoid "Link cannot be used as a JSX component" caused by duplicate @types/react.
// This preserves DX while you sort workspace node_modules later.
declare module 'next/link' {
  const Link: any;
  export default Link;
}

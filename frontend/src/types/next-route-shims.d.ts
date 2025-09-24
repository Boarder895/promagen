// Let Next's .next/types/* validator import page.js/layout.js/route.js shapes during `tsc --noEmit`.
declare module "*/app/**/page.js" {
  const Page: any;
  export default Page;
  export const metadata: any;
  export const generateMetadata: any;
}

declare module "*/app/**/layout.js" {
  const Layout: any;
  export default Layout;
  export const metadata: any;
}

declare module "*/app/**/route.js" {
  export const GET: any;
  export const POST: any;
  export const PUT: any;
  export const PATCH: any;
  export const DELETE: any;
}

declare module "*/app/**/loading.js" {
  const C: any;
  export default C;
}

declare module "*/app/**/error.js" {
  const C: any;
  export default C;
}

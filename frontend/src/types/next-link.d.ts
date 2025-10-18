// src/types/next-link.d.ts
import type * as React from "react";

// Avoids "Link cannot be used as a JSX component" due to React type duplication.
// Narrow enough for Stage 1; we’ll remove when workspace deps stabilize.
declare module "next/link" {
  const Link: React.ComponentType<unknown>;
  export default Link;
}






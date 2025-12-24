// frontend/src/global.d.ts
//
// Global type augmentation for singleton caches.
// This keeps runtime behaviour unchanged while removing unsafe casts.

import type postgres from 'postgres';

declare global {
   
  var promagenSql: postgres.Sql<Record<string, never>> | undefined;
}

export {};

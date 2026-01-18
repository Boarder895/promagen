import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

function isRunningOnFly(): boolean {
  return Boolean(process.env.FLY_APP_NAME || process.env.FLY_REGION);
}

function tryLoadLocalEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      return;
    }
  }
}

// Load local .env files only when running locally.
// On Fly.io, secrets/env are injected at runtime and we must not rely on local files.
if (!isRunningOnFly()) {
  tryLoadLocalEnv();
}

// Importing server starts the app.
await import('./server.js');

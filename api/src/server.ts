// src/server.ts
import app from './app.js';

const port = Number(process.env.PORT) || 3001; // default 3001 for local
const host = '0.0.0.0';

app.listen(port, host, () => {
  console.log(`🚀 API listening on http://${host}:${port}`);
});

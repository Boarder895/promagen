import express from 'express';
import cors from 'cors';

import providersRouter from './routes/providers';   // <-- default import
import { healthHandler } from './services/health';
import versionRouter from './routes/version';


const app = express();

app.use(express.json());
app.use(cors()); // keep it simple for now; we'll tighten later

// infra endpoints
app.get('/health', healthHandler);

// feature routers
app.use('/api/providers', providersRouter);
app.use('/version', versionRouter);
// boot
const PORT = Number(process.env.PORT || 3001);
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`[api] listening on http://${HOST}:${PORT}`);
});

import { Router } from 'express';

const router = Router();

// Simple JSON echo (validates that JSON parsing + CORS work)
router.post('/', (req, res) => {
  res.status(200).json({
    ok: true,
    received: req.body,
    ts: new Date().toISOString(),
  });
});

export default router;

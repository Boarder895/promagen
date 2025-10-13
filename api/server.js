// C:\Users\Martin Yarnold\Projects\promagen\api\server.js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS (open or restrict via env)
const allowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'));
  },
}));
app.use(express.json());

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// ★ Leaderboard (this is what the frontend calls)
app.get('/api/leaderboard', (req, res) => {
  const providers = [
    { id: 'openai',    name: 'OpenAI',    score: 92.1, delta: 0.4  },
    { id: 'i23rf',     name: 'I23RF',     score: 83.6, delta: -0.7 },
    { id: 'stability', name: 'Stability', score: 80.2, delta: 1.2  },
  ];
  res.json({ updatedAt: new Date().toISOString(), providers });
});

app.listen(PORT, () => console.log(`promagen-api listening on ${PORT}`));

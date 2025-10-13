# 🏗 Promagen Build Plan
**Edition: 2025-09-27**

### What’s New in This Edition
- Dual-option Prompt Runner flagged as ⬜ outstanding feature.  
- Copy & Open confirmed as universal, not just UI-only.  
- Score Adjustment Editor marked ✅ live.  
- Provider badges (⚡/✂️/💸) integrated into plan.  

---

## 1) Foundation & Repos
- ✅ Repo split (frontend + api)  
- ✅ ENV strategy (Vercel + Fly)  
- ⬜ CI/CD pipelines  
- ⬜ CHANGELOG/tags

## 2) Backend API
- ✅ Binds to `0.0.0.0:3001`, `/health` live  
- ✅ Prisma wired, migrations working  
- ✅ Secrets via Fly  
- 🟡 Logging (Logtail OK, redaction pending)  
- 🟡 AES-256-GCM helpers drafted (vault flow pending)  
- ⬜ Rate limiting  
- ⬜ Zod schema validation  
- ⬜ `/metrics` endpoint (restricted)

## 3) Frontend
- ✅ PROD API default, admin endpoints live  
- 🟡 App Router migration (partial)  
- 🟡 Root middleware for origin + admin guards  
- ⬜ Error boundaries, toast notifications  
- ⬜ Provider selector fully wired

## 4) Security
- ✅ HTTPS, CORS, origin checks, admin token  
- 🟡 Logging redaction  
- ⬜ helmet + CSP  
- ⬜ Rate limiting  
- ⬜ Zod validation  
- ⬜ Dependency hygiene (Renovate/audit)  
- ⬜ Hardened cookies (future sessions)

## 5) Provider Integration
- 🟡 Registry scaffolded (20 locked IDs)  
- ⬜ API integrations (OpenAI, Stability, Leonardo)  
- ⬜ UI-only providers (Midjourney, Canva, Firefly, etc.)  
- ⬜ Dual-option Prompt Runner (⚡ + ✂️ fully wired)  
- ⬜ User key vault (AES encrypted)

## 6) Leaderboard & Scoring
- ✅ Blueprint locked  
- ✅ Basic view in frontend  
- ✅ Score Adjustment Editor live (clamped 0–100)  
- ⬜ Collectors (hourly + nightly)  
- ⬜ Manual review UI + overrides  
- ⬜ Snapshots, sparklines, ▲▼ indicators  
- ⬜ Evidence/provenance tracking

## 7) Popular Prompt Grid
- ⬜ Grid UI  
- ⬜ Like button weighting  
- ⬜ Refine/Remix  
- ⬜ SEO surface

## 8) WordPress ↔ App
- ✅ Policy locked (iframe for secure features)  
- ⬜ Public shortcode (leaderboard embed)  
- ⬜ Personalized iframe scaffolding  
- ⬜ Affiliate disclosure components

## 9) Observability & Ops
- ✅ Fly logs, Logtail sink  
- 🟡 Slack alerts  
- ⬜ Uptime pings, runbooks  
- ⬜ Postgres backups + restore tests

## 10) Admin & Access
- ✅ Token pattern  
- 🟡 Token docs  
- ⬜ Admin panel UI  
- ⬜ Audit log

## 11) Data & Compliance
- 🟡 Minimal PII stance (keys only, encrypted)  
- ⬜ Retention policy + ERD docs  
- ⬜ GDPR export/delete  
- ⬜ Cookie banner (when sessions/analytics added)

## 12) Release & QA
- ⬜ Staging envs  
- ⬜ Smoke tests  
- ⬜ E2E happy paths  
- ⬜ Go/No-Go checklist

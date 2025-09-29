import { Router } from 'express'
import { PROVIDERS, UPDATED_AT, type ProviderId } from '../registry/providers'

const router = Router()

// GET /api/v1/providers
router.get('/', (_req, res) => {
  const apiEnabled = PROVIDERS.filter(p => p.apiEnabled)
  const nonApi = PROVIDERS.filter(p => !p.apiEnabled)
  res.json({
    updatedAt: UPDATED_AT,
    count: PROVIDERS.length,
    apiEnabledCount: apiEnabled.length,
    providers: PROVIDERS,
    apiEnabled,
    nonApi
  })
})

// GET /api/v1/providers/:id
router.get('/:id', (req, res) => {
  const id = req.params.id as ProviderId
  const p = PROVIDERS.find(x => x.id === id)
  if (!p) return res.status(404).json({ error: 'provider_not_found', id })
  res.json(p)
})

export default router

'use client'

import * as React from 'react'
import { PROVIDERS } from '@/lib/providers'

export default function ProviderGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 16
      }}
    >
      {PROVIDERS.map((p) => (
        <article
          key={p.id}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 14,
            background: 'var(--card-bg)'
          }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <strong>{p.name}</strong>
            <span
              title={p.apiEnabled ? 'API enabled' : 'Copy & Open only'}
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 9999,
                border: '1px solid var(--border)',
                background: p.apiEnabled ? 'color-mix(in oklab, #00c853 15%, var(--card-bg))' : 'color-mix(in oklab, #ffc400 18%, var(--card-bg))'
              }}
            >
              {p.apiEnabled ? '⚡ API' : '✂️ Copy & Open'}
            </span>
          </header>

          <footer style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {p.affiliate && (
              <span
                title="Affiliate — we may earn a commission"
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  border: '1px solid var(--border)'
                }}
              >
                💸 Affiliate
              </span>
            )}
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 12,
                  padding: '2px 10px',
                  borderRadius: 9999,
                  border: '1px solid var(--border)'
                }}
              >
                Visit
              </a>
            )}
          </footer>
        </article>
      ))}
    </div>
  )
}

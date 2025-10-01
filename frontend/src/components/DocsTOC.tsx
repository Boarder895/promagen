'use client'

import * as React from 'react'

export default function DocsTOC() {
  // Minimal TOC placeholder (no runtime deps). Replace with your real headings map later.
  const items = [
    { id: 'intro', label: 'Introduction' },
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'next-steps', label: 'Next Steps' },
  ]

  return (
    <nav aria-label="On this page">
      <h4>On this page</h4>
      {items.map((it) => (
        <a key={it.id} className="toc-link" href={`#${it.id}`}>
          {it.label}
        </a>
      ))}
    </nav>
  )
}



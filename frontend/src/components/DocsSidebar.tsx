'use client'

import Link from 'next/link'

export default function DocsSidebar() {
  return (
    <aside>
      <nav>
        <Link className="nav-link" href="/docs/developers">📘 Developers Book</Link>
        <Link className="nav-link" href="/docs/users">📙 Users Book</Link>
        <Link className="nav-link" href="/docs/build-plan">🏗 Build Progress Book</Link>
      </nav>
    </aside>
  )
}



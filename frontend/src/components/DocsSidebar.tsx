'use client'

import Link from 'next/link'

export default function DocsSidebar() {
  return (
    <aside>
      <nav>
        <Link className="nav-link" href="/docs/developers">ðŸ“˜ Developers Book</Link>
        <Link className="nav-link" href="/docs/users">ðŸ“™ Users Book</Link>
        <Link className="nav-link" href="/docs/build-plan">ðŸ— Build Progress Book</Link>
      </nav>
    </aside>
  )
}



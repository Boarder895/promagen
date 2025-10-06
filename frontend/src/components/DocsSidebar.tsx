'use client'

import Link from 'next/link'

export default function DocsSidebar() {
  return (
    <aside>
      <nav>
        <Link className="nav-link" href="/docs/developers">ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¹Ã…â€œ Developers Book</Link>
        <Link className="nav-link" href="/docs/users">ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Users Book</Link>
        <Link className="nav-link" href="/docs/build-plan">ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Build Progress Book</Link>
      </nav>
    </aside>
  )
}





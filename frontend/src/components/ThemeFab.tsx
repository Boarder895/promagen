'use client'

import { useEffect, useMemo, useState } from 'react'

type ThemeChoice = 'light' | 'dark' | 'system'
const KEY = 'theme'
const OPTIONS: ThemeChoice[] = ['light', 'dark', 'system']

export default function ThemeFab() {
  const [choice, setChoice] = useState<ThemeChoice>('system')
  const mql = useMemo(
    () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null),
    []
  )

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      if (saved === 'light' || saved === 'dark' || saved === 'system') setChoice(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    const apply = (c: ThemeChoice) => {
      const dark = c === 'dark' || (c === 'system' && mql?.matches)
      root.classList.toggle('dark', !!dark)
    }

    apply(choice)
    try {
      localStorage.setItem(KEY, choice)
    } catch {}

    if (choice === 'system' && mql) {
      const handler = () => apply('system')
      if (mql.addEventListener) mql.addEventListener('change', handler)
      else if (mql.addListener) mql.addListener(handler)
      return () => {
        if (mql.removeEventListener) mql.removeEventListener('change', handler)
        else if (mql.removeListener) mql.removeListener(handler)
      }
    }
  }, [choice, mql])

  const cycle = () => {
    const idx = OPTIONS.indexOf(choice)
    const next = OPTIONS[(idx + 1) % OPTIONS.length]
    setChoice(next)
  }

  return (
    <button
      type="button"
      aria-label={`Theme: ${choice}`}
      title={`Theme: ${choice.charAt(0).toUpperCase() + choice.slice(1)} (click to change)`}
      onClick={cycle}
      className="fixed bottom-5 right-5 z-50 h-11 w-11 rounded-full border shadow-soft
                 bg-white/90 hover:bg-white dark:bg-[#0b0f14]/90 dark:hover:bg-[#0b0f14]
                 border-gray-200 dark:border-gray-800
                 flex items-center justify-center transition-colors"
    >
      <Icon mode={choice} />
    </button>
  )
}

function Icon({ mode }: { mode: ThemeChoice }) {
  if (mode === 'light') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"
           className="text-black dark:text-white">
        <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zm10.48 0l1.8-1.79 1.41 1.41-1.79 1.8-1.42-1.42zM12 4V1h-0v3h0zm0 19v-3h0v3h0zM4 12H1v0h3v0zm19 0h-3v0h3v0zM6.76 19.16l-1.42 1.42-1.79-1.8 1.41-1.41 1.8 1.79zM19.16 17.24l1.42 1.42-1.8 1.79-1.41-1.41 1.79-1.8zM12 8a4 4 0 100 8 4 4 0 000-8z"/>
      </svg>
    )
  }
  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"
           className="text-black dark:text-white">
        <path d="M20.742 13.045A8.002 8.002 0 0110.955 3.258 8 8 0 1020.742 13.045z"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"
         className="text-black dark:text-white">
      <path d="M12 2v20a10 10 0 000-20zM4 12a8 8 0 008 8V4a8 8 0 00-8 8z"/>
    </svg>
  )
}



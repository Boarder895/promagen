// src/app/leaderboard/page.tsx
import React from 'react'
import { getLeaderboard, LeaderboardEntry } from '@/lib/apiClient'

export default async function LeaderboardPage(): Promise<JSX.Element> {
  // Fetch the leaderboard data on the server
  const leaderboard: LeaderboardEntry[] = await getLeaderboard()

  return (
    <section>
      <h1>Leaderboard</h1>
      <ul>
        {leaderboard.map((entry) => (
          <li key={entry.id}>
            {entry.name}: {entry.score}
          </li>
        ))}
      </ul>
    </section>
  )
}


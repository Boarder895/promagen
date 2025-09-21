// src/lib/apiClient.ts
import 'server-only'

// Define the data shape of a leaderboard entry
export interface LeaderboardEntry {
  id: string
  name: string
  score: number
}

// Fetch leaderboard data (server-only)
// Using `{ cache: 'no-store' }` to get fresh data on each request.
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) {
    throw new Error('Missing API base URL')
  }
  const res = await fetch(`${baseUrl}/leaderboard`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch leaderboard: ${res.status}`)
  }
  const data: LeaderboardEntry[] = await res.json()
  return data
}

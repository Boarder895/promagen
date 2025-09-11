# Provider Expansion Pattern

1. Add provider to `PROVIDERS` in `src/lib/providers.ts` and `enum Provider` in Prisma.
2. `npx prisma migrate dev -n "add_<provider>" && npx prisma generate`
3. Create `src/adapters/<provider>.ts` (implement `test()` and API calls).
4. Frontend: show in leaderboard / filters as needed.

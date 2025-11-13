// frontend/src/components/Leaderboard.tsx
// Tight, typed stub to satisfy pages/tests; replace with your real table.

import type { FC } from 'react';

export type LeaderboardRow = {
  id: string;
  name: string;
  score: number;
};

type Props = {
  rows?: LeaderboardRow[];
};

const Leaderboard: FC<Props> = ({ rows = [] }) => {
  return (
    <table aria-label="Leaderboard" className="w-full text-sm">
      <thead>
        <tr>
          <th className="text-left">Provider</th>
          <th className="text-right">Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.name}</td>
            <td className="text-right">{r.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default Leaderboard;

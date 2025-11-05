import React from "react";
import { providers, type Provider } from "@/lib/providers";

function Row({ p }: { p: Provider }) {
  return (
    <tr className="border-t">
      <td className="px-3 py-2">{p.name}</td>
      <td className="px-3 py-2">{p.apiEnabled ? "Yes" : "No"}</td>
      <td className="px-3 py-2">{(p.score ?? 0).toFixed(2)}</td>
    </tr>
  );
}

export default function ProvidersIndex() {
  const rows = providers.map((p) => <Row key={p.id} p={p} />);
  return (
    <table className="min-w-[480px] w-full border rounded-xl">
      <thead className="bg-gray-50">
        <tr>
          <th className="text-left px-3 py-2">Provider</th>
          <th className="text-left px-3 py-2">API</th>
          <th className="text-left px-3 py-2">Score</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}














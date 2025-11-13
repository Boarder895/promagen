import React from "react";
import { render, screen } from "@testing-library/react";
import ProvidersTable from "../providers-table";
import type { Provider } from "@/types/provider";

const SAMPLE: Provider[] = [
  { id: "alpha", name: "Alpha", score: 90, trend: "up", tags: ["images"] },
  { id: "beta", name: "Beta", score: 84, trend: "flat", tags: ["code"] },
  { id: "gamma", name: "Gamma", score: 78, trend: "down" },
];

describe("ProvidersTable", () => {
  it("renders up to the limit and shows headings", () => {
    render(<ProvidersTable providers={SAMPLE} limit={2} title="Test Table" />);

    expect(screen.getByRole("heading", { name: "Test Table" })).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    // 1 header row + 2 body rows (limited)
    expect(rows.length).toBe(1 + 2);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "#",
      "Provider",
      "Score",
      "Trend",
      "Tags",
    ]);
  });
});

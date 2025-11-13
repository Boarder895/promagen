// src/components/ui/__tests__/tabs.live.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { Tabs } from "../../ui/tabs";
import InpageTab from "../../ui/inpage-tab";

type T = { id: "overview" | "metrics" | "notes"; label: string; disabled?: boolean };

const ITEMS: T[] = [
  { id: "overview", label: "Overview" },
  { id: "metrics", label: "Metrics" },
  { id: "notes", label: "Notes", disabled: false },
];

describe("Tabs live region & roles", () => {
  it("exposes a labelled tablist and 3 tabs", () => {
    render(
      <>
        <h2 id="live-heading">Live Tabs</h2>
        <Tabs
          labelledById="live-heading"
          items={ITEMS}
          renderTab={(t: T) => (
            <InpageTab id={t.id} label={t.label} disabled={Boolean(t.disabled)} />
          )}
        />
      </>
    );

    expect(screen.getByRole("tablist", { name: "Live Tabs" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("renders a polite live region without visual noise", () => {
    render(
      <>
        <h2 id="live-heading-lite">Live Tabs</h2>
        <Tabs
          labelledById="live-heading-lite"
          items={ITEMS}
          renderTab={(t: T) => <InpageTab id={t.id} label={t.label} />}
          liveRegionTestId="tabs-live-region"
        />
      </>
    );
    // Region exists and is present for assistive tech (screen readers), but visually hidden
    const region = screen.getByTestId("tabs-live-region");
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-live", "polite");
  });
});

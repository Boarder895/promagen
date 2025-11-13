import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Tabs from "@/components/ui/tabs";

/**
 * Contract:
 * - ArrowRight / ArrowLeft move focus between tabs in DOM order
 * - Home jumps to first; End jumps to last
 * - Focused tab becomes selected (aria-selected="true")
 * - Test is resilient to the current DOM (no reliance on an accessible name
 *   for the tablist while the component doesn’t expose one).
 */

describe("Tabs keyboard navigation", () => {
  // Strongly typed items without importing TabItem from the component
  const items = [
    { id: "overview", label: "Overview", panel: <div>O</div> },
    { id: "metrics", label: "Metrics", panel: <div>M</div> },
    { id: "alerts", label: "Alerts", panel: <div>A</div> },
  ] as const satisfies ReadonlyArray<{
    id: string;
    label: string;
    panel: React.ReactNode;
  }>;

  const tick = () => new Promise((r) => setTimeout(r, 0));

  test("moves focus with Arrow keys and supports Home/End", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <h2 id="t-heading">Test Tabs</h2>
        <Tabs
          items={items}
          labelledById="t-heading"
          listTestId="tablist"
          tabTestIdPrefix="tab-"
          panelTestIdPrefix="panel-"
        />
      </div>
    );

    // Ensure the tablist is present (your component doesn’t expose a name yet)
    await screen.findByRole("tablist");
    expect(screen.getByTestId("tablist")).toBeInTheDocument();

    // Collect tab buttons, assert length, then cast to a precise 3-tuple
    const nodeList = screen.getAllByRole("tab");
    expect(nodeList).toHaveLength(3);
    const tabs = nodeList as [
      HTMLButtonElement,
      HTMLButtonElement,
      HTMLButtonElement
    ];

    // Focus starts on first; confirm selected
    tabs[0].focus();
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");

    // → moves to Metrics
    await user.keyboard("{ArrowRight}");
    await tick();
    await waitFor(() => {
      expect(document.activeElement).toBe(tabs[1]);
      expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    });

    // ← back to Overview
    await user.keyboard("{ArrowLeft}");
    await tick();
    await waitFor(() => {
      expect(document.activeElement).toBe(tabs[0]);
      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    });

    // End → Alerts
    await user.keyboard("{End}");
    await tick();
    await waitFor(() => {
      expect(document.activeElement).toBe(tabs[2]);
      expect(tabs[2].getAttribute("aria-selected")).toBe("true");
    });

    // Home → Overview
    await user.keyboard("{Home}");
    await tick();
    await waitFor(() => {
      expect(document.activeElement).toBe(tabs[0]);
      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    });
  });
});

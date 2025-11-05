import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Tabs from "../../ui/tabs";
import InpageTab from "../../ui/inpage-tab";
import TabPanel from "../../ui/tab-panel";

// minimal in-page tab items (no nav, no router)
const items = [
  { kind: "inpage", id: "a", label: "Alpha", panelId: "p-a" },
  { kind: "inpage", id: "b", label: "Beta",  panelId: "p-b" },
];

test("sr-only live region updates on change", () => {
  render(
    <Tabs items={items as any} aria-label="Live tabs">
      {items.map(t => (
        <InpageTab key={t.id} id={t.id} panelId={t.panelId} label={t.label} />
      ))}
      {items.map(t => (
        <TabPanel key={t.id} id={t.panelId} aria-labelledby={`tab-${t.id}`}>
          {t.label}
        </TabPanel>
      ))}
    </Tabs>
  );

  const beta = screen.getByRole("tab", { name: /beta/i });
  fireEvent.click(beta);

  // Match your actual announcement text (â€œTab changed: Betaâ€)
  expect(screen.getByText(/tab changed:\s*beta/i)).toBeInTheDocument();
});


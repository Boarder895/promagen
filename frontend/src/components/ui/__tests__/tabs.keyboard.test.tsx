import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import Tabs from "../../ui/tabs";
import InpageTab from "../../ui/inpage-tab";
import TabPanel from "../../ui/tab-panel";

const items = [
  { kind: "inpage", id: "a", label: "Alpha", panelId: "p-a" },
  { kind: "inpage", id: "b", label: "Beta",  panelId: "p-b" },
  { kind: "inpage", id: "c", label: "Gamma", panelId: "p-c" },
];

function mount() {
  render(
    <Tabs items={items as any} aria-label="keyboard tabs">
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
}

test("arrow keys move focus and aria-selected", async () => {
  mount();
  const user = userEvent.setup();

  // Start on Alpha
  screen.getByRole("tab", { name: /alpha/i }).focus();
  expect(screen.getByRole("tab", { name: /alpha/i })).toHaveFocus();

  // Right -> Beta
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: /beta/i })).toHaveFocus();

  // Right -> Gamma
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: /gamma/i })).toHaveFocus();

  // Left -> Beta
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("tab", { name: /beta/i })).toHaveFocus();

  // Space selects Beta
  await user.keyboard("{Space}");
  expect(screen.getByRole("tab", { name: /beta/i })).toHaveAttribute("aria-selected", "true");
});

test("home/end jump to first/last tab", async () => {
  mount();
  const user = userEvent.setup();

  // Focus first tab
  screen.getByRole("tab", { name: /alpha/i }).focus();

  // End -> Gamma
  await user.keyboard("{End}");
  expect(screen.getByRole("tab", { name: /gamma/i })).toHaveFocus();

  // Home -> Alpha
  await user.keyboard("{Home}");
  expect(screen.getByRole("tab", { name: /alpha/i })).toHaveFocus();
});


import { render, screen, within } from "@testing-library/react";
import ProvidersTabList from "../../nav/tab-list";

jest.mock("next/navigation", () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  };
  return {
    __esModule: true,
    // order check doesnâ€™t depend on the exact route; index is fine
    usePathname: jest.fn(() => "/providers"),
    useRouter: jest.fn(() => router),
  };
});

test("tab order follows json", () => {
  render(<ProvidersTabList />);

  const nav = screen.getByRole("tablist", { name: /providers/i });
  const labels = within(nav)
    .getAllByRole("link")
    .map((el: HTMLElement) => el.textContent?.trim() ?? "");

  const idx = (name: string) => labels.findIndex(t => (t ?? "").startsWith(name));

  expect(idx("Leaderboard")).toBeLessThan(idx("Trends"));
  expect(idx("Trends")).toBeLessThan(idx("Compare"));
});


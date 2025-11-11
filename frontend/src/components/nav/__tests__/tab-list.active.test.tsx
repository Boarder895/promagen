import { render, screen } from "@testing-library/react";
import ProvidersTabList from "../../nav/tab-list";

// Mock next/navigation exports used by the component tree (usePathname + useRouter)
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
    usePathname: jest.fn(() => "/providers/trends"),
    useRouter: jest.fn(() => router),
  };
});

test("active tab reflects current route", () => {
  render(<ProvidersTabList />);
  const active = screen.getByRole("link", { name: /trends/i });
  expect(active).toHaveAttribute("aria-current", "page");
});


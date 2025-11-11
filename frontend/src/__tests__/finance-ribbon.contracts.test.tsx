import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import FinanceRibbon from "@/components/ribbon/finance-ribbon";

/**
 * Matches the current FinanceRibbon API:
 *   - pairIds?: string[]
 *   - intervalMs?: number
 *   - demo?: boolean
 */
describe("FinanceRibbon (pairIds API)", () => {
  it("shows the default three pairs when no pairIds are provided", () => {
    render(<FinanceRibbon demo />);
    expect(screen.getByTestId("fx-EURUSD")).toBeInTheDocument();
    expect(screen.getByTestId("fx-GBPUSD")).toBeInTheDocument();
    expect(screen.getByTestId("fx-EURGBP")).toBeInTheDocument();
  });

  it("renders exactly the ids passed via pairIds", () => {
    render(<FinanceRibbon demo pairIds={["EURUSD", "USDJPY"]} />);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(2);
    expect(screen.getByTestId("fx-EURUSD")).toBeInTheDocument();
    expect(screen.getByTestId("fx-USDJPY")).toBeInTheDocument();
  });

  it("accepts intervalMs as an optional prop", () => {
    render(<FinanceRibbon demo pairIds={["EURUSD"]} intervalMs={0} />);
    expect(screen.getByTestId("fx-EURUSD")).toBeInTheDocument();
  });
});

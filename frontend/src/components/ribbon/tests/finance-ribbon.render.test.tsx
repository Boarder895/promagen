import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
// FinanceRibbon is a default export
import FinanceRibbon from "../finance-ribbon";

describe("FinanceRibbon render (smoke)", () => {
  it("renders with provided pairIds", () => {
    render(<FinanceRibbon demo pairIds={["EURUSD", "GBPUSD"]} />);
    expect(screen.getByTestId("fx-EURUSD")).toBeInTheDocument();
    expect(screen.getByTestId("fx-GBPUSD")).toBeInTheDocument();
  });
});

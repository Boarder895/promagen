import React from "react";
import { render, screen } from "@testing-library/react";

function LiveRegion() {
  return <div role="status" aria-live="polite" data-testid="sr-live" />;
}

test("renders a polite live region", () => {
  render(<LiveRegion />);
  expect(screen.getByTestId("sr-live")).toBeInTheDocument();
});

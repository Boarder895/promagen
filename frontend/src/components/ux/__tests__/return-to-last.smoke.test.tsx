import { render, screen } from "@testing-library/react";
import ReturnToLast from "@/components/ux/return-to-last";

describe("ReturnToLast", () => {
  it("renders nothing when no key present", () => {
    const { container } = render(<ReturnToLast />);
    expect(container.querySelector("[data-testid='return-to-last']")).toBeNull();
  });

  it("renders link when last provider present (migrates legacy)", () => {
    localStorage.setItem("last_provider", "ideogram");
    render(<ReturnToLast />);
    const pill = screen.getByTestId("return-to-last");
    expect(pill).toBeInTheDocument();
    // cleanup
    localStorage.removeItem("last_provider");
  });
});

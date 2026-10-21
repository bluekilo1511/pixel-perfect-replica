import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OriginScreen } from "@/components/tracker/OriginOverlay";

afterEach(cleanup);

describe("The Origin (Lizard's Core) easter egg", () => {
  it("shows the real streak, the tribute to Lizard and a return button", () => {
    render(<OriginScreen streak={42} onClose={() => {}} />);
    expect(screen.getByTestId("origin-streak")).toHaveTextContent("42");
    expect(screen.getByText(/khởi đầu bởi Lizard/)).toBeInTheDocument();
    expect(screen.getByText(/một tính năng Streak duy nhất/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Quay lại hiện tại/ })).toBeInTheDocument();
  });

  it("the manual day tick is simulated only and never changes the real streak", () => {
    const onClose = vi.fn();
    render(<OriginScreen streak={7} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /tích ngày/ }));
    // The big number still shows the real AppData streak.
    expect(screen.getByTestId("origin-streak")).toHaveTextContent("7");
    expect(screen.getByRole("button", { name: /\(\+1\)/ })).toBeInTheDocument();
  });

  it("Escape closes the overlay", () => {
    const onClose = vi.fn();
    render(<OriginScreen streak={3} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

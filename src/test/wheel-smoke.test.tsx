import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Wheel } from "@/components/tracker/Wheel";
import { PetShop } from "@/components/tracker/PetShop";
import { TrackerProvider } from "@/lib/tracker/store";

afterEach(cleanup);

describe("Wheel smoke", () => {
  it("PetShop + Wheel render together with no crash", () => {
    render(
      <TrackerProvider>
        <PetShop />
        <Wheel />
      </TrackerProvider>,
    );
    expect(screen.getByText(/Vòng quay may mắn/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Quay ngay/ })).toBeInTheDocument();
  });
});

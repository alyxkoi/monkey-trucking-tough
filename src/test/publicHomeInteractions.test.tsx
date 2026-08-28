// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vitest";
import PopularMaterialsSection from "@/components/public/PopularMaterialsSection";
import RecentWorkSection from "@/components/public/RecentWorkSection";
import ServiceFeatureGrid from "@/components/public/ServiceFeatureGrid";

describe("public Home interactions", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; },
      }),
    });
  });

  it("opens one service detail, closes with Escape, and restores trigger focus", async () => {
    render(<MemoryRouter><ServiceFeatureGrid /></MemoryRouter>);
    const trigger = screen.getByRole("button", { name: /Materials & Delivery/i });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: /Materials & Delivery/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Close service details" })).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps only one Recent Work row open at a time", () => {
    render(<MemoryRouter><RecentWorkSection /></MemoryRouter>);
    const driveway = screen.getByRole("button", { name: /New Gravel Driveway/i });
    const pond = screen.getByRole("button", { name: /Stock Pond Excavation/i });

    fireEvent.click(driveway);
    expect(driveway).toHaveAttribute("aria-expanded", "true");
    expect(pond).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(pond);
    expect(driveway).toHaveAttribute("aria-expanded", "false");
    expect(pond).toHaveAttribute("aria-expanded", "true");
  });

  it("provides a touch control for material outcome images", () => {
    render(<MemoryRouter><PopularMaterialsSection /></MemoryRouter>);
    const outcome = screen.getAllByRole("button", { name: "See in use" })[0];
    expect(outcome).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(outcome);
    expect(screen.getByRole("button", { name: "View material" })).toHaveAttribute("aria-pressed", "true");
  });
});

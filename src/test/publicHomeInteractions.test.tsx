// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vitest";
import PopularMaterialsSection from "@/components/public/PopularMaterialsSection";
import RecentWorkSection from "@/components/public/RecentWorkSection";
import ServiceFeatureGrid from "@/components/public/ServiceFeatureGrid";
import HomeHero from "@/components/public/HomeHero";

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

  it("keeps a single paused Hero video under reduced motion", () => {
    const { container } = render(<MemoryRouter><HomeHero /></MemoryRouter>);
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).not.toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("src", "https://dugmcjpistrxxryaubkd.supabase.co/storage/v1/object/public/videos//job home hero.mp4");
    expect(container.querySelectorAll("video source")).toHaveLength(0);
    expect(container.querySelector(".public-home-hero-media img")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Call 214-677-8466/i })).toHaveAttribute("href", "tel:+12146778466");
    expect(screen.getByRole("link", { name: /Get a Quote/i })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("list", { name: "Monkey Trucking proof points" })).toBeInTheDocument();
    expect(screen.getByText("Kaufman")).toBeInTheDocument();
    expect(screen.getByText("Local Service")).toBeInTheDocument();
    expect(screen.getByText("Materials")).toBeInTheDocument();
    expect(screen.getByText("+ Delivery")).toBeInTheDocument();
    expect(screen.getByText("Upfront")).toBeInTheDocument();
    expect(screen.getByText("Quotes")).toBeInTheDocument();
    expect(screen.queryByText(/Years in Service|Jobs Done|5 Stars/i)).not.toBeInTheDocument();
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

  it("keeps one service detail open and closes it from the backdrop", async () => {
    render(<MemoryRouter><ServiceFeatureGrid /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Driveways & Roads/i }));

    const dialog = screen.getByRole("dialog", { name: /Driveways & Roads/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Service/i })).toHaveAttribute("href", "/services");
    expect(screen.getByRole("link", { name: /Get a Quote/i })).toHaveAttribute("href", "/contact");

    fireEvent.click(screen.getByRole("button", { name: "Close service details backdrop" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
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

    fireEvent.click(pond);
    expect(pond).toHaveAttribute("aria-expanded", "false");
  });

  it("provides a touch control for material outcome images", () => {
    const { container } = render(<MemoryRouter><PopularMaterialsSection /></MemoryRouter>);
    expect(container.querySelectorAll(".popular-material-card")).toHaveLength(6);
    expect(screen.getAllByRole("button", { name: "See in use" })).toHaveLength(3);
    expect(screen.getByRole("link", { name: /View All Materials/i })).toHaveAttribute("href", "/materials");
    expect(container.querySelector("canvas")).not.toBeInTheDocument();

    const outcome = screen.getAllByRole("button", { name: "See in use" })[0];
    expect(outcome).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(outcome);
    const material = screen.getByRole("button", { name: "View material" });
    expect(material).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(material);
    expect(screen.getAllByRole("button", { name: "See in use" })[0]).toHaveAttribute("aria-pressed", "false");
  });
});

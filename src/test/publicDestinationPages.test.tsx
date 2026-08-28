// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Materials from "@/pages/Materials";
import Projects from "@/pages/Projects";
import Services from "@/pages/Services";

const renderPage = (page: React.ReactNode) => render(
  <HelmetProvider>
    <MemoryRouter>{page}</MemoryRouter>
  </HelmetProvider>,
);

describe("public destination pages", () => {
  it("shows every project without filters and preserves the project preview", () => {
    const { container } = renderPage(<Projects />);

    expect(container.querySelectorAll(".public-project-card")).toHaveLength(9);
    expect(screen.queryByRole("group", { name: /Filter projects/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View New Gravel Driveway" }));
    expect(screen.getByRole("button", { name: "Close project preview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close project preview" }));
    expect(screen.queryByRole("button", { name: "Close project preview" })).not.toBeInTheDocument();
  });

  it("keeps ten approved material cards with direct pricing calls", () => {
    const { container } = renderPage(<Materials />);
    const cards = container.querySelectorAll(".public-material-catalog-card");

    expect(cards).toHaveLength(10);
    for (const card of cards) {
      expect(card.querySelector('a[href="tel:+12146778466"]')).toHaveTextContent("Call for current pricing");
    }
    expect(container.textContent).not.toMatch(/\$\d/);
  });

  it("uses exactly four service groups and keeps clearing inside Dirt Work", () => {
    const { container } = renderPage(<Services />);

    expect(container.querySelectorAll(".public-service-card")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Dirt Work" })).toBeInTheDocument();
    expect(screen.getByText("Brush")).toBeInTheDocument();
    expect(screen.getByText("Small trees")).toBeInTheDocument();
    expect(screen.getByText("Rocks and boulders")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Light Land Clearing" })).not.toBeInTheDocument();
  });
});

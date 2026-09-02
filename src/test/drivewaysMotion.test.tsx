import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DrivewayHeroHeadline, DrivewayResultsHeadline, DrivewayTrustStats } from "@/components/driveways/DrivewayMotion";
import DrivewayReviewMarquee from "@/components/driveways/DrivewayReviewMarquee";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useInView: () => true,
    useReducedMotion: () => true,
  };
});

describe("driveway motion presentation", () => {
  it("renders complete typed headings immediately for reduced-motion users", () => {
    render(
      <>
        <DrivewayHeroHeadline />
        <DrivewayResultsHeadline />
      </>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Fix it before the next storm." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Real driveway work." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Fix it beforethe next storm.");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Real driveway work.");
    expect(document.querySelector(".driveway-type-cursor")).not.toBeInTheDocument();
  });

  it("renders two separators and five ordered rating stars in the compact rail", () => {
    const { container } = render(<DrivewayTrustStats />);

    expect(container.querySelectorAll(".driveway-form-trust-separator")).toHaveLength(2);
    expect(screen.getByLabelText("150 plus")).toHaveTextContent("150+");
    expect(screen.getByLabelText("12 plus")).toHaveTextContent("12+");
    expect(screen.getByLabelText("5 stars").querySelectorAll("svg")).toHaveLength(5);
  });

  it("renders six clearly labeled sample review drafts in the accessible marquee set", () => {
    const { container } = render(<DrivewayReviewMarquee />);

    expect(screen.getByRole("heading", { name: "Trusted by our customers." })).toBeInTheDocument();
    expect(container.querySelectorAll(".driveway-review-card")).toHaveLength(12);
    const accessibleSet = container.querySelector('.driveway-review-marquee-set:not([aria-hidden="true"])')!;
    expect(accessibleSet.querySelectorAll(".driveway-review-card")).toHaveLength(6);
    expect(accessibleSet).toHaveTextContent("Maria G.");
    expect(accessibleSet).toHaveTextContent("Thomas B.");
    expect(accessibleSet.querySelectorAll(".driveway-review-person span")).toHaveLength(6);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});

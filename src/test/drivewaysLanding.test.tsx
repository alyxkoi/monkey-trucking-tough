import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuoteRequestForm from "@/components/public/QuoteRequestForm";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

describe("driveway campaign quote form", () => {
  beforeEach(() => {
    invoke.mockReset();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/driveways?utm_source=facebook&utm_medium=paid_social&utm_campaign=fall-driveways");
  });

  it("uses the existing two-step form with driveway work preselected", () => {
    render(
      <MemoryRouter>
        <QuoteRequestForm idPrefix="driveway" defaultProjectType="gravel-driveway" submissionOrigin="driveway_landing" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Step 1 of 2")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex Rivera" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "214-555-0100" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /continue to project details/i }));

    expect(screen.getByText("Step 2 of 2")).toBeVisible();
    expect(screen.getByRole("combobox", { name: /what do you need/i })).toHaveTextContent("Driveway or Private Road");
  });

  it("sends driveway and UTM context through the existing contact function", async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    render(
      <MemoryRouter>
        <QuoteRequestForm idPrefix="driveway" defaultProjectType="gravel-driveway" submissionOrigin="driveway_landing" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex Rivera" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "214-555-0100" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /continue to project details/i }));
    fireEvent.change(screen.getByLabelText(/service or delivery location/i), { target: { value: "Kaufman, TX" } });
    fireEvent.click(screen.getByRole("button", { name: /send quote request/i }));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith("send-contact-email", {
      body: expect.objectContaining({
        name: "Alex Rivera",
        phone: "214-555-0100",
        email: "alex@example.com",
        location: "Kaufman, TX",
        projectType: "gravel-driveway",
        submissionContext: {
          origin: "driveway_landing",
          path: "/driveways",
          utmSource: "facebook",
          utmMedium: "paid_social",
          utmCampaign: "fall-driveways",
        },
      }),
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Request received");
  });
});

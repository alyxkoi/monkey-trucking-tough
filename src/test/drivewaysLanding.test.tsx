import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DrivewayQuoteForm from "@/components/driveways/DrivewayQuoteForm";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

describe("driveway campaign quote form", () => {
  beforeEach(() => {
    invoke.mockReset();
    window.localStorage.clear();
  });

  it("shows clear errors for all three required lead fields", () => {
    render(<MemoryRouter><DrivewayQuoteForm /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /get a free quote/i }));
    expect(screen.getByText("Enter your name.")).toBeVisible();
    expect(screen.getByText("Enter a 10-digit phone number.")).toBeVisible();
    expect(screen.getByText("Enter your city or ZIP.")).toBeVisible();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sends a phone-first lead through the existing contact function", async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    render(<MemoryRouter><DrivewayQuoteForm /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex Rivera" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "214-555-0100" } });
    fireEvent.change(screen.getByLabelText("City or ZIP"), { target: { value: "Kaufman, TX" } });
    fireEvent.click(screen.getByRole("button", { name: /get a free quote/i }));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith("send-contact-email", {
      body: expect.objectContaining({
        name: "Alex Rivera",
        phone: "214-555-0100",
        email: "",
        location: "Kaufman, TX",
        projectType: "gravel-driveway",
        smsConsent: false,
      }),
    });
    expect(await screen.findByRole("status")).toHaveTextContent("We have your driveway details.");
  });
});

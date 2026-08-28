// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Contact from "@/pages/Contact";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

vi.mock("@/components/ui/sonner", () => ({ toast: vi.fn() }));

describe("public quote form", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    window.localStorage.clear();
  });

  it("submits service location and leaves SMS consent off unless checked", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <Contact />
        </MemoryRouter>
      </HelmetProvider>,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alicia Ortiz" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "214-555-0182" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alicia@example.com" } });
    fireEvent.change(screen.getByLabelText("Service or delivery location"), { target: { value: "Kaufman, TX" } });
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "Need driveway material" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Quote Request" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith("send-contact-email", {
      body: expect.objectContaining({
        name: "Alicia Ortiz",
        phone: "214-555-0182",
        email: "alicia@example.com",
        location: "Kaufman, TX",
        message: "Need driveway material",
        smsConsent: false,
        smsDisclosureVersion: "website-contact-v1-2026-08-27",
        trackingAttribution: null,
      }),
    });
  });
});

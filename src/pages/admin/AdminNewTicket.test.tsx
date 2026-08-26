import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flexbase, pricingSettings } from "@/test/fixtures/ticketFixtures";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("sonner", () => ({ toast: { error: toastError, warning: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "00000000-0000-4000-8000-000000000001" } }),
}));
vi.mock("@/hooks/admin/useAdminMeta", () => ({
  useSettings: () => ({ data: pricingSettings }),
  useMaterials: () => ({ data: [flexbase] }),
  useDrivers: () => ({ data: [] }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: string[] }) => options.queryKey[1] === "past-customers"
    ? { data: [] }
    : { data: undefined },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));
vi.mock("@/components/admin/AdminTopBar", () => ({ default: () => null }));
vi.mock("@/lib/admin/tickets", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/admin/tickets")>();
  return { ...original, saveTicket: vi.fn() };
});

import AdminNewTicket from "@/pages/admin/AdminNewTicket";

describe("new Ticket safety UI", () => {
  beforeEach(() => toastError.mockReset());

  it("starts with no delivery option and refuses a silent free-delivery save", () => {
    render(<AdminNewTicket />);

    expect(screen.getByLabelText("Delivery")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Save ticket" }));
    expect(toastError).toHaveBeenCalledWith("Choose a delivery option.");
  });

  it("prices a material line from its own load count", () => {
    render(<AdminNewTicket />);

    fireEvent.change(screen.getByLabelText(/^Material$/), { target: { value: flexbase.id } });
    fireEvent.change(screen.getByLabelText("Loads of Flexbase"), { target: { value: "3" } });

    expect(screen.getAllByText("$2,160.00")).toHaveLength(2);
    expect(screen.getByLabelText("Loads")).toHaveValue("3");
  });
});

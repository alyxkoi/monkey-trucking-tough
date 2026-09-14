import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

const requestPasswordReset = vi.hoisted(() => vi.fn());
const updatePassword = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  isPasswordRecovery: false,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ requestPasswordReset, updatePassword, signOut, ...authState }),
}));

const renderPage = (page: React.ReactNode, route = "/") => render(
  <HelmetProvider>
    <MemoryRouter initialEntries={[route]}>{page}</MemoryRouter>
  </HelmetProvider>,
);

afterEach(() => {
  requestPasswordReset.mockReset();
  updatePassword.mockReset();
  signOut.mockReset();
  authState.user = null;
  authState.loading = false;
  authState.isPasswordRecovery = false;
  window.history.replaceState({}, "", "/");
});

describe("password recovery", () => {
  it("requests a reset using the production-safe route and shows a non-enumerating confirmation", async () => {
    requestPasswordReset.mockResolvedValue({ error: null });
    renderPage(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "  owner@example.com  " } });
    fireEvent.click(screen.getByRole("button", { name: "SEND RESET LINK" }));

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith(
      "owner@example.com",
      `${window.location.origin}/reset-password`,
    ));
    expect(screen.getByRole("status")).toHaveTextContent("If an account exists for owner@example.com");
  });

  it("keeps the request form usable when the provider rejects the send", async () => {
    requestPasswordReset.mockResolvedValue({ error: "rate limited" });
    renderPage(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "SEND RESET LINK" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't send the reset email");
    expect(screen.getByRole("button", { name: "SEND RESET LINK" })).toBeEnabled();
  });

  it("rejects an expired or directly visited reset page", () => {
    renderPage(<ResetPassword />, "/reset-password");
    expect(screen.getByRole("alert")).toHaveTextContent("This link isn't valid anymore");
    expect(screen.getByRole("link", { name: "REQUEST A NEW LINK" })).toHaveAttribute("href", "/forgot-password");
  });

  it("validates matching passwords before calling Supabase", async () => {
    authState.user = { id: "user-1" };
    authState.isPasswordRecovery = true;
    renderPage(<ResetPassword />, "/reset-password");

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "new-password-2" } });
    fireEvent.click(screen.getByRole("button", { name: "UPDATE PASSWORD" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("passwords don't match");
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("updates the password, signs out the recovery session, and confirms success", async () => {
    authState.user = { id: "user-1" };
    authState.isPasswordRecovery = true;
    updatePassword.mockResolvedValue({ error: null });
    signOut.mockResolvedValue(undefined);
    renderPage(<ResetPassword />, "/reset-password");

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "new-password-1" } });
    fireEvent.click(screen.getByRole("button", { name: "UPDATE PASSWORD" }));

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith("new-password-1"));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("Password updated");
    expect(screen.getByRole("link", { name: "SIGN IN" })).toHaveAttribute("href", "/signin");
  });
});

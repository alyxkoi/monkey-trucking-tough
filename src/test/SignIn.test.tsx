import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignIn from "@/pages/SignIn";

const signIn = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ signIn, user: authState.user }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const renderSignIn = () => render(
  <HelmetProvider>
    <SignIn />
  </HelmetProvider>,
);

afterEach(() => {
  signIn.mockReset();
  navigate.mockReset();
  authState.user = null;
});

describe("standalone sign-in page", () => {
  it("preserves the existing credentials and redirect contract", async () => {
    signIn.mockResolvedValue({ error: null });
    renderSignIn();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "  salvador@example.com  " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secure-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "SIGN IN" }).closest("form")!);

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("salvador@example.com", "secure-password"));
    expect(navigate).toHaveBeenCalledWith("/admin", { replace: true });
  });

  it("shows a clear inline error and keeps the user on the page", async () => {
    signIn.mockResolvedValue({ error: new Error("Invalid credentials") });
    renderSignIn();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "wrong@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "SIGN IN" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign in failed. Check your email and password.");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("disables the submit action while authentication is pending", async () => {
    signIn.mockReturnValue(new Promise(() => {}));
    renderSignIn();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "salvador@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secure-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "SIGN IN" }).closest("form")!);

    expect(await screen.findByRole("button", { name: "SIGNING IN…" })).toBeDisabled();
  });

  it("reveals and hides the password without changing its value", () => {
    renderSignIn();
    const password = screen.getByLabelText("Password");

    fireEvent.change(password, { target: { value: "still-secret" } });
    expect(password).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("still-secret");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("redirects an existing authenticated session to the control center", async () => {
    authState.user = { id: "authenticated-user" };
    renderSignIn();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/admin", { replace: true }));
  });

  it("keeps the back action routed to the homepage", () => {
    renderSignIn();
    fireEvent.click(screen.getByRole("button", { name: "Back to homepage" }));
    expect(navigate).toHaveBeenCalledWith("/");
  });
});

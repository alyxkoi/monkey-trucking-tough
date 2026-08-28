import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginModal from "@/components/auth/LoginModal";

const signIn = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ signIn }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

afterEach(() => {
  signIn.mockReset();
  navigate.mockReset();
});

describe("public LoginModal", () => {
  it("preserves the existing sign-in contract and closes on success", async () => {
    signIn.mockResolvedValue({ error: null });
    const onOpenChange = vi.fn();
    render(<LoginModal open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "  salvador@example.com  " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secure-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "SIGN IN" }).closest("form")!);

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("salvador@example.com", "secure-password"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigate).toHaveBeenCalledWith("/admin");
  });

  it("keeps authentication errors visible inside the modal", async () => {
    signIn.mockResolvedValue({ error: new Error("Invalid credentials") });
    render(<LoginModal open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "wrong@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "SIGN IN" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign in failed. Check your email and password.");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("retains accessible close and Escape behavior", async () => {
    const onOpenChange = vi.fn();
    render(<LoginModal open onOpenChange={onOpenChange} />);

    expect(screen.getByRole("button", { name: "Close sign in" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

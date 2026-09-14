import { act, render, screen, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const authMocks = vi.hoisted(() => {
  let listener: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
  return {
    getSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    setListener(next: (event: AuthChangeEvent, session: Session | null) => void) {
      listener = next;
    },
    emit(event: AuthChangeEvent, session: Session | null) {
      listener?.(event, session);
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      resetPasswordForEmail: authMocks.resetPasswordForEmail,
      updateUser: authMocks.updateUser,
      signOut: authMocks.signOut,
      onAuthStateChange: (listener: (event: AuthChangeEvent, session: Session | null) => void) => {
        authMocks.setListener(listener);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
}));

let currentAuth: ReturnType<typeof useAuth> | null = null;

const Probe = () => {
  currentAuth = useAuth();
  return (
    <div>
      <span>{currentAuth.loading ? "loading" : "ready"}</span>
      <span>{currentAuth.isPasswordRecovery ? "recovery" : "standard"}</span>
    </div>
  );
};

afterEach(() => {
  currentAuth = null;
  authMocks.getSession.mockReset();
  authMocks.resetPasswordForEmail.mockReset();
  authMocks.updateUser.mockReset();
  authMocks.signOut.mockReset();
  window.history.replaceState({}, "", "/");
});

describe("AuthProvider password recovery wiring", () => {
  it("calls the Supabase recovery and password update APIs", async () => {
    window.history.replaceState({}, "", "/forgot-password");
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    authMocks.updateUser.mockResolvedValue({ error: null });

    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("ready");

    let resetResult: { error: string | null } | undefined;
    let updateResult: { error: string | null } | undefined;
    await act(async () => {
      resetResult = await currentAuth?.requestPasswordReset("owner@example.com", "https://www.monkeytrucking.llc/reset-password");
      updateResult = await currentAuth?.updatePassword("new-password-1");
    });

    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith("owner@example.com", {
      redirectTo: "https://www.monkeytrucking.llc/reset-password",
    });
    expect(authMocks.updateUser).toHaveBeenCalledWith({ password: "new-password-1" });
    expect(resetResult).toEqual({ error: null });
    expect(updateResult).toEqual({ error: null });
  });

  it("preserves the PASSWORD_RECOVERY event for the reset screen", async () => {
    window.history.replaceState({}, "", "/reset-password?code=secure-code");
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("ready");

    const recoverySession = {
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: { id: "user-1" },
    } as unknown as Session;

    act(() => authMocks.emit("PASSWORD_RECOVERY", recoverySession));

    await waitFor(() => expect(screen.getByText("recovery")).toBeInTheDocument());
    expect(currentAuth?.user?.id).toBe("user-1");
  });
});

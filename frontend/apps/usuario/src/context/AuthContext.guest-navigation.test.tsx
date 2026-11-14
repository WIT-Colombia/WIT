import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { ApiError } from "../services/httpClient";

const auth = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock("../services/authService", () => ({
  refreshSession: auth.refreshSession,
  getMe: auth.getMe,
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  restoreSession: vi.fn(),
}));

function AuthStatus() {
  const { status, isAuthenticated } = useAuth();
  return <output data-testid="auth-state">{status} / {String(isAuthenticated)}</output>;
}

const authenticatedUser = {
  id: "test-user-id",
  publicId: "test-public-id",
  displayName: "Test",
  nickname: null,
  emailNormalized: "test@example.com",
  avatarUrl: null,
  locale: "es-CO",
  status: "ACTIVE" as const,
  emailVerified: true,
  authProviders: ["EMAIL" as const],
};

beforeEach(() => {
  vi.useFakeTimers();
  auth.refreshSession.mockReset();
  auth.getMe.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Navegación de invitados mientras se verifica la sesión", () => {
  it("permite navegar como invitado cuando refresh devuelve 401", async () => {
    auth.refreshSession.mockRejectedValue(new ApiError(401, "INVALID_REFRESH_TOKEN", "Sin sesión"));
    render(<AuthProvider><AuthStatus /></AuthProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("auth-state")).toHaveTextContent("anonymous / false");
  });

  it("no queda bloqueado indefinidamente si la solicitud nunca responde", async () => {
    auth.refreshSession.mockImplementation(() => new Promise(() => {}));
    render(<AuthProvider><AuthStatus /></AuthProvider>);
    expect(screen.getByTestId("auth-state")).toHaveTextContent("loading / false");
    await act(async () => { await vi.advanceTimersByTimeAsync(4001); });
    expect(screen.getByTestId("auth-state")).toHaveTextContent("anonymous / false");
  });

  it("habilita modo invitado ante un error de red y restablece la sesión después", async () => {
    auth.refreshSession.mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(authenticatedUser);
    render(<AuthProvider><AuthStatus /></AuthProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("auth-state")).toHaveTextContent("anonymous / false");
    await act(async () => { await vi.advanceTimersByTimeAsync(10001); });
    expect(screen.getByTestId("auth-state")).toHaveTextContent("authenticated / true");
  });
});

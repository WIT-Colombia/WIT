import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestJson, requestPhotoBlob } from "./businessApiClient";
import { clearAccessToken, getAvatarBlob, uploadAvatar, register, isVerifiedFirstRegistrationAvailable } from "./businessAuthService";

vi.mock("./businessApiClient", () => ({
  buildApiUrl: (path: string) => `https://api.xamuko.com/api/v1${path.startsWith("/api/v1/") ? path.slice("/api/v1".length) : path}`,
  configureAccessTokenProvider: vi.fn(),
  configureUnauthorizedHandler: vi.fn(),
  requestJson: vi.fn(),
  requestPhotoBlob: vi.fn(),
  BusinessApiError: class BusinessApiError extends Error {
    constructor(public readonly status: number, public readonly code: string, message: string) {
      super(message);
    }
  },
}));

const photo = () => new File(["foto"], "perfil.png", { type: "image/png" });

describe("Business: foto personal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAccessToken();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sube al API con sesión incluida", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadAvatar(photo());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.xamuko.com/api/v1/auth/me/avatar");
    expect(options.credentials).toBe("include");
    expect(options.body).toBeInstanceOf(FormData);
  });

  it("recupera el token y reintenta una sola vez al recibir 401", async () => {
    vi.mocked(requestJson).mockResolvedValue({ accessToken: "token-renovado", user: {} });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadAvatar(photo());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestJson).toHaveBeenCalledWith("/auth/refresh", { method: "POST", body: "{}" });
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toEqual({ Authorization: "Bearer token-renovado" });
  });

  it("propaga el mensaje cuando el backend rechaza la foto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "AVATAR_INVALID", message: "Formato de foto no permitido." } }),
      { status: 422, headers: { "content-type": "application/json" } },
    )));
    await expect(uploadAvatar(photo())).rejects.toThrow("Formato de foto no permitido.");
  });

  it("carga el avatar con el cliente que ya recupera sesiones", async () => {
    const blob = new Blob(["foto"], { type: "image/png" });
    vi.mocked(requestPhotoBlob).mockResolvedValue(blob);
    await expect(getAvatarBlob("/api/v1/auth/me/avatar?v=123")).resolves.toBe(blob);
    expect(requestPhotoBlob).toHaveBeenCalledWith("/api/v1/auth/me/avatar?v=123");
  });
});

describe("Business: registro condicionado a verificar el correo", () => {
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it("no crea cuentas en un backend antiguo que no admita registro pendiente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(register("Propietario", "nuevo@example.test", "claveSegura123")).rejects.toMatchObject({
      status: 503, code: "REGISTRATION_UPGRADE_PENDING",
    });
    expect(requestJson).not.toHaveBeenCalledWith("/auth/register", expect.anything());
  });

  it("devuelve la solicitud pendiente sin crear sesión ni usuario", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(
      JSON.stringify({ emailVerificationRequiredBeforeCreation: true }),
      { status: 200, headers: { "content-type": "application/json" } },
    )));
    expect(await isVerifiedFirstRegistrationAvailable()).toBe(true);
    const pending = {
      email: "nuevo@example.test",
      verificationExpiresAt: "2026-11-09T12:15:00.000Z",
      verificationEmailSent: true,
    };
    vi.mocked(requestJson).mockResolvedValueOnce({ pending });
    expect(await register("Propietario", "nuevo@example.test", "claveSegura123")).toEqual(pending);
    expect(requestJson).toHaveBeenCalledWith("/auth/register", expect.objectContaining({ method: "POST" }));
  });
});

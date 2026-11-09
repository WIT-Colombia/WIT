import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "./httpClient";
import { clearAccessToken, uploadAvatar } from "./authService";
import { normalizeImageForUpload } from "@wit/utils";

vi.mock("@wit/utils", () => ({
  buildApiUrl: (path: string) => `https://api.xamuko.com${path}`,
  // Transport tests mock normalization; imageUpload.test.ts tests real conversion.
  normalizeImageForUpload: vi.fn(async (file: File) => file),
}));
vi.mock("./httpClient", () => ({
  configureSession: vi.fn(),
  requestJson: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public readonly status: number, public readonly code: string, message: string) {
      super(message);
    }
  },
}));

const photo = () => new File(["foto"], "perfil.jpg", { type: "image/jpeg" });

describe("Usuario: subir foto personal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAccessToken();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("envía la imagen al API real, no al dominio del frontend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadAvatar(photo());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.xamuko.com/api/v1/auth/me/avatar");
    expect(options.credentials).toBe("include");
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("permite cambiar de fotografía varias veces en la misma sesión", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = new File(["primera"], "primera.jpg", { type: "image/jpeg" });
    const second = new File(["segunda"], "segunda.png", { type: "image/png" });

    await uploadAvatar(first);
    await uploadAvatar(second);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeInstanceOf(FormData);
    expect(((fetchMock.mock.calls[0][1] as RequestInit).body as FormData).get("file")).toBe(first);
    expect(((fetchMock.mock.calls[1][1] as RequestInit).body as FormData).get("file")).toBe(second);
  });

  it("renueva la sesión y reintenta una sola vez si recibe 401", async () => {
    vi.mocked(requestJson).mockResolvedValue({ accessToken: "nuevo-token", user: {} });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadAvatar(photo());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestJson).toHaveBeenCalledWith("/api/v1/auth/refresh", { method: "POST", body: "{}" });
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toEqual({ Authorization: "Bearer nuevo-token" });
  });

  it("muestra el error devuelto por el API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "PHOTO_STORAGE_UNAVAILABLE", message: "No se pudo guardar la fotografía." } }),
      { status: 503, headers: { "content-type": "application/json" } },
    )));
    await expect(uploadAvatar(photo())).rejects.toThrow("No se pudo guardar la fotografía.");
  });

  it("envía como JPEG la foto HEIC convertida por el procesador compartido", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const original = new File(["foto"], "foto.heic", { type: "image/heic" });
    const converted = new File(["foto"], "foto.jpg", { type: "image/jpeg" });
    vi.mocked(normalizeImageForUpload).mockResolvedValueOnce(converted);
    await uploadAvatar(original);
    expect(normalizeImageForUpload).toHaveBeenCalledWith(original);
    expect(((fetchMock.mock.calls[0][1] as RequestInit).body as FormData).get("file")).toBe(converted);
  });

  it("detiene el envío y muestra el error del procesador cuando no puede leer la foto", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(normalizeImageForUpload).mockRejectedValueOnce(new Error("No se pudo convertir la foto HEIC."));
    await expect(uploadAvatar(new File(["foto"], "foto.heic", { type: "image/heic" })))
      .rejects.toThrow("No se pudo convertir la foto HEIC.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

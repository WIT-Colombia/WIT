import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./httpClient";
import { listPublicCategories } from "./publicBusinessApi";

const request = vi.hoisted(() => vi.fn());
vi.mock("./authService", () => ({ requestWithSession: request }));

const business = (id: string, name: string, category: string, secondaryCategories: string[] = []) => ({
  publicId: id, name, sede: null, adultOnly: false, description: null,
  category: { id: category, code: category, name: category, iconKey: null },
  secondaryCategories: secondaryCategories.map(value => ({ id: value, code: value, name: value, iconKey: null })),
  location: { cityName: "Palmira", regionName: "Valle del Cauca", address: null, latitude: null, longitude: null },
  coverPhoto: null, profilePhoto: null,
});

beforeEach(() => request.mockReset());

describe("Explora por categoría: orden real por negocios", () => {
  it("ordena de izquierda a derecha por cantidad y excluye categorías sin negocios", async () => {
    request.mockResolvedValue({
      categories: [
        { id: "fer", code: "fer", name: "Ferreterías", iconKey: "wrench", businessCount: 2 },
        { id: "rest", code: "rest", name: "Restaurantes", iconKey: null, businessCount: 5 },
        { id: "sin", code: "sin", name: "Sin negocios", iconKey: null, businessCount: 0 },
      ],
    });
    const result = await listPublicCategories("Palmira", "Valle del Cauca");
    expect(result.map(item => [item.name, item.businessCount])).toEqual([["Restaurantes", 5], ["Ferreterías", 2]]);
    expect(request.mock.calls[0][0]).toContain("/api/v1/public/categories?city=Palmira&region=Valle+del+Cauca");
  });

  it("si el endpoint es nuevo, usa todas las páginas de búsqueda para contar negocios", async () => {
    request.mockImplementation(async (url: string) => {
      if (typeof url !== "string") throw new Error(`Se esperaba una URL de la API: ${new Error().stack}`);
      if (url.includes("/public/categories?")) throw new ApiError(404, "HTTP_ERROR", "Not found");
      const params = new URLSearchParams(url.split("?")[1]);
      expect(params.get("scope")).toBe("city");
      expect(params.get("city")).toBe("Pradera");
      expect(params.get("region")).toBe("Valle del Cauca");
      expect(params.get("businessPageSize")).toBe("50");
      const page = Number(params.get("businessPage"));
      return {
        businesses: page === 1
          ? [business("1", "Patico", "Panaderías"), business("2", "Mocho", "Ferreterías", ["Panaderías"])]
          : [business("3", "Patico 2", "Panaderías")],
        products: [], services: [],
        pagination: { businesses: { totalPages: 2 } },
      };
    });
    const result = await listPublicCategories("Pradera", "Valle del Cauca");
    expect(result.map(item => [item.name, item.businessCount])).toEqual([["Panaderías", 3], ["Ferreterías", 1]]);
    expect(request.mock.calls.length).toBe(3);
  });

  it("distingue un error real de conexión de una ciudad sin negocios", async () => {
    request.mockRejectedValue(new ApiError(503, "SERVICE_UNAVAILABLE", "offline"));
    let error: unknown;
    try { await listPublicCategories("Florida", "Valle del Cauca"); }
    catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(ApiError);
    expect((error as Error).message).toBe("offline");
    expect(request.mock.calls.length).toBe(1);
  });
});

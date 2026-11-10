import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchPublicUniversal } from "./publicBusinessApi";
import { searchUniversal } from "./businessService";

vi.mock("./publicBusinessApi", () => ({
  searchPublicUniversal: vi.fn(),
  listPublicBusinesses: vi.fn(),
  getPublicBusiness: vi.fn(),
  listPublicProducts: vi.fn(),
  listPublicServices: vi.fn(),
}));

beforeEach(() => vi.resetAllMocks());

describe("XAMUKO Usuario: resultados universales", () => {
  it("envía el término como q y preserva categoría, distancia y páginas", async () => {
    const result = {
      businesses: [], products: [], services: [],
      pagination: {
        businesses: { page: 2, pageSize: 50, total: 73, totalPages: 2 },
        products: { page: 1, pageSize: 50, total: 4, totalPages: 1 },
        services: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      },
    };
    vi.mocked(searchPublicUniversal).mockResolvedValue(result);
    const actual = await searchUniversal({
      query: "  Café  ", category: "Cafeterías", latitude: 3.54, longitude: -76.30, radiusKm: 10,
      businessPage: 2, businessPageSize: 50, productPageSize: 50, servicePageSize: 50,
    });

    expect(searchPublicUniversal).toHaveBeenCalledWith({
      q: "Café", category: "Cafeterías", latitude: 3.54, longitude: -76.30, radiusKm: 10,
      businessPage: 2, businessPageSize: 50, productPageSize: 50, servicePageSize: 50,
    });
    expect(actual).toBe(result);
    expect(actual.pagination?.businesses.total).toBe(73);
    expect(actual.pagination?.businesses.totalPages).toBe(2);
  });

  it("no vuelve a filtrar los negocios cuando coinciden por productos o servicios", async () => {
    const result = {
      businesses: [{ id: "biz-1", name: "Tienda Central", category: "Comercio" }] as any,
      products: [{ id: "product-1", businessId: "biz-1", name: "Café de origen" }] as any,
      services: [],
      pagination: {
        businesses: { page: 1, pageSize: 50, total: 101, totalPages: 3 },
        products: { page: 1, pageSize: 50, total: 58, totalPages: 2 },
        services: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      },
    };
    vi.mocked(searchPublicUniversal).mockResolvedValue(result);
    const actual = await searchUniversal({ query: "café" });
    expect(actual.businesses.map(item => item.id)).toEqual(["biz-1"]);
    expect(actual.pagination?.businesses.total).toBe(101);
    expect(actual.pagination?.products.totalPages).toBe(2);
    expect(searchPublicUniversal).toHaveBeenCalledWith({ q: "café" });
  });

  it("mantiene el mismo alcance virtual para Negocios, Productos y Servicios", async () => {
    const result = {
      businesses: [{ id: "virtual-1" }] as any, products: [{ id: "producto-virtual-1" }] as any,
      services: [{ id: "servicio-virtual-1" }] as any,
      pagination: { businesses: { total: 1 }, products: { total: 1 }, services: { total: 1 } },
    };
    vi.mocked(searchPublicUniversal).mockResolvedValueOnce(result);
    const actual = await searchUniversal({ query: "pan", scope: "virtual", businessPage: 2 });
    expect(searchPublicUniversal).toHaveBeenCalledWith({ q: "pan", scope: "virtual", businessPage: 2 });
    expect(actual).toBe(result);
  });

  it("filtra por ciudad y departamento sin exigir coordenadas GPS", async () => {
    const result = {
      businesses: [], products: [], services: [],
      pagination: { businesses: { total: 0 }, products: { total: 0 }, services: { total: 0 } },
    };
    vi.mocked(searchPublicUniversal).mockResolvedValueOnce(result);
    await searchUniversal({ query: "barbería", scope: "city", city: "Palmira", region: "Valle del Cauca" });
    expect(searchPublicUniversal).toHaveBeenCalledWith({
      q: "barbería", scope: "city", city: "Palmira", region: "Valle del Cauca",
    });
  });

  it("propaga un fallo del API para no presentarlo como cero resultados", async () => {
    vi.mocked(searchPublicUniversal).mockRejectedValueOnce(new Error("Network unavailable"));
    await expect(searchUniversal({ query: "motos" })).rejects.toThrow("Network unavailable");
  });
});

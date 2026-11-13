import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./httpClient";
import { listPublicNewArrivals } from "./publicBusinessApi";

const request = vi.hoisted(() => vi.fn());
vi.mock("./authService", () => ({ requestWithSession: request }));

const published = new Date().toISOString();
const old = new Date(Date.now() - 9 * 86_400_000).toISOString();
const offer = (id: string, name: string, createdAt: string, businessId: string) => ({
  id, name, createdAt, description: "", category: null, photos: [],
  price: { amount: null, text: null, currency: "COP", negotiable: false },
  business: { publicId: businessId, name: businessId, location: null },
});

beforeEach(() => { request.mockReset(); });

describe("Nuevos en tu ciudad: API aún no desplegada", () => {
  it("recupera un producto nuevo y un servicio nuevo de Palmira por la búsqueda existente", async () => {
    request.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/public/new-arrivals")) {
        throw new ApiError(404, "HTTP_ERROR", "Not found");
      }
      expect(path).toContain("/api/v1/public/search?");
      const params = new URLSearchParams(path.split("?")[1]);
      expect(params.get("scope")).toBe("city");
      expect(params.get("city")).toBe("Palmira");
      expect(params.get("region")).toBe("Valle del Cauca");
      expect(params.get("productPageSize")).toBe("50");
      expect(params.get("servicePageSize")).toBe("50");
      return {
        businesses: [],
        products: [
          offer("croissant", "Croissant", published, "panaderia-patico"),
          offer("viejo", "Martillo viejo", old, "ferreteria"),
        ],
        services: [offer("domicilio", "Domicilios", published, "panaderia-patico")],
        pagination: { products: { totalPages: 1 }, services: { totalPages: 1 } },
      };
    });
    const arrivals = await listPublicNewArrivals("Palmira", "Valle del Cauca");
    expect(arrivals.items.map(({ item }) => item.name)).toEqual(["Croissant", "Domicilios"]);
    expect(arrivals.items.map(({ kind }) => kind)).toEqual(["PRODUCT", "SERVICE"]);
    expect(arrivals.pagination.total).toBe(2);
    expect(arrivals.pagination.hasMore).toBe(false);
  });

  it("diferencia errores reales del servidor de un catálogo vacío", async () => {
    request.mockRejectedValue(new ApiError(503, "SERVICE_UNAVAILABLE", "Service unavailable"));
    await expect(listPublicNewArrivals("Pradera", "Valle del Cauca")).rejects.toThrow("Service unavailable");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("respeta veinte novedades por página en el modo compatible", async () => {
    request.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/public/new-arrivals")) {
        throw new ApiError(404, "HTTP_ERROR", "Not found");
      }
      const products = Array.from({ length: 23 }, (_, index) =>
        offer("item-" + index, "Producto " + index, published, "business-" + index));
      return {
        businesses: [], products, services: [],
        pagination: { products: { totalPages: 1 }, services: { totalPages: 0 } },
      };
    });
    const first = await listPublicNewArrivals("Florida", "Valle del Cauca", 1);
    const second = await listPublicNewArrivals("Florida", "Valle del Cauca", 2);
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(3);
    expect(first.pagination.hasMore).toBe(true);
    expect(second.pagination.hasMore).toBe(false);
    expect(new Set([...first.items, ...second.items].map(({ item }) => item.id)).size).toBe(23);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Business } from "../data/mockData";
import { listDiscoverBusinesses } from "./discoverBusinessService";
import { searchUniversal } from "./businessService";

vi.mock("./businessService", () => ({ searchUniversal: vi.fn() }));
const search = vi.mocked(searchUniversal);
const item = (id: string) => ({ id } as Business);

beforeEach(() => search.mockReset());

describe("Catálogo del carrusel Descubre negocios", () => {
  it("consulta todas las páginas de la ciudad, sin mezclarlas con otros municipios", async () => {
    search.mockImplementation(async (params) => {
      const page = params?.businessPage ?? 1;
      return {
        businesses: page === 1 ? [item("a"), item("b")] : page === 2 ? [item("c"), item("a")] : [item("d")],
        products: [], services: [],
        pagination: { businesses: { totalPages: 3 } },
      };
    });
    const found = await listDiscoverBusinesses("Santiago de Cali", "Valle del Cauca");
    expect(found.map((business) => business.id)).toEqual(["a", "b", "c", "d"]);
    expect(search).toHaveBeenCalledTimes(3);
    for (const [params] of search.mock.calls) {
      expect(params).toMatchObject({
        scope: "city", city: "Santiago de Cali", region: "Valle del Cauca",
        businessPageSize: 50, productPageSize: 1, servicePageSize: 1,
      });
    }
  });

  it("deja el catálogo vacío cuando no existen negocios publicados", async () => {
    search.mockResolvedValue({ businesses: [], products: [], services: [], pagination: { businesses: { totalPages: 0 } } });
    expect(await listDiscoverBusinesses("Buenaventura", "Valle del Cauca")).toEqual([]);
    expect(search).toHaveBeenCalledTimes(1);
  });
});

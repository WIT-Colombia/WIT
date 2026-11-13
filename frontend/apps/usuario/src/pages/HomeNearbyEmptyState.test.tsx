import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";

const api = vi.hoisted(() => ({ search: vi.fn(), banner: vi.fn(), selection: { mode: "manual", locality: { id: "76834", name: "Tuluá", context: "Valle del Cauca", departmentCode: "76", kind: "Municipio" } } }));
vi.mock("../services/businessService", () => ({ searchUniversal: api.search, prioritizeFeaturedByDistance: (items: unknown[]) => items }));
vi.mock("../context/LocationContext", () => ({ useLocationContext: () => ({ selection: api.selection }) }));
vi.mock("../services/publicBusinessApi", () => ({ listPublicBusinesses: async () => [], listPublicProducts: async () => [], listPublicCategories: async () => [], listPublicPromotions: async () => [], listPublicServices: async () => [], listPublicNewArrivals: async () => ({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0, hasMore: false } }) }));
vi.mock("../services/reviewsService", () => ({ listPublicReviews: async () => ({ summary: { average: 0, total: 0 } }) }));
vi.mock("../services/favoritesService", () => ({ useFavorites: () => ({ favorites: [], toggleFavorite: vi.fn() }) }));
vi.mock("../services/offerLikesService", () => ({ isRealOfferId: () => false, useOfferLikes: () => ({ get: () => ({ liked: false, count: 0 }), toggle: vi.fn() }) }));
vi.mock("../components/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../components/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("../components/BottomNavigation", () => ({ BottomNavigation: () => null }));
vi.mock("../components/LocationStarter", () => ({ LocationStarter: () => null }));
vi.mock("../components/NewProductsBanner", () => ({ NewProductsBanner: (props: unknown) => { api.banner(props); return null; } }));
vi.mock("../components/AdMobBanner", () => ({ AdMobBanner: () => null }));
vi.mock("../components/EntityCards", () => ({ BusinessCard: ({ business }: { business: { name: string } }) => <article>{business.name}</article> }));

beforeEach(() => {
  api.search.mockReset();
  api.banner.mockClear();
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const show = () => render(<MemoryRouter><Home /></MemoryRouter>);

describe("Lugares cerca de ti: condiciones del aviso", () => {
  it("muestra la tarjeta solo después de recibir un catálogo vacío válido", async () => {
    api.search.mockResolvedValue({ businesses: [], products: [] });
    const { container } = show();
    expect(await screen.findByRole("heading", { name: "Aún no encontramos coincidencias" })).toBeInTheDocument();
    expect(container.querySelector("#lugares .no-results-state--nearby")).not.toBeNull();
    expect(api.search).toHaveBeenCalledWith(expect.objectContaining({ scope: "city", city: "Tuluá", region: "Valle del Cauca" }));
    expect(screen.getByText(/Por ahora no hay opciones en Tuluá/)).toBeInTheDocument();
    await waitFor(() => expect(api.banner).toHaveBeenLastCalledWith(expect.objectContaining({ locationName: "Tuluá", cityEmpty: true })));
  });

  it("mantiene la carga sin mostrar una ciudad vacía antes de tener respuesta", () => {
    api.search.mockReturnValue(new Promise(() => {}));
    const { container } = show();
    expect(screen.getByText("Cargando negocios…")).toBeInTheDocument();
    expect(container.querySelector(".no-results-state--nearby")).toBeNull();
  });

  it("mantiene el error y el botón de reintento si el catálogo no se pudo consultar", async () => {
    api.search.mockRejectedValue(new Error("offline"));
    const { container } = show();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar los negocios");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(container.querySelector(".no-results-state--nearby")).toBeNull();
  });

  it("conserva los negocios recibidos y oculta el aviso cuando hay resultados", async () => {
    api.search.mockResolvedValue({ businesses: [{ id: "isolated-test", name: "Negocio de prueba", distanceKm: 0, city: "Tuluá", plan: "free" }], products: [] });
    const { container } = show();
    const nearbySection = container.querySelector<HTMLElement>("#lugares");
    expect(nearbySection).not.toBeNull();
    expect(await within(nearbySection!).findByText("Negocio de prueba")).toBeInTheDocument();
    expect(container.querySelector(".no-results-state--nearby")).toBeNull();
  });
});

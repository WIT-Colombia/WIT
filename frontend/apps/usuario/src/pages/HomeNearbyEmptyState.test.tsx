import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";

const api = vi.hoisted(() => ({ search: vi.fn(), categories: vi.fn(), banner: vi.fn(), selection: { mode: "manual", locality: { id: "76834", name: "Tuluá", context: "Valle del Cauca", departmentCode: "76", kind: "Municipio" } } }));
vi.mock("../services/businessService", () => ({ searchUniversal: api.search, prioritizeFeaturedByDistance: (items: unknown[]) => items }));
vi.mock("../context/LocationContext", () => ({ useLocationContext: () => ({ selection: api.selection }) }));
vi.mock("../services/publicBusinessApi", () => ({ listPublicBusinesses: async () => [], listPublicProducts: async () => [], listPublicCategories: api.categories, listPublicPromotions: async () => [], listPublicServices: async () => [], listPublicNewArrivals: async () => ({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0, hasMore: false } }) }));
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
  api.categories.mockReset().mockResolvedValue([]);
  api.banner.mockClear();
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const LocationProbe = () => { const location = useLocation(); return <output data-testid="current-path">{location.pathname + location.search}</output>; };
const show = () => render(<MemoryRouter><Home /><LocationProbe /></MemoryRouter>);

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


describe("Explora por categoría: ocultar la sección vacía", () => {
  it("oculta toda la sección si la ciudad no tiene negocios por categoría", async () => {
    api.search.mockResolvedValue({ businesses: [], products: [] });
    api.categories.mockResolvedValue([]);
    const { container } = show();
    await waitFor(() => expect(api.categories).toHaveBeenCalledWith("Tuluá", "Valle del Cauca"));
    await screen.findByRole("heading", { name: "Aún no encontramos coincidencias" });
    expect(container.querySelector("#explorar")).toBeNull();
    expect(screen.queryByText(/Aún no hay negocios publicados por categoría/)).toBeNull();
  });

  it("distingue un error de consulta de una lista realmente vacía y permite reintentar", async () => {
    api.search.mockResolvedValue({ businesses: [], products: [] });
    api.categories.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([
      { id: "cat-cafe", code: "cafeterias", name: "Cafeterías", iconKey: "coffee", businessCount: 1 },
    ]);
    const { container } = show();
    const categorySection = await waitFor(() => {
      const element = container.querySelector("#explorar");
      expect(element).not.toBeNull();
      expect(within(element as HTMLElement).getByText("No pudimos cargar las categorías.")).toBeInTheDocument();
      return element as HTMLElement;
    });
    fireEvent.click(within(categorySection).getByRole("button", { name: "Reintentar" }));
    expect(await within(categorySection).findByRole("button", { name: "Cafeterías, 1 negocio" })).toBeInTheDocument();
  });
});

describe("Explora por categoría: orden, conteos y navegación", () => {
  it("muestra de izquierda a derecha primero las categorías con más negocios de la ciudad", async () => {
    api.search.mockResolvedValue({ businesses: [], products: [] });
    api.categories.mockResolvedValue([
      { id: "cat-rest", code: "restaurantes", name: "Restaurantes", iconKey: "utensils", businessCount: 8 },
      { id: "cat-fer", code: "ferreterias", name: "Ferreterías", iconKey: "wrench", businessCount: 3 },
      { id: "cat-cafe", code: "cafeterias", name: "Cafeterías", iconKey: "coffee", businessCount: 1 },
    ]);
    const { container } = show();
    expect(await screen.findByRole("button", { name: "Restaurantes, 8 negocios" })).toBeInTheDocument();
    expect(api.categories).toHaveBeenCalledWith("Tuluá", "Valle del Cauca");
    const labels = Array.from(container.querySelectorAll(".category-list .category-tile")).map(element =>
      element.textContent?.replace(/\s+/g, " ").trim());
    expect(labels).toEqual(["Restaurantes8 negocios", "Ferreterías3 negocios", "Cafeterías1 negocio"]);
    fireEvent.click(screen.getByRole("button", { name: "Ferreterías, 3 negocios" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/results?category=Ferreter%C3%ADas");
  });

  it("muestra siete categorías inicialmente y habilita Ver más para las restantes", async () => {
    api.search.mockResolvedValue({ businesses: [], products: [] });
    api.categories.mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({
      id: `category-${index}`, code: `category-${index}`, name: `Categoría ${index + 1}`,
      iconKey: null, businessCount: 8 - index,
    })));
    const { container } = show();
    expect(await screen.findByRole("button", { name: "Categoría 1, 8 negocios" })).toBeInTheDocument();
    expect(container.querySelectorAll(".category-tile")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: /Ver más \(8\)/ }));
    expect(container.querySelectorAll(".category-tile")).toHaveLength(8);
    expect(screen.getByRole("button", { name: /Ver menos/ })).toBeInTheDocument();
  });
});

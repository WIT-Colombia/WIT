import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Location from "./Location";

const state = vi.hoisted(() => ({ selection: null as null | { mode: "automatic"; coordinates: { lat: number; lng: number } } }));
vi.mock("../context/LocationContext", () => ({ useLocationContext: () => ({ selection: state.selection, requestAutomaticLocation: vi.fn(), isRequesting: false }) }));
vi.mock("../components/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../components/SiteFooter", () => ({ SiteFooter: () => null }));

describe("mapa en ubicación automática", () => {
  it("muestra el aviso en texto y la ilustración cuando faltan coordenadas", () => {
    state.selection = null;
    render(<MemoryRouter><Location /></MemoryRouter>);
    expect(screen.getByText("Activa tu ubicación o elige una zona")).toBeVisible();
    expect(screen.getByText("para verla en el mapa.")).toBeVisible();
    expect(screen.getByRole("complementary", { name: "Mapa de tu ubicación" }).querySelector("img")).toHaveAttribute("srcset", expect.stringContaining("3840w"));
    expect(screen.queryByTitle("Mapa de tu ubicación")).not.toBeInTheDocument();
  });

  it("conserva el mapa de Google al tener coordenadas automáticas", () => {
    state.selection = { mode: "automatic", coordinates: { lat: 3.54, lng: -76.3 } };
    render(<MemoryRouter><Location /></MemoryRouter>);
    expect(screen.getByTitle("Mapa de tu ubicación")).toHaveAttribute("src", expect.stringContaining("3.54,-76.3"));
    expect(screen.queryByText("Activa tu ubicación o elige una zona")).not.toBeInTheDocument();
  });
});

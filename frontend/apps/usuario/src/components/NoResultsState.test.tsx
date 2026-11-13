import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { CityEmptyState, NoResultsState } from "./NoResultsState";

afterEach(cleanup);

describe("Estado vacío de negocios en la ciudad", () => {
  it.each(["Cali", "Tuluá", "Santa Fe de Antioquia"])("muestra la ciudad elegida (%s) en HTML y conserva la acción virtual", locationName => {
    const { container } = render(<MemoryRouter><CityEmptyState locationName={locationName}/></MemoryRouter>);
    expect(screen.getByRole("heading", { name: `Aún no hay negocios registrados en ${locationName}.` })).toBeInTheDocument();
    expect(screen.getByText(/Prueba con negocios en modalidad virtual/)).toBeInTheDocument();
    const image = container.querySelector(".no-results-state--city img");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("width", "3840");
    expect(image).toHaveAttribute("height", "3840");
    expect(image?.getAttribute("srcset")).toMatch(/480w,.*960w,.*3840w/);
    const action = screen.getByRole("link", { name: /Ver negocios virtuales disponibles en toda Colombia/ });
    expect(action).toHaveAttribute("href", "/results?scope=virtual");
  });

  it("el botón sigue navegando a resultados en modalidad virtual", () => {
    function Destination() { const [params] = useSearchParams(); return <h1>Resultados: {params.get("scope")}</h1>; }
    render(<MemoryRouter initialEntries={["/home"]}><Routes>
      <Route path="/home" element={<CityEmptyState locationName="Cali"/>}/>
      <Route path="/results" element={<Destination/>}/>
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: "Ver negocios virtuales disponibles en toda Colombia" }));
    expect(screen.getByRole("heading", { name: "Resultados: virtual" })).toBeInTheDocument();
  });

  it("presenta la referencia con texto HTML, ciudad dinámica y arte responsive separado", () => {
    const { container } = render(<MemoryRouter><NoResultsState appearance="nearby" locationName="Tuluá" /></MemoryRouter>);
    expect(screen.getByText("SIGAMOS EXPLORANDO")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aún no encontramos coincidencias" })).toBeInTheDocument();
    expect(screen.getByText(/Por ahora no hay opciones en Tuluá/)).toBeInTheDocument();
    const illustration = container.querySelector(".nearby-empty-illustration img");
    expect(illustration).toHaveAttribute("alt", "");
    expect(illustration).toHaveAttribute("width", "3840");
    expect(illustration).toHaveAttribute("height", "2880");
    expect(illustration?.getAttribute("srcset")).toMatch(/480w,.*960w,.*3840w/);
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/location?returnTo=%2Fhome", "/map", "/register-need"]);
  });

  it("permite elegir otra ubicación y conserva los filtros para el mapa", () => {
    render(<MemoryRouter><NoResultsState appearance="nearby" locationName="Palmira" term="café & pan" /></MemoryRouter>);
    const query = "?q=caf%C3%A9%20%26%20pan";
    expect(screen.getByRole("link", { name: "Elegir otra ubicación" })).toHaveAttribute("href", "/location?returnTo=%2Fhome");
    expect(screen.getByRole("link", { name: "Ampliar búsqueda en el mapa" })).toHaveAttribute("href", `/map${query}`);
    expect(screen.getByRole("link", { name: "Contarnos qué necesitas" })).toHaveAttribute("href", `/register-need${query}`);
    expect(screen.queryByText(/Ver todos los negocios en Palmira/)).toBeNull();
  });

  it("conserva el estado y las acciones de búsquedas virtuales fuera del home", () => {
    const { container } = render(<MemoryRouter><NoResultsState locationName="Colombia" virtualOnly term="café" /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "No encontramos resultados virtuales para “café”" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ampliar búsqueda en el mapa" })).toBeNull();
    expect(container.querySelector(".no-results-state--nearby")).toBeNull();
    expect(screen.getByRole("link", { name: "Cambiar búsqueda" })).toHaveAttribute("href", "/results?scope=virtual");
    expect(screen.queryByRole("link", { name: "Elegir otra ubicación" })).toBeNull();
  });
});

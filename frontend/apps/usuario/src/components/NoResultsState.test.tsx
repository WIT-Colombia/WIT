import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CityEmptyState } from "./NoResultsState";

describe("Estado vacío de negocios en la ciudad", () => {
  it("muestra un título y descripción HTML reales sin imagen", () => {
    const { container } = render(<MemoryRouter><CityEmptyState /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Aún no hay negocios registrados en tu ciudad" })).toBeInTheDocument();
    expect(screen.getByText(/Mientras llegan nuevas opciones a tu comunidad/)).toBeInTheDocument();
    expect(container.querySelector(".no-results-state--city img")).toBeNull();
    const action = screen.getByRole("link", { name: /Explorar negocios virtuales/ });
    expect(action).toHaveAttribute("href", "/results?scope=virtual");
  });
});

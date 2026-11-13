import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { faqs } from "@wit/utils";
import FaqPage from "./FaqPage";

vi.mock("../components/PageLayout", () => ({
  PageLayout: ({ children, className }: { children: ReactNode; className: string }) => <main className={className}>{children}</main>,
}));

function renderPage() {
  render(<MemoryRouter initialEntries={["/ayuda/preguntas-frecuentes"]}>
    <Routes>
      <Route path="/ayuda/preguntas-frecuentes" element={<FaqPage />} />
      <Route path="/home" element={<h1>Inicio de XAMUKO</h1>} />
    </Routes>
  </MemoryRouter>);
}

afterEach(cleanup);

describe("Página de preguntas frecuentes de Usuarios", () => {
  it("reutiliza las mismas preguntas y respuestas del landing", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Preguntas frecuentes" })).toBeInTheDocument();
    expect(document.querySelectorAll(".faq-page__list details")).toHaveLength(faqs.usuarios.length);
    expect(screen.getByText(faqs.usuarios[0][0])).toBeInTheDocument();
    expect(screen.getByText(faqs.usuarios[0][1])).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Negocios" }));
    expect(document.querySelectorAll(".faq-page__list details")).toHaveLength(faqs.negocios.length);
    expect(screen.getByText(faqs.negocios[0][0])).toBeInTheDocument();
    expect(screen.queryByText(faqs.usuarios[0][0])).toBeNull();
  });

  it("ofrece regreso seguro a Inicio cuando no hay historial interno", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "← Volver" }));
    expect(screen.getByRole("heading", { name: "Inicio de XAMUKO" })).toBeInTheDocument();
  });
});

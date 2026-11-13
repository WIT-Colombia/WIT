import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isRouteLoadError, mayReloadRoute, RouteErrorBoundary } from "./RouteErrorBoundary";

const chunkError = new TypeError("Failed to fetch dynamically imported module");

afterEach(() => { sessionStorage.clear(); document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("route loading recovery", () => {
  it("identifies browser and Vite chunk errors without treating ordinary errors as chunk failures", () => {
    expect(isRouteLoadError(chunkError)).toBe(true);
    expect(isRouteLoadError(new Error("Importing a module script failed"))).toBe(true);
    expect(isRouteLoadError(new Error("Unable to preload CSS"))).toBe(true);
    expect(isRouteLoadError(new Error("network request failed"))).toBe(false);
  });

  it("allows at most one automatic reload in the cooldown window", () => {
    expect(mayReloadRoute(chunkError, sessionStorage, document, 1_000_000, "", "/map")).toBe(true);
    expect(mayReloadRoute(chunkError, sessionStorage, document, 1_000_001, "", "/map")).toBe(false);
    expect(mayReloadRoute(chunkError, sessionStorage, document, 1_600_001, "", "/map")).toBe(true);
  });

  it("preserves changed form data, sensitive links, and handles unavailable storage", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.value = "texto sin guardar";
    expect(mayReloadRoute(chunkError, sessionStorage, document, 1_000_000, "", "/home")).toBe(false);
    input.value = "";
    expect(mayReloadRoute(chunkError, sessionStorage, document, 1_000_000, "?token=secret", "/home")).toBe(false);
    expect(mayReloadRoute(chunkError, sessionStorage, document, 1_000_000, "", "/register-need")).toBe(false);
    expect(mayReloadRoute(chunkError, sessionStorage, document, 1_000_000, "", "/home", true)).toBe(false);
    const unavailable = { getItem: () => { throw new Error("denied"); } } as unknown as Storage;
    expect(mayReloadRoute(chunkError, unavailable, document, 1_000_000, "", "/home")).toBe(false);
  });

  it("shows a manual retry when an unexpected route error occurs", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    function Broken(): never { throw new Error("render error"); }
    render(<RouteErrorBoundary><Broken /></RouteErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar esta página");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(sessionStorage.length).toBe(0);
  });

  it("avoids auto-reload when a render failure replaces a form with unsaved input", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.history.replaceState({}, "", "/home");
    function FormWithFailure() {
      const [failed, setFailed] = useState(false);
      if (failed) throw chunkError;
      return <><input aria-label="Búsqueda" /><button onClick={() => setFailed(true)}>Abrir página</button></>;
    }
    render(<RouteErrorBoundary><FormWithFailure /></RouteErrorBoundary>);
    fireEvent.change(screen.getByLabelText("Búsqueda"), { target: { value: "sin guardar" } });
    fireEvent.click(screen.getByRole("button", { name: "Abrir página" }));
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(sessionStorage.length).toBe(0);
  });
});

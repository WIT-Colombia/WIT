/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "../src/App";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

it("synchronizes FAQ and Plans with Back, Forward and ordinary links", async () => {
  render(<App />);
  const faq = document.getElementById("preguntas") as HTMLElement;
  const plans = document.getElementById("planes") as HTMLElement;
  expect(faq.hidden).toBe(true);
  expect(plans.hidden).toBe(true);

  fireEvent.click(screen.getByRole("link", { name: "Preguntas", exact: true }));
  expect(window.location.hash).toBe("#preguntas");
  expect(faq.hidden).toBe(false);

  window.history.back();
  await waitFor(() => expect(window.location.hash).toBe(""));
  await waitFor(() => expect(faq.hidden).toBe(true));

  window.history.forward();
  await waitFor(() => expect(window.location.hash).toBe("#preguntas"));
  await waitFor(() => expect(faq.hidden).toBe(false));

  fireEvent.click(screen.getByRole("link", { name: "Planes", exact: true }));
  expect(window.location.hash).toBe("#planes");
  expect(plans.hidden).toBe(false);
  expect(faq.hidden).toBe(true);

  fireEvent.click(within(screen.getByRole("navigation", { name: "Navegación principal" })).getByRole("link", { name: "Inicio" }));
  await waitFor(() => expect(window.location.hash).toBe("#inicio"));
  await waitFor(() => expect(plans.hidden).toBe(true));
});

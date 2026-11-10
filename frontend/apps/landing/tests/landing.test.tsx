import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../src/App";
import { destinations } from "../src/config/destinations";

beforeEach(() => vi.stubGlobal("window", { location: { hash: "" } }));
afterEach(() => vi.unstubAllGlobals());

describe("Landing navigation contract", () => {
  it("uses the official hosts and the application's actual registration, login and exploration routes", () => {
    expect(destinations.explore).toBe("https://user.xamuko.com/home");
    expect(destinations.userRegister).toBe("https://user.xamuko.com/register");
    expect(destinations.userLogin).toBe("https://user.xamuko.com/register?mode=login");
    expect(destinations.businessRegister).toBe("https://business.xamuko.com/registro");
    expect(destinations.businessLogin).toBe("https://business.xamuko.com/login");
    const usuario = readFileSync(new URL("../../usuario/src/App.tsx", import.meta.url), "utf8");
    const business = readFileSync(new URL("../../negocios/src/App.tsx", import.meta.url), "utf8");
    const registration = readFileSync(new URL("../../usuario/src/pages/Register.tsx", import.meta.url), "utf8");
    for (const url of Object.values(destinations)) {
      const route = new URL(url);
      expect(route.hostname === "user.xamuko.com" ? usuario : business).toContain(`path="${route.pathname}"`.replace(/legal\/(terms|privacy)/, "legal/:page"));
    }
    expect(registration).toContain('params.get("mode") === "login"');
  });

  it("connects every page link to an existing section or an approved destination", () => {
    const html = renderToStaticMarkup(<App/>);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    const links = [...html.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map(match => match[1].replaceAll("&amp;", "&"));
    expect(links.length).toBeGreaterThan(20);
    for (const href of links) {
      if (href.startsWith("#")) expect(ids).toContain(href.slice(1));
      else expect(Object.values(destinations)).toContain(href);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).not.toContain("<form");
    expect(html).toContain("Las cifras son ejemplos");
    expect(html.match(/<summary>/g)).toHaveLength(6);
  });

  it("supports directly opening FAQs and plans from their fragment URLs", () => {
    for (const section of ["preguntas", "planes"]) {
      vi.stubGlobal("window", { location: { hash: `#${section}` } });
      const html = renderToStaticMarkup(<App/>);
      const tag = html.match(new RegExp(`<section[^>]*id="${section}"[^>]*>`))?.[0];
      expect(tag).toBeDefined();
      expect(tag).not.toContain("hidden");
    }
  });

  it("keeps local application hosts in local development", async () => {
    vi.resetModules();
    vi.stubGlobal("window", { location: { hostname: "127.0.0.1", hash: "" } });
    const { destinations: local } = await import("../src/config/destinations");
    expect(local.explore).toBe("http://127.0.0.1:5173/home");
    expect(local.userLogin).toBe("http://127.0.0.1:5173/register?mode=login");
    expect(local.businessRegister).toBe("http://127.0.0.1:5174/registro");
  });

  it.each(["xamuko.com", "www.xamuko.com"])("keeps official destinations when served on %s", async hostname => {
    vi.resetModules();
    vi.stubGlobal("window", { location: { hostname, hash: "" } });
    const { destinations: official } = await import("../src/config/destinations");
    expect(official.explore).toBe("https://user.xamuko.com/home");
    expect(official.businessRegister).toBe("https://business.xamuko.com/registro");
  });
});

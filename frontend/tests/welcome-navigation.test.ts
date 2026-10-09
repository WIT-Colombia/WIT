import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("the visible Welcome logo navigates internally to home", () => {
  const source = readFileSync(new URL("../apps/usuario/src/pages/Welcome.tsx", import.meta.url), "utf8");
  assert.match(source, /<Link className="welcome-brand" to="\/home" aria-label="WIT, inicio">/);
  assert.doesNotMatch(source, /welcome-brand[^>]+href=/);
});

test("location screen logos also navigate to home", () => {
  const location = readFileSync(new URL("../apps/usuario/src/pages/Location.tsx", import.meta.url), "utf8");
  const manual = readFileSync(new URL("../apps/usuario/src/pages/ManualLocation.tsx", import.meta.url), "utf8");
  assert.match(location, /<Link className="location-logo" to="\/home" aria-label="WIT, inicio">/);
  assert.match(manual, /<Link className="manual-location-logo" to="\/home" aria-label="WIT, inicio">/);
});

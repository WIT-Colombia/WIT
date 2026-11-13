import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const service = await readFile(new URL("../src/services/locationService.ts", import.meta.url), "utf8");
const context = await readFile(new URL("../src/context/LocationContext.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const manual = await readFile(new URL("../src/pages/ManualLocation.tsx", import.meta.url), "utf8");
const home = await readFile(new URL("../src/pages/Home.tsx", import.meta.url), "utf8");

test("new visitors are not silently assigned Palmira", () => {
  assert.match(service, /if \(!saved\) return null/);
  assert.match(manual, /defaultMunicipality.*76520/);
});

test("location is hydrated from the account and guarded before home", () => {
  assert.match(context, /getPreferredLocation\(\)/);
  assert.match(context, /wit-selected-location-owner/);
  assert.match(app, /InitialLocationGate/);
  assert.match(app, /requestAutomaticLocation\(\)\.catch/);
});

test("manual municipalities persist immediately, then enrich with coordinates safely", () => {
  assert.match(service, /resolveCoordinatesForLocality/);
  assert.match(context, /saveSelectedLocation\(locality\);\s*const coordinates = await resolveCoordinatesForLocality\(locality\)/);
  assert.match(context, /revision !== localRevision\.current/);
  assert.match(context, /saveSelectedLocation\(locality, coordinates\)/);
  assert.match(service, /isCoordinates\(parsed\.coordinates\) \? parsed\.coordinates/);
});
test("Home filters explicit manual city selections and promotions", () => {
  assert.match(home, /scope: "city" as const, city: selection\.locality\.name, region: selection\.locality\.context/);
  assert.match(home, /Promise\.resolve\(items\)\.then\(async businesses/);
});

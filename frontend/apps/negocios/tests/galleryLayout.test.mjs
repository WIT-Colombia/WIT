import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/pages/BusinessDetailPage.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles/pages.css", import.meta.url), "utf8");

test("business gallery renders two-row columns instead of a flat thumbnail strip", () => {
  assert.match(page, /business-photo-grid/);
  assert.match(page, /business-photo-column/);
  assert.match(page, /Math\.ceil\(\(business\.images\?\.length \?\? 0\) \/ 2\)/);
  assert.match(styles, /business-gallery-thumbnails\.business-photo-grid/);
  assert.match(styles, /business-photo-column\{display:grid;grid-template-rows:repeat\(2,auto\)/);
});

test("gallery breakpoints keep complete photos visible at rest", () => {
  assert.match(styles, /scroll-snap-type:x proximity/);
  assert.match(styles, /overflow-x:auto/);
  assert.match(styles, /overflow-y:hidden/);
  assert.match(styles, /object-fit:cover/);
  assert.match(styles, /calc\(\(100% - 30px\) \/ 4\)/);
  assert.match(styles, /@media \(min-width:768px\) and \(max-width:1023px\)[\s\S]*calc\(\(100% - 20px\) \/ 3\)/);
  assert.match(styles, /@media \(max-width:767px\)[\s\S]*calc\(\(100% - 9px\) \/ 2\)/);
});

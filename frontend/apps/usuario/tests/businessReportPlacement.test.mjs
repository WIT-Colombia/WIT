import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/pages/BusinessDetail.tsx", import.meta.url), "utf8");
const dialog = await readFile(new URL("../src/components/BusinessReportDialog.tsx", import.meta.url), "utf8");

test("report business is visible at the top of public business profiles", () => {
  const headerStart = page.indexOf('<div className="business-detail-back">');
  const heroStart = page.indexOf('<section className="business-detail-hero">', headerStart);
  assert.ok(headerStart !== -1 && heroStart > headerStart);
  assert.match(page.slice(headerStart, heroStart), /<BusinessReportDialog\b/);
  assert.equal((page.match(/<BusinessReportDialog\b/g) ?? []).length, 1);
});

test("business owner preview shows report control without allowing submission", () => {
  assert.match(page, /disabled=\{isBusinessPreview\}/);
  assert.match(dialog, /disabled=\{disabled\}/);
});

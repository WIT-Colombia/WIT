import assert from "node:assert/strict";
import test from "node:test";
import { whatsappLink } from "../src/utils/whatsapp.ts";

test("WhatsApp conserva el código internacional y elimina separadores", () => {
  assert.equal(whatsappLink("+57 3204445566"), "https://wa.me/573204445566");
  assert.equal(whatsappLink("+1 (202) 555-0123"), "https://wa.me/12025550123");
  assert.equal(whatsappLink("0034 612 345 678"), "https://wa.me/34612345678");
});

test("WhatsApp no produce enlaces para valores vacíos o inválidos", () => {
  for (const value of ["", "   ", "abc", "123", "000000000", "1234567890123456"]) {
    assert.equal(whatsappLink(value), null);
  }
});

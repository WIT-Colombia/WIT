import assert from "node:assert/strict";
import { test } from "node:test";
import { BUSINESS_CARD_PRINT, businessCardPdfFromJpeg } from "../apps/negocios/src/utils/businessCardDownload";

test("XAMUKO QR card uses the approved portrait print size", () => {
  assert.deepEqual(BUSINESS_CARD_PRINT, { widthMm: 150, heightMm: 235, widthPx: 1772, heightPx: 2776 });
  assert.ok(BUSINESS_CARD_PRINT.heightPx > BUSINESS_CARD_PRINT.widthPx);
  const ratioDifference = Math.abs(
    BUSINESS_CARD_PRINT.widthPx / BUSINESS_CARD_PRINT.heightPx -
    BUSINESS_CARD_PRINT.widthMm / BUSINESS_CARD_PRINT.heightMm
  );
  assert.ok(ratioDifference < 0.001);
});

test("PDF export embeds a JPEG with exact 150 × 235 mm page geometry", async () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = await businessCardPdfFromJpeg(new Blob([bytes], { type: "image/jpeg" }));
  assert.equal(pdf.type, "application/pdf");
  const binary = new Uint8Array(await pdf.arrayBuffer());
  const text = new TextDecoder("latin1").decode(binary);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/MediaBox \[0 0 425\.197 666\.142\]/);
  assert.match(text, /\/Width 1772 \/Height 2776/);
  assert.match(text, /\/Filter \/DCTDecode \/Length 4/);
  assert.match(text, /xref\n0 6\n/);
  assert.match(text, /\/Im0 Do/);
  assert.ok(text.includes("%%EOF"));
  assert.ok(binary.some((value, i) => value === 0xff && binary[i + 1] === 0xd8));
});

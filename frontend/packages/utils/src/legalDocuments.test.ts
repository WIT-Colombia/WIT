import { describe, expect, it } from "vitest";
import { legalEffectiveDate, legalVersion, privacySections, termsSections } from "./legalDocuments";

describe("public legal documents", () => {
  it("keeps complete, navigable sections without draft placeholders", () => {
    for (const document of [termsSections, privacySections]) {
      expect(document.length).toBeGreaterThan(15);
      expect(document.map(section => section.id)).toEqual(document.map((_, index) => `legal-${index}`));
      expect(new Set(document.map(section => section.title)).size).toBe(document.length);
      const text = JSON.stringify(document);
      expect(text).not.toMatch(/\[[A-ZÁÉÍÓÚÑ][^\]]*\]|BORRADOR EN REVISIÓN|Pendiente definir|Pendiente inventario/);
      expect(text).toContain("XAMUKO S.A.S.");
      expect(text).toContain("notificacionesjudiciales@xamuko.com");
    }
  });

  it("covers reporting, impersonation, age-restricted content and data rights", () => {
    const terms = JSON.stringify(termsSections);
    const privacy = JSON.stringify(privacySections);
    expect(terms).toContain("Reportar negocio");
    expect(terms).toContain("suplantación");
    expect(terms).toContain("mayores de 18 años");
    expect(privacy).toContain("conservación");
    expect(privacy).toContain("supresión");
    expect(privacy).toContain("Cloudflare");
    expect(legalVersion).toMatch(/^\d+\.\d+$/);
    expect(legalEffectiveDate).toMatch(/\d{4}$/);
  });
});

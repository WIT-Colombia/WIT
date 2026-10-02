import divipola2025 from "../data/colombia-divipola-2025.json";
import type { AdministrativeDivision } from "../data/locations";

/** Catálogo incluido en el frontend: el selector funciona sin servicios externos. */
export function getColombianAdministrativeDivisions(): AdministrativeDivision {
  return divipola2025 as AdministrativeDivision;
}

import type { BusinessCardLevel } from "../components/business/BusinessDigitalCard";

export type RecognitionLevelDefinition = {
  level: BusinessCardLevel;
  name: string;
  min: number;
  max?: number;
  productLimit: number;
  serviceLimit: number;
  proDiscount: number;
  exclusiveStatistic?: string;
};

export const BUSINESS_PRO_REFERENCE_PRICE = 30_000;

export const recognitionLevels: RecognitionLevelDefinition[] = [
  { level: "BASIC", name: "Principiante", min: 0, max: 19, productLimit: 20, serviceLimit: 20, proDiscount: 0 },
  { level: "BRONZE", name: "Bronce", min: 20, max: 49, productLimit: 25, serviceLimit: 25, proDiscount: 5, exclusiveStatistic: "Productos y servicios más buscados en tu ciudad" },
  { level: "SILVER", name: "Plata", min: 50, max: 99, productLimit: 30, serviceLimit: 30, proDiscount: 10, exclusiveStatistic: "Búsquedas sin resultados en tu categoría" },
  { level: "GOLD", name: "Oro", min: 100, max: 249, productLimit: 40, serviceLimit: 40, proDiscount: 20, exclusiveStatistic: "Comparación con negocios similares" },
  { level: "PLATINUM", name: "Platino", min: 250, max: 499, productLimit: 50, serviceLimit: 50, proDiscount: 30, exclusiveStatistic: "Tendencias de demanda local" },
  { level: "DIAMOND", name: "Diamante", min: 500, productLimit: 75, serviceLimit: 75, proDiscount: 40, exclusiveStatistic: "Índice de oportunidades comerciales XAMUKO" },
];

export const recognitionLevelFor = (referrals: number) => [...recognitionLevels].reverse().find(item => referrals >= item.min) ?? recognitionLevels[0];
export const recognitionRange = (level: RecognitionLevelDefinition) => level.max === undefined ? `${level.min.toLocaleString("es-CO")} o más referidos válidos` : `${level.min.toLocaleString("es-CO")} a ${level.max.toLocaleString("es-CO")} referidos válidos`;

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
  { level: "BRONZE", name: "Bronce", min: 20, max: 49, productLimit: 25, serviceLimit: 25, proDiscount: 5, exclusiveStatistic: "Usuarios que te guardaron" },
  { level: "SILVER", name: "Plata", min: 50, max: 99, productLimit: 30, serviceLimit: 30, proDiscount: 10, exclusiveStatistic: "Me gusta recibidos" },
  { level: "GOLD", name: "Oro", min: 100, max: 249, productLimit: 40, serviceLimit: 40, proDiscount: 20, exclusiveStatistic: "Opiniones recibidas" },
  { level: "PLATINUM", name: "Platino", min: 250, max: 499, productLimit: 50, serviceLimit: 50, proDiscount: 30, exclusiveStatistic: "Distribución de calificaciones" },
  { level: "DIAMOND", name: "Diamante", min: 500, productLimit: 75, serviceLimit: 75, proDiscount: 40, exclusiveStatistic: "Productos y servicios más consultados" },
];

export const recognitionLevelFor = (referrals: number) => [...recognitionLevels].reverse().find(item => referrals >= item.min) ?? recognitionLevels[0];
export const recognitionRange = (level: RecognitionLevelDefinition) => level.max === undefined ? `${level.min.toLocaleString("es-CO")} o más referidos válidos` : `${level.min.toLocaleString("es-CO")} a ${level.max.toLocaleString("es-CO")} referidos válidos`;

/** Local development fixture; never active in production and never sent to the backend. */
export const DEVELOPMENT_REFERRAL_TEST = { businessName: "Panadería Patico", validReferrals: 600 } as const;
export function developmentReferralTestFor(businessName: string | undefined) {
  return import.meta.env.DEV && businessName?.trim().toLocaleLowerCase("es-CO") === DEVELOPMENT_REFERRAL_TEST.businessName.toLocaleLowerCase("es-CO")
    ? DEVELOPMENT_REFERRAL_TEST.validReferrals
    : null;
}



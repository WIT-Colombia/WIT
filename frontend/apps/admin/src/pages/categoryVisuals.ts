/**
 * Iconografía vectorial del catálogo oficial de XAMUKO.
 * Las claves son códigos persistidos, no posiciones ni IDs de base de datos.
 * Para categorías nuevas se utiliza una etiqueta neutra: nunca un icono inventado.
 */
export type CategoryTone = 'violet' | 'blue' | 'teal' | 'amber' | 'rose' | 'slate';
export type CategoryGlyph =
  | 'utensils' | 'pill' | 'hammer' | 'wrench' | 'scissors' | 'laptop'
  | 'coffee' | 'cake' | 'basket' | 'carrot' | 'fish' | 'heart-pulse'
  | 'stethoscope' | 'glasses' | 'hairdryer' | 'shirt' | 'sofa' | 'hard-hat'
  | 'cog' | 'washer' | 'paw' | 'book-open' | 'graduation-cap' | 'dumbbell'
  | 'car' | 'house' | 'monitor-cog' | 'briefcase' | 'flower' | 'bed'
  | 'ticket' | 'sparkles' | 'shapes' | 'tag';

export type CategoryVisual = { glyph: CategoryGlyph; tone: CategoryTone };

const officialIcons: Record<string, CategoryVisual> = {
  'restaurantes': { glyph: 'utensils', tone: 'amber' },
  'droguerias': { glyph: 'pill', tone: 'teal' },
  'ferreterias': { glyph: 'hammer', tone: 'slate' },
  'talleres': { glyph: 'wrench', tone: 'blue' },
  'barberias': { glyph: 'scissors', tone: 'slate' },
  'tecnologia': { glyph: 'laptop', tone: 'blue' },
  'cafeterias': { glyph: 'coffee', tone: 'amber' },
  'panaderias-y-reposterias': { glyph: 'cake', tone: 'amber' },
  'supermercados-y-tiendas': { glyph: 'basket', tone: 'teal' },
  'frutas-y-verduras': { glyph: 'carrot', tone: 'teal' },
  'carnicerias-y-pescaderias': { glyph: 'fish', tone: 'blue' },
  'salud-y-bienestar': { glyph: 'heart-pulse', tone: 'rose' },
  'clinicas-y-consultorios': { glyph: 'stethoscope', tone: 'teal' },
  'opticas': { glyph: 'glasses', tone: 'blue' },
  'peluquerias-y-belleza': { glyph: 'hairdryer', tone: 'rose' },
  'ropa-y-calzado': { glyph: 'shirt', tone: 'violet' },
  'hogar-y-decoracion': { glyph: 'sofa', tone: 'amber' },
  'construccion-y-remodelacion': { glyph: 'hard-hat', tone: 'slate' },
  'repuestos-y-accesorios': { glyph: 'cog', tone: 'slate' },
  'lavanderias-y-tintorerias': { glyph: 'washer', tone: 'blue' },
  'mascotas-y-veterinarias': { glyph: 'paw', tone: 'rose' },
  'papelerias-y-librerias': { glyph: 'book-open', tone: 'violet' },
  'educacion-y-cursos': { glyph: 'graduation-cap', tone: 'blue' },
  'deportes-y-recreacion': { glyph: 'dumbbell', tone: 'teal' },
  'transporte-y-movilidad': { glyph: 'car', tone: 'blue' },
  'servicios-para-el-hogar': { glyph: 'house', tone: 'amber' },
  'servicios-tecnicos': { glyph: 'monitor-cog', tone: 'slate' },
  'servicios-profesionales': { glyph: 'briefcase', tone: 'blue' },
  'floristerias-y-regalos': { glyph: 'flower', tone: 'rose' },
  'hoteles-y-turismo': { glyph: 'bed', tone: 'violet' },
  'eventos-y-entretenimiento': { glyph: 'ticket', tone: 'violet' },
  'belleza-y-cuidado-personal': { glyph: 'sparkles', tone: 'rose' },
  'otros': { glyph: 'shapes', tone: 'slate' },
};

// Compatibilidad con códigos anteriores y catálogos de pruebas.
const aliases: Record<string, keyof typeof officialIcons> = {
  'restaurants': 'restaurantes',
  'restaurant': 'restaurantes',
  'fashion': 'ropa-y-calzado',
  'health': 'salud-y-bienestar',
  'beauty': 'belleza-y-cuidado-personal',
  'technology': 'tecnologia',
  'home': 'hogar-y-decoracion',
  'pets': 'mascotas-y-veterinarias',
  'education': 'educacion-y-cursos',
};

export const normalizeCategoryCode = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function resolveCategoryVisual(code: string, name?: string): CategoryVisual {
  const key = normalizeCategoryCode(code);
  return officialIcons[key] ?? officialIcons[aliases[key]] ??
    (name ? officialIcons[normalizeCategoryCode(name)] : undefined) ??
    { glyph: 'tag', tone: 'slate' };
}
export const OFFICIAL_CATEGORY_CODES = Object.keys(officialIcons);

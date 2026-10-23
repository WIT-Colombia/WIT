import { demoBusinesses, demoProducts, demoServices } from "./expandedDemoCatalog";

export type Business = {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  isOpen: boolean;
  address: string;
  image: string;
  gallery?: string[];
  logo?: string;
  tags: string[];
  description?: string;
  isFeatured?: boolean;
  isVerified?: boolean;
  plan?: "free" | "premium";
  pioneerNumber?: number | null;
  createdAt?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  city?: string;
  regionName?: string;
  additionalAddressInfo?: string;
  secondaryCategories?: string[];
  modalityTypes?: string[];
  weeklyHours?: { day: string; hours: string; isClosed: boolean }[];
  socialNetworks?: { instagram?: string | null; facebook?: string | null; tiktok?: string | null; x?: string | null };
  coordinates?: { lat: number; lng: number };
  /** Only true when the coordinates were verified by the business or platform. */
  coordinatesVerified?: boolean;
  /** Development-only preview coordinates; never used for real navigation. */
  staticMapPreviewCoordinates?: { lat: number; lng: number };
};

export type Product = {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price?: number;
  priceLabel?: string;
  originalPriceLabel?: string;
  businessName?: string;
  businessCoordinates?: { lat: number; lng: number };
  image: string;
  createdAt?: string;
  likeCount?: number;
  isOffer?: boolean;
  offerLabel?: string;
  discount?: string;
  offerDeadline?: string;
  promotionId?: string;
};

const sampleProductPublished = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

export type Service = {
  id: string;
  businessId: string;
  name: string;
  description: string;
  priceLabel?: string;
  originalPriceLabel?: string;
  businessName?: string;
  businessCoordinates?: { lat: number; lng: number };
  image: string;
  likeCount?: number;
  isOffer?: boolean;
  offerLabel?: string;
  discount?: string;
  offerDeadline?: string;
  promotionId?: string;
};

export type Review = {
  id: string;
  businessId: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  response?: { body: string; createdAt: string; updatedAt: string } | null;
};

export const categories = [
  { name: "Restaurantes", icon: "🍽️" },
  { name: "Droguerías", icon: "✚" },
  { name: "Ferreterías", icon: "🔧" },
  { name: "Talleres", icon: "🛠️" },
  { name: "Barberías", icon: "✂️" },
  { name: "Tecnología", icon: "📱" },
  { name: "Cafeterías", icon: "☕" },
  { name: "Panaderías y reposterías", icon: "🥐" },
  { name: "Supermercados y tiendas", icon: "🛒" },
  { name: "Frutas y verduras", icon: "🥑" },
  { name: "Carnicerías y pescaderías", icon: "🥩" },
  { name: "Salud y bienestar", icon: "🩺" },
  { name: "Clínicas y consultorios", icon: "🏥" },
  { name: "Ópticas", icon: "👓" },
  { name: "Peluquerías y belleza", icon: "💇" },
  { name: "Ropa y calzado", icon: "👟" },
  { name: "Hogar y decoración", icon: "🛋️" },
  { name: "Construcción y remodelación", icon: "🧱" },
  { name: "Repuestos y accesorios", icon: "⚙️" },
  { name: "Lavanderías y tintorerías", icon: "🧺" },
  { name: "Mascotas y veterinarias", icon: "🐾" },
  { name: "Papelerías y librerías", icon: "📚" },
  { name: "Educación y cursos", icon: "🎓" },
  { name: "Deportes y recreación", icon: "⚽" },
  { name: "Transporte y movilidad", icon: "🚗" },
  { name: "Servicios para el hogar", icon: "🧰" },
  { name: "Servicios técnicos", icon: "🪛" },
  { name: "Servicios profesionales", icon: "💼" },
  { name: "Floristerías y regalos", icon: "💐" },
  { name: "Hoteles y turismo", icon: "🧳" },
  { name: "Eventos y entretenimiento", icon: "🎟️" },
  { name: "Belleza y cuidado personal", icon: "💅" },
];

export const alphabeticalCategories = [...categories].sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));

const demoBusinessData: Business[] = [
  {
    id: "arepa-majo", name: "La Arepería de Majo", category: "Restaurantes", rating: 4.8,
    reviewCount: 126, distanceKm: 0.4, isOpen: true, address: "Calle 30 # 28-16, Palmira",
    image: "https://images.unsplash.com/photo-1598214886806-c87b84b7078b?auto=format&fit=crop&w=900&q=85",
    tags: ["Comida típica", "Desayunos"], isFeatured: true, isVerified: true, plan: "premium",
    whatsapp: "+57 000 000 0003",
    description: "Arepas hechas al momento y sabores de casa para empezar bien el día.",
  },
  {
    id: "drogueria-central", name: "Droguería San Jorge", category: "Droguerías", rating: 4.7,
    reviewCount: 84, distanceKm: 0.7, isOpen: true, address: "Carrera 29 # 31-42, Palmira",
    image: "https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=900&q=85",
    tags: ["Salud", "Cuidado personal"], isVerified: true,
    description: "Un lugar cercano para encontrar productos de cuidado personal y bienestar.",
  },
  {
    id: "casa-tornillo", name: "Casa del Tornillo", category: "Ferreterías", rating: 4.6,
    reviewCount: 53, distanceKm: 1.1, isOpen: true, address: "Calle 32 # 25-08, Palmira",
    image: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=900&q=85",
    tags: ["Herramientas", "Construcción"],
    description: "Herramientas y soluciones para esos arreglos que tienes pendientes.",
  },
  {
    id: "distrito-23", name: "Distrito 23 Barbería", category: "Barberías", rating: 4.9,
    reviewCount: 91, distanceKm: 1.3, isOpen: true, address: "Carrera 31 # 27-23, Palmira",
    image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=85",
    tags: ["Barbería", "Cuidado personal"], isVerified: true,
    description: "Cortes y cuidado personal en un espacio pensado para hacer una pausa.",
  },
  {
    id: "moto-express", name: "Moto Express Palmira", category: "Talleres", rating: 4.5,
    reviewCount: 47, distanceKm: 1.8, isOpen: false, address: "Calle 42 # 19-35, Palmira",
    image: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=85",
    tags: ["Motos", "Mantenimiento"], createdAt: "2026-09-15T12:00:00.000Z",
    phone: "+57 000 000 0001", whatsapp: "+57 000 000 0001",
    description: "Mantenimiento general para que sigas tu camino con tranquilidad.",
  },
  {
    id: "tecno-palmira", name: "TecnoPalmira", category: "Tecnología", rating: 4.6,
    reviewCount: 62, distanceKm: 2.0, isOpen: true, address: "Carrera 28 # 35-10, Palmira",
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=900&q=85",
    tags: ["Celulares", "Accesorios"],
    description: "Accesorios y ayuda para mantener conectados tus dispositivos.",
  },
  ...demoBusinesses,
];

// Marca diez negocios de muestra como destacados para probar la sección y su acción "Ver todos".
demoBusinessData.slice(0, 10).forEach((business) => {
  business.isFeatured = true;
  business.plan = "premium";
});

const demoProductData: Product[] = [
  { id: "arepa-queso", businessId: "arepa-majo", name: "Arepa con queso", description: "Arepa de maíz dorada en plancha con queso derretido.", price: 6500, image: demoBusinessData[0].image, createdAt: sampleProductPublished(1), likeCount: 24, isOffer: true, offerLabel: "Oferta", discount: "-20%", offerDeadline: "31 oct." },
  { id: "desayuno-campesino", businessId: "arepa-majo", name: "Desayuno campesino", description: "Arepa, huevos al gusto, bebida caliente y fruta del día.", price: 18000, image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=85", likeCount: 42, isOffer: true, offerLabel: "Oferta", discount: "-15%", offerDeadline: "30 oct." },
  { id: "calentado-campesino", businessId: "arepa-majo", name: "Calentado campesino", description: "Arroz, fríjol, huevo y acompañamiento de la casa para empezar con energía.", price: 16000, image: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=85", likeCount: 16, isOffer: true, offerLabel: "Oferta", discount: "-10%", offerDeadline: "28 oct." },
  { id: "chocolate-con-queso", businessId: "arepa-majo", name: "Chocolate con queso", description: "Chocolate caliente servido con queso y pan recién horneado.", price: 9000, image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=85", likeCount: 60 },
  { id: "arepa-mixta", businessId: "arepa-majo", name: "Arepa mixta de la casa", description: "Arepa dorada con pollo, chorizo y queso, preparada al momento.", price: 14500, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85", likeCount: 35 },
  ...Array.from({ length: 35 }, (_, index) => {
    const number = index + 6;
    const sampleNames = ["Arepa de chocolo", "Huevos pericos", "Arepa paisa", "Jugo natural", "Café de la casa", "Tostadas con aguacate", "Caldo campesino"];
    const sampleImages = [demoBusinessData[0].image, "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=85"];
    return {
      id: `arepa-majo-producto-${number}`,
      businessId: "arepa-majo",
      name: `${sampleNames[index % sampleNames.length]} ${number}`,
      description: "Una opción preparada al momento con el sabor de la casa.",
      price: 7000 + ((index * 1250) % 24000),
      image: sampleImages[index % sampleImages.length],
      likeCount: 10 + ((index * 7) % 28),
    };
  }),
  { id: "vitaminas", businessId: "drogueria-central", name: "Vitaminas y bienestar", description: "Opciones de cuidado diario. Consulta disponibilidad en el establecimiento.", image: demoBusinessData[1].image, createdAt: sampleProductPublished(3) },
  { id: "kit-herramientas", businessId: "casa-tornillo", name: "Kit básico de herramientas", description: "Una selección práctica para pequeñas reparaciones del hogar.", price: 45900, image: demoBusinessData[2].image, createdAt: sampleProductPublished(5) },
  { id: "cera-cabello", businessId: "distrito-23", name: "Cera para peinar", description: "Fijación flexible para completar tu rutina de cuidado.", price: 22000, image: demoBusinessData[3].image },
  { id: "soporte-celular", businessId: "tecno-palmira", name: "Soporte para celular", description: "Soporte ajustable para escritorio y videollamadas.", price: 28000, image: demoBusinessData[5].image, createdAt: sampleProductPublished(7) },
  { id: "combo-cuidado-diario", businessId: "drogueria-central", name: "Combo de cuidado diario", description: "Selección práctica para acompañar tu rutina de cuidado personal.", price: 32000, image: demoBusinessData[1].image, createdAt: sampleProductPublished(1) },
  ...demoProducts,
];

const demoServiceData: Service[] = [
  { id: "mantenimiento-moto", businessId: "moto-express", name: "Mantenimiento general de moto", description: "Revisión básica de puntos esenciales y recomendaciones para tu moto.", priceLabel: "Cotiza en el taller", image: demoBusinessData[4].image },
  { id: "cambio-aceite", businessId: "moto-express", name: "Cambio de aceite", description: "Servicio de cambio de aceite con revisión visual de rutina.", image: demoBusinessData[4].image },
  { id: "corte-clasico", businessId: "distrito-23", name: "Corte clásico", description: "Corte personalizado con asesoría según tu estilo.", priceLabel: "Desde $25.000", image: demoBusinessData[3].image },
  { id: "barba", businessId: "distrito-23", name: "Arreglo de barba", description: "Perfilado y cuidado para mantener tu estilo.", priceLabel: "Desde $18.000", image: demoBusinessData[3].image },
  { id: "diagnostico-celular", businessId: "tecno-palmira", name: "Diagnóstico de celular", description: "Revisión inicial del equipo para identificar qué puede estar pasando.", priceLabel: "Consulta disponibilidad", image: demoBusinessData[5].image },
  { id: "asesoria-ferretera", businessId: "casa-tornillo", name: "Asesoría para tu proyecto", description: "Orientación para elegir herramientas y materiales adecuados.", image: demoBusinessData[2].image },
  ...Array.from({ length: 40 }, (_, index) => ({
    id: `arepa-majo-servicio-${index + 7}`,
    businessId: "arepa-majo",
    name: ["Desayuno para llevar", "Servicio de domicilio", "Catering para eventos", "Menú personalizado", "Reserva de mesa", "Combo familiar"][index % 6] + ` ${index + 7}`,
    description: "Una atención cercana y preparada según lo que necesitas.",
    priceLabel: index % 3 === 0 ? "Desde $12.000" : "Consulta disponibilidad",
    image: [demoBusinessData[0].image, "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=85"][index % 3],
    likeCount: 8 + ((index * 5) % 26),
    ...(index < 3 ? { isOffer: true, offerLabel: "Oferta", discount: index === 0 ? "-20%" : index === 1 ? "-15%" : "-10%", offerDeadline: index === 0 ? "31 oct." : index === 1 ? "30 oct." : "28 oct." } : {}),
  })),
  ...demoServices,
];

const E2E_REAL_ONLY = import.meta.env.VITE_E2E_REAL_ONLY === "true";
export const businesses: Business[] = E2E_REAL_ONLY ? [] : demoBusinessData;
export const products: Product[] = E2E_REAL_ONLY ? [] : demoProductData;
export const services: Service[] = E2E_REAL_ONLY ? [] : demoServiceData;

export const reviews: Review[] = [
  { id: "review-arepa-1", businessId: "arepa-majo", author: "Mariana G.", rating: 5, date: "2026-08-14", comment: "La arepa estaba recién hecha y la atención fue muy querida." },
  { id: "review-arepa-2", businessId: "arepa-majo", author: "Julián R.", rating: 4, date: "2026-07-28", comment: "Buen desayuno y porciones generosas. Volvería." },
  { id: "review-barber-1", businessId: "distrito-23", author: "Andrés P.", rating: 5, date: "2026-08-20", comment: "Me gustó el resultado y fueron puntuales." },
  { id: "review-tools-1", businessId: "casa-tornillo", author: "Camilo T.", rating: 4, date: "2026-06-18", comment: "Me orientaron para encontrar justo la herramienta que necesitaba." },
  { id: "review-tech-1", businessId: "tecno-palmira", author: "Laura M.", rating: 5, date: "2026-08-04", comment: "Encontré el accesorio que buscaba y me ayudaron a instalarlo." },
];

// Datos de muestra para previsualizar un catálogo activo mientras llega el backend.
products.forEach((product, index) => { product.likeCount = product.likeCount ?? 18 + ((index * 13) % 74); });
services.forEach((service, index) => { service.likeCount = service.likeCount ?? 12 + ((index * 17) % 58); });
businesses.forEach((business, index) => {
  const existing = reviews.filter((review) => review.businessId === business.id);
  if (existing.length === 0) {
    reviews.push(
      { id: `sample-${business.id}-1`, businessId: business.id, author: "Valentina M.", rating: 4 + (index % 2), date: "2026-09-18", comment: "Buena atención y una experiencia que volvería a repetir." },
      { id: `sample-${business.id}-2`, businessId: business.id, author: "Santiago R.", rating: 4, date: "2026-09-09", comment: "Encontré lo que necesitaba y me atendieron con amabilidad." },
    );
  }
  const businessReviews = reviews.filter((review) => review.businessId === business.id);
  business.reviewCount = Math.max(business.reviewCount, businessReviews.length + 24 + (index % 40));
  business.rating = Number((businessReviews.reduce((sum, review) => sum + review.rating, 0) / businessReviews.length).toFixed(1));
});

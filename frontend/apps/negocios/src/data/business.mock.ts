import type { BusinessAccount, BusinessDetails, BusinessNotification, CatalogItem, Preferences } from "../types/business";

// Contenido ficticio para explorar la interfaz. No representa un negocio real.
export const initialBusiness: BusinessDetails = {
  name: "Café del Barrio",
  category: "Café y repostería",
  description: "Un rincón para disfrutar café de origen, repostería artesanal y buenos momentos en el corazón del barrio.",
  city: "Bogotá",
  address: "Calle 45 # 12-34, Chapinero",
  phone: "+57 601 555 0142",
  whatsapp: "+57 300 555 0142",
  email: "hola@cafedelbarrio.example",
  website: "cafedelbarrio.example",
  instagram: "@cafedelbarrio.demo",
  hours: "Lun–Vie 8:00 a. m.–7:00 p. m. · Sáb–Dom 9:00 a. m.–6:00 p. m.",
  status: "Verificado",
};

export const initialBusinesses: BusinessDetails[] = [
  { ...initialBusiness, name: "La Arepería de Majo", category: "Restaurantes", description: "Arepas hechas al momento y sabores de casa para empezar bien el día.", city: "Palmira", address: "Calle 30 # 28-16, Palmira", coverImage: "https://images.unsplash.com/photo-1598214886806-c87b84b7078b?auto=format&fit=crop&w=900&q=85", rating: 4.8, reviewCount: 126, tags: ["Comida típica", "Desayunos"], isOpen: true, phone: "+57 000 000 0003", whatsapp: "+57 000 000 0003", email: "", website: "", instagram: "", hours: "", status: "Verificado" },
  { ...initialBusiness, name: "Droguería San Jorge", category: "Droguerías", description: "Un lugar cercano para encontrar productos de cuidado personal y bienestar.", city: "Palmira", address: "Carrera 29 # 31-42, Palmira", coverImage: "https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=900&q=85", tags: ["Salud", "Cuidado personal"], isOpen: true, status: "Verificado" },
  { ...initialBusiness, name: "Casa del Tornillo", category: "Ferreterías", description: "Herramientas y soluciones para esos arreglos que tienes pendientes.", city: "Palmira", address: "Calle 32 # 25-08, Palmira", coverImage: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=900&q=85", tags: ["Herramientas", "Construcción"], isOpen: true, status: "Pendiente" },
];

export const initialAccount: BusinessAccount = {
  name: "Mariana Castillo",
  email: "mariana@cafedelbarrio.example",
  phone: "+57 300 555 0198",
  role: "Propietaria",
};

export const initialItems: CatalogItem[] = [
  { id: "p1", kind: "product", name: "Capuchino de vainilla", category: "Bebidas calientes", description: "Espresso con leche cremosa y un toque de vainilla.", price: "$12.000", image: "☕", active: true, interest: 86 },
  { id: "p2", kind: "product", name: "Croissant de almendras", category: "Repostería", description: "Hojaldre artesanal con crema y almendras tostadas.", price: "$11.500", image: "🥐", active: true, interest: 73 },
  { id: "p3", kind: "product", name: "Cold brew", category: "Bebidas frías", description: "Café infusionado lentamente y servido frío.", price: "$10.000", image: "🧊", active: true, interest: 61 },
  { id: "p4", kind: "product", name: "Torta de zanahoria", category: "Repostería", description: "Porción de torta con especias y crema suave.", price: "$14.000", image: "🍰", active: false, interest: 24 },
  { id: "s1", kind: "service", name: "Espacio para trabajar", category: "Experiencias", description: "Mesas cómodas, wifi y enchufes para trabajar con calma.", price: "", image: "💻", active: true, interest: 67 },
  { id: "s2", kind: "service", name: "Catering para eventos", category: "Servicios", description: "Bebidas y repostería para reuniones y eventos pequeños.", price: "Desde $80.000", image: "✨", active: true, interest: 49 },
  { id: "s3", kind: "service", name: "Pedidos para recoger", category: "Servicios", description: "Preparamos tu selección para que la recojas en el local.", price: "", image: "🛍️", active: false, interest: 38 },
];

export const businessCatalog: Record<string, CatalogItem[]> = {
  "La Arepería de Majo": [
    { id: "majo-p1", kind: "product", name: "Arepa con queso", category: "Productos", description: "Arepa de maíz dorada en plancha con queso derretido.", price: "$6.500", image: "🫓", active: true, interest: 86 },
    { id: "majo-p2", kind: "product", name: "Desayuno campesino", category: "Productos", description: "Arepa, huevos al gusto, bebida caliente y fruta del día.", price: "$18.000", image: "🍳", active: true, interest: 73 },
  ],
  "Droguería San Jorge": [
    { id: "san-p1", kind: "product", name: "Protector solar SPF 50", category: "Cuidado personal", description: "Protección solar para uso diario.", price: "$32.000", image: "🧴", active: true, interest: 76 },
    { id: "san-p2", kind: "product", name: "Complejo vitamínico", category: "Bienestar", description: "Vitaminas para complementar tu rutina diaria.", price: "$28.000", image: "💊", active: true, interest: 62 },
    { id: "san-s1", kind: "service", name: "Domicilios en Palmira", category: "Servicios", description: "Llevamos tus productos hasta tu casa.", price: "", image: "🛵", active: true, interest: 70 },
  ],
  "Casa del Tornillo": [
    { id: "tor-p1", kind: "product", name: "Kit de herramientas básico", category: "Herramientas", description: "Todo lo esencial para reparaciones en casa.", price: "$65.000", image: "🧰", active: true, interest: 74 },
    { id: "tor-p2", kind: "product", name: "Tornillos surtidos", category: "Ferretería", description: "Caja con tornillos para diferentes proyectos.", price: "$18.000", image: "🔩", active: true, interest: 59 },
    { id: "tor-s1", kind: "service", name: "Asesoría para proyectos", category: "Servicios", description: "Te ayudamos a elegir materiales y herramientas.", price: "", image: "🔧", active: true, interest: 66 },
  ],
};

export const reviews = [
  { id: "r1", author: "Laura P.", date: "1 oct 2026", rating: 5, text: "El café es delicioso y el lugar se siente muy acogedor. Volveré por el croissant.", item: "Experiencia general" },
  { id: "r2", author: "Andrés M.", date: "28 sep 2026", rating: 5, text: "Buen espacio para trabajar un par de horas. Atención amable y wifi estable.", item: "Espacio para trabajar" },
  { id: "r3", author: "Valentina R.", date: "20 sep 2026", rating: 4, text: "Me gustó mucho el cold brew. Había bastante gente, pero el servicio fue rápido.", item: "Cold brew" },
  { id: "r4", author: "Usuario de WIT", date: "14 sep 2026", rating: 5, text: "Muy buena repostería y fácil de encontrar.", item: "Experiencia general" },
];

export const businessReviews = {
  "La Arepería de Majo": [
    { id: "review-arepa-1", author: "Mariana G.", date: "14 ago 2026", rating: 5, text: "La arepa estaba recién hecha y la atención fue muy querida.", item: "Experiencia general" },
    { id: "review-arepa-2", author: "Julián R.", date: "28 jul 2026", rating: 4, text: "Buen desayuno y porciones generosas. Volvería.", item: "Desayuno campesino" },
  ],
  "Droguería San Jorge": [
    { id: "san-r1", author: "Camila G.", date: "30 sep 2026", rating: 5, text: "Encontré todo lo que necesitaba y me atendieron muy bien.", item: "Experiencia general" },
    { id: "san-r2", author: "Julián T.", date: "22 sep 2026", rating: 4, text: "Buenos precios y servicio rápido.", item: "Domicilios en Palmira" },
  ],
  "Casa del Tornillo": [
    { id: "tor-r1", author: "Mauricio L.", date: "26 sep 2026", rating: 5, text: "Me asesoraron muy bien para arreglar la puerta de la casa.", item: "Asesoría para proyectos" },
  ],
} as const;

export const initialNotifications: BusinessNotification[] = [
  { id: "n1", title: "Recibiste una nueva opinión", description: "Laura P. compartió su experiencia con tu negocio.", date: "Hoy · 9:42 a. m.", type: "review", read: false },
  { id: "n2", title: "Tu capuchino está llamando la atención", description: "Este producto recibió más interés durante la última semana.", date: "Ayer · 4:18 p. m.", type: "interest", read: false },
  { id: "n3", title: "Completa la información de tu perfil", description: "Añade más fotos y detalles para ayudar a tus clientes.", date: "30 sep · 11:05 a. m.", type: "profile", read: false },
  { id: "n4", title: "Tu negocio está verificado", description: "Tu establecimiento aparece en las búsquedas de WIT.", date: "22 sep · 8:00 a. m.", type: "wit", read: true },
  { id: "n5", title: "Mensaje del equipo WIT", description: "Recuerda mantener actualizados tus horarios para que tus clientes encuentren información confiable.", date: "18 sep · 10:30 a. m.", type: "admin", read: true },
  { id: "n6", title: "Nueva oportunidad para tu negocio", description: "Tu perfil puede destacar más si agregas una descripción y fotografías de tus productos.", date: "15 sep · 2:15 p. m.", type: "offer", read: true },
  { id: "n7", title: "Tu contraseña se actualizó", description: "La contraseña de tu cuenta fue actualizada correctamente.", date: "10 sep · 8:05 a. m.", type: "security", read: true },
];

export const initialPreferences: Preferences = { emailUpdates: true, reviewAlerts: true, interestAlerts: true, profileVisible: true, visibilityUntil: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString() };

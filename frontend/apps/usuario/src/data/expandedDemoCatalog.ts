import type { Business, Product, Service } from "./mockData";

type DemoSeed = {
  id: string;
  name: string;
  category: string;
  tags: [string, string];
  description: string;
  sector: string;
};

type ProductSeed = { kind: "product"; name: string; description: string; price: number };
type ServiceSeed = { kind: "service"; name: string; description: string; priceLabel: string };
type OfferSeed = ProductSeed | ServiceSeed;

const seeds: DemoSeed[] = [
  { id: "cafe-vuelta-parque", name: "Café Vuelta al Parque", category: "Cafeterías", tags: ["Café de origen", "Desayunos"], description: "Café colombiano, desayunos y algo rico para acompañar la tarde.", sector: "Centro" },
  { id: "horno-abuelita", name: "Horno de la Abuela", category: "Panaderías y reposterías", tags: ["Pan artesanal", "Postres"], description: "Pan recién horneado, tortas y antojos preparados cada día.", sector: "Las Flores" },
  { id: "mercadito-veintiocho", name: "Mercadito La 28", category: "Supermercados y tiendas", tags: ["Mercado", "Domicilios"], description: "Productos de la canasta familiar y compras rápidas para el hogar.", sector: "Centro" },
  { id: "frutas-el-sol", name: "Frutas El Sol", category: "Frutas y verduras", tags: ["Fruta fresca", "Verduras"], description: "Frutas y verduras seleccionadas para llevar frescas a casa.", sector: "La Emilia" },
  { id: "carnes-don-lucho", name: "Carnes Don Lucho", category: "Carnicerías y pescaderías", tags: ["Carnes", "Cortes frescos"], description: "Cortes para el almuerzo y opciones listas para tu próxima parrillada.", sector: "El Prado" },
  { id: "raiz-vital", name: "Raíz Vital", category: "Salud y bienestar", tags: ["Bienestar", "Asesoría"], description: "Acompañamiento y productos para cuidar tus hábitos de bienestar.", sector: "Centro" },
  { id: "centro-medico-armonia", name: "Centro Médico Armonía", category: "Clínicas y consultorios", tags: ["Consulta general", "Salud"], description: "Consultas y orientación para el cuidado integral de la familia.", sector: "Las Delicias" },
  { id: "optica-punto-claro", name: "Óptica Punto Claro", category: "Ópticas", tags: ["Salud visual", "Gafas"], description: "Asesoría en salud visual y monturas para distintos estilos.", sector: "Centro" },
  { id: "luna-estudio-belleza", name: "Luna Estudio de Belleza", category: "Peluquerías y belleza", tags: ["Peluquería", "Color"], description: "Cortes, peinados y color con atención personalizada.", sector: "El Prado" },
  { id: "ropas-urbana", name: "Urbana Ropa y Calzado", category: "Ropa y calzado", tags: ["Moda", "Calzado"], description: "Prendas y calzado para acompañarte en el día a día.", sector: "Centro" },
  { id: "casa-oliva", name: "Casa Oliva Decoración", category: "Hogar y decoración", tags: ["Decoración", "Hogar"], description: "Detalles y objetos para darle un toque propio a tus espacios.", sector: "La Emilia" },
  { id: "obra-lista", name: "Obra Lista", category: "Construcción y remodelación", tags: ["Remodelación", "Acabados"], description: "Asesoría y apoyo para renovar espacios y avanzar tus proyectos.", sector: "Las Mercedes" },
  { id: "repuestos-el-piston", name: "Repuestos El Pistón", category: "Repuestos y accesorios", tags: ["Motos", "Repuestos"], description: "Repuestos y accesorios para mantener tu moto en buen estado.", sector: "Colombia" },
  { id: "lavanderia-espuma", name: "Lavandería Espuma", category: "Lavanderías y tintorerías", tags: ["Lavado", "Cuidado de prendas"], description: "Lavado y cuidado de prendas para resolver tu semana.", sector: "Centro" },
  { id: "mundo-animal", name: "Mundo Animal Palmira", category: "Mascotas y veterinarias", tags: ["Mascotas", "Veterinaria"], description: "Productos y cuidados para que tus compañeros estén bien.", sector: "El Prado" },
  { id: "papel-tinta", name: "Papel y Tinta", category: "Papelerías y librerías", tags: ["Papelería", "Libros"], description: "Útiles, materiales creativos y lecturas para todas las edades.", sector: "Centro" },
  { id: "ingles-al-dia", name: "Inglés al Día", category: "Educación y cursos", tags: ["Idiomas", "Clases"], description: "Clases prácticas para aprender a tu ritmo y ganar confianza.", sector: "Las Flores" },
  { id: "activa-fitness", name: "Activa Fitness", category: "Deportes y recreación", tags: ["Entrenamiento", "Deporte"], description: "Entrenamiento y actividades para moverte y sentirte mejor.", sector: "Sesquicentenario" },
  { id: "taxi-palmira-express", name: "Palmira Express", category: "Transporte y movilidad", tags: ["Transporte", "Traslados"], description: "Traslados urbanos y servicios de transporte bajo solicitud.", sector: "Centro" },
  { id: "manos-a-casa", name: "Manos a la Casa", category: "Servicios para el hogar", tags: ["Hogar", "Mantenimiento"], description: "Ayuda práctica con tareas y arreglos cotidianos del hogar.", sector: "Las Mercedes" },
  { id: "tecni-hogar", name: "TecniHogar", category: "Servicios técnicos", tags: ["Reparación", "Electrodomésticos"], description: "Diagnóstico y mantenimiento de equipos para el hogar.", sector: "La Emilia" },
  { id: "contable-claro", name: "Contable Claro", category: "Servicios profesionales", tags: ["Contabilidad", "Asesoría"], description: "Orientación contable para personas independientes y pequeños negocios.", sector: "Centro" },
  { id: "flores-de-abril", name: "Flores de Abril", category: "Floristerías y regalos", tags: ["Flores", "Detalles"], description: "Arreglos florales y detalles para celebrar momentos especiales.", sector: "El Prado" },
  { id: "hotel-guaduales", name: "Hotel Los Guaduales", category: "Hoteles y turismo", tags: ["Hospedaje", "Turismo"], description: "Un lugar tranquilo para descansar y conocer la zona.", sector: "Las Delicias" },
  { id: "estacion-cultural", name: "La Estación Cultural", category: "Eventos y entretenimiento", tags: ["Eventos", "Música"], description: "Un espacio para encuentros, música y actividades culturales.", sector: "Centro" },
  { id: "esencia-cuidado", name: "Esencia Cuidado Personal", category: "Belleza y cuidado personal", tags: ["Cuidado personal", "Belleza"], description: "Productos y servicios para acompañar tus rutinas de cuidado.", sector: "Las Flores" },
  { id: "sazon-treinta", name: "Sazón de la 30", category: "Restaurantes", tags: ["Almuerzos", "Comida casera"], description: "Platos caseros y almuerzos preparados con sabores del Valle.", sector: "Centro" },
  { id: "farmacia-treinta-tres", name: "Farmacia La 33", category: "Droguerías", tags: ["Cuidado personal", "Bienestar"], description: "Productos de cuidado personal y artículos para el bienestar diario.", sector: "El Prado" },
  { id: "ferreteria-martillo", name: "Ferretería El Martillo", category: "Ferreterías", tags: ["Herramientas", "Materiales"], description: "Herramientas y materiales para reparaciones y proyectos en casa.", sector: "Las Mercedes" },
  { id: "rodar-motos", name: "Rodar Taller de Motos", category: "Talleres", tags: ["Motos", "Mecánica"], description: "Mecánica y mantenimiento para que tu moto siga rodando.", sector: "Colombia" },
  { id: "barberia-plaza", name: "Barbería La Plaza", category: "Barberías", tags: ["Corte", "Barba"], description: "Cortes clásicos y actuales en un ambiente relajado.", sector: "Centro" },
  { id: "tecno-accesorios", name: "Tecno Accesorios", category: "Tecnología", tags: ["Celulares", "Accesorios"], description: "Accesorios y soluciones para tus dispositivos y equipos.", sector: "Centro" },
  { id: "pan-canela", name: "Pan y Canela", category: "Panaderías y reposterías", tags: ["Repostería", "Pan fresco"], description: "Postres, galletas y pan para compartir en cualquier momento.", sector: "La Emilia" },
  { id: "delicias-catorce", name: "Delicias de la 14", category: "Restaurantes", tags: ["Comida rápida", "Hamburguesas"], description: "Comidas rápidas preparadas al momento para compartir.", sector: "Las Flores" },
  { id: "paella-valle", name: "Sabores del Valle", category: "Restaurantes", tags: ["Cocina vallecaucana", "Almuerzos"], description: "Recetas de la región y platos para disfrutar sin afán.", sector: "Sesquicentenario" },
  { id: "botica-vida", name: "Botica Vida", category: "Droguerías", tags: ["Droguería", "Salud"], description: "Artículos de cuidado diario y productos para el hogar.", sector: "La Emilia" },
  { id: "parrilla-latitud", name: "Parrilla Latitud", category: "Restaurantes", tags: ["Parrilla", "Cenas"], description: "Carnes a la parrilla y acompañamientos para una buena comida.", sector: "Las Delicias" },
  { id: "papeleria-grafito", name: "Papelería Grafito", category: "Papelerías y librerías", tags: ["Impresiones", "Útiles escolares"], description: "Útiles, impresiones y materiales para estudiar o trabajar.", sector: "Las Mercedes" },
  { id: "veterinaria-huellas", name: "Veterinaria Huellas", category: "Mascotas y veterinarias", tags: ["Veterinaria", "Consulta"], description: "Atención veterinaria y recomendaciones para el cuidado de tu mascota.", sector: "El Prado" },
  { id: "nails-studio", name: "Nails Studio Palmira", category: "Belleza y cuidado personal", tags: ["Manicure", "Cuidado de uñas"], description: "Manicure, pedicure y cuidado de uñas con cita previa.", sector: "Centro" },
  { id: "tecnologia-smart", name: "Smart Punto Tech", category: "Tecnología", tags: ["Tecnología", "Reparaciones"], description: "Accesorios, configuración y ayuda técnica para celulares.", sector: "Las Flores" },
  { id: "floristeria-azucena", name: "Floristería Azucena", category: "Floristerías y regalos", tags: ["Ramos", "Regalos"], description: "Ramos y detalles armados para cumpleaños y ocasiones especiales.", sector: "La Emilia" },
  { id: "costuras-parque", name: "Costuras del Parque", category: "Ropa y calzado", tags: ["Arreglos", "Confección"], description: "Ajustes y arreglos para que tus prendas queden como te gustan.", sector: "Centro" },
  { id: "consultorio-sonrisa", name: "Consultorio Sonrisa", category: "Clínicas y consultorios", tags: ["Odontología", "Salud oral"], description: "Valoración y cuidado oral con atención cercana y personalizada.", sector: "Las Delicias" },
];

const categoryImages: Record<string, string> = {
  "Restaurantes": "photo-1555939594-58d7cb561ad1",
  "Droguerías": "photo-1576602976047-174e57a47881",
  "Ferreterías": "photo-1581244277943-fe4a9c777189",
  "Talleres": "photo-1558981806-ec527fa84c39",
  "Barberías": "photo-1503951914875-452162b0f3f1",
  "Tecnología": "photo-1531297484001-80022131f5a1",
  "Cafeterías": "photo-1501339847302-ac426a4a7cbb",
  "Panaderías y reposterías": "photo-1509440159596-0249088772ff",
  "Supermercados y tiendas": "photo-1542838132-92c53300491e",
  "Frutas y verduras": "photo-1610832958506-aa56368176cf",
  "Carnicerías y pescaderías": "photo-1607623814075-e51df1bdc82f",
  "Salud y bienestar": "photo-1505751172876-fa1923c5c528",
  "Clínicas y consultorios": "photo-1519494026892-80bbd2d6fd0d",
  "Ópticas": "photo-1511499767150-a48a237f0083",
  "Peluquerías y belleza": "photo-1560066984-138dadb4c035",
  "Ropa y calzado": "photo-1483985988355-763728e1935b",
  "Hogar y decoración": "photo-1616486338812-3dadae4b4ace",
  "Construcción y remodelación": "photo-1504307651254-35680f356dfd",
  "Repuestos y accesorios": "photo-1486262715619-67b85e0b08d3",
  "Lavanderías y tintorerías": "photo-1517677208171-0bc6725a3e60",
  "Mascotas y veterinarias": "photo-1548199973-03cce0bbc87b",
  "Papelerías y librerías": "photo-1507842217343-583bb7270b66",
  "Educación y cursos": "photo-1503676260728-1c00da094a0b",
  "Deportes y recreación": "photo-1534438327276-14e5300c3a48",
  "Transporte y movilidad": "photo-1549317661-bd32c8ce0db2",
  "Servicios para el hogar": "photo-1581578731548-c64695cc6952",
  "Servicios técnicos": "photo-1518770660439-4636190af475",
  "Servicios profesionales": "photo-1454165804606-c3d57bc86b40",
  "Floristerías y regalos": "photo-1490750967868-88aa4486c946",
  "Hoteles y turismo": "photo-1566073771259-6a8506099945",
  "Eventos y entretenimiento": "photo-1492684223066-81342ee5ff30",
  "Belleza y cuidado personal": "photo-1596462502278-27bfdc403348",
};

const offerCatalog: Record<string, OfferSeed[]> = {
  "Restaurantes": [
    { kind: "product", name: "Plato recomendado del día", description: "Una preparación de la casa con ingredientes frescos y acompañamiento.", price: 18900 },
    { kind: "product", name: "Combo para compartir", description: "Una combinación de sabores preparada al momento para disfrutar juntos.", price: 27900 },
    { kind: "product", name: "Menú ejecutivo", description: "Plato principal, acompañamiento y bebida para el almuerzo.", price: 16500 },
  ],
  "Droguerías": [
    { kind: "product", name: "Kit de cuidado diario", description: "Productos básicos para complementar tu rutina de cuidado personal.", price: 24900 },
    { kind: "product", name: "Protección solar", description: "Protector solar para el cuidado diario de la piel.", price: 32900 },
  ],
  "Ferreterías": [
    { kind: "product", name: "Kit de herramientas para el hogar", description: "Herramientas esenciales para arreglos y proyectos pequeños.", price: 54900 },
    { kind: "product", name: "Taladro inalámbrico", description: "Herramienta práctica para trabajos de instalación y reparación.", price: 189900 },
  ],
  "Talleres": [
    { kind: "service", name: "Diagnóstico preventivo", description: "Revisión de puntos esenciales y recomendaciones de mantenimiento.", priceLabel: "Cotiza en el taller" },
    { kind: "service", name: "Cambio de aceite", description: "Cambio de aceite con revisión general del vehículo.", priceLabel: "Desde $45.000" },
  ],
  "Barberías": [
    { kind: "service", name: "Corte clásico", description: "Corte personalizado con asesoría según el estilo que buscas.", priceLabel: "Desde $22.000" },
    { kind: "service", name: "Corte y arreglo de barba", description: "Cuidado de barba y cabello en una sola cita.", priceLabel: "Desde $35.000" },
  ],
  "Tecnología": [
    { kind: "product", name: "Cargador de carga rápida", description: "Cargador compatible con diferentes modelos de celular.", price: 39900 },
    { kind: "service", name: "Diagnóstico de celular", description: "Revisión inicial para identificar posibles fallas del dispositivo.", priceLabel: "Consulta disponibilidad" },
  ],
  "Cafeterías": [
    { kind: "product", name: "Café filtrado de origen", description: "Café colombiano preparado al momento con método filtrado.", price: 8500 },
    { kind: "product", name: "Café y repostería", description: "Bebida caliente acompañada de una porción de repostería.", price: 14500 },
  ],
  "Panaderías y reposterías": [
    { kind: "product", name: "Caja de pan artesanal", description: "Selección de panes horneados durante el día.", price: 18000 },
    { kind: "product", name: "Torta para compartir", description: "Torta de la casa para reuniones y celebraciones.", price: 52000 },
  ],
  "Supermercados y tiendas": [
    { kind: "product", name: "Mercado básico", description: "Selección de productos esenciales para la despensa del hogar.", price: 69900 },
    { kind: "product", name: "Canasta de frutas", description: "Frutas de temporada seleccionadas para la semana.", price: 24900 },
  ],
  "Frutas y verduras": [
    { kind: "product", name: "Canasta de temporada", description: "Frutas frescas variadas según disponibilidad del día.", price: 22000 },
    { kind: "product", name: "Combo para jugos", description: "Selección de frutas para preparar jugos en casa.", price: 15900 },
  ],
  "Carnicerías y pescaderías": [
    { kind: "product", name: "Combo para asar", description: "Cortes seleccionados para una parrillada en casa.", price: 45900 },
    { kind: "product", name: "Corte de res del día", description: "Corte fresco preparado según la cantidad que necesitas.", price: 23900 },
  ],
  "Salud y bienestar": [
    { kind: "service", name: "Asesoría de bienestar", description: "Orientación inicial para revisar hábitos y objetivos personales.", priceLabel: "Agenda tu consulta" },
    { kind: "product", name: "Paquete de bienestar", description: "Selección de productos para acompañar una rutina saludable.", price: 38900 },
  ],
  "Clínicas y consultorios": [
    { kind: "service", name: "Consulta de valoración", description: "Primera consulta para escuchar tus necesidades y orientar los siguientes pasos.", priceLabel: "Consulta disponibilidad" },
    { kind: "service", name: "Control de seguimiento", description: "Espacio de seguimiento con cita previamente agendada.", priceLabel: "Agenda tu cita" },
  ],
  "Ópticas": [
    { kind: "service", name: "Valoración visual", description: "Orientación inicial sobre salud visual y necesidades de corrección.", priceLabel: "Consulta disponibilidad" },
    { kind: "product", name: "Montura clásica", description: "Montura liviana en diferentes estilos y colores.", price: 119900 },
  ],
  "Peluquerías y belleza": [
    { kind: "service", name: "Corte y peinado", description: "Corte personalizado y peinado según el estilo que buscas.", priceLabel: "Desde $35.000" },
    { kind: "service", name: "Coloración", description: "Asesoría de color y aplicación según disponibilidad.", priceLabel: "Cotiza en el salón" },
  ],
  "Ropa y calzado": [
    { kind: "product", name: "Camiseta de temporada", description: "Prenda casual disponible en varios colores y tallas.", price: 49900 },
    { kind: "service", name: "Ajuste de prendas", description: "Arreglos básicos para que tus prendas queden a tu medida.", priceLabel: "Cotiza en el local" },
  ],
  "Hogar y decoración": [
    { kind: "product", name: "Lámpara decorativa", description: "Iluminación cálida para darle personalidad a tus espacios.", price: 89900 },
    { kind: "product", name: "Set de decoración", description: "Detalles para renovar una mesa, repisa o espacio especial.", price: 62900 },
  ],
  "Construcción y remodelación": [
    { kind: "service", name: "Asesoría de remodelación", description: "Revisión inicial del proyecto y orientación sobre los siguientes pasos.", priceLabel: "Agenda una visita" },
    { kind: "service", name: "Instalación de acabados", description: "Instalación de acabados para espacios residenciales y comerciales.", priceLabel: "Cotiza tu proyecto" },
  ],
  "Repuestos y accesorios": [
    { kind: "product", name: "Kit de mantenimiento", description: "Elementos básicos para el mantenimiento periódico de tu vehículo.", price: 65900 },
    { kind: "product", name: "Casco urbano", description: "Casco para recorridos urbanos en diferentes tallas.", price: 149900 },
  ],
  "Lavanderías y tintorerías": [
    { kind: "service", name: "Lavado por carga", description: "Lavado y secado de prendas de uso diario.", priceLabel: "Desde $18.000" },
    { kind: "service", name: "Cuidado de prendas delicadas", description: "Tratamiento y cuidado especial según el tipo de prenda.", priceLabel: "Cotiza en el local" },
  ],
  "Mascotas y veterinarias": [
    { kind: "service", name: "Consulta veterinaria", description: "Valoración general para revisar la salud de tu mascota.", priceLabel: "Agenda tu consulta" },
    { kind: "product", name: "Kit de paseo", description: "Accesorios básicos para salir cómodamente con tu mascota.", price: 42900 },
  ],
  "Papelerías y librerías": [
    { kind: "product", name: "Kit escolar", description: "Útiles esenciales para empezar clases o reponer materiales.", price: 28900 },
    { kind: "product", name: "Cuaderno de notas", description: "Cuaderno para organizar ideas, tareas y proyectos.", price: 12900 },
  ],
  "Educación y cursos": [
    { kind: "service", name: "Clase de prueba", description: "Sesión inicial para conocer la metodología y resolver tus dudas.", priceLabel: "Consulta horarios" },
    { kind: "service", name: "Curso de inglés básico", description: "Clases prácticas para fortalecer vocabulario y conversación.", priceLabel: "Pregunta por los grupos" },
  ],
  "Deportes y recreación": [
    { kind: "service", name: "Plan de entrenamiento", description: "Rutina guiada de acuerdo con tus objetivos y nivel.", priceLabel: "Consulta los planes" },
    { kind: "service", name: "Clase grupal", description: "Actividad guiada para entrenar y compartir en grupo.", priceLabel: "Reserva tu cupo" },
  ],
  "Transporte y movilidad": [
    { kind: "service", name: "Traslado urbano", description: "Servicio de transporte dentro de la ciudad bajo solicitud.", priceLabel: "Cotiza tu recorrido" },
    { kind: "service", name: "Transporte programado", description: "Coordina con anticipación la hora y el lugar de recogida.", priceLabel: "Reserva tu traslado" },
  ],
  "Servicios para el hogar": [
    { kind: "service", name: "Limpieza por horas", description: "Apoyo para limpieza y organización de espacios del hogar.", priceLabel: "Cotiza según el espacio" },
    { kind: "service", name: "Instalaciones menores", description: "Ayuda con instalaciones y arreglos sencillos en casa.", priceLabel: "Agenda una visita" },
  ],
  "Servicios técnicos": [
    { kind: "service", name: "Diagnóstico técnico", description: "Revisión inicial del equipo para identificar posibles fallas.", priceLabel: "Consulta disponibilidad" },
    { kind: "service", name: "Mantenimiento preventivo", description: "Limpieza y revisión de funcionamiento de equipos.", priceLabel: "Cotiza el servicio" },
  ],
  "Servicios profesionales": [
    { kind: "service", name: "Asesoría inicial", description: "Espacio para revisar tu caso y definir una ruta de trabajo.", priceLabel: "Agenda una consulta" },
    { kind: "service", name: "Acompañamiento mensual", description: "Apoyo profesional periódico para organizar tus necesidades.", priceLabel: "Solicita una cotización" },
  ],
  "Floristerías y regalos": [
    { kind: "product", name: "Ramo de temporada", description: "Arreglo con flores frescas disponible según temporada.", price: 59900 },
    { kind: "product", name: "Caja de regalo", description: "Detalle preparado para cumpleaños y ocasiones especiales.", price: 74900 },
  ],
  "Hoteles y turismo": [
    { kind: "service", name: "Noche de hospedaje", description: "Habitación para una o dos personas, sujeto a disponibilidad.", priceLabel: "Consulta fechas" },
    { kind: "service", name: "Plan de fin de semana", description: "Opciones de alojamiento para una escapada en la región.", priceLabel: "Pregunta por disponibilidad" },
  ],
  "Eventos y entretenimiento": [
    { kind: "service", name: "Alquiler de espacio", description: "Espacio para reuniones y celebraciones de distintos tamaños.", priceLabel: "Cotiza tu evento" },
    { kind: "service", name: "Paquete de sonido", description: "Apoyo de sonido para encuentros y eventos privados.", priceLabel: "Solicita una cotización" },
  ],
  "Belleza y cuidado personal": [
    { kind: "product", name: "Set de cuidado personal", description: "Productos seleccionados para acompañar tu rutina diaria.", price: 36900 },
    { kind: "service", name: "Manicure tradicional", description: "Cuidado y arreglo de uñas con cita previa.", priceLabel: "Desde $28.000" },
  ],
};

const premiumSeedIndexes = new Set([2, 9, 16, 23, 30, 37, 43]);
const newSeedDates = new Map<number, string>([
  [4, "2026-09-29T12:00:00.000Z"], [11, "2026-09-26T12:00:00.000Z"],
  [18, "2026-09-23T12:00:00.000Z"], [25, "2026-09-20T12:00:00.000Z"],
  [32, "2026-09-17T12:00:00.000Z"], [39, "2026-09-14T12:00:00.000Z"],
]);
// Invalid demo numbers keep the contact controls visible without reaching real people.
const demoContacts: Record<string, Pick<Business, "phone" | "whatsapp">> = {
  "ropas-urbana": { phone: "+57 000 000 0002", whatsapp: "+57 000 000 0002" },
};
const streetTypes = ["Calle", "Carrera", "Avenida"];

export const demoBusinesses: Business[] = seeds.map((seed, index) => {
  const plan = premiumSeedIndexes.has(index) ? "premium" : undefined;
  return {
    id: seed.id,
    name: seed.name,
    category: seed.category,
    rating: Number((4.2 + ((index * 3) % 8) / 10).toFixed(1)),
    reviewCount: 8 + (index * 17) % 131,
    distanceKm: Number((2.3 + index * 0.16).toFixed(1)),
    isOpen: index % 5 !== 0,
    address: `${streetTypes[index % streetTypes.length]} ${34 + (index * 3) % 39} # ${18 + (index * 5) % 24}-${10 + (index * 7) % 80}, ${seed.sector}, Palmira`,
    image: `https://images.unsplash.com/${categoryImages[seed.category] ?? "photo-1486406146926-c627a92ad1ab"}?auto=format&fit=crop&w=900&q=85`,
    tags: seed.tags,
    description: seed.description,
    ...(demoContacts[seed.id] ?? {}),
    ...(plan ? { plan } : {}),
    ...(newSeedDates.has(index) ? { createdAt: newSeedDates.get(index) } : {}),
  };
});

const slug = (value: string) => value.toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const demoProducts: Product[] = [];
export const demoServices: Service[] = [];

seeds.forEach((seed, index) => {
  const business = demoBusinesses[index];
  const templates = offerCatalog[seed.category] ?? [];
  const chosen = templates.length <= 2 ? templates : [templates[index % templates.length], templates[(index + 1) % templates.length]];
  chosen.forEach((template) => {
    const id = `${seed.id}-${slug(template.name)}`;
    if (template.kind === "product") {
      demoProducts.push({ id, businessId: seed.id, name: template.name, description: template.description, price: template.price, image: business.image });
    } else {
      demoServices.push({ id, businessId: seed.id, name: template.name, description: template.description, priceLabel: template.priceLabel, image: business.image });
    }
  });
});
